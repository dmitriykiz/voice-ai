// Copyright (c) 2023-2025 RapidaAI
// Author: Prashant Srivastav <prashant@rapida.ai>
//
// Licensed under GPL-2.0 with Rapida Additional Terms.
// See LICENSE.md or contact sales@rapida.ai for commercial usage.

package internal_transformer_openai

import (
	"context"
	"fmt"
	"time"

	openai "github.com/openai/openai-go"
	"github.com/openai/openai-go/option"
	internal_type "github.com/rapidaai/api/assistant-api/internal/type"
	"github.com/rapidaai/pkg/commons"
	"github.com/rapidaai/pkg/utils"
)

type openaiSpeechToText struct {
	logger   commons.Logger
	client   openai.Client
	ctx      context.Context
	cancel   context.CancelFunc
	onPacket func(pkt ...internal_type.Packet) error
}

func (o *openaiSpeechToText) Initialize() error {
	start := time.Now()
	o.ctx, o.cancel = context.WithCancel(context.Background())
	o.client = openai.NewClient(option.WithAPIKey("YOUR_API_KEY"))

	o.onPacket(internal_type.ConversationEventPacket{
		Name: "stt",
		Data: map[string]string{
			"type":     "initialized",
			"provider": o.Name(),
			"init_ms":  fmt.Sprintf("%d", time.Since(start).Milliseconds()),
		},
		Time: time.Now(),
	})
	return nil
}

func (o *openaiSpeechToText) Close(ctx context.Context) error {
	if o.cancel != nil {
		o.cancel()
	}
	o.logger.Infof("OpenAI SpeechToText connection closed.")
	return nil
}

func (o *openaiSpeechToText) Name() string {
	return "openai-speech-to-text"
}

// Transform receives a stream of bytes (audioStream) and prints transcribed text in realtime.
func (o *openaiSpeechToText) Transform(ctx context.Context, byt internal_type.UserAudioPacket) error {
	return nil
}

func NewOpenaiSpeechToText(
	ctx context.Context,
	logger commons.Logger,
	onPacket func(pkt ...internal_type.Packet) error,
	opts utils.Option,
) (internal_type.SpeechToTextTransformer, error) {
	stt := &openaiSpeechToText{
		logger:   logger,
		onPacket: onPacket,
	}
	return stt, nil
}
