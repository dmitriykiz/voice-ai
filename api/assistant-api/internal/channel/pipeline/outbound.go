// Copyright (c) 2023-2025 RapidaAI
// Author: Prashant Srivastav <prashant@rapida.ai>
//
// Licensed under GPL-2.0 with Rapida Additional Terms.
// See LICENSE.md or contact sales@rapida.ai for commercial usage.

package channel_pipeline

import (
	"context"
	"fmt"

	obs "github.com/rapidaai/api/assistant-api/internal/observe"
	internal_type "github.com/rapidaai/api/assistant-api/internal/type"
)

func (d *Dispatcher) runOutbound(ctx context.Context, v OutboundRequestedPipeline) *PipelineResult {
	d.logger.Infow("Pipeline: OutboundRequested",
		"to", v.ToPhone,
		"from", v.FromPhone,
		"assistant_id", v.AssistantID)

	if d.onLoadAssistant == nil {
		return &PipelineResult{Error: ErrCallbackNotConfigured}
	}
	assistant, err := d.onLoadAssistant(ctx, v.Auth, v.AssistantID)
	if err != nil {
		return &PipelineResult{Error: fmt.Errorf("invalid assistant: %w", err)}
	}
	if assistant.AssistantPhoneDeployment == nil {
		return &PipelineResult{Error: fmt.Errorf("phone deployment not enabled")}
	}

	fromPhone := v.FromPhone
	if fromPhone == "" {
		fn, err := assistant.AssistantPhoneDeployment.GetOptions().GetString("phone")
		if err != nil {
			return &PipelineResult{Error: fmt.Errorf("no phone number configured: %w", err)}
		}
		fromPhone = fn
	}
	provider := assistant.AssistantPhoneDeployment.TelephonyProvider

	if d.onCreateConversation == nil {
		return &PipelineResult{Error: ErrCallbackNotConfigured}
	}
	conversationID, err := d.onCreateConversation(ctx, v.Auth, v.ToPhone, assistant.Id, assistant.AssistantProviderId, "outbound")
	if err != nil {
		return &PipelineResult{Error: fmt.Errorf("failed to create conversation: %w", err)}
	}

	if d.onApplyConversationExtras != nil {
		if err := d.onApplyConversationExtras(ctx, v.Auth, assistant.Id, conversationID, v.Options, v.Args, v.Metadata); err != nil {
			d.logger.Warnw("Failed to apply conversation extras", "error", err)
		}
	}

	if d.onSaveCallContext == nil {
		return &PipelineResult{Error: ErrCallbackNotConfigured}
	}
	callInfo := &internal_type.CallInfo{CallerNumber: v.ToPhone, FromNumber: fromPhone, Direction: "outbound", Provider: provider, Status: "queued"}
	contextID, err := d.onSaveCallContext(ctx, v.Auth, assistant, conversationID, callInfo, provider)
	if err != nil {
		return &PipelineResult{Error: fmt.Errorf("failed to save call context: %w", err)}
	}

	var observer *obs.ConversationObserver
	if d.onCreateObserver != nil {
		observer = d.onCreateObserver(ctx, contextID, v.Auth, assistant.Id, conversationID)
	}

	if observer != nil {
		observer.EmitMetadata(ctx, obs.ClientMetadata(
			v.ToPhone, fromPhone, "outbound", provider,
			"", contextID, "", "",
		))
		observer.EmitEvent(ctx, obs.ComponentTelephony, map[string]string{
			obs.DataType:      obs.EventOutboundRequested,
			obs.DataProvider:  provider,
			obs.DataTo:        v.ToPhone,
			obs.DataFrom:      fromPhone,
			obs.DataContextID: contextID,
		})
	}

	if d.onDispatchOutbound != nil {
		if err := d.onDispatchOutbound(ctx, contextID); err != nil {
			d.logger.Error("Pipeline: outbound dispatch failed", "error", err)
			if observer != nil {
				observer.EmitEvent(ctx, obs.ComponentTelephony, map[string]string{
					obs.DataType:  obs.EventOutboundDispatchFailed,
					obs.DataError: err.Error(),
				})
				observer.EmitMetric(ctx, obs.CallStatusMetric("FAILED", err.Error()))
				observer.Shutdown(ctx)
			}
			return &PipelineResult{ContextID: contextID, ConversationID: conversationID, Error: err}
		}
	}

	if observer != nil {
		observer.EmitEvent(ctx, obs.ComponentTelephony, map[string]string{
			obs.DataType:      obs.EventOutboundDispatched,
			obs.DataProvider:  provider,
			obs.DataContextID: contextID,
		})
		observer.Shutdown(ctx)
	}

	return &PipelineResult{ContextID: contextID, ConversationID: conversationID}
}
