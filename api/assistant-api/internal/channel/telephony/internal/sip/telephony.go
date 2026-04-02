// Copyright (c) 2023-2025 RapidaAI
// Author: Prashant Srivastav <prashant@rapida.ai>
//
// Licensed under GPL-2.0 with Rapida Additional Terms.
// See LICENSE.md or contact sales@rapida.ai for commercial usage.

package internal_sip_telephony

import (
	"context"
	"encoding/json"
	"fmt"
	"net"
	"net/http"
	"strconv"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/rapidaai/api/assistant-api/config"
	internal_type "github.com/rapidaai/api/assistant-api/internal/type"
	sip_infra "github.com/rapidaai/api/assistant-api/sip/infra"
	"github.com/rapidaai/pkg/commons"
	"github.com/rapidaai/pkg/types"
	"github.com/rapidaai/pkg/utils"
	"github.com/rapidaai/protos"
)

const sipProvider = "sip"
const defaultOutboundSIPPort = 5060

// sipTelephony implements the Telephony interface for native SIP
type sipTelephony struct {
	appCfg       *config.AssistantConfig
	logger       commons.Logger
	sharedServer *sip_infra.Server // Shared SIP server for outbound calls (injected from SIPManager)
}

// NewSIPTelephony creates a new SIP telephony provider.
// sipServer is the shared SIP server instance from SIPManager used for outbound calls.
func NewSIPTelephony(cfg *config.AssistantConfig, logger commons.Logger, sipServer *sip_infra.Server) (internal_type.Telephony, error) {
	return &sipTelephony{
		appCfg:       cfg,
		logger:       logger,
		sharedServer: sipServer,
	}, nil
}

// parseConfig extracts SIP credentials from vault and overlays platform
// operational settings (port, transport, RTP range) from app config.
func (t *sipTelephony) parseConfig(vaultCredential *protos.VaultCredential) (*sip_infra.Config, error) {
	if vaultCredential == nil || vaultCredential.GetValue() == nil {
		return nil, fmt.Errorf("vault credential is required")
	}

	credMap := vaultCredential.GetValue().AsMap()
	cfg := &sip_infra.Config{}

	// Extract server and port from sip_uri (e.g. "sip:192.168.1.5:5060")
	if sipURI, ok := credMap["sip_uri"].(string); ok && sipURI != "" {
		uri := strings.TrimPrefix(strings.TrimPrefix(sipURI, "sips:"), "sip:")
		host, portStr, err := net.SplitHostPort(uri)
		if err != nil {
			// No port in URI, treat entire string as host
			cfg.Server = uri
		} else {
			cfg.Server = host
			if p, err := strconv.Atoi(portStr); err == nil {
				cfg.Port = p
			}
		}
	}

	// sip_server overrides sip_uri
	if server, ok := credMap["sip_server"].(string); ok && server != "" {
		cfg.Server = server
	}
	if cfg.Port <= 0 {
		if port := t.parsePort(credMap["sip_port"]); port > 0 {
			cfg.Port = port
		}
	}
	if username, ok := credMap["sip_username"].(string); ok {
		cfg.Username = username
	}
	if password, ok := credMap["sip_password"].(string); ok {
		cfg.Password = password
	}
	if realm, ok := credMap["sip_realm"].(string); ok {
		cfg.Realm = realm
	}
	if domain, ok := credMap["sip_domain"].(string); ok {
		cfg.Domain = domain
	}

	// Custom SIP headers are stored as a JSON string in vault
	if headersRaw, ok := credMap["sip_headers"].(string); ok && headersRaw != "" {
		parsed := make(map[string]string)
		if err := json.Unmarshal([]byte(headersRaw), &parsed); err == nil {
			cfg.CustomHeaders = parsed
		} else {
			t.logger.Warnw("failed to parse sip_headers JSON", "raw", headersRaw, "error", err)
		}
	}

	// Default outbound port — distinct from SIP__PORT (local server bind)
	if cfg.Port <= 0 {
		cfg.Port = defaultOutboundSIPPort
	}

	// --- Platform operational settings (from app config) ---
	if t.appCfg.SIPConfig != nil {
		cfg.ApplyOperationalDefaults(
			t.appCfg.SIPConfig.Port,
			sip_infra.Transport(t.appCfg.SIPConfig.Transport),
			t.appCfg.SIPConfig.RTPPortRangeStart,
			t.appCfg.SIPConfig.RTPPortRangeEnd,
		)
	}

	if err := cfg.Validate(); err != nil {
		return nil, err
	}

	return cfg, nil
}

// parsePort normalizes a loosely-typed port value (JSON float64 or string) into a valid TCP port or 0.
func (t *sipTelephony) parsePort(v any) int {
	var port int
	switch p := v.(type) {
	case float64:
		port = int(p)
	case string:
		port, _ = strconv.Atoi(p)
	default:
		return 0
	}
	if port > 0 && port <= 65535 {
		return port
	}
	return 0
}

// StatusCallback handles status callbacks from SIP events
func (t *sipTelephony) StatusCallback(
	c *gin.Context,
	auth types.SimplePrinciple,
	assistantId uint64,
	assistantConversationId uint64,
) (*internal_type.StatusInfo, error) {
	body, err := c.GetRawData()
	if err != nil {
		t.logger.Error("Failed to read SIP status callback body", "error", err)
		return nil, fmt.Errorf("failed to read request body")
	}

	var payload map[string]interface{}
	if err := json.Unmarshal(body, &payload); err != nil {
		t.logger.Error("Failed to parse SIP status callback", "error", err)
		return nil, fmt.Errorf("failed to parse request body")
	}

	eventType, _ := payload["event"].(string)
	callID, _ := payload["call_id"].(string)

	t.logger.Debug("SIP status callback received",
		"event", eventType,
		"call_id", callID,
		"assistant_id", assistantId,
		"conversation_id", assistantConversationId)

	return &internal_type.StatusInfo{Event: eventType, Payload: payload}, nil
}

// CatchAllStatusCallback handles catch-all status callbacks
func (t *sipTelephony) CatchAllStatusCallback(ctx *gin.Context) (*internal_type.StatusInfo, error) {
	return nil, nil
}

// OutboundCall initiates an outbound SIP call
func (t *sipTelephony) OutboundCall(
	auth types.SimplePrinciple,
	toPhone string,
	fromPhone string,
	assistantId, assistantConversationId uint64,
	vaultCredential *protos.VaultCredential,
	opts utils.Option,
) (*internal_type.CallInfo, error) {
	info := &internal_type.CallInfo{Provider: sipProvider}

	cfg, err := t.parseConfig(vaultCredential)
	if err != nil {
		info.Status = "FAILED"
		info.ErrorMessage = fmt.Sprintf("config error: %s", err.Error())
		return info, err
	}

	// Validate shared server is available and running
	if t.sharedServer == nil {
		info.Status = "FAILED"
		info.ErrorMessage = "SIP server not initialized"
		return info, fmt.Errorf("shared SIP server not available")
	}
	if !t.sharedServer.IsRunning() {
		info.Status = "FAILED"
		info.ErrorMessage = "SIP server not running"
		return info, fmt.Errorf("shared SIP server is not running")
	}

	// Initiate outbound call via the shared SIP server.
	// Pass metadata upfront so it is set on the session BEFORE the
	// handleOutboundDialog goroutine starts. On fast LANs the 200 OK
	// can arrive before MakeCall returns, causing handleOutboundAnswered
	// to fail with "outbound session missing assistant_id metadata".
	callMetadata := map[string]interface{}{
		"assistant_id":    assistantId,
		"conversation_id": assistantConversationId,
		"to_phone":        toPhone,
		"auth":            auth,
		"sip_config":      cfg,
	}
	session, err := t.sharedServer.MakeCall(context.Background(), cfg, toPhone, fromPhone, callMetadata)
	if err != nil {
		info.Status = "FAILED"
		info.ErrorMessage = fmt.Sprintf("call error: %s", err.Error())
		return info, err
	}

	t.logger.Info("SIP outbound call initiated",
		"to", toPhone,
		"from", fromPhone,
		"call_id", session.GetCallID(),
		"assistant_id", assistantId,
		"conversation_id", assistantConversationId)

	info.ChannelUUID = session.GetCallID()
	info.Status = "SUCCESS"
	info.StatusInfo = internal_type.StatusInfo{
		Event: "initiated",
		Payload: map[string]interface{}{
			"to":              toPhone,
			"from":            fromPhone,
			"call_id":         session.GetCallID(),
			"assistant_id":    assistantId,
			"conversation_id": assistantConversationId,
		},
	}
	info.Extra = map[string]string{
		"telephony.status": "initiated",
	}
	return info, nil
}

// InboundCall handles incoming SIP calls
func (t *sipTelephony) InboundCall(
	c *gin.Context,
	auth types.SimplePrinciple,
	assistantId uint64,
	clientNumber string,
	assistantConversationId uint64,
) error {
	// For native SIP, inbound calls are handled directly by the SIP server
	// This endpoint just returns a confirmation
	c.JSON(http.StatusOK, gin.H{
		"status":          "ready",
		"assistant_id":    assistantId,
		"conversation_id": assistantConversationId,
		"client_number":   clientNumber,
		"message":         "SIP inbound call ready - connect via SIP signaling",
	})
	return nil
}

// ReceiveCall processes incoming call webhook data
func (t *sipTelephony) ReceiveCall(c *gin.Context) (*internal_type.CallInfo, error) {
	clientNumber := c.Query("from")
	if clientNumber == "" {
		clientNumber = c.Query("caller")
	}
	if clientNumber == "" {
		return nil, fmt.Errorf("missing caller information")
	}

	// Snapshot query params for the status payload
	queryParams := make(map[string]string, len(c.Request.URL.Query()))
	for key, values := range c.Request.URL.Query() {
		queryParams[key] = values[0]
	}

	info := &internal_type.CallInfo{
		CallerNumber: clientNumber,
		Provider:     sipProvider,
		Status:       "SUCCESS",
		StatusInfo:   internal_type.StatusInfo{Event: "webhook", Payload: queryParams},
	}
	if callID := c.Query("call_id"); callID != "" {
		info.ChannelUUID = callID
	}
	return info, nil
}
