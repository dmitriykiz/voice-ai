// Copyright (c) 2023-2025 RapidaAI
// Author: Prashant Srivastav <prashant@rapida.ai>
//
// Licensed under GPL-2.0 with Rapida Additional Terms.
// See LICENSE.md or contact sales@rapida.ai for commercial usage.

package internal_transformer_elevenlabs

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"net/http"
	"sync"
	"time"

	"github.com/gorilla/websocket"

	elevenlabs_internal "github.com/rapidaai/api/assistant-api/internal/transformer/elevenlabs/internal"
	internal_type "github.com/rapidaai/api/assistant-api/internal/type"
	"github.com/rapidaai/pkg/commons"
	"github.com/rapidaai/pkg/utils"
	"github.com/rapidaai/protos"
)

type elevenlabsTTS struct {
	*elevenLabsOption
	ctx       context.Context
	ctxCancel context.CancelFunc

	mu            sync.Mutex
	connection    *websocket.Conn
	contextId     string
	ttsStartedAt  time.Time
	ttsMetricSent bool

	logger   commons.Logger
	onPacket func(pkt ...internal_type.Packet) error
}

func NewElevenlabsTextToSpeech(ctx context.Context, logger commons.Logger, credential *protos.VaultCredential,
	onPacket func(pkt ...internal_type.Packet) error,
	opts utils.Option) (internal_type.TextToSpeechTransformer, error) {
	eleOpts, err := NewElevenLabsOption(logger, credential, opts)
	if err != nil {
		logger.Errorf("elevenlabs-tts: initializing elevenlabs failed %+v", err)
		return nil, err
	}
	ctx2, contextCancel := context.WithCancel(ctx)
	return &elevenlabsTTS{
		ctx:              ctx2,
		ctxCancel:        contextCancel,
		onPacket:         onPacket,
		logger:           logger,
		elevenLabsOption: eleOpts,
	}, nil
}

func (*elevenlabsTTS) Name() string {
	return "elevenlabs-text-to-speech"
}

// Initialize opens a fresh WebSocket connection to ElevenLabs and starts the
// read goroutine. Called at session start and after each interruption so the
// connection is warm before the first text delta arrives.
func (ct *elevenlabsTTS) Initialize() error {
	start := time.Now()
	header := http.Header{}
	header.Set("xi-api-key", ct.GetKey())
	conn, resp, err := websocket.DefaultDialer.Dial(ct.GetTextToSpeechConnectionString(), header)
	if err != nil {
		ct.logger.Errorf("elevenlabs-tts: dial failed %s with response %v", err, resp)
		return err
	}

	ct.mu.Lock()
	ct.connection = conn
	ct.mu.Unlock()

	go ct.readLoop(conn)
	ct.onPacket(internal_type.ConversationEventPacket{
		Name: "tts",
		Data: map[string]string{
			"type":     "initialized",
			"provider": ct.Name(),
			"init_ms":  fmt.Sprintf("%d", time.Since(start).Milliseconds()),
		},
		Time: time.Now(),
	})
	return nil
}

// readLoop owns a single WebSocket connection for the duration of one TTS turn.
// It exits when the connection closes — intentionally (interrupt / flush complete)
// or unexpectedly (network drop).
func (elt *elevenlabsTTS) readLoop(conn *websocket.Conn) {
	for {
		select {
		case <-elt.ctx.Done():
			return
		default:
		}

		_, audioChunk, err := conn.ReadMessage()
		if err != nil {
			elt.mu.Lock()
			intentional := elt.connection == nil // set to nil before conn.Close() on intentional paths
			if !intentional {
				elt.connection = nil // unintentional drop: next delta will reconnect
			}
			elt.mu.Unlock()
			if !intentional {
				elt.logger.Errorf("elevenlabs-tts: connection lost: %v", err)
			}
			return
		}

		var audioData elevenlabs_internal.ElevenlabTextToSpeechResponse
		if err := json.Unmarshal(audioChunk, &audioData); err != nil {
			elt.logger.Errorf("elevenlabs-tts: error parsing audio chunk: %v", err)
			continue
		}

		if audioData.Audio != "" {
			if rawAudioData, err := base64.StdEncoding.DecodeString(audioData.Audio); err == nil {
				elt.mu.Lock()
				ctxId := elt.contextId
				startedAt := elt.ttsStartedAt
				metricSent := elt.ttsMetricSent
				if !metricSent && !startedAt.IsZero() {
					elt.ttsMetricSent = true
				}
				elt.mu.Unlock()
				if ctxId != "" {
					if !metricSent && !startedAt.IsZero() {
						elt.onPacket(internal_type.MessageMetricPacket{
							ContextID: ctxId,
							Metrics: []*protos.Metric{{
								Name:  "tts_latency_ms",
								Value: fmt.Sprintf("%d", time.Since(startedAt).Milliseconds()),
							}},
						})
					}
					elt.onPacket(internal_type.TextToSpeechAudioPacket{ContextID: ctxId, AudioChunk: rawAudioData})
				}
			} else {
				elt.logger.Errorf("elevenlabs-tts: base64 decode failed: %v", err)
			}
		}

		if audioData.IsFinal != nil && *audioData.IsFinal {
			elt.handleFlushComplete(conn)
			return
		}
	}
}

// handleFlushComplete is called when ElevenLabs signals isFinal. It emits
// TextToSpeechEndPacket — correctly ordered after the last audio chunk — and
// closes the per-turn connection.
func (elt *elevenlabsTTS) handleFlushComplete(conn *websocket.Conn) {
	elt.mu.Lock()
	ctxId := elt.contextId
	elt.connection = nil // mark before Close so readLoop error handler sees intentional
	elt.mu.Unlock()

	elt.onPacket(
		internal_type.TextToSpeechEndPacket{ContextID: ctxId},
		internal_type.ConversationEventPacket{
			Name: "tts",
			Data: map[string]string{"type": "completed"},
			Time: time.Now(),
		},
	)
	conn.Close()
}

func (t *elevenlabsTTS) Transform(ctx context.Context, in internal_type.LLMPacket) error {
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
			t.logger.Errorf("elevenlabs-tts: reconnect after interrupt failed: %v", err)
		}
		return nil

	case internal_type.LLMResponseDeltaPacket:
		// Fallback reconnect: handles Initialize() failure or an unintentional drop.
		if connection == nil {
			if err := t.Initialize(); err != nil {
				return fmt.Errorf("elevenlabs-tts: failed to connect: %w", err)
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
		t.mu.Lock()
		ctxId := t.contextId
		t.mu.Unlock()
		if err := connection.WriteJSON(map[string]interface{}{
			"text":       input.Text,
			"context_id": ctxId,
			"flush":      true,
		}); err != nil {
			t.logger.Errorf("elevenlabs-tts: write failed: %v", err)
			return err
		}
		t.onPacket(internal_type.ConversationEventPacket{
			Name: "tts",
			Data: map[string]string{"type": "speaking", "text": input.Text},
			Time: time.Now(),
		})

	case internal_type.LLMResponseDonePacket:
		// Interrupted before done arrived — nothing to flush.
		if connection == nil {
			return nil
		}
		t.mu.Lock()
		ctxId := t.contextId
		t.mu.Unlock()
		// Signal end of text stream; ElevenLabs will respond with isFinal:true.
		if err := connection.WriteJSON(map[string]interface{}{
			"text":       " ",
			"context_id": ctxId,
			"flush":      true,
		}); err != nil {
			t.logger.Errorf("elevenlabs-tts: flush signal failed: %v", err)
			return err
		}
		// TextToSpeechEndPacket is emitted by handleFlushComplete once isFinal received.

	default:
		return fmt.Errorf("elevenlabs-tts: unsupported input type %T", in)
	}
	return nil
}

func (t *elevenlabsTTS) Close(ctx context.Context) error {
	t.ctxCancel()
	t.mu.Lock()
	defer t.mu.Unlock()

	if t.connection != nil {
		conn := t.connection
		t.connection = nil // mark before Close so readLoop sees intentional
		conn.Close()
	}
	return nil
}
