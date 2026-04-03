// Copyright (c) 2023-2025 RapidaAI
// Author: Prashant Srivastav <prashant@rapida.ai>
//
// Licensed under GPL-2.0 with Rapida Additional Terms.
// See LICENSE.md or contact sales@rapida.ai for commercial usage.

package sip_pipeline

import (
	"context"
	"fmt"
	"sync"

	observe "github.com/rapidaai/api/assistant-api/internal/observe"
	sip_infra "github.com/rapidaai/api/assistant-api/sip/infra"
	"github.com/rapidaai/pkg/commons"
	"github.com/rapidaai/pkg/types"
	"github.com/rapidaai/protos"
)

// Channel buffer sizes — tuned per priority tier.
const (
	signalChSize  = 64   // BYE, CANCEL, transfer — small but never blocked
	setupChSize   = 256  // INVITE, route, auth — moderate burst capacity
	mediaChSize   = 256  // RTP, codec, hold — moderate burst capacity
	controlChSize = 512  // metrics, CDR, events — highest volume, lowest priority
)

// callEnvelope bundles a pipeline stage with its originating context
// so cancellation signals propagate through the pipeline.
type callEnvelope struct {
	ctx context.Context
	p   sip_infra.Pipeline
}

// Dispatcher routes SIP pipeline stages to priority-based channel goroutines.
// Each channel has a dedicated consumer so no tier can stall another.
//
// Priority:
//
//	signal  — BYE, CANCEL, transfer                     (preempts everything)
//	setup   — INVITE, route, auth, session creation      (call setup)
//	media   — RTP, codec negotiation, hold/resume        (media path)
//	control — metrics, CDR, events, recording, DTMF      (background work)
type Dispatcher struct {
	mu     sync.RWMutex
	logger commons.Logger

	signalCh  chan callEnvelope
	setupCh   chan callEnvelope
	mediaCh   chan callEnvelope
	controlCh chan callEnvelope

	// Per-call observer store — maps callID to ConversationObserver.
	// Populated by handleSessionEstablished after onCallSetup succeeds.
	// Used by all handlers to emit events/metrics/metadata (DB + exporters).
	// Removed by handleCallEnded.
	observers map[string]*observe.ConversationObserver

	// Dependencies injected by SIPEngine
	server             *sip_infra.Server
	registrationClient *sip_infra.RegistrationClient

	// Callbacks — injected by SIPEngine for operations requiring DB/vault/services.
	didResolver     DIDResolverFunc
	onCallSetup     OnCallSetupFunc
	onCallStart     OnCallStartFunc
	onCallEnd       OnCallEndFunc
	onCreateObserver OnCreateObserverFunc

	// Pluggable stages — nil means skip
	// callScreener  CallScreener
	// ivrHandler    IVRHandler
	// dtmfRouter    DTMFRouter
	// recorder      CallRecorder
	// transferAgent TransferAgent
	// callQueue     CallQueue
}


// DIDResolverFunc resolves a DID to an assistant ID and auth principal.
type DIDResolverFunc func(did string) (assistantID uint64, auth types.SimplePrinciple, err error)

// OnCallSetupFunc creates a conversation and returns a CallContext.
// Called by handleAuthenticated after the assistant is resolved.
type OnCallSetupFunc func(ctx context.Context, session *sip_infra.Session, auth types.SimplePrinciple, assistantID uint64, fromURI string, direction string) (*CallSetupResult, error)

// CallSetupResult carries the output of OnCallSetupFunc into the pipeline.
type CallSetupResult struct {
	ConversationID      uint64
	AssistantProviderId uint64
	AuthToken           string
	AuthType            string
	ProjectID           uint64
	OrganizationID      uint64
}

// OnCallStartFunc creates a streamer and talker, then runs talker.Talk (blocking).
// Called by handleSessionEstablished.
type OnCallStartFunc func(ctx context.Context, session *sip_infra.Session, setup *CallSetupResult, vaultCred interface{}, sipConfig *sip_infra.Config, direction string)

// OnCallEndFunc cleans up a call (cancel context, release session from map).
type OnCallEndFunc func(callID string)

// OnCreateObserverFunc creates a ConversationObserver for a call after setup.
// SIPEngine implements this using the conversation service + telemetry providers.
type OnCreateObserverFunc func(ctx context.Context, setup *CallSetupResult, auth types.SimplePrinciple) *observe.ConversationObserver

// DispatcherConfig holds dependencies for creating a Dispatcher.
type DispatcherConfig struct {
	Logger             commons.Logger
	Server             *sip_infra.Server
	RegistrationClient *sip_infra.RegistrationClient
	DIDResolver        DIDResolverFunc
	OnCallSetup        OnCallSetupFunc
	OnCallStart        OnCallStartFunc
	OnCallEnd          OnCallEndFunc
	OnCreateObserver   OnCreateObserverFunc
}

// NewDispatcher creates a SIP call pipeline dispatcher.
func NewDispatcher(cfg *DispatcherConfig) *Dispatcher {
	return &Dispatcher{
		logger:             cfg.Logger,
		server:             cfg.Server,
		registrationClient: cfg.RegistrationClient,
		observers:          make(map[string]*observe.ConversationObserver),
		didResolver:        cfg.DIDResolver,
		onCallSetup:        cfg.OnCallSetup,
		onCallStart:        cfg.OnCallStart,
		onCallEnd:          cfg.OnCallEnd,
		onCreateObserver:   cfg.OnCreateObserver,
		signalCh:           make(chan callEnvelope, signalChSize),
		setupCh:            make(chan callEnvelope, setupChSize),
		mediaCh:            make(chan callEnvelope, mediaChSize),
		controlCh:          make(chan callEnvelope, controlChSize),
	}
}

// storeObserver creates and stores a ConversationObserver for a call.
// Called by handleSessionEstablished after onCallSetup succeeds.
func (d *Dispatcher) storeObserver(callID string, obs *observe.ConversationObserver) {
	d.mu.Lock()
	d.observers[callID] = obs
	d.mu.Unlock()
}

// getObserver retrieves the ConversationObserver for a call.
func (d *Dispatcher) getObserver(callID string) (*observe.ConversationObserver, bool) {
	d.mu.RLock()
	obs, ok := d.observers[callID]
	d.mu.RUnlock()
	return obs, ok
}

// removeObserver removes and shuts down the observer for a call.
func (d *Dispatcher) removeObserver(ctx context.Context, callID string) {
	d.mu.Lock()
	obs, ok := d.observers[callID]
	if ok {
		delete(d.observers, callID)
	}
	d.mu.Unlock()

	if ok && obs != nil {
		obs.Shutdown(ctx)
	}
}

// emitEvent writes a SIP event via the call's ConversationObserver (DB + exporters).
// No-op if no observer exists for this call (pre-conversation stages).
func (d *Dispatcher) emitEvent(ctx context.Context, callID, name string, data map[string]string) {
	obs, ok := d.getObserver(callID)
	if !ok {
		return
	}
	obs.EmitEvent(ctx, name, data)
}

// emitMetric writes SIP metrics via the call's ConversationObserver (DB + exporters).
func (d *Dispatcher) emitMetric(ctx context.Context, callID string, metrics []*protos.Metric) {
	if len(metrics) == 0 {
		return
	}
	obs, ok := d.getObserver(callID)
	if !ok {
		return
	}
	obs.EmitMetric(ctx, metrics)
}

// Start launches the four dispatcher goroutines. Call before any OnPipeline calls.
func (d *Dispatcher) Start(ctx context.Context) {
	go d.runSignalDispatcher(ctx)
	go d.runSetupDispatcher(ctx)
	go d.runMediaDispatcher(ctx)
	go d.runControlDispatcher(ctx)

	d.logger.Infow("SIP pipeline dispatcher started")
}

// OnPipeline enqueues pipeline stages into the appropriate priority channel.
// Handlers call this to emit the next stage, forming chains without explicit wiring.
func (d *Dispatcher) OnPipeline(ctx context.Context, stages ...sip_infra.Pipeline) {
	for _, s := range stages {
		e := callEnvelope{ctx: ctx, p: s}
		switch s.(type) {
		// Signal — BYE, CANCEL, transfer (preempts everything)
		case sip_infra.ByeReceivedPipeline,
			sip_infra.CancelReceivedPipeline,
			sip_infra.TransferRequestedPipeline,
			sip_infra.CallEndedPipeline,
			sip_infra.CallFailedPipeline:
			d.signalCh <- e

		// Setup — INVITE, routing, auth
		case sip_infra.InviteReceivedPipeline,
			sip_infra.RouteResolvedPipeline,
			sip_infra.AuthenticatedPipeline,
			sip_infra.OutboundRequestedPipeline,
			sip_infra.InviteSentPipeline,
			sip_infra.AnswerReceivedPipeline:
			d.setupCh <- e

		// Media — session, RTP, codec, hold
		case sip_infra.SessionEstablishedPipeline,
			sip_infra.CallStartedPipeline,
			sip_infra.HoldRequestedPipeline,
			sip_infra.ReInviteReceivedPipeline:
			d.mediaCh <- e

		// Control — metrics, events, recording, DTMF, registration
		case sip_infra.EventEmittedPipeline,
			sip_infra.MetricEmittedPipeline,
			sip_infra.RecordingStartedPipeline,
			sip_infra.DTMFReceivedPipeline,
			sip_infra.RegisterRequestedPipeline,
			sip_infra.RegisterActivePipeline,
			sip_infra.RegisterFailedPipeline,
			sip_infra.RegisterExpiringPipeline:
			d.controlCh <- e

		default:
			d.logger.Warnw("OnPipeline: unrouted pipeline type, falling back to setupCh", "type", fmt.Sprintf("%T", s))
			d.setupCh <- e
		}
	}
}

// =============================================================================
// Dispatcher goroutines — one per priority tier
// =============================================================================

func (d *Dispatcher) runSignalDispatcher(ctx context.Context) {
	for {
		select {
		case <-ctx.Done():
			d.drain(d.signalCh)
			return
		case e := <-d.signalCh:
			d.dispatch(e.ctx, e.p)
		}
	}
}

func (d *Dispatcher) runSetupDispatcher(ctx context.Context) {
	for {
		select {
		case <-ctx.Done():
			d.drain(d.setupCh)
			return
		case e := <-d.setupCh:
			d.dispatch(e.ctx, e.p)
		}
	}
}

func (d *Dispatcher) runMediaDispatcher(ctx context.Context) {
	for {
		select {
		case <-ctx.Done():
			d.drain(d.mediaCh)
			return
		case e := <-d.mediaCh:
			d.dispatch(e.ctx, e.p)
		}
	}
}

func (d *Dispatcher) runControlDispatcher(ctx context.Context) {
	for {
		select {
		case <-ctx.Done():
			d.drain(d.controlCh)
			return
		case e := <-d.controlCh:
			d.dispatch(e.ctx, e.p)
		}
	}
}

// drain processes remaining items in a channel after context cancellation.
func (d *Dispatcher) drain(ch chan callEnvelope) {
	for {
		select {
		case e := <-ch:
			d.dispatch(e.ctx, e.p)
		default:
			return
		}
	}
}

// =============================================================================
// dispatch — routes a single pipeline stage to its handler
// =============================================================================

func (d *Dispatcher) dispatch(ctx context.Context, p sip_infra.Pipeline) {
	switch v := p.(type) {
	// Setup handlers
	case sip_infra.InviteReceivedPipeline:
		d.handleInviteReceived(ctx, v)
	case sip_infra.RouteResolvedPipeline:
		d.handleRouteResolved(ctx, v)
	case sip_infra.AuthenticatedPipeline:
		d.handleAuthenticated(ctx, v)
	case sip_infra.OutboundRequestedPipeline:
		d.handleOutboundRequested(ctx, v)
	case sip_infra.InviteSentPipeline:
		d.handleInviteSent(ctx, v)
	case sip_infra.AnswerReceivedPipeline:
		d.handleAnswerReceived(ctx, v)

	// Media handlers
	case sip_infra.SessionEstablishedPipeline:
		d.handleSessionEstablished(ctx, v)
	case sip_infra.CallStartedPipeline:
		d.handleCallStarted(ctx, v)
	case sip_infra.HoldRequestedPipeline:
		d.handleHoldRequested(ctx, v)
	case sip_infra.ReInviteReceivedPipeline:
		d.handleReInviteReceived(ctx, v)

	// Signal handlers
	case sip_infra.ByeReceivedPipeline:
		d.handleByeReceived(ctx, v)
	case sip_infra.CancelReceivedPipeline:
		d.handleCancelReceived(ctx, v)
	case sip_infra.TransferRequestedPipeline:
		d.handleTransferRequested(ctx, v)
	case sip_infra.CallEndedPipeline:
		d.handleCallEnded(ctx, v)
	case sip_infra.CallFailedPipeline:
		d.handleCallFailed(ctx, v)

	// Control handlers
	case sip_infra.EventEmittedPipeline:
		d.handleEventEmitted(ctx, v)
	case sip_infra.MetricEmittedPipeline:
		d.handleMetricEmitted(ctx, v)
	case sip_infra.RecordingStartedPipeline:
		d.handleRecordingStarted(ctx, v)
	case sip_infra.DTMFReceivedPipeline:
		d.handleDTMFReceived(ctx, v)
	case sip_infra.RegisterRequestedPipeline:
		d.handleRegisterRequested(ctx, v)
	case sip_infra.RegisterActivePipeline:
		d.handleRegisterActive(ctx, v)
	case sip_infra.RegisterFailedPipeline:
		d.handleRegisterFailed(ctx, v)
	case sip_infra.RegisterExpiringPipeline:
		d.handleRegisterExpiring(ctx, v)

	default:
		d.logger.Warnw("dispatch: unknown pipeline type", "type", fmt.Sprintf("%T", p))
	}
}
