// Copyright (c) 2023-2025 RapidaAI
// Author: Prashant Srivastav <prashant@rapida.ai>
//
// Licensed under GPL-2.0 with Rapida Additional Terms.
// See LICENSE.md or contact sales@rapida.ai for commercial usage.

package sip_infra

import (
	"context"
	"errors"
	"fmt"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/emiago/sipgo"
	"github.com/emiago/sipgo/sip"
	"github.com/rapidaai/pkg/commons"
)

// Registration errors
var (
	ErrRegistrationFailed  = errors.New("SIP registration failed")
	ErrRegistrationExpired = errors.New("SIP registration expired")
	ErrDIDNotRegistered    = errors.New("DID is not registered")
	ErrMissingDID          = errors.New("DID is required for registration")
	ErrMissingServer       = errors.New("SIP server is required for registration")
)

const (
	defaultRegisterExpiry  = 3600 // seconds
	renewalFraction        = 0.8  // re-register at 80% of expiry
	defaultRegisterTimeout = 10 * time.Second
	renewRetryInterval     = 30 * time.Second
)

// Registration describes a SIP registration to be maintained with an external registrar.
type Registration struct {
	DID         string  // Phone number / DID being registered (e.g., "+15551234567")
	Config      *Config // SIP provider credentials (server, username, password, realm, domain)
	AssistantID uint64  // Assistant that owns this DID
	ExpiresIn   int     // Desired registration duration in seconds (0 = use default)
}

// Validate checks that the registration has the minimum required fields.
func (r *Registration) Validate() error {
	if r.DID == "" {
		return ErrMissingDID
	}
	if r.Config == nil || r.Config.Server == "" {
		return ErrMissingServer
	}
	return nil
}

// activeRegistration tracks a live registration and its renewal timer.
type activeRegistration struct {
	reg       *Registration
	cancel    context.CancelFunc
	expiresAt time.Time
}

// RegistrationClient manages outbound SIP REGISTER transactions.
// Each registration is maintained with periodic renewal and supports digest auth.
// Thread-safe: all methods can be called concurrently.
type RegistrationClient struct {
	client       *sipgo.Client
	listenConfig *ListenConfig
	logger       commons.Logger

	mu            sync.RWMutex
	registrations map[string]*activeRegistration // keyed by DID
}

// NewRegistrationClient creates a registration client using the shared sipgo client.
func NewRegistrationClient(client *sipgo.Client, listenConfig *ListenConfig, logger commons.Logger) *RegistrationClient {
	return &RegistrationClient{
		client:        client,
		listenConfig:  listenConfig,
		logger:        logger,
		registrations: make(map[string]*activeRegistration),
	}
}

// Register sends a REGISTER request and maintains the registration with periodic renewal.
// Handles 401/407 digest auth challenges automatically via sipgo's DoDigestAuth.
// Idempotent: calling Register for an already-registered DID replaces the existing registration.
func (rc *RegistrationClient) Register(ctx context.Context, reg *Registration) error {
	if err := reg.Validate(); err != nil {
		return err
	}

	expiresIn := reg.ExpiresIn
	if expiresIn <= 0 {
		expiresIn = defaultRegisterExpiry
	}

	grantedExpiry, err := rc.sendRegister(ctx, reg, expiresIn)
	if err != nil {
		return fmt.Errorf("%w: DID %s at %s: %v", ErrRegistrationFailed, reg.DID, reg.Config.Server, err)
	}

	// Store active registration and start renewal loop.
	// Cancel any existing registration for this DID first (idempotent replace).
	regCtx, cancelReg := context.WithCancel(ctx)

	rc.mu.Lock()
	if existing, ok := rc.registrations[reg.DID]; ok {
		existing.cancel()
	}
	rc.registrations[reg.DID] = &activeRegistration{
		reg:       reg,
		cancel:    cancelReg,
		expiresAt: time.Now().Add(time.Duration(grantedExpiry) * time.Second),
	}
	rc.mu.Unlock()

	go rc.renewLoop(regCtx, reg, grantedExpiry)

	rc.logger.Infow("SIP registration active",
		"did", reg.DID,
		"server", reg.Config.Server,
		"assistant_id", reg.AssistantID,
		"expires_in", grantedExpiry)

	return nil
}

// Unregister sends a REGISTER with Expires: 0 to remove the registration.
// Idempotent: returns nil if the DID is not registered.
func (rc *RegistrationClient) Unregister(ctx context.Context, did string) error {
	rc.mu.Lock()
	active, ok := rc.registrations[did]
	if ok {
		active.cancel()
		delete(rc.registrations, did)
	}
	rc.mu.Unlock()

	if !ok {
		return nil
	}

	unregCtx, cancel := contextWithTimeout(ctx, defaultRegisterTimeout)
	defer cancel()

	if _, err := rc.sendRegister(unregCtx, active.reg, 0); err != nil {
		rc.logger.Warnw("Failed to send REGISTER Expires:0",
			"did", did,
			"error", err)
		return err
	}

	rc.logger.Infow("SIP registration removed", "did", did)
	return nil
}

// UnregisterAll unregisters all active registrations. Called during shutdown.
func (rc *RegistrationClient) UnregisterAll(ctx context.Context) {
	rc.mu.RLock()
	dids := make([]string, 0, len(rc.registrations))
	for did := range rc.registrations {
		dids = append(dids, did)
	}
	rc.mu.RUnlock()

	for _, did := range dids {
		if err := rc.Unregister(ctx, did); err != nil {
			rc.logger.Warnw("Shutdown: failed to unregister DID",
				"did", did,
				"error", err)
		}
	}
}

// IsRegistered returns true if the given DID has an active registration.
func (rc *RegistrationClient) IsRegistered(did string) bool {
	rc.mu.RLock()
	defer rc.mu.RUnlock()
	_, ok := rc.registrations[did]
	return ok
}

// ActiveCount returns the number of active registrations.
func (rc *RegistrationClient) ActiveCount() int {
	rc.mu.RLock()
	defer rc.mu.RUnlock()
	return len(rc.registrations)
}

// GetRegisteredDIDs returns all currently registered DIDs.
func (rc *RegistrationClient) GetRegisteredDIDs() []string {
	rc.mu.RLock()
	defer rc.mu.RUnlock()
	dids := make([]string, 0, len(rc.registrations))
	for did := range rc.registrations {
		dids = append(dids, did)
	}
	return dids
}

// sendRegister constructs and sends a REGISTER request, handling digest auth if challenged.
// Returns the granted expiry from the 200 OK response.
func (rc *RegistrationClient) sendRegister(ctx context.Context, reg *Registration, expiresIn int) (int, error) {
	cfg := reg.Config

	domain := cfg.Domain
	if domain == "" {
		domain = cfg.Server
	}

	scheme := "sip"
	if cfg.Transport == TransportTLS {
		scheme = "sips"
	}

	// Request-URI: the registrar address
	registrar := sip.Uri{
		Scheme: scheme,
		Host:   cfg.Server,
		Port:   cfg.Port,
	}

	req := sip.NewRequest(sip.REGISTER, registrar)

	// To/From: the AOR (Address of Record) being registered.
	// Per RFC 3261 §10.2, To and From are identical for REGISTER.
	aor := sip.Uri{
		Scheme: scheme,
		User:   normalizeUser(reg.DID),
		Host:   domain,
	}

	toHdr := &sip.ToHeader{Address: aor}
	fromHdr := &sip.FromHeader{
		Address: aor,
		Params:  sip.NewParams(),
	}
	fromHdr.Params.Add("tag", sip.GenerateTagN(16))

	req.AppendHeader(toHdr)
	req.AppendHeader(fromHdr)

	// Contact: where the registrar should route INVITEs for this DID
	externalIP := rc.listenConfig.GetExternalIP()
	contactHdr := &sip.ContactHeader{
		Address: sip.Uri{
			Scheme: scheme,
			User:   normalizeUser(reg.DID),
			Host:   externalIP,
			Port:   rc.listenConfig.Port,
		},
	}
	req.AppendHeader(contactHdr)

	// Expires
	expiresHdr := sip.ExpiresHeader(expiresIn)
	req.AppendHeader(&expiresHdr)

	// CSeq
	req.AppendHeader(&sip.CSeqHeader{SeqNo: 1, MethodName: sip.REGISTER})

	// Call-ID (unique per registration binding per RFC 3261 §10.2)
	callID := sip.CallIDHeader(fmt.Sprintf("reg-%s-%d", reg.DID, time.Now().UnixNano()))
	req.AppendHeader(&callID)

	// Max-Forwards
	maxFwd := sip.MaxForwardsHeader(70)
	req.AppendHeader(&maxFwd)

	// Apply timeout — respect parent context deadline if shorter
	reqCtx, cancel := contextWithTimeout(ctx, defaultRegisterTimeout)
	defer cancel()

	rc.logger.Debugw("Sending REGISTER",
		"did", reg.DID,
		"registrar", registrar.String(),
		"contact", contactHdr.Address.String(),
		"expires", expiresIn)

	resp, err := rc.client.Do(reqCtx, req)
	if err != nil {
		return 0, fmt.Errorf("transport error: %w", err)
	}

	// Handle digest auth challenges (401 WWW-Authenticate / 407 Proxy-Authenticate)
	if resp.StatusCode == 401 || resp.StatusCode == 407 {
		rc.logger.Debugw("REGISTER auth challenge",
			"did", reg.DID,
			"status", resp.StatusCode)

		resp, err = rc.client.DoDigestAuth(reqCtx, req, resp, sipgo.DigestAuth{
			Username: cfg.Username,
			Password: cfg.Password,
		})
		if err != nil {
			return 0, fmt.Errorf("digest auth failed: %w", err)
		}
	}

	if resp.StatusCode != 200 {
		return 0, fmt.Errorf("rejected with %d %s", resp.StatusCode, resp.Reason)
	}

	// Parse granted expiry — registrar may shorten our requested duration
	grantedExpiry := expiresIn
	if hdr := resp.GetHeader("Expires"); hdr != nil {
		if parsed, err := strconv.Atoi(strings.TrimSpace(hdr.Value())); err == nil && parsed > 0 {
			grantedExpiry = parsed
		}
	}

	return grantedExpiry, nil
}

// renewLoop periodically re-registers before the registration expires.
// Re-registers at renewalFraction (80%) of the granted expiry time.
// On failure, retries every renewRetryInterval (30s) until successful or cancelled.
func (rc *RegistrationClient) renewLoop(ctx context.Context, reg *Registration, expiresIn int) {
	renewInterval := time.Duration(float64(expiresIn)*renewalFraction) * time.Second
	timer := time.NewTimer(renewInterval)
	defer timer.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-timer.C:
			renewCtx, cancel := contextWithTimeout(ctx, defaultRegisterTimeout)
			grantedExpiry, err := rc.sendRegister(renewCtx, reg, expiresIn)
			cancel()

			if err != nil {
				rc.logger.Warnw("Re-registration failed",
					"did", reg.DID,
					"error", err,
					"retry_in", renewRetryInterval)
				timer.Reset(renewRetryInterval)
				continue
			}

			rc.mu.Lock()
			if active, ok := rc.registrations[reg.DID]; ok {
				active.expiresAt = time.Now().Add(time.Duration(grantedExpiry) * time.Second)
			}
			rc.mu.Unlock()

			renewInterval = time.Duration(float64(grantedExpiry)*renewalFraction) * time.Second
			timer.Reset(renewInterval)

			rc.logger.Debugw("Re-registration successful",
				"did", reg.DID,
				"granted_expiry", grantedExpiry,
				"next_renewal_in", renewInterval)
		}
	}
}

// contextWithTimeout creates a context with the given timeout, but respects
// the parent context's deadline if it is sooner. This follows the LiveKit
// pattern of never extending beyond the caller's deadline.
func contextWithTimeout(parent context.Context, timeout time.Duration) (context.Context, context.CancelFunc) {
	if deadline, ok := parent.Deadline(); ok {
		remaining := time.Until(deadline)
		if remaining < timeout {
			timeout = remaining
		}
	}
	return context.WithTimeout(parent, timeout)
}

// normalizeUser strips the "+" prefix from a DID for the SIP URI user part.
// Some registrars reject "+" in the userinfo field.
func normalizeUser(did string) string {
	return strings.TrimPrefix(did, "+")
}
