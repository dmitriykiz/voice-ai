// Copyright (c) 2023-2025 RapidaAI
// Author: Prashant Srivastav <prashant@rapida.ai>
//
// Licensed under GPL-2.0 with Rapida Additional Terms.
// See LICENSE.md or contact sales@rapida.ai for commercial usage.

package internal_transformer_resemble

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"net/http"
	"sync"
	"time"

	"github.com/gorilla/websocket"
	internal_type "github.com/rapidaai/api/assistant-api/internal/type"
	"github.com/rapidaai/pkg/commons"
	"github.com/rapidaai/pkg/utils"
	protos "github.com/rapidaai/protos"
)

type resembleTTS struct {
	*resembleOption

	ctx       context.Context
	ctxCancel context.CancelFunc

	mu         sync.Mutex
	contextId  string
	connection *websocket.Conn

	ttsStartedAt  time.Time
	ttsMetricSent bool

	logger   commons.Logger
	onPacket func(pkt ...internal_type.Packet) error
}

func NewResembleTextToSpeech(
	ctx context.Context,
	logger commons.Logger,
	credential *protos.VaultCredential,
	onPacket func(pkt ...internal_type.Packet) error,
	opts utils.Option,
) (internal_type.TextToSpeechTransformer, error) {
	rsmblOpts, err := NewResembleOption(logger, credential, opts)
	if err != nil {
		logger.Errorf("resemble-tts: initializing resembleai failed %+v", err)
		return nil, err
	}

	ct, ctxCancel := context.WithCancel(ctx)
	return &resembleTTS{
		resembleOption: rsmblOpts,
		ctx:            ct,
		ctxCancel:      ctxCancel,
		logger:         logger,
		onPacket:       onPacket,
	}, nil
}

// Initialize opens a fresh WebSocket connection to Resemble and starts the
// read goroutine. Called at session start and after each interruption so the
// connection is warm before the first text delta arrives.
func (rt *resembleTTS) Initialize() error {
	start := time.Now()
	headers := http.Header{}
	headers.Set("Authorization", fmt.Sprintf("Bearer %s", rt.GetKey()))
	conn, _, err := websocket.DefaultDialer.Dial("wss://websocket.cluster.resemble.ai/stream", headers)
	if err != nil {
		rt.logger.Errorf("resemble-tts: unable to connect to websocket err: %v", err)
		return err
	}

	rt.mu.Lock()
	rt.connection = conn
	rt.mu.Unlock()

	rt.logger.Debugf("resemble-tts: connection established")
	go rt.readLoop(conn)
	rt.onPacket(internal_type.ConversationEventPacket{
		Name: "tts",
		Data: map[string]string{
			"type":     "initialized",
			"provider": rt.Name(),
			"init_ms":  fmt.Sprintf("%d", time.Since(start).Milliseconds()),
		},
		Time: time.Now(),
	})
	return nil
}

func (*resembleTTS) Name() string {
	return "resemble-text-to-speech"
}

// handleFlushComplete is called when Resemble signals audio_end. It emits
// TextToSpeechEndPacket — correctly ordered after the last audio chunk — and
// closes the per-turn connection.
func (rt *resembleTTS) handleFlushComplete(conn *websocket.Conn) {
	rt.mu.Lock()
	contextId := rt.contextId
	rt.connection = nil // mark before Close so readLoop error handler sees intentional
	rt.mu.Unlock()

	rt.onPacket(
		internal_type.TextToSpeechEndPacket{ContextID: contextId},
		internal_type.ConversationEventPacket{
			Name: "tts",
			Data: map[string]string{"type": "completed"},
			Time: time.Now(),
		},
	)
	conn.Close()
}

// readLoop owns a single WebSocket connection for the duration of one TTS turn.
// It exits when the connection closes — intentionally (interrupt / audio_end)
// or unexpectedly (network drop).
func (rt *resembleTTS) readLoop(conn *websocket.Conn) {
	for {
		select {
		case <-rt.ctx.Done():
			return
		default:
		}

		_, audioChunk, err := conn.ReadMessage()
		if err != nil {
			rt.mu.Lock()
			intentional := rt.connection == nil // set to nil before conn.Close() on intentional paths
			if !intentional {
				rt.connection = nil // unintentional drop: next delta will reconnect
			}
			rt.mu.Unlock()
			if !intentional {
				rt.logger.Errorf("resemble-tts: connection lost: %v", err)
			}
			return
		}

		var audioData map[string]interface{}
		if err := json.Unmarshal(audioChunk, &audioData); err != nil {
			rt.logger.Errorf("resemble-tts: error parsing audio chunk: %v", err)
			continue
		}

		messageType, ok := audioData["type"].(string)
		if !ok {
			rt.logger.Errorf("resemble-tts: invalid message type format")
			continue
		}

		switch messageType {
		case "audio_end":
			rt.handleFlushComplete(conn)
			return
		case "audio":
			payload, ok := audioData["audio_content"].(string)
			if !ok {
				rt.logger.Errorf("resemble-tts: invalid audio_content format")
				continue
			}
			rawAudioData, err := base64.StdEncoding.DecodeString(payload)
			if err != nil {
				rt.logger.Errorf("resemble-tts: error decoding base64 string: %v", err)
				continue
			}
			rt.mu.Lock()
			contextId := rt.contextId
			startedAt := rt.ttsStartedAt
			metricSent := rt.ttsMetricSent
			if !metricSent && !startedAt.IsZero() {
				rt.ttsMetricSent = true
			}
			rt.mu.Unlock()
			if !metricSent && !startedAt.IsZero() {
				rt.onPacket(internal_type.MessageMetricPacket{
					ContextID: contextId,
					Metrics: []*protos.Metric{{
						Name:  "tts_latency_ms",
						Value: fmt.Sprintf("%d", time.Since(startedAt).Milliseconds()),
					}},
				})
			}
			rt.onPacket(internal_type.TextToSpeechAudioPacket{ContextID: contextId, AudioChunk: rawAudioData})
		default:
			rt.logger.Debugf("resemble-tts: unhandled message type: %s", messageType)
		}
	}
}

func (rt *resembleTTS) Transform(ctx context.Context, in internal_type.LLMPacket) error {
	rt.mu.Lock()
	if in.ContextId() != rt.contextId {
		rt.contextId = in.ContextId()
		rt.ttsStartedAt = time.Time{}
		rt.ttsMetricSent = false
	}
	connection := rt.connection
	rt.mu.Unlock()

	switch input := in.(type) {
	case internal_type.InterruptionPacket:
		rt.mu.Lock()
		rt.contextId = ""
		rt.ttsStartedAt = time.Time{}
		rt.ttsMetricSent = false
		conn := rt.connection
		rt.connection = nil
		rt.mu.Unlock()
		if conn != nil {
			conn.Close()
		}
		rt.onPacket(internal_type.ConversationEventPacket{
			Name: "tts",
			Data: map[string]string{"type": "interrupted"},
			Time: time.Now(),
		})
		if err := rt.Initialize(); err != nil {
			rt.logger.Errorf("resemble-tts: reconnect after interrupt failed: %v", err)
		}
		return nil

	case internal_type.LLMResponseDeltaPacket:
		// Fallback reconnect: handles Initialize() failure or an unintentional drop.
		if connection == nil {
			if err := rt.Initialize(); err != nil {
				return fmt.Errorf("resemble-tts: failed to connect: %w", err)
			}
			rt.mu.Lock()
			connection = rt.connection
			if rt.ttsStartedAt.IsZero() {
				rt.ttsStartedAt = time.Now()
			}
			rt.mu.Unlock()
		} else {
			rt.mu.Lock()
			if rt.ttsStartedAt.IsZero() {
				rt.ttsStartedAt = time.Now()
			}
			rt.mu.Unlock()
		}
		rt.mu.Lock()
		currentCtx := rt.contextId
		rt.mu.Unlock()
		if err := connection.WriteJSON(rt.GetTextToSpeechRequest(currentCtx, input.Text)); err != nil {
			rt.logger.Errorf("resemble-tts: error while writing request to websocket: %v", err)
			return err
		}
		rt.onPacket(internal_type.ConversationEventPacket{
			Name: "tts",
			Data: map[string]string{
				"type": "speaking",
				"text": input.Text,
			},
			Time: time.Now(),
		})
		return nil

	case internal_type.LLMResponseDonePacket:
		// TextToSpeechEndPacket is emitted by handleFlushComplete once audio_end received.
		return nil

	default:
		return fmt.Errorf("resemble-tts: unsupported input type %T", in)
	}
}

func (rt *resembleTTS) Close(ctx context.Context) error {
	rt.ctxCancel()
	rt.mu.Lock()
	defer rt.mu.Unlock()

	if rt.connection != nil {
		conn := rt.connection
		rt.connection = nil // mark before Close so readLoop sees intentional
		conn.Close()
	}
	return nil
}
