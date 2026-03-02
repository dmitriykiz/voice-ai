// Copyright (c) 2023-2025 RapidaAI
// Author: Prashant Srivastav <prashant@rapida.ai>
//
// Licensed under GPL-2.0 with Rapida Additional Terms.
// See LICENSE.md or contact sales@rapida.ai for commercial usage.

package channel_webrtc

import (
	"context"
	"errors"
	"fmt"
	"io"
	"sync"
	"sync/atomic"
	"time"

	"github.com/google/uuid"
	"github.com/pion/interceptor"
	"github.com/pion/rtp"
	pionwebrtc "github.com/pion/webrtc/v4"
	"github.com/pion/webrtc/v4/pkg/media"
	internal_audio "github.com/rapidaai/api/assistant-api/internal/audio"
	internal_audio_resampler "github.com/rapidaai/api/assistant-api/internal/audio/resampler"
	channel_base "github.com/rapidaai/api/assistant-api/internal/channel/base"
	webrtc_internal "github.com/rapidaai/api/assistant-api/internal/channel/webrtc/internal"
	internal_type "github.com/rapidaai/api/assistant-api/internal/type"
	"github.com/rapidaai/pkg/commons"
	"github.com/rapidaai/protos"
	"google.golang.org/grpc"
	"google.golang.org/protobuf/types/known/timestamppb"
)

// ============================================================================
// webrtcStreamer - WebRTC with gRPC signaling
// ============================================================================

// webrtcStreamer implements the Streamer interface using Pion WebRTC
// with gRPC bidirectional stream for signaling instead of WebSocket.
// Audio flows through WebRTC media tracks; gRPC is used for signaling.
//
// It embeds baseStreamer which manages input/output channels, audio buffers,
// and common lifecycle helpers. webrtcStreamer focuses only on WebRTC-specific
// logic: peer connections, Opus encoding, gRPC dispatch, and signaling.
type webrtcStreamer struct {
	channel_base.BaseStreamer // channels, buffers, PushInput/PushOutput, Recv, Context

	// WebRTC-specific components
	config     *webrtc_internal.Config
	grpcStream grpc.BidiStreamingServer[protos.WebTalkRequest, protos.WebTalkResponse]

	// Session state
	sessionID string

	// Pion WebRTC
	pc         *pionwebrtc.PeerConnection
	localTrack *pionwebrtc.TrackLocalStaticSample
	resampler  internal_type.AudioResampler
	opusCodec  *webrtc_internal.OpusCodec

	// Audio processing context - cancelled on audio disconnect/reconnect
	audioCtx    context.Context
	audioCancel context.CancelFunc
	audioWg     sync.WaitGroup // Tracks audio goroutines for clean shutdown

	currentMode protos.StreamMode

	// peerConnected is set to true when the WebRTC peer connection reaches
	// Connected state. runOutputWriter gates audio writes on this flag
	// to prevent WriteSample from silently dropping frames before the
	// SRTP session is established. Uses atomic for lock-free access from
	// runOutputWriter's hot loop.
	peerConnected atomic.Bool

	// iceStartedAt records when ICE negotiation began (inside setupAudioAndHandshake)
	// so we can report ICE latency in the peer_connected observability event.
	iceStartedAt time.Time
}

// NewWebRTCStreamer creates a new WebRTC streamer with gRPC signaling.
// The streamer owns its own context (derived from context.Background) so that
// cleanup is never short-circuited by the caller's context being cancelled first.
// A separate goroutine watches the caller's context and triggers a graceful close.
func NewWebRTCStreamer(
	ctx context.Context,
	logger commons.Logger,
	grpcStream grpc.BidiStreamingServer[protos.WebTalkRequest, protos.WebTalkResponse],
) (internal_type.Streamer, error) {
	resampler, err := internal_audio_resampler.GetResampler(logger)
	if err != nil {
		return nil, fmt.Errorf("failed to create resampler: %w", err)
	}

	opusCodec, err := webrtc_internal.NewOpusCodec()
	if err != nil {
		return nil, fmt.Errorf("failed to create Opus codec: %w", err)
	}

	s := &webrtcStreamer{
		BaseStreamer: channel_base.NewBaseStreamer(logger,
			channel_base.WithInputChannelSize(webrtc_internal.InputChannelSize),
			channel_base.WithOutputChannelSize(webrtc_internal.OutputChannelSize),
			channel_base.WithInputBufferThreshold(webrtc_internal.InputBufferThreshold),
			channel_base.WithOutputBufferThreshold(webrtc_internal.OutputBufferThreshold),
			channel_base.WithOutputFrameSize(webrtc_internal.OpusFrameBytes),
		),
		config:      webrtc_internal.DefaultConfig(),
		grpcStream:  grpcStream,
		sessionID:   uuid.New().String(),
		resampler:   resampler,
		opusCodec:   opusCodec,
		currentMode: protos.StreamMode_STREAM_MODE_TEXT,
		// peerConnected zero-value is false — correct: not connected yet
	}

	// Start background loops
	go s.runGrpcReader()   // inputCh feeder
	go s.runOutputWriter() // outputCh consumer

	// Watch the caller's context so a cancelled parent triggers graceful close
	// rather than an abrupt context cancellation mid-cleanup.
	go s.watchCallerContext(ctx)

	return s, nil
}

// ============================================================================
// Peer Connection Setup
// ============================================================================

// stopAudioProcessing cancels audio goroutines (runOutputSender, readRemoteAudio)
func (s *webrtcStreamer) stopAudioProcessing() {
	s.Mu.Lock()
	if s.audioCancel != nil {
		s.audioCancel()
		s.audioCancel = nil
	}
	s.audioCtx = nil
	s.Mu.Unlock()
	s.audioWg.Wait()
}

func (s *webrtcStreamer) createPeerConnection() error {
	// Create new audio context and fresh output channel for this connection
	s.Mu.Lock()
	s.audioCtx, s.audioCancel = context.WithCancel(s.Ctx)
	s.Mu.Unlock()
	s.peerConnected.Store(false) // reset for new connection cycle

	mediaEngine := &pionwebrtc.MediaEngine{}
	if err := mediaEngine.RegisterCodec(pionwebrtc.RTPCodecParameters{
		RTPCodecCapability: pionwebrtc.RTPCodecCapability{
			MimeType:    pionwebrtc.MimeTypeOpus,
			ClockRate:   webrtc_internal.OpusSampleRate,
			Channels:    webrtc_internal.OpusChannels,
			SDPFmtpLine: webrtc_internal.OpusSDPFmtpLine,
		},
		PayloadType: webrtc_internal.OpusPayloadType,
	}, pionwebrtc.RTPCodecTypeAudio); err != nil {
		return fmt.Errorf("failed to register Opus codec: %w", err)
	}

	// Interceptors (default includes NACK for audio packet recovery)
	registry := &interceptor.Registry{}
	if err := pionwebrtc.RegisterDefaultInterceptors(mediaEngine, registry); err != nil {
		return fmt.Errorf("failed to register interceptors: %w", err)
	}

	api := pionwebrtc.NewAPI(
		pionwebrtc.WithMediaEngine(mediaEngine),
		pionwebrtc.WithInterceptorRegistry(registry),
	)

	iceServers := make([]pionwebrtc.ICEServer, len(s.config.ICEServers))
	for i, srv := range s.config.ICEServers {
		iceServers[i] = pionwebrtc.ICEServer{
			URLs:       srv.URLs,
			Username:   srv.Username,
			Credential: srv.Credential,
		}
	}

	pcConfig := pionwebrtc.Configuration{ICEServers: iceServers}
	if s.config.ICETransportPolicy == "relay" {
		pcConfig.ICETransportPolicy = pionwebrtc.ICETransportPolicyRelay
	}

	pc, err := api.NewPeerConnection(pcConfig)
	if err != nil {
		return fmt.Errorf("failed to create peer connection: %w", err)
	}

	s.Mu.Lock()
	s.pc = pc
	s.Mu.Unlock()

	s.setupPeerEventHandlers()
	return s.createLocalTrack()
}

func (s *webrtcStreamer) setupPeerEventHandlers() {
	// ICE candidates are NOT sent individually (no trickle ICE).
	// Instead we wait for gathering to complete in initiateWebRTCHandshake()
	// and embed all candidates inline in the offer SDP. Safari has consistent
	// issues processing trickle ICE candidates that arrive as separate messages
	// after the offer/answer exchange; a complete offer avoids those bugs.
	s.pc.OnICECandidate(func(c *pionwebrtc.ICECandidate) {
		// no-op: candidates are captured via LocalDescription() after gathering
	})

	// Connection state
	s.pc.OnConnectionStateChange(func(state pionwebrtc.PeerConnectionState) {
		s.Logger.Infow("WebRTC connection state changed", "state", state, "session", s.sessionID)

		// Update mode under lock, then release before any channel operations
		// to avoid holding mu while pushing to outputCh.
		s.Mu.Lock()
		switch state {
		case pionwebrtc.PeerConnectionStateConnected:
			s.currentMode = protos.StreamMode_STREAM_MODE_AUDIO
		case pionwebrtc.PeerConnectionStateFailed,
			pionwebrtc.PeerConnectionStateClosed,
			pionwebrtc.PeerConnectionStateDisconnected:
			s.currentMode = protos.StreamMode_STREAM_MODE_TEXT
		}
		s.Mu.Unlock()

		// Perform channel / lifecycle operations outside the lock.
		switch state {
		case pionwebrtc.PeerConnectionStateConnected:
			// Unblock runOutputWriter so buffered greeting audio can drain.
			s.peerConnected.Store(true)
			s.Mu.Lock()
			iceLatencyMs := time.Since(s.iceStartedAt).Milliseconds()
			s.Mu.Unlock()
			s.PushInputLow(&protos.ConversationEvent{
				Name: "webrtc",
				Data: map[string]string{
					"type":           "peer_connected",
					"session_id":     s.sessionID,
					"ice_latency_ms": fmt.Sprintf("%d", iceLatencyMs),
				},
				Time: timestamppb.Now(),
			})
			s.sendReady()

		case pionwebrtc.PeerConnectionStateFailed:
			// ICE failure — common on Safari (mDNS privacy candidates cannot be
			// resolved on a cloud server). Do NOT close the gRPC session; fall
			// back to text mode so the conversation stays alive.
			s.Logger.Warnw("WebRTC ICE failed, falling back to text mode", "session", s.sessionID)
			s.PushInputLow(&protos.ConversationEvent{
				Name: "webrtc",
				Data: map[string]string{
					"type":       "peer_failed",
					"session_id": s.sessionID,
					"reason":     "ice_failed",
				},
				Time: timestamppb.Now(),
			})
			s.resetAudioSession()

		case pionwebrtc.PeerConnectionStateDisconnected:
			// Transient state — network hiccup, ICE may recover.
			// Only reset audio; do NOT close the gRPC stream/context so the
			// session can continue in text mode or reconnect.
			s.Logger.Warnw("WebRTC peer disconnected, resetting audio", "session", s.sessionID)
			s.PushInputLow(&protos.ConversationEvent{
				Name: "webrtc",
				Data: map[string]string{
					"type":       "peer_disconnected",
					"session_id": s.sessionID,
				},
				Time: timestamppb.Now(),
			})
			s.resetAudioSession()
		}
	})

	// Remote track (incoming audio)
	s.pc.OnTrack(func(track *pionwebrtc.TrackRemote, _ *pionwebrtc.RTPReceiver) {
		if track.Kind() != pionwebrtc.RTPCodecTypeAudio {
			return
		}
		s.Logger.Infow("Remote audio track received", "codec", track.Codec().MimeType)
		s.PushInputLow(&protos.ConversationEvent{
			Name: "webrtc",
			Data: map[string]string{
				"type":       "audio_track_received",
				"session_id": s.sessionID,
				"codec":      track.Codec().MimeType,
			},
			Time: timestamppb.Now(),
		})
		// Add to WaitGroup before launching goroutine to prevent
		// audioWg.Wait() from racing with audioWg.Add(1).
		s.audioWg.Add(1)
		go s.readRemoteAudio(track)
	})
}

func (s *webrtcStreamer) createLocalTrack() error {
	track, err := pionwebrtc.NewTrackLocalStaticSample(
		pionwebrtc.RTPCodecCapability{
			MimeType:  pionwebrtc.MimeTypeOpus,
			ClockRate: webrtc_internal.OpusSampleRate,
			Channels:  webrtc_internal.OpusChannels,
		},
		"audio",
		"rapida-audio",
	)
	if err != nil {
		return fmt.Errorf("failed to create local audio track: %w", err)
	}

	if _, err := s.pc.AddTrack(track); err != nil {
		return fmt.Errorf("failed to add track: %w", err)
	}

	s.Mu.Lock()
	s.localTrack = track
	s.Mu.Unlock()
	return nil
}

// ============================================================================
// Input Audio: WebRTC track -> decode -> resample -> Recv()
// ============================================================================

// readRemoteAudio reads from the WebRTC remote track, decodes Opus to PCM,
// resamples from 48kHz to 16kHz, and pushes onto inputAudioCh for Recv().
func (s *webrtcStreamer) readRemoteAudio(track *pionwebrtc.TrackRemote) {
	defer s.audioWg.Done()

	s.Mu.Lock()
	audioCtx := s.audioCtx
	s.Mu.Unlock()

	if audioCtx == nil {
		return
	}

	mimeType := track.Codec().MimeType
	if mimeType != pionwebrtc.MimeTypeOpus {
		s.Logger.Errorw("Unsupported codec, only Opus is supported", "codec", mimeType)
		return
	}

	opusDecoder, err := webrtc_internal.NewOpusCodec()
	if err != nil {
		s.Logger.Errorw("Failed to create Opus decoder", "error", err)
		return
	}

	buf := make([]byte, webrtc_internal.RTPBufferSize)
	consecutiveErrors := 0

	for {
		select {
		case <-audioCtx.Done():
			return
		default:
		}

		n, _, err := track.Read(buf)
		if err != nil {
			if errors.Is(err, io.EOF) {
				return
			}
			consecutiveErrors++
			if consecutiveErrors >= webrtc_internal.MaxConsecutiveErrors {
				s.Logger.Errorw("Too many consecutive read errors, stopping audio reader", "lastError", err)
				return
			}
			continue
		}
		consecutiveErrors = 0

		pkt := &rtp.Packet{}
		if err := pkt.Unmarshal(buf[:n]); err != nil {
			s.Logger.Debugw("Failed to unmarshal RTP packet", "error", err)
			continue
		}
		if len(pkt.Payload) == 0 {
			continue
		}

		pcm, err := opusDecoder.Decode(pkt.Payload)
		if err != nil {
			s.Logger.Debugw("Opus decode failed", "error", err, "payloadSize", len(pkt.Payload))
			continue
		}
		// resample to 16kHz
		resampled, err := s.resampler.Resample(pcm, internal_audio.WEBRTC_AUDIO_CONFIG, internal_audio.RAPIDA_INTERNAL_AUDIO_CONFIG)
		if err != nil {
			s.Logger.Debugw("Audio resample failed", "error", err)
			continue
		}

		// Buffer and flush to channel when threshold is reached
		s.BufferAndSendInput(resampled)
	}
}

// runOutputWriter is the single output loop:
//
//	outputCh -> loop (process) -> upstream service
//
// All outbound messages flow through outputCh to preserve ordering.
// Raw proto types and pre-built *WebTalkResponse (signaling) are accepted.
// The writer wraps raw types into WebTalkResponse before sending to gRPC.
//
//   - ConversationAssistantMessage_Audio → queue raw PCM → Opus-encode → WebRTC track
//     (paced at 20ms real-time intervals to smooth TTS bursts)
//   - *protos.WebTalkResponse (signaling) → send directly to gRPC
//   - All other raw types → wrap in WebTalkResponse → send to gRPC
//
// Runs for the lifetime of the streamer (exits when ctx is cancelled).
func (s *webrtcStreamer) runOutputWriter() {
	ticker := time.NewTicker(time.Duration(webrtc_internal.OutputPaceInterval) * time.Millisecond)
	defer ticker.Stop()

	// pendingAudio holds raw 20ms PCM frames waiting for the next tick.
	var pendingAudio [][]byte

	for {
		select {
		case <-s.Ctx.Done():
			return

		case <-s.FlushAudioCh:
			// Interruption: discard all queued audio immediately.
			pendingAudio = pendingAudio[:0]

		case <-ticker.C:
			// Encode and send one paced audio frame per tick (20ms real-time).
			// Only write when the peer connection is established — before that,
			// Pion silently drops WriteSample (no SRTP session). Frames stay
			// buffered in pendingAudio and drain once connected.
			if len(pendingAudio) > 0 && s.peerConnected.Load() {
				encoded, err := s.opusCodec.Encode(pendingAudio[0])
				if err != nil {
					s.Logger.Debugw("Opus encode failed", "error", err)
				} else {
					s.writeAudioFrame(encoded)
				}
				pendingAudio = pendingAudio[1:]
			}

		case msg := <-s.OutputCh:
			// Assistant audio → queue raw PCM for paced Opus encoding.
			if m, ok := msg.(*protos.ConversationAssistantMessage); ok {
				if audio, ok := m.Message.(*protos.ConversationAssistantMessage_Audio); ok {
					pendingAudio = append(pendingAudio, audio.Audio)
					continue
				}
			}

			// Wrap raw types in WebTalkResponse and send to gRPC.
			if resp := s.buildGRPCResponse(msg); resp != nil {
				s.dispatchOutput(resp)
			}
		}
	}
}

// buildGRPCResponse wraps a raw proto type into a WebTalkResponse for gRPC.
// Pre-built *WebTalkResponse (e.g. signaling) are passed through as-is.
func (s *webrtcStreamer) buildGRPCResponse(msg internal_type.Stream) *protos.WebTalkResponse {
	resp := &protos.WebTalkResponse{Code: 200, Success: true}
	switch m := msg.(type) {
	case *protos.ConversationAssistantMessage:
		resp.Data = &protos.WebTalkResponse_Assistant{Assistant: m}
	case *protos.ConversationConfiguration:
		resp.Data = &protos.WebTalkResponse_Configuration{Configuration: m}
	case *protos.ConversationInitialization:
		resp.Data = &protos.WebTalkResponse_Initialization{Initialization: m}
	case *protos.ConversationUserMessage:
		resp.Data = &protos.WebTalkResponse_User{User: m}
	case *protos.ConversationInterruption:
		resp.Data = &protos.WebTalkResponse_Interruption{Interruption: m}
	case *protos.ConversationDirective:
		resp.Data = &protos.WebTalkResponse_Directive{Directive: m}
	case *protos.ConversationError:
		resp.Data = &protos.WebTalkResponse_Error{Error: m}
	case *protos.ConversationEvent:
		resp.Data = &protos.WebTalkResponse_Event{Event: m}
	case *protos.ConversationMetadata:
		resp.Data = &protos.WebTalkResponse_Metadata{Metadata: m}
	case *protos.ConversationMetric:
		resp.Data = &protos.WebTalkResponse_Metric{Metric: m}
	case *protos.ServerSignaling:
		resp.Data = &protos.WebTalkResponse_Signaling{Signaling: m}
	default:
		s.Logger.Warnw("Unknown output message type, skipping", "type", fmt.Sprintf("%T", msg))
		return nil
	}
	return resp
}

// dispatchOutput sends a WebTalkResponse directly to the gRPC stream.
func (s *webrtcStreamer) dispatchOutput(resp *protos.WebTalkResponse) {
	if err := s.grpcStream.Send(resp); err != nil {
		s.Logger.Errorw("Failed to send gRPC response", "error", err)
	}
}

// writeAudioFrame writes an encoded Opus frame to the WebRTC local track.
func (s *webrtcStreamer) writeAudioFrame(data []byte) {
	s.Mu.Lock()
	track := s.localTrack
	s.Mu.Unlock()

	if track == nil {
		return
	}
	if err := track.WriteSample(media.Sample{
		Data:     data,
		Duration: webrtc_internal.OpusFrameDuration * time.Millisecond,
	}); err != nil {
		s.Logger.Debugw("Failed to write sample to track", "error", err)
	}
}

// ============================================================================
// Signaling helpers
// ============================================================================

// sendConfig sends WebRTC configuration (ICE servers, codec info) to client via outputCh.
func (s *webrtcStreamer) sendConfig() {
	iceServers := make([]*protos.ICEServer, len(s.config.ICEServers))
	for i, srv := range s.config.ICEServers {
		iceServers[i] = &protos.ICEServer{
			Urls:       srv.URLs,
			Username:   srv.Username,
			Credential: srv.Credential,
		}
	}

	s.PushOutput(&protos.ServerSignaling{
		SessionId: s.sessionID,
		Message: &protos.ServerSignaling_Config{
			Config: &protos.WebRTCConfig{
				IceServers: iceServers,
				AudioCodec: "opus",
				SampleRate: int32(webrtc_internal.OpusSampleRate),
			},
		},
	},
	)
}

// sendOffer sends SDP offer to client via outputCh.
func (s *webrtcStreamer) sendOffer(sdp string) {
	s.PushOutput(&protos.ServerSignaling{
		SessionId: s.sessionID,
		Message: &protos.ServerSignaling_Sdp{
			Sdp: &protos.WebRTCSDP{
				Type: protos.WebRTCSDP_OFFER,
				Sdp:  sdp,
			},
		},
	})
}

// sendICECandidate sends ICE candidate to client via outputCh.
func (s *webrtcStreamer) sendICECandidate(ice *webrtc_internal.ICECandidate) {
	s.PushOutput(&protos.ServerSignaling{
		SessionId: s.sessionID,
		Message: &protos.ServerSignaling_IceCandidate{
			IceCandidate: &protos.ICECandidate{
				Candidate:        ice.Candidate,
				SdpMid:           ice.SDPMid,
				SdpMLineIndex:    int32(ice.SDPMLineIndex),
				UsernameFragment: ice.UsernameFragment,
			},
		},
	})
}

// sendReady sends ready signal to client via outputCh.
func (s *webrtcStreamer) sendReady() {
	s.PushOutput(&protos.ServerSignaling{
		SessionId: s.sessionID,
		Message:   &protos.ServerSignaling_Ready{Ready: true},
	})
}

// sendClear sends clear/interrupt signal to client via outputCh.
func (s *webrtcStreamer) sendClear() {
	s.PushOutput(&protos.ServerSignaling{
		SessionId: s.sessionID,
		Message:   &protos.ServerSignaling_Clear{Clear: true},
	})
}

// runGrpcReader reads from the gRPC stream in a loop and pushes
// non-signaling messages into inputCh. Signaling is handled internally.
// Runs until the gRPC stream closes or the context is cancelled.
func (s *webrtcStreamer) runGrpcReader() {
	for {
		msg, err := s.grpcStream.Recv()
		if err != nil {
			s.PushDisconnection(protos.ConversationDisconnection_DISCONNECTION_TYPE_USER)
			return
		}
		switch msg.GetRequest().(type) {
		case *protos.WebTalkRequest_Initialization:
			s.PushInput(msg.GetInitialization())
			// Don't call handleConfigurationMessage here — the Talk() loop will
			// trigger transport setup after Connect() completes via NotifyMode().
		case *protos.WebTalkRequest_Configuration:
			s.PushInput(msg.GetConfiguration())
			s.handleConfigurationMessage(msg.GetConfiguration().GetStreamMode())
		case *protos.WebTalkRequest_Message:
			s.PushInput(msg.GetMessage())
		case *protos.WebTalkRequest_Metadata:
			s.PushInput(msg.GetMetadata())
		case *protos.WebTalkRequest_Metric:
			s.PushInput(msg.GetMetric())
		case *protos.WebTalkRequest_Disconnection:
			s.PushInput(msg.GetDisconnection())
		case *protos.WebTalkRequest_Signaling:
			s.handleClientSignaling(msg.GetSignaling())
		default:
			s.Logger.Warnw("Unknown message type", "type", fmt.Sprintf("%T", msg.GetRequest()))
		}
	}
}

// NotifyMode is called by the Talk loop after Connect() completes.
// For AUDIO mode it triggers the WebRTC handshake; for TEXT it is a no-op
// (or tears down audio if switching back to text).
func (s *webrtcStreamer) NotifyMode(mode protos.StreamMode) {
	s.handleConfigurationMessage(mode)
}

// handleConfigurationMessage processes transport mode changes.
// Switching text <-> audio only changes I/O transport - it does NOT create a new session.
func (s *webrtcStreamer) handleConfigurationMessage(mode protos.StreamMode) {
	s.Mu.Lock()
	currentMode := s.currentMode
	s.Mu.Unlock()

	if mode == currentMode {
		return
	}

	switch mode {
	case protos.StreamMode_STREAM_MODE_AUDIO:
		if err := s.setupAudioAndHandshake(); err != nil {
			s.Logger.Errorw("Failed to setup audio", "error", err)
			s.resetAudioSession()
		}
	case protos.StreamMode_STREAM_MODE_TEXT:
		s.resetAudioSession()
	}
}

// handleClientSignaling processes client WebRTC signaling messages
func (s *webrtcStreamer) handleClientSignaling(signaling *protos.ClientSignaling) {
	s.Mu.Lock()
	pc := s.pc
	s.Mu.Unlock()

	switch msg := signaling.GetMessage().(type) {
	case *protos.ClientSignaling_Sdp:
		if msg.Sdp.GetType() == protos.WebRTCSDP_ANSWER {
			if pc == nil {
				s.Logger.Warnw("Received SDP answer but peer connection is nil, ignoring")
				return
			}
			if err := pc.SetRemoteDescription(pionwebrtc.SessionDescription{
				Type: pionwebrtc.SDPTypeAnswer,
				SDP:  msg.Sdp.GetSdp(),
			}); err != nil {
				s.Logger.Errorw("Failed to set remote description", "error", err)
			}
		}

	case *protos.ClientSignaling_IceCandidate:
		if pc == nil {
			s.Logger.Warnw("Received ICE candidate but peer connection is nil, ignoring")
			return
		}
		ice := msg.IceCandidate
		idx := uint16(ice.GetSdpMLineIndex())
		sdpMid := ice.GetSdpMid()
		usernameFragment := ice.GetUsernameFragment()
		if err := pc.AddICECandidate(pionwebrtc.ICECandidateInit{
			Candidate:        ice.GetCandidate(),
			SDPMid:           &sdpMid,
			SDPMLineIndex:    &idx,
			UsernameFragment: &usernameFragment,
		}); err != nil {
			// Non-fatal: with complete ICE we use candidates embedded in the SDP;
			// individual trickle candidates are unnecessary and may arrive before
			// remote description is set on older clients. Log at Warn, not Error.
			s.Logger.Warnw("Failed to add ICE candidate (non-fatal)", "error", err)
		}

	case *protos.ClientSignaling_Disconnect:
		if msg.Disconnect {
			s.PushDisconnection(protos.ConversationDisconnection_DISCONNECTION_TYPE_USER)
		}
	}
}

func (s *webrtcStreamer) resetAudioSession() {
	s.stopAudioProcessing()
	s.Mu.Lock()
	defer s.Mu.Unlock()
	if s.pc != nil {
		s.pc.Close()
		s.pc = nil
	}
	s.localTrack = nil
	s.currentMode = protos.StreamMode_STREAM_MODE_TEXT
	s.peerConnected.Store(false)
}

// setupAudioAndHandshake tears down any stale peer connection, creates a fresh
// one, and initiates the WebRTC handshake (config -> offer -> answer -> ICE).
func (s *webrtcStreamer) setupAudioAndHandshake() error {
	// Always start fresh
	s.Mu.Lock()
	if s.pc != nil {
		s.pc.Close()
		s.pc = nil
		s.localTrack = nil
	}
	s.iceStartedAt = time.Now()
	s.Mu.Unlock()

	if err := s.createPeerConnection(); err != nil {
		return fmt.Errorf("failed to create peer connection: %w", err)
	}

	return s.initiateWebRTCHandshake()
}

// initiateWebRTCHandshake sends config and a complete SDP offer.
//
// We wait for ICE gathering to finish before sending the offer so all
// candidates are embedded inline in the SDP (complete ICE, not trickle).
// Safari consistently fails when ICE candidates arrive as separate messages
// after the offer; embedding them in the SDP avoids those timing bugs.
func (s *webrtcStreamer) initiateWebRTCHandshake() error {
	s.sendConfig()

	if _, err := s.createAndSetLocalOffer(); err != nil {
		return err
	}

	// Wait for ICE gathering so LocalDescription has all candidates.
	gatherComplete := pionwebrtc.GatheringCompletePromise(s.pc)

	s.Mu.Lock()
	audioCtx := s.audioCtx
	s.Mu.Unlock()

	select {
	case <-gatherComplete:
		// all candidates gathered
	case <-time.After(5 * time.Second):
		s.Logger.Warnw("ICE gathering timed out after 5s, sending partial offer", "session", s.sessionID)
	case <-audioCtx.Done():
		return fmt.Errorf("context cancelled during ICE gathering")
	}

	finalDesc := s.pc.LocalDescription()
	if finalDesc == nil {
		return fmt.Errorf("local description is nil after ICE gathering")
	}
	s.sendOffer(finalDesc.SDP)
	return nil
}

// createAndSetLocalOffer creates SDP offer and sets it as local description.
func (s *webrtcStreamer) createAndSetLocalOffer() (*pionwebrtc.SessionDescription, error) {
	offer, err := s.pc.CreateOffer(nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create offer: %w", err)
	}

	if err := s.pc.SetLocalDescription(offer); err != nil {
		return nil, fmt.Errorf("failed to set local description: %w", err)
	}

	return &offer, nil
}

// ============================================================================
// Send - output to client
// ============================================================================

// Send pushes output to the client via the unified output channel.
// All messages (audio and non-audio) flow through outputCh to preserve ordering.
// send (non-blocking) -> outputCh -> loop (runOutputWriter) -> upstream service
func (s *webrtcStreamer) Send(response internal_type.Stream) error {
	switch data := response.(type) {
	case *protos.ConversationAssistantMessage:
		switch content := data.Message.(type) {
		case *protos.ConversationAssistantMessage_Audio:
			audio48kHz, err := s.resampler.Resample(content.Audio, internal_audio.RAPIDA_INTERNAL_AUDIO_CONFIG, internal_audio.WEBRTC_AUDIO_CONFIG)
			if err != nil {
				return err
			}
			s.BufferAndSendOutput(audio48kHz)
			return nil
		case *protos.ConversationAssistantMessage_Text:
			s.PushOutput(data)
		}
	case *protos.ConversationConfiguration:
		s.PushOutput(data)
	case *protos.ConversationInitialization:
		s.PushOutput(data)
	case *protos.ConversationUserMessage:
		s.PushOutput(data)
	case *protos.ConversationInterruption:
		if data.Type == protos.ConversationInterruption_INTERRUPTION_TYPE_WORD {
			s.ClearOutputBuffer()
			s.sendClear()
		}
		s.PushOutput(data)
	case *protos.ConversationDirective:
		s.PushOutput(data)
		if data.GetType() == protos.ConversationDirective_END_CONVERSATION {
			s.PushDisconnection(protos.ConversationDisconnection_DISCONNECTION_TYPE_TOOL)
		}
	case *protos.ConversationError:
		s.PushOutput(data)
	case *protos.ConversationEvent:
		s.PushOutput(data)
	case *protos.ConversationMetadata:
		s.PushOutput(data)
	case *protos.ConversationDisconnection:
		s.PushOutput(data)
	case *protos.ConversationMetric:
		s.PushOutput(data)
	}
	return nil
}

// ============================================================================
// Lifecycle
// ============================================================================

// watchCallerContext monitors the caller's context and triggers a graceful
// close when it is cancelled, ensuring cleanup is never short-circuited.
func (s *webrtcStreamer) watchCallerContext(callerCtx context.Context) {
	select {
	case <-callerCtx.Done():
		s.Logger.Infow("Caller context cancelled, closing streamer gracefully", "session", s.sessionID)
		s.Close()
	case <-s.Ctx.Done():
		// Streamer already closed on its own, nothing to do.
	}
}

// Close closes the WebRTC connection and releases all resources.
// It is idempotent — safe to call from multiple goroutines or multiple times.
// PushDisconnection handles the Closed flag and idempotency; if it has already
// been called (e.g. from runGrpcReader or a client disconnect signal), the
// duplicate push is a no-op.
func (s *webrtcStreamer) Close() error {
	// Push disconnection signal into inputCh so the Talk loop exits cleanly.
	// PushDisconnection is idempotent (checks+sets s.Closed under lock).
	s.PushDisconnection(protos.ConversationDisconnection_DISCONNECTION_TYPE_USER)

	// Tear down audio goroutines first (they depend on audioCtx).
	s.stopAudioProcessing()

	// Close the peer connection and nil out resources.
	s.Mu.Lock()
	if s.pc != nil {
		s.pc.Close()
		s.pc = nil
	}
	s.localTrack = nil
	s.Mu.Unlock()

	// Cancel the streamer-wide context last so that Recv() can still
	// drain inputCh before the context fires.
	s.Cancel()
	return nil
}
