// Copyright (c) 2023-2025 RapidaAI
// Author: Prashant Srivastav <prashant@rapida.ai>
//
// Licensed under GPL-2.0 with Rapida Additional Terms.
// See LICENSE.md or contact sales@rapida.ai for commercial usage.
package internal_transformer_sarvam

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/gorilla/websocket"
	sarvam_internal "github.com/rapidaai/api/assistant-api/internal/transformer/sarvam/internal"
	internal_type "github.com/rapidaai/api/assistant-api/internal/type"
	"github.com/rapidaai/pkg/commons"
	"github.com/rapidaai/pkg/utils"
	"github.com/rapidaai/protos"
)

type sarvamSpeechToText struct {
	*sarvamOption

	ctx       context.Context
	ctxCancel context.CancelFunc

	mu         sync.Mutex
	connection *websocket.Conn
	startedAt  time.Time

	logger   commons.Logger
	onPacket func(pkt ...internal_type.Packet) error
}

func (*sarvamSpeechToText) Name() string {
	return "sarvam-speech-to-text"
}

func NewSarvamSpeechToText(
	ctx context.Context,
	logger commons.Logger,
	credential *protos.VaultCredential,
	onPacket func(pkt ...internal_type.Packet) error,
	opts utils.Option,
) (internal_type.SpeechToTextTransformer, error) {
	sarvamOpts, err := NewSarvamOption(logger, credential, opts)
	if err != nil {
		logger.Errorf("sarvam-stt: failed to initialize options: %v", err)
		return nil, err
	}

	ct, ctxCancel := context.WithCancel(ctx)
	return &sarvamSpeechToText{
		ctx:          ct,
		ctxCancel:    ctxCancel,
		logger:       logger,
		sarvamOption: sarvamOpts,
		onPacket:     onPacket,
	}, nil
}

func (cst *sarvamSpeechToText) Initialize() error {
	start := time.Now()
	header := http.Header{}
	header.Set("Api-Subscription-Key", cst.GetKey())
	conn, _, err := websocket.DefaultDialer.Dial(cst.speechToTextUrl(), header)
	if err != nil {
		return fmt.Errorf("sarvam-stt: dial failed: %w", err)
	}

	cst.mu.Lock()
	cst.connection = conn
	cst.mu.Unlock()

	go cst.readLoop(conn)

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

// readLoop owns a single WebSocket connection for the lifetime of the STT session.
// It exits when the connection closes — intentionally (Close) or unexpectedly (drop).
func (cst *sarvamSpeechToText) readLoop(conn *websocket.Conn) {
	for {
		select {
		case <-cst.ctx.Done():
			return
		default:
		}

		_, msg, err := conn.ReadMessage()
		if err != nil {
			cst.mu.Lock()
			intentional := cst.connection == nil // set to nil before conn.Close() on intentional paths
			if !intentional {
				cst.connection = nil // unintentional drop
			}
			cst.mu.Unlock()
			if !intentional {
				cst.logger.Errorf("sarvam-stt: connection lost: %v", err)
			}
			return
		}

		var response sarvam_internal.SarvamSpeechToTextResponse
		if err := json.Unmarshal(msg, &response); err != nil {
			cst.logger.Errorf("sarvam-stt: failed to parse message: %v", err)
			continue
		}

		switch response.Type {
		case "data":
			cst.handleTranscription(response)
		case "error":
			cst.handleServerError(response)
		case "events":
			cst.logger.Infof("sarvam-stt: vad event: %s", string(response.Data))
		default:
			cst.logger.Warnf("sarvam-stt: unknown message type: %s", response.Type)
		}
	}
}

func (cst *sarvamSpeechToText) handleTranscription(response sarvam_internal.SarvamSpeechToTextResponse) {
	transcriptionData, err := response.AsTranscription()
	if err != nil {
		cst.logger.Errorf("sarvam-stt: invalid transcription payload: %v", err)
		return
	}

	now := time.Now()
	cst.mu.Lock()
	var latencyMs int64
	if !cst.startedAt.IsZero() {
		latencyMs = now.Sub(cst.startedAt).Milliseconds()
		cst.startedAt = time.Time{}
	}
	cst.mu.Unlock()

	langCode := ""
	if transcriptionData.LanguageCode != nil {
		langCode = *transcriptionData.LanguageCode
	}

	cst.onPacket(
		internal_type.InterruptionPacket{Source: internal_type.InterruptionSourceWord},
		internal_type.SpeechToTextPacket{
			Script:     transcriptionData.Transcript,
			Confidence: 0.9,
			Language:   langCode,
			Interim:    false,
		},
		internal_type.ConversationEventPacket{
			Name: "stt",
			Data: map[string]string{
				"type":       "completed",
				"script":     transcriptionData.Transcript,
				"confidence": "0.9000",
				"language":   langCode,
				"word_count": fmt.Sprintf("%d", len(strings.Fields(transcriptionData.Transcript))),
				"char_count": fmt.Sprintf("%d", len(transcriptionData.Transcript)),
			},
			Time: now,
		},
		internal_type.MessageMetricPacket{
			Metrics: []*protos.Metric{{Name: "stt_latency_ms", Value: fmt.Sprintf("%d", latencyMs)}},
		},
	)
}

func (cst *sarvamSpeechToText) handleServerError(response sarvam_internal.SarvamSpeechToTextResponse) {
	errorData, err := response.AsError()
	if err != nil {
		cst.logger.Errorf("sarvam-stt: could not parse error payload: %v", err)
		return
	}
	cst.logger.Errorf("sarvam-stt: server error code=%s message=%s", errorData.Code, errorData.Error)
	cst.onPacket(internal_type.ConversationEventPacket{
		Name: "stt",
		Data: map[string]string{
			"type":    "error",
			"message": errorData.Error,
		},
		Time: time.Now(),
	})
}

func (cst *sarvamSpeechToText) Transform(ctx context.Context, in internal_type.UserAudioPacket) error {
	vl, err := cst.speechToTextMessage(in.Audio)
	if err != nil {
		return fmt.Errorf("sarvam-stt: failed to encode audio: %w", err)
	}

	cst.mu.Lock()
	connection := cst.connection
	if cst.startedAt.IsZero() {
		cst.startedAt = time.Now()
	}
	cst.mu.Unlock()

	if connection == nil {
		return fmt.Errorf("sarvam-stt: connection is not initialized")
	}

	if err := connection.WriteMessage(websocket.TextMessage, vl); err != nil {
		return fmt.Errorf("sarvam-stt: failed to send audio: %w", err)
	}

	return nil
}

func (cst *sarvamSpeechToText) Close(ctx context.Context) error {
	cst.ctxCancel()
	cst.mu.Lock()
	defer cst.mu.Unlock()
	if cst.connection != nil {
		conn := cst.connection
		cst.connection = nil // mark nil before Close so readLoop sees intentional
		conn.Close()
	}
	return nil
}
