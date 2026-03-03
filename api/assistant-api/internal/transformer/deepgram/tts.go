// Copyright (c) 2023-2025 RapidaAI
// Author: Prashant Srivastav <prashant@rapida.ai>
//
// Licensed under GPL-2.0 with Rapida Additional Terms.
// See LICENSE.md or contact sales@rapida.ai for commercial usage.

package internal_transformer_deepgram

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"sync"
	"time"

	"github.com/gorilla/websocket"
	deepgram_internal "github.com/rapidaai/api/assistant-api/internal/transformer/deepgram/internal"
	internal_type "github.com/rapidaai/api/assistant-api/internal/type"
	"github.com/rapidaai/pkg/commons"
	utils "github.com/rapidaai/pkg/utils"
	"github.com/rapidaai/protos"
)

/*
Deepgram Continuous Streaming TTS
Reference: https://developers.deepgram.com/reference/text-to-speech/speak-streaming
*/

type deepgramTTS struct {
	*deepgramOption
	ctx       context.Context
	ctxCancel context.CancelFunc
	contextId string
	mu        sync.Mutex

	ttsStartedAt  time.Time
	ttsMetricSent bool

	logger     commons.Logger
	connection *websocket.Conn
	onPacket   func(pkt ...internal_type.Packet) error
	normalizer internal_type.TextNormalizer
}

func NewDeepgramTextToSpeech(ctx context.Context, logger commons.Logger, credential *protos.VaultCredential,
	onPacket func(pkt ...internal_type.Packet) error,
	opts utils.Option) (internal_type.TextToSpeechTransformer, error) {

	dGoptions, err := NewDeepgramOption(logger, credential, opts)
	if err != nil {
		logger.Errorf("deepgram-tts: error while intializing deepgram text to speech")
		return nil, err
	}
	ctx2, cancel := context.WithCancel(ctx)
	return &deepgramTTS{
		deepgramOption: dGoptions,
		ctx:            ctx2,
		ctxCancel:      cancel,
		logger:         logger,
		onPacket:       onPacket,
		normalizer:     NewDeepgramNormalizer(logger, opts),
	}, nil
}

// Initialize opens a fresh WebSocket connection to Deepgram and starts the
// read goroutine. Called at session start and after each interruption so the
// connection is warm before the first text delta arrives.
func (t *deepgramTTS) Initialize() error {
	start := time.Now()
	header := http.Header{}
	header.Set("Authorization", fmt.Sprintf("token %s", t.GetKey()))
	conn, resp, err := websocket.DefaultDialer.Dial(t.GetTextToSpeechConnectionString(), header)
	if err != nil {
		t.logger.Errorf("deepgram-tts: websocket dial failed err=%v resp=%v", err, resp)
		return err
	}

	t.mu.Lock()
	t.connection = conn
	t.mu.Unlock()

	go t.readLoop(conn)
	t.onPacket(internal_type.ConversationEventPacket{
		Name: "tts",
		Data: map[string]string{
			"type":     "initialized",
			"provider": t.Name(),
			"init_ms":  fmt.Sprintf("%d", time.Since(start).Milliseconds()),
		},
		Time: time.Now(),
	})
	return nil
}

func (*deepgramTTS) Name() string {
	return "deepgram-text-to-speech"
}

// handleFlushComplete is called when Deepgram signals Flushed. It emits
// TextToSpeechEndPacket — correctly ordered after the last audio chunk — and
// closes the per-turn connection.
func (t *deepgramTTS) handleFlushComplete(conn *websocket.Conn) {
	t.mu.Lock()
	ctxId := t.contextId
	t.connection = nil // mark before Close so readLoop error handler sees intentional
	t.mu.Unlock()

	t.onPacket(
		internal_type.TextToSpeechEndPacket{ContextID: ctxId},
		internal_type.ConversationEventPacket{
			Name: "tts",
			Data: map[string]string{"type": "completed"},
			Time: time.Now(),
		},
	)
	conn.Close()
}

// readLoop owns a single WebSocket connection for the duration of one TTS turn.
// It exits when the connection closes — intentionally (interrupt / flush complete)
// or unexpectedly (network drop).
func (t *deepgramTTS) readLoop(conn *websocket.Conn) {
	for {
		select {
		case <-t.ctx.Done():
			return
		default:
		}

		msgType, data, err := conn.ReadMessage()
		if err != nil {
			t.mu.Lock()
			intentional := t.connection == nil // set to nil before conn.Close() on intentional paths
			if !intentional {
				t.connection = nil // unintentional drop: next delta will reconnect
			}
			t.mu.Unlock()
			if !intentional {
				t.logger.Errorf("deepgram-tts: connection lost: %v", err)
			}
			return
		}

		if msgType == websocket.BinaryMessage {
			t.mu.Lock()
			startedAt := t.ttsStartedAt
			metricSent := t.ttsMetricSent
			ctxId := t.contextId
			if !metricSent && !startedAt.IsZero() {
				t.ttsMetricSent = true
			}
			t.mu.Unlock()
			if !metricSent && !startedAt.IsZero() {
				t.onPacket(internal_type.MessageMetricPacket{
					ContextID: ctxId,
					Metrics: []*protos.Metric{{
						Name:  "tts_latency_ms",
						Value: fmt.Sprintf("%d", time.Since(startedAt).Milliseconds()),
					}},
				})
			}
			t.onPacket(internal_type.TextToSpeechAudioPacket{
				ContextID:  ctxId,
				AudioChunk: data,
			})
			continue
		}

		var envelope *deepgram_internal.DeepgramTextToSpeechResponse
		if err := json.Unmarshal(data, &envelope); err != nil {
			continue
		}

		switch envelope.Type {
		case "Metadata":
			continue
		case "Flushed":
			t.handleFlushComplete(conn)
			return
		case "Cleared":
			continue
		case "Warning":
			t.logger.Warnf("deepgram-tts warning code=%s message=%s", envelope.Code, envelope.Message)
		default:
			t.logger.Debugf("deepgram-tts: unhandled message type: %s", envelope.Type)
		}
	}
}

// Transform streams text into Deepgram
func (t *deepgramTTS) Transform(ctx context.Context, in internal_type.LLMPacket) error {
	t.mu.Lock()
	if in.ContextId() != t.contextId {
		t.contextId = in.ContextId()
		t.ttsStartedAt = time.Time{}
		t.ttsMetricSent = false
	}
	connection := t.connection
	t.mu.Unlock()

	switch input := in.(type) {
	case internal_type.InterruptionPacket:
		t.mu.Lock()
		t.contextId = ""
		t.ttsStartedAt = time.Time{}
		t.ttsMetricSent = false
		conn := t.connection
		t.connection = nil
		t.mu.Unlock()
		if conn != nil {
			conn.Close()
		}
		t.onPacket(internal_type.ConversationEventPacket{
			Name: "tts",
			Data: map[string]string{"type": "interrupted"},
			Time: time.Now(),
		})
		if err := t.Initialize(); err != nil {
			t.logger.Errorf("deepgram-tts: reconnect after interrupt failed: %v", err)
		}
		return nil

	case internal_type.LLMResponseDeltaPacket:
		// Fallback reconnect: handles Initialize() failure or an unintentional drop.
		if connection == nil {
			if err := t.Initialize(); err != nil {
				return fmt.Errorf("deepgram-tts: failed to connect: %w", err)
			}
			t.mu.Lock()
			connection = t.connection
			if t.ttsStartedAt.IsZero() {
				t.ttsStartedAt = time.Now()
			}
			t.mu.Unlock()
		} else {
			t.mu.Lock()
			if t.ttsStartedAt.IsZero() {
				t.ttsStartedAt = time.Now()
			}
			t.mu.Unlock()
		}
		normalized := t.normalizer.Normalize(ctx, input.Text)
		if err := connection.WriteJSON(map[string]interface{}{
			"type": "Speak",
			"text": normalized,
		}); err != nil {
			t.logger.Errorf("deepgram-tts: failed to send Speak message %v", err)
			return err
		}
		t.onPacket(internal_type.ConversationEventPacket{
			Name: "tts",
			Data: map[string]string{
				"type": "speaking",
				"text": normalized,
			},
			Time: time.Now(),
		})
		return nil

	case internal_type.LLMResponseDonePacket:
		// Interrupted before done arrived — nothing to flush.
		if connection == nil {
			return nil
		}
		// Signal end of text stream; Deepgram will respond with Flushed.
		if err := connection.WriteJSON(map[string]string{"type": "Flush"}); err != nil {
			t.logger.Errorf("deepgram-tts: failed to send Flush %v", err)
			return err
		}
		// TextToSpeechEndPacket is emitted by handleFlushComplete once Flushed received.
		return nil

	default:
		return fmt.Errorf("deepgram-tts: unsupported input type %T", in)
	}
}

// Close gracefully closes the Deepgram connection
func (t *deepgramTTS) Close(ctx context.Context) error {
	t.ctxCancel()
	t.mu.Lock()
	defer t.mu.Unlock()

	if t.connection != nil {
		conn := t.connection
		t.connection = nil // mark before Close so readLoop sees intentional
		_ = conn.WriteJSON(map[string]string{"type": "Close"})
		conn.Close()
	}
	return nil
}
