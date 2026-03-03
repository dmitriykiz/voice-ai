// Copyright (c) 2023-2025 RapidaAI
// Author: Prashant Srivastav <prashant@rapida.ai>
//
// Licensed under GPL-2.0 with Rapida Additional Terms.
// See LICENSE.md or contact sales@rapida.ai for commercial usage.

package internal_transformer_assemblyai

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/gorilla/websocket"
	assemblyai_internal "github.com/rapidaai/api/assistant-api/internal/transformer/assembly-ai/internal"
	internal_type "github.com/rapidaai/api/assistant-api/internal/type"
	"github.com/rapidaai/pkg/commons"
	"github.com/rapidaai/pkg/utils"
	"github.com/rapidaai/protos"
)

type assemblyaiSTT struct {
	*assemblyaiOption

	ctx       context.Context
	ctxCancel context.CancelFunc

	mu         sync.Mutex
	connection *websocket.Conn
	logger     commons.Logger
	onPacket   func(pkt ...internal_type.Packet) error

	startedAt time.Time
}

func NewAssemblyaiSpeechToText(ctx context.Context, logger commons.Logger, credential *protos.VaultCredential,
	onPacket func(pkt ...internal_type.Packet) error,
	opts utils.Option,
) (internal_type.SpeechToTextTransformer, error) {
	ayOptions, err := NewAssemblyaiOption(
		logger,
		credential,
		opts,
	)
	if err != nil {
		logger.Errorf("assembly-ai-stt: key from credential failed %v", err)
		return nil, err
	}
	ct, ctxCancel := context.WithCancel(ctx)
	return &assemblyaiSTT{
		ctx:              ct,
		ctxCancel:        ctxCancel,
		logger:           logger,
		assemblyaiOption: ayOptions,
		onPacket:         onPacket,
	}, nil
}

func (aai *assemblyaiSTT) Name() string {
	return "assemblyai-speech-to-text"
}

func (aai *assemblyaiSTT) Initialize() error {
	start := time.Now()
	headers := http.Header{}
	headers.Set("Authorization", aai.GetKey())
	dialer := websocket.Dialer{
		Proxy:            nil,
		HandshakeTimeout: 10 * time.Second,
	}

	connection, _, err := dialer.Dial(aai.GetSpeechToTextConnectionString(), headers)
	if err != nil {
		aai.logger.Errorf("assembly-ai-stt: failed to connect to websocket: %v", err)
		return fmt.Errorf("failed to connect to assemblyai websocket: %w", err)
	}

	aai.mu.Lock()
	aai.connection = connection
	aai.mu.Unlock()

	aai.logger.Debugf("assembly-ai-stt: connection established")
	go aai.readLoop(connection)

	aai.onPacket(internal_type.ConversationEventPacket{
		Name: "stt",
		Data: map[string]string{
			"type":     "initialized",
			"provider": aai.Name(),
			"init_ms":  fmt.Sprintf("%d", time.Since(start).Milliseconds()),
		},
		Time: time.Now(),
	})
	return nil
}

// readLoop owns the WebSocket connection for the lifetime of the STT session.
// It exits when the connection closes — intentionally (Close) or unexpectedly (drop).
func (aai *assemblyaiSTT) readLoop(conn *websocket.Conn) {
	for {
		select {
		case <-aai.ctx.Done():
			return
		default:
		}

		_, msg, err := conn.ReadMessage()
		if err != nil {
			aai.mu.Lock()
			intentional := aai.connection == nil // set to nil before conn.Close() on intentional paths
			if !intentional {
				aai.connection = nil // unintentional drop
			}
			aai.mu.Unlock()
			if !intentional {
				aai.logger.Errorf("assembly-ai-stt: connection lost: %v", err)
				aai.onPacket(internal_type.ConversationEventPacket{
					Name: "stt",
					Data: map[string]string{"type": "error", "error": err.Error()},
					Time: time.Now(),
				})
			}
			return
		}

		var transcript assemblyai_internal.TranscriptMessage
		if err := json.Unmarshal(msg, &transcript); err != nil {
			aai.logger.Errorf("assembly-ai-stt: error unmarshalling transcript: %v", err)
			continue
		}

		switch transcript.Type {
		case "Turn":
			if len(transcript.Words) == 0 {
				aai.logger.Warnf("assembly-ai-stt: received Turn message with no words")
				continue
			}

			threshold := 0.0
			if v, err := aai.assemblyaiOption.mdlOpts.GetFloat64("listen.threshold"); err == nil {
				threshold = v
			}

			var filteredTranscript string
			var totalConfidence float64
			var wordCount int
			for _, word := range transcript.Words {
				if word.Confidence >= threshold {
					filteredTranscript += word.Text + " "
					totalConfidence += word.Confidence
					wordCount++
				}
			}

			if wordCount == 0 {
				continue
			}

			isInterim := !transcript.EndOfTurn || !transcript.TurnIsFormatted
			confStr := fmt.Sprintf("%.4f", totalConfidence/float64(wordCount))

			if isInterim {
				aai.onPacket(
					internal_type.InterruptionPacket{Source: internal_type.InterruptionSourceWord},
					internal_type.SpeechToTextPacket{
						Script:     filteredTranscript,
						Language:   "en",
						Confidence: totalConfidence / float64(wordCount),
						Interim:    true,
					},
					internal_type.ConversationEventPacket{
						Name: "stt",
						Data: map[string]string{
							"type":       "interim",
							"script":     filteredTranscript,
							"confidence": confStr,
						},
						Time: time.Now(),
					},
				)
			} else {
				now := time.Now()
				var latencyMs int64
				aai.mu.Lock()
				if !aai.startedAt.IsZero() {
					latencyMs = now.Sub(aai.startedAt).Milliseconds()
					aai.startedAt = time.Time{}
				}
				aai.mu.Unlock()
				aai.onPacket(
					internal_type.InterruptionPacket{Source: internal_type.InterruptionSourceWord},
					internal_type.SpeechToTextPacket{
						Script:     filteredTranscript,
						Language:   "en",
						Confidence: totalConfidence / float64(wordCount),
						Interim:    false,
					},
					internal_type.ConversationEventPacket{
						Name: "stt",
						Data: map[string]string{
							"type":       "completed",
							"script":     filteredTranscript,
							"confidence": confStr,
							"language":   "en",
							"word_count": fmt.Sprintf("%d", len(strings.Fields(filteredTranscript))),
							"char_count": fmt.Sprintf("%d", len(filteredTranscript)),
						},
						Time: now,
					},
					internal_type.MessageMetricPacket{
						Metrics: []*protos.Metric{{Name: "stt_latency_ms", Value: fmt.Sprintf("%d", latencyMs)}},
					},
				)
			}

		case "Begin":
			aai.logger.Debugf("assembly-ai-stt: received Begin message")

		default:
			aai.logger.Debugf("assembly-ai-stt: unhandled message type: %s", transcript.Type)
		}
	}
}

func (aai *assemblyaiSTT) Transform(ctx context.Context, in internal_type.UserAudioPacket) error {
	aai.mu.Lock()
	defer aai.mu.Unlock()
	if aai.connection == nil {
		return fmt.Errorf("assembly-ai-stt: websocket connection is not initialized")
	}
	if aai.startedAt.IsZero() {
		aai.startedAt = time.Now()
	}
	if err := aai.connection.WriteMessage(websocket.BinaryMessage, in.Content()); err != nil {
		aai.logger.Errorf("assembly-ai-stt: error sending audio: %v", err)
		return fmt.Errorf("error sending audio: %w", err)
	}
	return nil
}

func (aai *assemblyaiSTT) Close(ctx context.Context) error {
	aai.ctxCancel()
	aai.mu.Lock()
	defer aai.mu.Unlock()

	if aai.connection != nil {
		conn := aai.connection
		aai.connection = nil // mark before Close so readLoop sees intentional
		conn.Close()
	}
	return nil
}
