// Copyright (c) 2023-2025 RapidaAI
// Author: Prashant Srivastav <prashant@rapida.ai>
//
// Licensed under GPL-2.0 with Rapida Additional Terms.
// See LICENSE.md or contact sales@rapida.ai for commercial usage.

package internal_transformer_azure

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"sync"
	"time"

	"github.com/Microsoft/cognitive-services-speech-sdk-go/audio"
	"github.com/Microsoft/cognitive-services-speech-sdk-go/common"
	"github.com/Microsoft/cognitive-services-speech-sdk-go/speech"
	azure_internal "github.com/rapidaai/api/assistant-api/internal/transformer/azure/internal"
	internal_type "github.com/rapidaai/api/assistant-api/internal/type"
	"github.com/rapidaai/pkg/commons"
	"github.com/rapidaai/pkg/utils"
	"github.com/rapidaai/protos"
)

const defaultConfidence = 0.9

type azureSpeechToText struct {
	*azureOption
	mu sync.Mutex

	// context management
	ctx       context.Context
	ctxCancel context.CancelFunc

	logger           commons.Logger
	client           *speech.SpeechRecognizer
	azureAudioConfig *audio.AudioConfig
	inputstream      *audio.PushAudioInputStream
	onPacket         func(pkt ...internal_type.Packet) error

	// observability: time when speech started
	startedAt time.Time
}

// NewAzureSpeechToText creates a new Azure Speech-to-Text transformer instance.
func NewAzureSpeechToText(
	ctx context.Context,
	logger commons.Logger,
	credential *protos.VaultCredential,
	onPacket func(pkt ...internal_type.Packet) error,
	opts utils.Option,
) (internal_type.SpeechToTextTransformer, error) {
	azureOpt, err := NewAzureOption(logger, credential, opts)
	if err != nil {
		logger.Errorf("azure-stt: unable to initialize azure option: %v", err)
		return nil, err
	}

	childCtx, cancel := context.WithCancel(ctx)
	return &azureSpeechToText{
		ctx:         childCtx,
		ctxCancel:   cancel,
		logger:      logger,
		onPacket:    onPacket,
		azureOption: azureOpt,
	}, nil
}

// Initialize sets up the Azure Speech-to-Text recognizer with audio stream and event handlers.
func (s *azureSpeechToText) Initialize() error {
	start := time.Now()
	inputStream, err := audio.CreatePushAudioInputStreamFromFormat(s.GetAudioStreamFormat())
	if err != nil {
		s.logger.Errorf("azure-stt: failed to create push audio input stream: %v", err)
		return fmt.Errorf("failed to create push audio input stream: %w", err)
	}

	audioConfig, err := audio.NewAudioConfigFromStreamInput(inputStream)
	if err != nil {
		s.logger.Errorf("azure-stt: failed to create audio config from stream input: %v", err)
		return fmt.Errorf("failed to create audio config from stream input: %w", err)
	}

	speechConfig, err := s.SpeechToTextOption()
	if err != nil {
		s.logger.Errorf("azure-stt: failed to create speech config from subscription: %v", err)
		return fmt.Errorf("failed to create speech config from subscription: %w", err)
	}

	client, err := speech.NewSpeechRecognizerFromConfig(speechConfig, audioConfig)
	if err != nil {
		s.logger.Errorf("azure-stt: failed to create speech recognizer from config: %v", err)
		return fmt.Errorf("failed to create speech recognizer from config: %w", err)
	}

	s.mu.Lock()
	s.client = client
	s.azureAudioConfig = audioConfig
	s.inputstream = inputStream
	s.mu.Unlock()

	s.registerEventHandlers()
	s.client.StartContinuousRecognitionAsync()

	s.onPacket(internal_type.ConversationEventPacket{
		Name: "stt",
		Data: map[string]string{
			"type":     "initialized",
			"provider": s.Name(),
			"init_ms":  fmt.Sprintf("%d", time.Since(start).Milliseconds()),
		},
		Time: time.Now(),
	})
	return nil
}

// registerEventHandlers sets up all the speech recognition event callbacks.
func (s *azureSpeechToText) registerEventHandlers() {
	s.client.SessionStarted(s.OnSessionStarted)
	s.client.SessionStopped(s.OnSessionStopped)
	s.client.Recognizing(s.OnRecognizing)
	s.client.Recognized(s.OnRecognized)
	s.client.Canceled(s.OnCancelled)
}

// Name returns the transformer identifier.
func (s *azureSpeechToText) Name() string {
	return "azure-speech-to-text"
}

// Transform writes audio data to the input stream for recognition.
func (s *azureSpeechToText) Transform(_ context.Context, in internal_type.UserAudioPacket) error {
	s.mu.Lock()
	stream := s.inputstream
	s.mu.Unlock()

	if stream == nil {
		return fmt.Errorf("azure-stt: transform called before initialize")
	}

	if err := stream.Write(in.Content()); err != nil {
		return fmt.Errorf("failed to write audio data: %w", err)
	}

	return nil
}

func (s *azureSpeechToText) OnSessionStarted(event speech.SessionEventArgs) {
	defer event.Close()
}

func (s *azureSpeechToText) OnSessionStopped(event speech.SessionEventArgs) {
	defer event.Close()
}

// OnRecognizing handles interim speech recognition results.
func (s *azureSpeechToText) OnRecognizing(event speech.SpeechRecognitionEventArgs) {
	defer event.Close()

	jsonResult := event.Result.Properties.GetProperty(common.SpeechServiceResponseJSONResult, "{}")

	var result azure_internal.AzureRecognizingResult
	if err := json.Unmarshal([]byte(jsonResult), &result); err != nil {
		s.logger.Warnf("failed to parse recognizing result: %v", err)
		return
	}

	if result.Text == "" {
		return
	}

	if s.startedAt.IsZero() {
		s.startedAt = time.Now()
	}

	language := result.PrimaryLanguage.Language
	if language == "" {
		language = "en-US"
	}

	s.onPacket(
		internal_type.InterruptionPacket{Source: internal_type.InterruptionSourceWord},
		internal_type.SpeechToTextPacket{
			Script:     result.Text,
			Confidence: defaultConfidence,
			Language:   language,
			Interim:    true,
		},
		internal_type.ConversationEventPacket{
			Name: "stt",
			Data: map[string]string{
				"type":       "interim",
				"script":     result.Text,
				"confidence": "0.9000",
			},
			Time: time.Now(),
		},
	)
}

// OnRecognized handles final speech recognition results.
func (s *azureSpeechToText) OnRecognized(event speech.SpeechRecognitionEventArgs) {
	defer event.Close()
	jsonResult := event.Result.Properties.GetProperty(common.SpeechServiceResponseJSONResult, "{}")

	var result azure_internal.AzureRecognizedResult
	if err := json.Unmarshal([]byte(jsonResult), &result); err != nil {
		s.logger.Warnf("failed to parse recognized result: %v", err)
		return
	}
	if result.RecognitionStatus != "Success" {
		return
	}

	text := result.DisplayText
	confidence := defaultConfidence

	if len(result.NBest) > 0 {
		confidence = result.NBest[0].Confidence
		if threshold, err := s.mdlOpts.GetFloat64("listen.threshold"); err == nil {
			if confidence < threshold {
				s.logger.Debugf("confidence %.4f below threshold %.4f, skipping", confidence, threshold)
				return
			}
		}
		if result.NBest[0].Display != "" {
			text = result.NBest[0].Display
		}
	}

	if text == "" {
		return
	}

	now := time.Now()
	var latencyMs int64
	if !s.startedAt.IsZero() {
		latencyMs = now.Sub(s.startedAt).Milliseconds()
		s.startedAt = time.Time{}
	}

	confStr := fmt.Sprintf("%.4f", confidence)
	s.onPacket(
		internal_type.InterruptionPacket{Source: internal_type.InterruptionSourceWord},
		internal_type.SpeechToTextPacket{
			Script:     text,
			Confidence: confidence,
			Language:   "en-US",
			Interim:    false,
		},
		internal_type.ConversationEventPacket{
			Name: "stt",
			Data: map[string]string{
				"type":       "completed",
				"script":     text,
				"confidence": confStr,
				"language":   "en-US",
				"word_count": fmt.Sprintf("%d", len(strings.Fields(text))),
				"char_count": fmt.Sprintf("%d", len(text)),
			},
			Time: now,
		},
		internal_type.MessageMetricPacket{
			Metrics: []*protos.Metric{{Name: "stt_latency_ms", Value: fmt.Sprintf("%d", latencyMs)}},
		},
	)
}

func (s *azureSpeechToText) OnCancelled(event speech.SpeechRecognitionCanceledEventArgs) {
	defer event.Close()
	s.onPacket(internal_type.ConversationEventPacket{
		Name: "stt",
		Data: map[string]string{"type": "error", "error": "recognition cancelled"},
		Time: time.Now(),
	})
}

// Close stops recognition and releases all Azure Speech SDK resources.
func (s *azureSpeechToText) Close(_ context.Context) error {
	s.ctxCancel()

	s.mu.Lock()
	defer s.mu.Unlock()

	if s.client != nil {
		s.client.StopContinuousRecognitionAsync()
		s.client.Close()
	}
	if s.inputstream != nil {
		s.inputstream.Close()
	}
	if s.azureAudioConfig != nil {
		s.azureAudioConfig.Close()
	}

	return nil
}
