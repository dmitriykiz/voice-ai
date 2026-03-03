// Copyright (c) 2023-2025 RapidaAI
// Author: Prashant Srivastav <prashant@rapida.ai>
//
// Licensed under GPL-2.0 with Rapida Additional Terms.
// See LICENSE.md or contact sales@rapida.ai for commercial usage.

package internal_transformer_neuphonic

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"net/http"
	"sync"
	"time"

	"github.com/gorilla/websocket"

	neuphonic_internal "github.com/rapidaai/api/assistant-api/internal/transformer/neuphonic/internal"
	internal_type "github.com/rapidaai/api/assistant-api/internal/type"
	"github.com/rapidaai/pkg/commons"
	"github.com/rapidaai/pkg/utils"
	"github.com/rapidaai/protos"
)

type neuphonicTTS struct {
	*neuphonicOption
	ctx       context.Context
	ctxCancel context.CancelFunc

	mu        sync.Mutex
	contextId string

	ttsStartedAt  time.Time
	ttsMetricSent bool

	logger     commons.Logger
	connection *websocket.Conn
	onPacket   func(pkt ...internal_type.Packet) error
}

func NewNeuPhonicTextToSpeech(ctx context.Context, logger commons.Logger, credential *protos.VaultCredential,
	onPacket func(pkt ...internal_type.Packet) error,
	opts utils.Option) (internal_type.TextToSpeechTransformer, error) {
	neuphonicOpts, err := NewNeuPhonicOption(logger, credential, opts)
	if err != nil {
		logger.Errorf("neuphonic-tts: initializing neuphonic failed %+v", err)
		return nil, err
	}
	ctx2, contextCancel := context.WithCancel(ctx)
	return &neuphonicTTS{
		ctx:             ctx2,
		ctxCancel:       contextCancel,
		onPacket:        onPacket,
		logger:          logger,
		neuphonicOption: neuphonicOpts,
	}, nil
}

// Initialize opens a fresh WebSocket connection to Neuphonic and starts the
// read goroutine. Called at session start and after each interruption so the
// connection is warm before the first text delta arrives.
func (ct *neuphonicTTS) Initialize() error {
	start := time.Now()
	header := http.Header{}
	header.Set("x-api-key", ct.GetKey())
	conn, resp, err := websocket.DefaultDialer.Dial(ct.GetTextToSpeechConnectionString(), header)
	if err != nil {
		ct.logger.Errorf("neuphonic-tts: error while connecting to neuphonic %s with response %v", err, resp)
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

func (*neuphonicTTS) Name() string {
	return "neuphonic-text-to-speech"
}

// readLoop owns a single WebSocket connection for the duration of one TTS turn.
// It exits when the connection closes — intentionally (interrupt / done) or
// unexpectedly (network drop). Neuphonic has no server-side completion ACK so
// the turn ends when Transform receives LLMResponseDonePacket.
func (rt *neuphonicTTS) readLoop(conn *websocket.Conn) {
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
				rt.logger.Errorf("neuphonic-tts: connection lost: %v", err)
			}
			return
		}

		var audioData neuphonic_internal.NeuPhonicTextToSpeechResponse
		if err := json.Unmarshal(audioChunk, &audioData); err != nil {
			rt.logger.Errorf("neuphonic-tts: error parsing audio chunk: %v", err)
			continue
		}

		if audioData.Data.Audio != "" {
			if rawAudioData, err := base64.StdEncoding.DecodeString(audioData.Data.Audio); err == nil {
				rt.mu.Lock()
				startedAt := rt.ttsStartedAt
				metricSent := rt.ttsMetricSent
				ctxId := rt.contextId
				if !metricSent && !startedAt.IsZero() {
					rt.ttsMetricSent = true
				}
				rt.mu.Unlock()
				if ctxId != "" {
					if !metricSent && !startedAt.IsZero() {
						rt.onPacket(internal_type.MessageMetricPacket{
							ContextID: ctxId,
							Metrics: []*protos.Metric{{
								Name:  "tts_latency_ms",
								Value: fmt.Sprintf("%d", time.Since(startedAt).Milliseconds()),
							}},
						})
					}
					rt.onPacket(internal_type.TextToSpeechAudioPacket{ContextID: ctxId, AudioChunk: rawAudioData})
				}
			} else {
				rt.logger.Errorf("neuphonic-tts: error decoding base64 audio: %v", err)
			}
		}
	}
}

func (t *neuphonicTTS) Transform(ctx context.Context, in internal_type.LLMPacket) error {
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
			t.logger.Errorf("neuphonic-tts: reconnect after interrupt failed: %v", err)
		}
		return nil

	case internal_type.LLMResponseDeltaPacket:
		// Fallback reconnect: handles Initialize() failure or an unintentional drop.
		if connection == nil {
			if err := t.Initialize(); err != nil {
				return fmt.Errorf("neuphonic-tts: failed to connect: %w", err)
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
		if err := connection.WriteJSON(map[string]interface{}{
			"text": input.Text + " <STOP>",
		}); err != nil {
			t.logger.Errorf("neuphonic-tts: unable to write json for text to speech: %v", err)
			return err
		}
		t.onPacket(internal_type.ConversationEventPacket{
			Name: "tts",
			Data: map[string]string{
				"type": "speaking",
				"text": input.Text,
			},
			Time: time.Now(),
		})
		return nil

	case internal_type.LLMResponseDonePacket:
		// Interrupted before done arrived — nothing to flush.
		if connection == nil {
			return nil
		}
		// Neuphonic has no server-side completion ACK, so we emit TextToSpeechEndPacket
		// here and close the per-turn connection ourselves.
		if err := connection.WriteJSON(map[string]interface{}{
			"text": "<STOP>",
		}); err != nil {
			t.logger.Errorf("neuphonic-tts: unable to send stop signal: %v", err)
		}
		t.mu.Lock()
		ctxId := t.contextId
		t.connection = nil // mark before Close so readLoop sees intentional
		t.mu.Unlock()
		connection.Close()
		t.onPacket(
			internal_type.TextToSpeechEndPacket{ContextID: ctxId},
			internal_type.ConversationEventPacket{
				Name: "tts",
				Data: map[string]string{"type": "completed"},
				Time: time.Now(),
			},
		)
		return nil

	default:
		return fmt.Errorf("neuphonic-tts: unsupported input type %T", in)
	}
}

func (t *neuphonicTTS) Close(ctx context.Context) error {
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
