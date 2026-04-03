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

// handleEventEmitted persists a SIP event to the conversation in DB.
func (d *Dispatcher) handleEventEmitted(ctx context.Context, v sip_infra.EventEmittedPipeline) {
	d.logger.Debugw("Pipeline: Event",
		"call_id", v.ID,
		"event", v.Event)

	d.emitEvent(ctx, v.ID, "sip", v.Data)
}

// handleMetricEmitted persists call metrics to the conversation in DB.
func (d *Dispatcher) handleMetricEmitted(ctx context.Context, v sip_infra.MetricEmittedPipeline) {
	if len(v.Metrics) == 0 {
		return
	}
	d.logger.Debugw("Pipeline: Metric",
		"call_id", v.ID,
		"count", len(v.Metrics))

	d.emitMetric(ctx, v.ID, v.Metrics)
}

// handleRecordingStarted logs recording start.
func (d *Dispatcher) handleRecordingStarted(ctx context.Context, v sip_infra.RecordingStartedPipeline) {
	d.logger.Infow("Pipeline: RecordingStarted",
		"call_id", v.ID,
		"recording_id", v.RecordingID)

	d.emitEvent(ctx, v.ID, "sip", map[string]string{
		"type":         "recording_started",
		"recording_id": v.RecordingID,
	})
}

// handleDTMFReceived persists DTMF digit event.
func (d *Dispatcher) handleDTMFReceived(ctx context.Context, v sip_infra.DTMFReceivedPipeline) {
	d.logger.Debugw("Pipeline: DTMFReceived",
		"call_id", v.ID,
		"digit", v.Digit)

	d.emitEvent(ctx, v.ID, "sip", map[string]string{
		"type":  "dtmf",
		"digit": v.Digit,
	})
}
