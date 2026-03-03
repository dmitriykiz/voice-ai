// Copyright (c) 2023-2025 RapidaAI
// Author: Prashant Srivastav <prashant@rapida.ai>
//
// Licensed under GPL-2.0 with Rapida Additional Terms.
// See LICENSE.md or contact sales@rapida.ai for commercial usage.

package internal_transformer_sarvam

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"net/http"
	"sync"
	"time"

	"github.com/gorilla/websocket"
	sarvam_internal "github.com/rapidaai/api/assistant-api/internal/transformer/sarvam/internal"
	internal_type "github.com/rapidaai/api/assistant-api/internal/type"
	"github.com/rapidaai/pkg/commons"
	"github.com/rapidaai/pkg/utils"
	"github.com/rapidaai/protos"
)

type sarvamTextToSpeech struct {
	*sarvamOption
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

func NewSarvamTextToSpeech(
	ctx context.Context,
	logger commons.Logger,
	credential *protos.VaultCredential,
	onPacket func(pkt ...internal_type.Packet) error,
	opts utils.Option,
) (internal_type.TextToSpeechTransformer, error) {
	sarvamOpts, err := NewSarvamOption(logger, credential, opts)
	if err != nil {
		logger.Errorf("sarvam-tts: failed to initialize options: %v", err)
		return nil, err
	}
	ct, ctxCancel := context.WithCancel(ctx)
	return &sarvamTextToSpeech{
		ctx:          ct,
		ctxCancel:    ctxCancel,
		logger:       logger,
		sarvamOption: sarvamOpts,
		onPacket:     onPacket,
	}, nil
}

func (*sarvamTextToSpeech) Name() string {
	return "sarvam-text-to-speech"
}

// Initialize opens a fresh WebSocket connection to Sarvam and starts the read
// goroutine for that connection. Called at session start and after each
// interruption so the connection is warm before the first text delta arrives.
func (rt *sarvamTextToSpeech) Initialize() error {
	start := time.Now()
	header := http.Header{}
	header.Set("Api-Subscription-Key", rt.GetKey())
	conn, _, err := websocket.DefaultDialer.Dial(rt.textToSpeechUrl(), header)
	if err != nil {
		rt.logger.Errorf("sarvam-tts: dial failed: %v", err)
		return err
	}
	if err := conn.WriteJSON(rt.configureTextToSpeech()); err != nil {
		conn.Close()
		rt.logger.Errorf("sarvam-tts: config send failed: %v", err)
		return err
	}

	rt.mu.Lock()
	rt.connection = conn
	rt.mu.Unlock()

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

// readLoop owns a single WebSocket connection for the duration of one TTS turn.
// It exits when the connection closes — intentionally (interrupt / flush complete)
// or unexpectedly (network drop / server error).
func (rt *sarvamTextToSpeech) readLoop(conn *websocket.Conn) {
	for {
		select {
		case <-rt.ctx.Done():
			return
		default:
		}

		_, msg, err := conn.ReadMessage()
		if err != nil {
			rt.mu.Lock()
			intentional := rt.connection == nil // set to nil before conn.Close() on intentional paths
			if !intentional {
				rt.connection = nil // unintentional drop: next delta will reconnect
			}
			rt.mu.Unlock()
			if !intentional {
				rt.logger.Errorf("sarvam-tts: connection lost: %v", err)
			}
			return
		}

		var response sarvam_internal.SarvamTextToSpeechResponse
		if err := json.Unmarshal(msg, &response); err != nil {
			rt.logger.Errorf("sarvam-tts: failed to parse message: %v", err)
			continue
		}

		switch response.Type {
		case "audio":
			rt.handleAudio(response)
		case "event":
			// Sarvam signals that all audio for the current flush has been sent.
			// Emit the end packet and close this per-turn connection.
			rt.handleFlushComplete(conn)
			return
		case "error":
			rt.handleServerError(conn, response)
			return
		default:
			rt.logger.Debugf("sarvam-tts: unhandled message type: %s", response.Type)
		}
	}
}

// handleAudio decodes an audio chunk and forwards it downstream.
// Chunks arriving with no active contextId are discarded (post-interrupt drain).
func (rt *sarvamTextToSpeech) handleAudio(response sarvam_internal.SarvamTextToSpeechResponse) {
	audioData, err := response.Audio()
	if err != nil {
		rt.logger.Errorf("sarvam-tts: invalid audio payload: %v", err)
		return
	}
	raw, err := base64.StdEncoding.DecodeString(audioData.Audio)
	if err != nil {
		rt.logger.Errorf("sarvam-tts: base64 decode failed: %v", err)
		return
	}

	rt.mu.Lock()
	contextId := rt.contextId
	startedAt := rt.ttsStartedAt
	metricSent := rt.ttsMetricSent
	if !metricSent && !startedAt.IsZero() {
		rt.ttsMetricSent = true
	}
	rt.mu.Unlock()

	if contextId == "" {
		rt.logger.Debugf("sarvam-tts: discarding audio — no active context")
		return
	}

	if !metricSent && !startedAt.IsZero() {
		rt.onPacket(internal_type.MessageMetricPacket{
			ContextID: contextId,
			Metrics: []*protos.Metric{{
				Name:  "tts_latency_ms",
				Value: fmt.Sprintf("%d", time.Since(startedAt).Milliseconds()),
			}},
		})
	}
	rt.onPacket(internal_type.TextToSpeechAudioPacket{ContextID: contextId, AudioChunk: raw})
}

// handleFlushComplete is called when Sarvam sends the "event" message confirming
// that all audio for the current flush has been delivered. It emits
// TextToSpeechEndPacket — correctly ordered after the last audio chunk — and
// closes the per-turn connection.
func (rt *sarvamTextToSpeech) handleFlushComplete(conn *websocket.Conn) {
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

// handleServerError logs the Sarvam error, surfaces it downstream, and closes
// the connection. The next delta will trigger a fresh reconnect via lazy fallback.
func (rt *sarvamTextToSpeech) handleServerError(conn *websocket.Conn, response sarvam_internal.SarvamTextToSpeechResponse) {
	msg := "unknown error"
	errData, err := response.AsError()
	if err != nil {
		rt.logger.Errorf("sarvam-tts: could not parse error payload: %v", err)
	} else {
		msg = errData.Message
		rt.logger.Errorf("sarvam-tts: server error code=%v message=%s", errData.Code, errData.Message)
	}
	rt.mu.Lock()
	rt.connection = nil
	rt.mu.Unlock()
	rt.onPacket(internal_type.ConversationEventPacket{
		Name: "tts",
		Data: map[string]string{"type": "error", "message": msg},
		Time: time.Now(),
	})
	conn.Close()
}

func (rt *sarvamTextToSpeech) Transform(ctx context.Context, in internal_type.LLMPacket) error {
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
		// Close the current connection immediately — the readLoop goroutine will
		// exit, discarding any in-flight audio. Reconnect now so the fresh
		// connection is ready before the next text delta arrives.
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
		// Emit before Initialize so downstream sees the interrupt immediately.
		rt.onPacket(internal_type.ConversationEventPacket{
			Name: "tts",
			Data: map[string]string{"type": "interrupted"},
			Time: time.Now(),
		})
		if err := rt.Initialize(); err != nil {
			rt.logger.Errorf("sarvam-tts: reconnect after interrupt failed: %v", err)
		}
		return nil

	case internal_type.LLMResponseDeltaPacket:
		// Fallback reconnect: handles Initialize() failure during interrupt or
		// an unintentional connection drop between turns.
		if connection == nil {
			if err := rt.Initialize(); err != nil {
				return fmt.Errorf("sarvam-tts: failed to connect: %w", err)
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
		if err := connection.WriteJSON(map[string]interface{}{
			"type": "text",
			"data": map[string]interface{}{"text": input.Text},
		}); err != nil {
			rt.logger.Errorf("sarvam-tts: write failed: %v", err)
			return err
		}
		rt.onPacket(internal_type.ConversationEventPacket{
			Name: "tts",
			Data: map[string]string{"type": "speaking", "text": input.Text},
			Time: time.Now(),
		})

	case internal_type.LLMResponseDonePacket:
		// Interrupted before done arrived — nothing to flush.
		if connection == nil {
			return nil
		}
		if err := connection.WriteJSON(map[string]interface{}{"type": "flush"}); err != nil {
			rt.logger.Errorf("sarvam-tts: flush failed: %v", err)
			return err
		}
		// TextToSpeechEndPacket is emitted by handleFlushComplete once Sarvam
		// confirms all audio has been delivered via the "event" response.

	default:
		return fmt.Errorf("sarvam-tts: unsupported packet type %T", in)
	}
	return nil
}

func (rt *sarvamTextToSpeech) Close(ctx context.Context) error {
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
