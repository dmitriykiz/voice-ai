// Copyright (c) 2023-2025 RapidaAI
// Author: Prashant Srivastav <prashant@rapida.ai>
//
// Licensed under GPL-2.0 with Rapida Additional Terms.
// See LICENSE.md or contact sales@rapida.ai for commercial usage.
package internal_denoiser_rnnoise

import (
	"context"
	"fmt"
	"time"

	internal_audio_resampler "github.com/rapidaai/api/assistant-api/internal/audio/resampler"
	internal_type "github.com/rapidaai/api/assistant-api/internal/type"
	"github.com/rapidaai/pkg/commons"
	"github.com/rapidaai/pkg/utils"
	"github.com/rapidaai/protos"
)

type rnnoiseDenoiser struct {
	rnNoise        *RNNoise
	logger         commons.Logger
	denoiserConfig *protos.AudioConfig
	inputConfig    *protos.AudioConfig
	audioSampler   internal_type.AudioResampler
	audioConverter internal_type.AudioConverter
	onPacket       func(context.Context, ...internal_type.Packet) error
}

// NewDenoiser creates a new denoiser instance
func NewRnnoiseDenoiser(
	ctx context.Context,
	logger commons.Logger, inputConfig *protos.AudioConfig, onPacket func(context.Context, ...internal_type.Packet) error, options utils.Option,
) (internal_type.Denoiser, error) {
	start := time.Now()
	rn, err := NewRNNoise()
	if err != nil {
		return nil, err
	}
	sampler, err := internal_audio_resampler.GetResampler(logger)
	if err != nil {
		return nil, err
	}
	converter, err := internal_audio_resampler.GetConverter(logger)
	if err != nil {
		return nil, err
	}

	d := &rnnoiseDenoiser{
		audioSampler:   sampler,
		audioConverter: converter,
		rnNoise:        rn,
		denoiserConfig: &protos.AudioConfig{
			SampleRate:  48000,
			AudioFormat: protos.AudioConfig_LINEAR16,
		},
		inputConfig: inputConfig,
		logger:      logger,
		onPacket:    onPacket,
	}

	if onPacket != nil {
		_ = onPacket(ctx, internal_type.ConversationEventPacket{
			Name: "denoise",
			Data: map[string]string{
				"type":     "initialized",
				"provider": "rnnoise",
				"init_ms":  fmt.Sprintf("%d", time.Since(start).Milliseconds()),
			},
			Time: time.Now(),
		})
	}

	return d, nil
}

// Denoise processes the audio in pkt and pushes a DenoisedAudioPacket via
// onPacket instead of returning bytes to the caller. On error it falls back
// to the original audio and still emits the packet with NoiseReduced=false.
func (rnd *rnnoiseDenoiser) Denoise(ctx context.Context, pkt internal_type.DenoiseAudioPacket) error {
	input := pkt.Audio
	fallback := func(err error, noFallback bool) error {
		if rnd.onPacket != nil {
			_ = rnd.onPacket(ctx, internal_type.DenoisedAudioPacket{
				ContextID:    pkt.ContextID,
				Audio:        input,
				NoiseReduced: false,
			}, internal_type.ConversationEventPacket{
				ContextID: pkt.ContextID,
				Name:      "denoise",
				Data: map[string]string{
					"type":     "error",
					"error":    err.Error(),
					"fallback": fmt.Sprintf("%v", noFallback),
				},
				Time: time.Now(),
			})
		}
		return nil
	}

	idi, err := rnd.audioSampler.Resample(input, rnd.inputConfig, rnd.denoiserConfig)
	if err != nil {
		return fallback(err, false)
	}

	floatSample, err := rnd.audioConverter.ConvertToFloat32Samples(idi, rnd.denoiserConfig)
	if err != nil {
		return fallback(err, false)
	}

	var combinedCleanedAudio []float32
	var combinedCnf float64

	for i := 0; i < len(floatSample); i += 480 {
		end := i + 480
		if end > len(floatSample) {
			end = len(floatSample)
		}

		chunk := floatSample[i:end]
		if len(chunk) < 480 {
			padding := make([]float32, 480-len(chunk))
			chunk = append(chunk, padding...)
		}

		cnf, cleanedAudio, err := rnd.rnNoise.SuppressNoise(chunk)
		if err != nil {
			return fallback(err, false)
		}

		combinedCleanedAudio = append(combinedCleanedAudio, cleanedAudio...)
		combinedCnf += cnf
	}

	if len(combinedCleanedAudio) > 0 {
		combinedCnf /= float64((len(floatSample)-1)/480 + 1)
	}

	ido, err := rnd.audioConverter.ConvertToByteSamples(combinedCleanedAudio, rnd.denoiserConfig)
	if err != nil {
		return fallback(err, false)
	}

	idm, err := rnd.audioSampler.Resample(ido, rnd.denoiserConfig, rnd.inputConfig)
	if err != nil {
		return fallback(err, false)
	}
	if rnd.onPacket != nil {
		_ = rnd.onPacket(ctx,
			internal_type.DenoisedAudioPacket{
				ContextID:    pkt.ContextID,
				Audio:        idm,
				Confidence:   combinedCnf,
				NoiseReduced: true,
			},
			// internal_type.ConversationEventPacket{
			// 	ContextID: pkt.ContextID,
			// 	Name:      "denoise",
			// 	Data: map[string]string{
			// 		"type":         "completed",
			// 		"input_bytes":  fmt.Sprintf("%d", len(input)),
			// 		"output_bytes": fmt.Sprintf("%d", len(idm)),
			// 	},
			// 	Time: time.Now(),
			// },
		)
	}
	return nil
}

// Close releases resources
func (d *rnnoiseDenoiser) Close() error {
	if d.rnNoise != nil {
		d.rnNoise.Close()
	}
	return nil
}
