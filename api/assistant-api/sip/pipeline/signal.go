// Copyright (c) 2023-2025 RapidaAI
// Author: Prashant Srivastav <prashant@rapida.ai>
//
// Licensed under GPL-2.0 with Rapida Additional Terms.
// See LICENSE.md or contact sales@rapida.ai for commercial usage.

package sip_pipeline

import (
	"context"
	"fmt"

	sip_infra "github.com/rapidaai/api/assistant-api/sip/infra"
	"github.com/rapidaai/protos"
)

// handleByeReceived processes SIP BYE — cancels the call context and cleans up.
func (d *Dispatcher) handleByeReceived(ctx context.Context, v sip_infra.ByeReceivedPipeline) {
	d.logger.Infow("Pipeline: ByeReceived", "call_id", v.ID, "reason", v.Reason)

	d.OnPipeline(ctx,
		sip_infra.CallEndedPipeline{
			ID:     v.ID,
			Reason: "bye",
		},
		sip_infra.EventEmittedPipeline{
			ID:    v.ID,
			Event: "bye_received",
		},
	)
}

// handleCancelReceived processes SIP CANCEL during call setup.
func (d *Dispatcher) handleCancelReceived(ctx context.Context, v sip_infra.CancelReceivedPipeline) {
	d.logger.Infow("Pipeline: CancelReceived", "call_id", v.ID)

	d.OnPipeline(ctx,
		sip_infra.CallEndedPipeline{
			ID:     v.ID,
			Reason: "cancel",
		},
		sip_infra.EventEmittedPipeline{
			ID:    v.ID,
			Event: "cancel_received",
		},
	)
}

// handleTransferRequested processes SIP REFER (call transfer).
func (d *Dispatcher) handleTransferRequested(ctx context.Context, v sip_infra.TransferRequestedPipeline) {
	// TODO: pluggable transfer agent
	// if d.transferAgent != nil { d.transferAgent.Transfer(ctx, v); return }
	d.logger.Warnw("Pipeline: TransferRequested (not supported)",
		"call_id", v.ID,
		"target", v.TargetURI)
}

// handleCallEnded performs final cleanup after a call ends.
func (d *Dispatcher) handleCallEnded(ctx context.Context, v sip_infra.CallEndedPipeline) {
	d.logger.Infow("Pipeline: CallEnded",
		"call_id", v.ID,
		"duration", v.Duration,
		"reason", v.Reason)

	// Persist end-of-call event and metrics to DB
	d.emitEvent(ctx, v.ID, "sip", map[string]string{
		"type":     "call_ended",
		"reason":   v.Reason,
		"duration": v.Duration.String(),
	})

	d.emitMetric(ctx, v.ID, []*protos.Metric{
		{Name: "sip.call_duration_ms", Value: fmt.Sprintf("%d", v.Duration.Milliseconds()), Description: "SIP call duration"},
		{Name: "sip.end_reason", Value: v.Reason, Description: "Call end reason"},
	})

	// Remove call context from store
	d.removeObserver(ctx, v.ID)

	// Delegate cleanup to SIPEngine (cancel context, remove from session map)
	if d.onCallEnd != nil {
		d.onCallEnd(v.ID)
	}
}

// handleCallFailed handles call setup or active call failures.
func (d *Dispatcher) handleCallFailed(ctx context.Context, v sip_infra.CallFailedPipeline) {
	d.logger.Warnw("Pipeline: CallFailed",
		"call_id", v.ID,
		"error", v.Error,
		"sip_code", v.SIPCode)

	d.emitEvent(ctx, v.ID, "sip", map[string]string{
		"type":     "call_failed",
		"error":    fmt.Sprintf("%v", v.Error),
		"sip_code": fmt.Sprintf("%d", v.SIPCode),
	})

	d.emitMetric(ctx, v.ID, []*protos.Metric{
		{Name: "sip.call_failed", Value: fmt.Sprintf("%v", v.Error), Description: "SIP call failure"},
	})

	d.removeObserver(ctx, v.ID)

	if d.onCallEnd != nil {
		d.onCallEnd(v.ID)
	}
}
