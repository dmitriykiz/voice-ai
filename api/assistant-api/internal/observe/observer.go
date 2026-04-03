// Copyright (c) 2023-2025 RapidaAI
// Author: Prashant Srivastav <prashant@rapida.ai>
//
// Licensed under GPL-2.0 with Rapida Additional Terms.
// See LICENSE.md or contact sales@rapida.ai for commercial usage.

package observe

import (
	"context"
	"fmt"
	"time"

	"github.com/rapidaai/pkg/commons"
	"github.com/rapidaai/pkg/types"
	"github.com/rapidaai/protos"
)

// PersistFunc persists metrics/metadata to DB for a conversation.
// Implementations are provided by the conversation service layer.
type PersistFunc struct {
	ApplyMetrics  func(ctx context.Context, auth types.SimplePrinciple, assistantID, conversationID uint64, metrics []*types.Metric) error
	ApplyMetadata func(ctx context.Context, auth types.SimplePrinciple, assistantID, conversationID uint64, metadata []*types.Metadata) error
}

// ConversationObserver provides unified observability for a conversation's lifecycle.
// It combines:
//   - DB persistence (metrics + metadata via PersistFunc)
//   - Telemetry export (events + metrics via EventCollector + MetricCollector)
//
// This is the shared infrastructure used by:
//   - SIP pipeline (pre-talk and post-talk stages)
//   - Telephony providers (Twilio, Asterisk, etc.)
//   - Audio dispatch pipeline (genericRequestor delegates to this)
//
// The observer is scoped to a single conversation. Create one per conversation
// via NewConversationObserver after the conversation is created in DB.
type ConversationObserver struct {
	logger commons.Logger
	meta   SessionMeta
	auth   types.SimplePrinciple

	// DB persistence
	persist PersistFunc

	// Telemetry collectors (fan-out to exporters: OpenSearch, OTLP, X-Ray, etc.)
	events  EventCollector
	metrics MetricCollector
}

// ConversationObserverConfig holds the dependencies for creating a ConversationObserver.
type ConversationObserverConfig struct {
	Logger         commons.Logger
	Auth           types.SimplePrinciple
	AssistantID    uint64
	ConversationID uint64
	ProjectID      uint64
	OrganizationID uint64
	Persist        PersistFunc
	Events         EventCollector
	Metrics        MetricCollector
}

// NewConversationObserver creates a new observer scoped to a conversation.
// The observer is safe for concurrent use from multiple goroutines.
func NewConversationObserver(cfg *ConversationObserverConfig) *ConversationObserver {
	meta := SessionMeta{
		AssistantID:             cfg.AssistantID,
		AssistantConversationID: cfg.ConversationID,
		ProjectID:               cfg.ProjectID,
		OrganizationID:          cfg.OrganizationID,
	}

	events := cfg.Events
	if events == nil {
		events = NewEventCollector(cfg.Logger, meta) // no-op when no exporters
	}
	metrics := cfg.Metrics
	if metrics == nil {
		metrics = NewMetricCollector(cfg.Logger, meta) // no-op when no exporters
	}

	return &ConversationObserver{
		logger:  cfg.Logger,
		meta:    meta,
		auth:    cfg.Auth,
		persist: cfg.Persist,
		events:  events,
		metrics: metrics,
	}
}

// EmitEvent records an event to both DB (as metadata) and telemetry exporters.
//
//	name: component name — "sip", "telephony", "session", etc.
//	data: event-specific key/value pairs (always include "type")
func (o *ConversationObserver) EmitEvent(ctx context.Context, name string, data map[string]string) {
	// Telemetry export (OpenSearch, OTLP, X-Ray, Datadog, etc.)
	o.events.Collect(ctx, EventRecord{
		MessageID: "", // call-level event, not scoped to a message turn
		Name:      name,
		Data:      data,
		Time:      time.Now(),
	})

	// DB persistence (conversation metadata)
	if o.persist.ApplyMetadata != nil {
		metadata := make([]*types.Metadata, 0, len(data)+1)
		metadata = append(metadata, types.NewMetadata(fmt.Sprintf("%s.event", name), dataType(data)))
		for k, v := range data {
			metadata = append(metadata, types.NewMetadata(fmt.Sprintf("%s.%s", name, k), v))
		}
		if err := o.persist.ApplyMetadata(ctx, o.auth, o.meta.AssistantID, o.meta.AssistantConversationID, metadata); err != nil {
			o.logger.Warnw("observer: failed to persist event metadata", "name", name, "error", err)
		}
	}
}

// EmitMetric records metrics to both DB and telemetry exporters.
func (o *ConversationObserver) EmitMetric(ctx context.Context, metrics []*protos.Metric) {
	if len(metrics) == 0 {
		return
	}

	// Telemetry export
	o.metrics.Collect(ctx, ConversationMetricRecord{
		ConversationID: fmt.Sprintf("%d", o.meta.AssistantConversationID),
		Metrics:        metrics,
		Time:           time.Now(),
	})

	// DB persistence
	if o.persist.ApplyMetrics != nil {
		converted := make([]*types.Metric, 0, len(metrics))
		for _, pm := range metrics {
			converted = append(converted, &types.Metric{
				Name:        pm.Name,
				Value:       pm.Value,
				Description: pm.Description,
			})
		}
		if err := o.persist.ApplyMetrics(ctx, o.auth, o.meta.AssistantID, o.meta.AssistantConversationID, converted); err != nil {
			o.logger.Warnw("observer: failed to persist metrics", "error", err)
		}
	}
}

// EmitMetadata records metadata to DB only (no telemetry export for raw metadata).
func (o *ConversationObserver) EmitMetadata(ctx context.Context, metadata []*types.Metadata) {
	if len(metadata) == 0 {
		return
	}
	if o.persist.ApplyMetadata != nil {
		if err := o.persist.ApplyMetadata(ctx, o.auth, o.meta.AssistantID, o.meta.AssistantConversationID, metadata); err != nil {
			o.logger.Warnw("observer: failed to persist metadata", "error", err)
		}
	}
}

// EventCollectors returns the underlying collectors for direct use by
// genericRequestor (which also calls Notify for gRPC streaming).
func (o *ConversationObserver) EventCollectors() EventCollector {
	return o.events
}

// MetricCollectors returns the underlying collectors for direct use.
func (o *ConversationObserver) MetricCollectors() MetricCollector {
	return o.metrics
}

// Shutdown waits for all in-flight exports to complete and shuts down exporters.
func (o *ConversationObserver) Shutdown(ctx context.Context) {
	o.events.Shutdown(ctx)
	o.metrics.Shutdown(ctx)
}

// Meta returns the session metadata for this observer.
func (o *ConversationObserver) Meta() SessionMeta {
	return o.meta
}

// dataType extracts the "type" field from event data, or returns "unknown".
func dataType(data map[string]string) string {
	if t, ok := data["type"]; ok {
		return t
	}
	return "unknown"
}
