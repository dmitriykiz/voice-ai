// Copyright (c) 2023-2025 RapidaAI
// Author: Prashant Srivastav <prashant@rapida.ai>
//
// Licensed under GPL-2.0 with Rapida Additional Terms.
// See LICENSE.md or contact sales@rapida.ai for commercial usage.

package internal_transformer_cartesia

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"sync"
	"time"

	"github.com/gorilla/websocket"
	cartesia_internal "github.com/rapidaai/api/assistant-api/internal/transformer/cartesia/internal"
	internal_type "github.com/rapidaai/api/assistant-api/internal/type"
	"github.com/rapidaai/pkg/commons"
	"github.com/rapidaai/pkg/utils"
	protos "github.com/rapidaai/protos"
)

type cartesiaSpeechToText struct {
	*cartesiaOption
	mu     sync.Mutex
	logger commons.Logger

	// context management
	ctx       context.Context
	ctxCancel context.CancelFunc

	connection *websocket.Conn
	onPacket   func(pkt ...internal_type.Packet) error

	// observability: time when speech started
	startedAt time.Time
}

// Name implements internal_transformer.SpeechToTextTransformer.
func (*cartesiaSpeechToText) Name() string {
	return "cartesia-speech-to-text"
}

func NewCartesiaSpeechToText(ctx context.Context, logger commons.Logger, credential *protos.VaultCredential,
	onPacket func(pkt ...internal_type.Packet) error,
	opts utils.Option) (internal_type.SpeechToTextTransformer, error) {
	cartesiaOpts, err := NewCartesiaOption(logger, credential, opts)
	if err != nil {
		logger.Errorf("cartesia-stt: intializing cartesia failed %+v", err)
		return nil, err
	}
	ct, ctxCancel := context.WithCancel(ctx)
	return &cartesiaSpeechToText{
		ctx:            ct,
		ctxCancel:      ctxCancel,
		logger:         logger,
		cartesiaOption: cartesiaOpts,
		onPacket:       onPacket,
	}, nil
}

func (cst *cartesiaSpeechToText) Initialize() error {
	start := time.Now()
	conn, _, err := websocket.DefaultDialer.Dial(cst.GetSpeechToTextConnectionString(), nil)
	if err != nil {
		cst.logger.Errorf("cartesia-stt: failed to connect to Cartesia WebSocket: %w", err)
		return err
	}
	//
	cst.mu.Lock()
	cst.connection = conn
	defer cst.mu.Unlock()

	go cst.speechToTextCallback(conn, cst.ctx)
	cst.logger.Debugf("cartesia-stt: connection established")

	cst.onPacket(internal_type.ConversationEventPacket{
		Name: "stt",
		Data: map[string]string{
			"type":     "initialized",
			"provider": cst.Name(),
			"init_ms":  fmt.Sprintf("%d", time.Since(start).Milliseconds()),
		},
		Time: time.Now(),
	})
	return nil
}

// textToSpeechCallback processes streaming responses asynchronously.
func (cst *cartesiaSpeechToText) speechToTextCallback(conn *websocket.Conn, ctx context.Context) {
	for {
		select {
		case <-ctx.Done():
			cst.logger.Infof("cartesia-tts: context cancelled, stopping response listener")
			return
		default:
			_, msg, err := conn.ReadMessage()
			if err != nil {
				cst.logger.Error("cartesia-tts: error reading from Cartesia WebSocket: ", err)
				cst.onPacket(internal_type.ConversationEventPacket{
					Name: "stt",
					Data: map[string]string{"type": "error", "error": err.Error()},
					Time: time.Now(),
				})
				return
			}
			var resp cartesia_internal.SpeechToTextOutput
			if err := json.Unmarshal(msg, &resp); err == nil && resp.Text != "" {
				if cst.onPacket != nil {
					if !resp.IsFinal {
						cst.onPacket(
							internal_type.InterruptionPacket{Source: internal_type.InterruptionSourceWord},
							internal_type.SpeechToTextPacket{
								Script:   resp.Text,
								Language: resp.Language,
								Interim:  true,
							},
							internal_type.ConversationEventPacket{
								Name: "stt",
								Data: map[string]string{
									"type":       "interim",
									"script":     resp.Text,
									"confidence": "0.9000",
								},
								Time: time.Now(),
							},
						)
					} else {
						now := time.Now()
						var latencyMs int64
						cst.mu.Lock()
						if !cst.startedAt.IsZero() {
							latencyMs = now.Sub(cst.startedAt).Milliseconds()
							cst.startedAt = time.Time{}
						}
						cst.mu.Unlock()
						cst.onPacket(
							internal_type.InterruptionPacket{Source: internal_type.InterruptionSourceWord},
							internal_type.SpeechToTextPacket{
								Script:   resp.Text,
								Language: resp.Language,
								Interim:  false,
							},
							internal_type.ConversationEventPacket{
								Name: "stt",
								Data: map[string]string{
									"type":       "completed",
									"script":     resp.Text,
									"confidence": "0.9000",
									"language":   resp.Language,
									"word_count": fmt.Sprintf("%d", len(strings.Fields(resp.Text))),
									"char_count": fmt.Sprintf("%d", len(resp.Text)),
								},
								Time: now,
							},
							internal_type.MessageMetricPacket{
								Metrics: []*protos.Metric{{Name: "stt_latency_ms", Value: fmt.Sprintf("%d", latencyMs)}},
							},
						)
					}
				}
			}
		}
	}
}

func (cst *cartesiaSpeechToText) Transform(ctx context.Context, in internal_type.UserAudioPacket) error {
	cst.mu.Lock()
	conn := cst.connection
	if cst.startedAt.IsZero() {
		cst.startedAt = time.Now()
	}
	defer cst.mu.Unlock()

	if conn == nil {
		return fmt.Errorf("cartesia-stt: websocket connection is not initialized")
	}
	if err := conn.WriteMessage(websocket.BinaryMessage, in.Audio); err != nil {
		return fmt.Errorf("failed to send audio data: %w", err)
	}
	return nil
}

func (cst *cartesiaSpeechToText) Close(ctx context.Context) error {
	cst.ctxCancel()

	cst.mu.Lock()
	defer cst.mu.Unlock()

	if cst.connection != nil {
		if err := cst.connection.Close(); err != nil {
			return fmt.Errorf("error closing WebSocket connection: %w", err)
		}
		cst.logger.Info("cartesia-stt: cartesia websocket connection closed")
	}
	return nil
}
