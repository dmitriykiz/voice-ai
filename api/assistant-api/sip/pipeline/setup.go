// Copyright (c) 2023-2025 RapidaAI
// Author: Prashant Srivastav <prashant@rapida.ai>
//
// Licensed under GPL-2.0 with Rapida Additional Terms.
// See LICENSE.md or contact sales@rapida.ai for commercial usage.

package sip_pipeline

import (
	"context"

	sip_infra "github.com/rapidaai/api/assistant-api/sip/infra"
)

// =============================================================================
// Inbound setup handlers (future — called when pipeline owns the full flow)
// =============================================================================

// handleInviteReceived parses SDP and extracts DID from the incoming INVITE.
func (d *Dispatcher) handleInviteReceived(ctx context.Context, v sip_infra.InviteReceivedPipeline) {
	sdpInfo, err := d.server.ParseSDP(v.SDPBody)
	if err != nil {
		d.logger.Warnw("Failed to parse SDP, using defaults", "error", err, "call_id", v.ID)
		pcmu := sip_infra.CodecPCMU
		sdpInfo = &sip_infra.SDPMediaInfo{PreferredCodec: &pcmu}
	}

	did := extractDIDFromURI(v.ToURI)
	if did == "" {
		did = extractDIDFromURI(v.FromURI)
	}

	d.OnPipeline(ctx, sip_infra.RouteResolvedPipeline{
		ID:      v.ID,
		DID:     did,
		SDP:     sdpInfo,
		FromURI: v.FromURI,
		ToURI:   v.ToURI,
		Req:     v.Req,
		Tx:      v.Tx,
	})
}

// handleRouteResolved looks up the assistant by DID.
func (d *Dispatcher) handleRouteResolved(ctx context.Context, v sip_infra.RouteResolvedPipeline) {
	if v.DID == "" {
		d.logger.Warnw("No DID found in INVITE", "call_id", v.ID)
		d.sendReject(v.Tx, v.Req, 404)
		return
	}

	assistantID, auth, err := d.resolveAssistantByDID(v.DID)
	if err != nil {
		d.logger.Warnw("DID lookup failed", "call_id", v.ID, "did", v.DID, "error", err)
		d.sendReject(v.Tx, v.Req, 404)
		return
	}

	d.OnPipeline(ctx, sip_infra.AuthenticatedPipeline{
		ID:          v.ID,
		AssistantID: assistantID,
		Auth:        auth,
		SDP:         v.SDP,
		FromURI:     v.FromURI,
		Req:         v.Req,
		Tx:          v.Tx,
	})
}

// handleAuthenticated is a future extension point for when the pipeline owns session
// creation (RTP allocation, 180/200 OK). Currently server.go handles this via the
// middleware chain, so this handler emits SessionEstablishedPipeline directly.
func (d *Dispatcher) handleAuthenticated(ctx context.Context, v sip_infra.AuthenticatedPipeline) {
	d.logger.Infow("Pipeline: Authenticated",
		"call_id", v.ID,
		"assistant_id", v.AssistantID)

	// Future: session creation, RTP allocation, 180/200 will happen here.
	// For now, server.go handles SIP protocol and emits SessionEstablishedPipeline
	// directly via onInvite, so this handler is only reached in the future
	// pipeline-native path.
}
