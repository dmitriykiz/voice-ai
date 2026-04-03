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

// handleSessionEstablished is the convergence point for inbound and outbound calls.
// By this stage the session is created, RTP is allocated, and the call is answered.
//
// Steps:
//  1. Create conversation via onCallSetup
//  2. Create streamer + talker via onCallStart (blocking, runs in goroutine)
func (d *Dispatcher) handleSessionEstablished(ctx context.Context, v sip_infra.SessionEstablishedPipeline) {
	d.logger.Infow("Pipeline: SessionEstablished",
		"call_id", v.ID,
		"direction", v.Direction,
		"assistant_id", v.AssistantID)

	if d.onCallSetup == nil || d.onCallStart == nil {
		d.logger.Error("Pipeline: callbacks not configured", "call_id", v.ID)
		d.OnPipeline(ctx, sip_infra.CallFailedPipeline{
			ID:    v.ID,
			Error: sip_infra.ErrConnectionFailed,
		})
		return
	}

	// Create conversation
	setup, err := d.onCallSetup(ctx, v.Session, v.Auth, v.AssistantID, v.FromURI, string(v.Direction))
	if err != nil {
		d.logger.Error("Pipeline: call setup failed", "call_id", v.ID, "error", err)
		d.OnPipeline(ctx, sip_infra.CallFailedPipeline{ID: v.ID, Error: err})
		return
	}

	// Create and store observer for this call (DB + exporters)
	if d.onCreateObserver != nil {
		obs := d.onCreateObserver(ctx, setup, v.Auth)
		if obs != nil {
			d.storeObserver(v.ID, obs)
		}
	}

	d.OnPipeline(ctx,
		sip_infra.CallStartedPipeline{ID: v.ID, Session: v.Session},
		sip_infra.EventEmittedPipeline{ID: v.ID, Event: "call_started", Data: map[string]string{
			"direction": string(v.Direction),
		}},
	)

	// Run streamer + talker.Talk in a goroutine (blocking for call duration).
	go func() {
		defer func() {
			if r := recover(); r != nil {
				d.logger.Error("Pipeline: onCallStart panicked", "call_id", v.ID, "panic", r)
			}
			d.OnPipeline(ctx, sip_infra.CallEndedPipeline{
				ID:     v.ID,
				Reason: "talk_completed",
			})
		}()
		d.onCallStart(ctx, v.Session, setup, v.VaultCredential, v.Config, string(v.Direction))
	}()
}

// handleCallStarted logs call start — emitted by handleSessionEstablished.
func (d *Dispatcher) handleCallStarted(ctx context.Context, v sip_infra.CallStartedPipeline) {
	d.logger.Infow("Pipeline: CallStarted", "call_id", v.ID)
}

// handleHoldRequested processes hold/resume from a re-INVITE.
func (d *Dispatcher) handleHoldRequested(ctx context.Context, v sip_infra.HoldRequestedPipeline) {
	action := "hold"
	if !v.IsHold {
		action = "resume"
	}
	d.logger.Infow("Pipeline: HoldRequested", "call_id", v.ID, "action", action)
	d.OnPipeline(ctx, sip_infra.EventEmittedPipeline{ID: v.ID, Event: action})
}

// handleReInviteReceived processes re-INVITE for codec renegotiation (observability).
func (d *Dispatcher) handleReInviteReceived(ctx context.Context, v sip_infra.ReInviteReceivedPipeline) {
	d.logger.Debugw("Pipeline: ReInviteReceived", "call_id", v.ID)
}
