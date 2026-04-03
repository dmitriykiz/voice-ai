// Copyright (c) 2023-2025 RapidaAI
// Author: Prashant Srivastav <prashant@rapida.ai>
//
// Licensed under GPL-2.0 with Rapida Additional Terms.
// See LICENSE.md or contact sales@rapida.ai for commercial usage.

package observe

import (
	"context"
	"encoding/json"
	"fmt"
	"slices"
	"strconv"
	"strings"
	"time"

	internal_assistant_entity "github.com/rapidaai/api/assistant-api/internal/entity/assistants"
	"github.com/rapidaai/pkg/clients/rest"
	"github.com/rapidaai/pkg/commons"
	"github.com/rapidaai/pkg/types"
	type_enums "github.com/rapidaai/pkg/types/enums"
	"github.com/rapidaai/pkg/utils"
	"github.com/rapidaai/protos"
)

// ConversationSnapshot holds the conversation state needed by hooks.
// This decouples hook execution from genericRequestor, allowing
// SIP pipeline, telephony providers, and any other caller to trigger hooks.
type ConversationSnapshot struct {
	Assistant    *internal_assistant_entity.Assistant
	Conversation *ConversationRef
	Histories    []MessageEntry
	Metadata     map[string]interface{}
	Arguments    map[string]interface{}
	Options      map[string]interface{}
	Auth         types.SimplePrinciple
}

// ConversationRef holds minimal conversation identity.
type ConversationRef struct {
	ID uint64
}

// MessageEntry is a simplified message for webhook/analysis payloads.
type MessageEntry struct {
	Role    string
	Content string
}

// InvokeEndpointFunc calls a configured analysis endpoint.
// Injected by the caller (genericRequestor or SIPEngine via deployment client).
type InvokeEndpointFunc func(ctx context.Context, auth types.SimplePrinciple, endpointID uint64, endpointVersion string, arguments map[string]interface{}) (*protos.InvokeResponse, error)

// WebhookLogFunc persists a webhook execution log to DB.
type WebhookLogFunc func(ctx context.Context, webhookID uint64, url, method, event string, statusCode, timeTaken int64, retryCount uint32, status type_enums.RecordState, request, response []byte) error

// SetMetadataFunc persists metadata back to the conversation in DB.
type SetMetadataFunc func(ctx context.Context, auth types.SimplePrinciple, metadata map[string]interface{}) error

// ConversationHooks executes analysis and webhook hooks for a conversation.
// It is decoupled from genericRequestor — any component (SIP pipeline, telephony,
// dispatch) can create a ConversationHooks with a ConversationSnapshot and trigger
// lifecycle events.
//
// Usage:
//
//	hooks := observe.NewConversationHooks(cfg)
//	hooks.OnBegin(ctx)      // call start
//	hooks.OnEnd(ctx)        // call end (runs analysis, then webhooks)
//	hooks.OnError(ctx)      // call failed
type ConversationHooks struct {
	logger          commons.Logger
	snap            *ConversationSnapshot
	invokeEndpoint  InvokeEndpointFunc
	createLog       WebhookLogFunc
	setMetadata     SetMetadataFunc
}

// ConversationHooksConfig holds dependencies for creating hooks.
type ConversationHooksConfig struct {
	Logger         commons.Logger
	Snapshot       *ConversationSnapshot
	InvokeEndpoint InvokeEndpointFunc
	CreateLog      WebhookLogFunc
	SetMetadata    SetMetadataFunc
}

// NewConversationHooks creates a hook executor scoped to a conversation.
func NewConversationHooks(cfg *ConversationHooksConfig) *ConversationHooks {
	return &ConversationHooks{
		logger:         cfg.Logger,
		snap:           cfg.Snapshot,
		invokeEndpoint: cfg.InvokeEndpoint,
		createLog:      cfg.CreateLog,
		setMetadata:    cfg.SetMetadata,
	}
}

// RefreshSnapshot updates the conversation snapshot with the latest state.
// Call before OnEnd to ensure analysis/webhooks see accumulated messages and metadata.
func (h *ConversationHooks) RefreshSnapshot(snap *ConversationSnapshot) {
	h.snap = snap
}

// OnBegin fires webhooks subscribed to ConversationBegin.
func (h *ConversationHooks) OnBegin(ctx context.Context) {
	h.fireWebhooks(ctx, utils.ConversationBegin)
}

// OnResume fires webhooks subscribed to ConversationBegin (same event for resume).
func (h *ConversationHooks) OnResume(ctx context.Context) {
	h.fireWebhooks(ctx, utils.ConversationResume)
}

// OnError fires webhooks subscribed to ConversationFailed.
func (h *ConversationHooks) OnError(ctx context.Context) {
	h.fireWebhooks(ctx, utils.ConversationFailed)
}

// OnEnd runs all analyses first, stores results as metadata, then fires
// webhooks subscribed to ConversationCompleted. Runs asynchronously.
func (h *ConversationHooks) OnEnd(ctx context.Context) {
	utils.Go(ctx, func() {
		// Phase 1: Run analyses
		if len(h.snap.Assistant.AssistantAnalyses) > 0 {
			output := make(map[string]interface{})
			for _, a := range h.snap.Assistant.AssistantAnalyses {
				args := h.parse(utils.ConversationCompleted, a.GetParameters())
				result, err := h.analysis(ctx, a.GetEndpointId(), a.GetEndpointVersion(), args)
				if err != nil {
					h.logger.Warnw("Analysis execution failed", "name", a.GetName(), "error", err)
					continue
				}
				output[fmt.Sprintf("analysis.%s", a.GetName())] = result
			}
			if h.setMetadata != nil && len(output) > 0 {
				if err := h.setMetadata(ctx, h.snap.Auth, output); err != nil {
					h.logger.Warnw("Failed to store analysis results", "error", err)
				}
			}
		}

		// Phase 2: Fire webhooks (with analysis results available in metadata)
		h.fireWebhooks(ctx, utils.ConversationCompleted)
	})
}

// fireWebhooks executes all webhooks subscribed to the given event.
func (h *ConversationHooks) fireWebhooks(ctx context.Context, event utils.AssistantWebhookEvent) {
	if h.snap.Assistant == nil {
		return
	}
	for _, webhook := range h.snap.Assistant.AssistantWebhooks {
		if slices.Contains(webhook.AssistantEvents, event.Get()) {
			args := h.parse(event, webhook.GetBody())
			h.executeWebhook(ctx, event.Get(), args, webhook)
		}
	}
}

// analysis invokes an analysis endpoint and returns the parsed response.
func (h *ConversationHooks) analysis(ctx context.Context, endpointID uint64, endpointVersion string, arguments map[string]interface{}) (map[string]interface{}, error) {
	if h.invokeEndpoint == nil {
		return nil, fmt.Errorf("endpoint invoker not configured")
	}
	resp, err := h.invokeEndpoint(ctx, h.snap.Auth, endpointID, endpointVersion, arguments)
	if err != nil {
		return nil, err
	}
	if resp.GetSuccess() {
		if data := resp.GetData(); len(data) > 0 {
			var parsed map[string]interface{}
			if err := json.Unmarshal([]byte(data[0]), &parsed); err != nil {
				return map[string]interface{}{"result": data[0]}, nil
			}
			return parsed, nil
		}
	}
	return nil, fmt.Errorf("empty response from endpoint")
}

// executeWebhook performs the HTTP request with retry logic and logs the result.
func (h *ConversationHooks) executeWebhook(ctx context.Context, event string, arguments map[string]interface{}, webhook *internal_assistant_entity.AssistantWebhook) {
	utils.Go(ctx, func() {
		startTime := time.Now()
		var res *rest.APIResponse
		var err error
		var statusCode int

		retryCount := uint32(0)
		maxRetryCount := webhook.GetMaxRetryCount()
		retryStatusCodes := webhook.GetRetryStatusCode()

		for retryCount <= maxRetryCount {
			res, err = doHTTP(ctx, webhook.GetTimeoutSecond(), webhook.GetUrl(), webhook.GetMethod(), webhook.GetHeaders(), arguments)
			if err != nil {
				h.logger.Warnw("Webhook execution failed", "url", webhook.GetUrl(), "error", err)
				statusCode = 500
			} else {
				statusCode = res.StatusCode
				if !slices.Contains(retryStatusCodes, strconv.Itoa(statusCode)) {
					break
				}
			}
			retryCount++
			if retryCount <= maxRetryCount {
				time.Sleep(2 * time.Second)
			}
		}

		// Log execution
		if h.createLog != nil {
			reqBytes, _ := utils.Serialize(arguments)
			var resBytes []byte
			if res != nil {
				resBytes, _ = res.ToJSON()
			}
			if err := h.createLog(ctx, webhook.Id, webhook.HttpUrl, webhook.HttpMethod, event,
				int64(statusCode), int64(time.Since(startTime)),
				retryCount, type_enums.RECORD_COMPLETE, reqBytes, resBytes); err != nil {
				h.logger.Warnw("Failed to create webhook log", "error", err)
			}
		}
	})
}

// parse transforms template mappings into actual arguments using conversation state.
func (h *ConversationHooks) parse(event utils.AssistantWebhookEvent, mapping map[string]string) map[string]interface{} {
	arguments := make(map[string]interface{})
	snap := h.snap

	for key, value := range mapping {
		if k, ok := strings.CutPrefix(key, "event."); ok {
			switch k {
			case "type":
				arguments[value] = event.Get()
			case "data":
				analysisData := make(map[string]interface{})
				for k, v := range snap.Metadata {
					if analysisKey, ok := strings.CutPrefix(k, "analysis."); ok {
						analysisData[analysisKey] = v
					}
				}
				arguments[value] = map[string]interface{}{
					"assistant": map[string]interface{}{
						"id":      fmt.Sprintf("%d", snap.Assistant.Id),
						"version": fmt.Sprintf("vrsn_%d", snap.Assistant.AssistantProviderId),
					},
					"conversation": map[string]interface{}{
						"id":       fmt.Sprintf("%d", snap.Conversation.ID),
						"messages": simplifyHistory(snap.Histories),
					},
					"analysis": analysisData,
				}
			}
		}
		if k, ok := strings.CutPrefix(key, "assistant."); ok {
			switch k {
			case "id":
				arguments[value] = fmt.Sprintf("%d", snap.Assistant.Id)
			case "version":
				arguments[value] = fmt.Sprintf("vrsn_%d", snap.Assistant.AssistantProviderId)
			}
		}
		if k, ok := strings.CutPrefix(key, "conversation."); ok {
			switch k {
			case "id":
				arguments[value] = fmt.Sprintf("%d", snap.Conversation.ID)
			case "messages":
				arguments[value] = simplifyHistory(snap.Histories)
			}
		}
		if k, ok := strings.CutPrefix(key, "argument."); ok {
			if v, ok := snap.Arguments[k]; ok {
				arguments[value] = v
			}
		}
		if k, ok := strings.CutPrefix(key, "metadata."); ok {
			if v, ok := snap.Metadata[k]; ok {
				arguments[value] = v
			}
		}
		if k, ok := strings.CutPrefix(key, "option."); ok {
			if v, ok := snap.Options[k]; ok {
				arguments[value] = v
			}
		}
		if strings.HasPrefix(key, "analysis.") {
			if v, ok := snap.Metadata[key]; ok {
				arguments[value] = v
			}
		}
	}
	return arguments
}

// simplifyHistory converts message entries to webhook/analysis payload format.
func simplifyHistory(msgs []MessageEntry) []map[string]string {
	out := make([]map[string]string, 0, len(msgs))
	for _, m := range msgs {
		out = append(out, map[string]string{"role": m.Role, "message": m.Content})
	}
	return out
}

// doHTTP performs the actual HTTP request.
func doHTTP(ctx context.Context, timeout uint32, baseURL, method string, headers map[string]string, body map[string]interface{}) (*rest.APIResponse, error) {
	client := rest.NewRestClientWithConfig(baseURL, headers, timeout)
	switch method {
	case "POST":
		return client.Post(ctx, "", body, headers)
	case "PUT":
		return client.Put(ctx, "", body, headers)
	case "PATCH":
		return client.Patch(ctx, "", body, headers)
	default:
		return client.Get(ctx, "", body, headers)
	}
}
