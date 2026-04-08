// Copyright (c) 2023-2025 RapidaAI
// Author: Prashant Srivastav <prashant@rapida.ai>
//
// Licensed under GPL-2.0 with Rapida Additional Terms.
// See LICENSE.md or contact sales@rapida.ai for commercial usage.

package sip_infra

import (
	"time"

	"github.com/emiago/sipgo/sip"
	"github.com/rapidaai/pkg/types"
	"github.com/rapidaai/protos"
)

// Pipeline is the base interface for all SIP call lifecycle stages.
// Each concrete type represents a distinct stage in the pipeline.
// Handlers receive a typed Pipeline, apply logic, and emit the next stage(s)
// via OnPipeline — forming chains without explicit wiring.
type Pipeline interface {
	CallID() string
}

// =============================================================================
// Setup pipeline — INVITE processing, routing, auth, session creation
// =============================================================================

// InviteReceivedPipeline is emitted when the SIP server receives an INVITE.
// First stage for inbound calls.
type InviteReceivedPipeline struct {
	ID      string
	FromURI string
	ToURI   string
	SDPBody []byte
	Req     *sip.Request
	Tx      sip.ServerTransaction
}

func (p InviteReceivedPipeline) CallID() string { return p.ID }

// RouteResolvedPipeline is emitted after DID extraction and SDP parsing.
// The DID is ready for assistant lookup.
type RouteResolvedPipeline struct {
	ID      string
	DID     string
	SDP     *SDPMediaInfo
	FromURI string
	ToURI   string
	Req     *sip.Request
	Tx      sip.ServerTransaction
}

func (p RouteResolvedPipeline) CallID() string { return p.ID }

// AuthenticatedPipeline is emitted after DID → assistant resolution succeeds.
type AuthenticatedPipeline struct {
	ID          string
	AssistantID uint64
	Auth        types.SimplePrinciple
	SDP         *SDPMediaInfo
	FromURI     string
	Req         *sip.Request
	Tx          sip.ServerTransaction
}

func (p AuthenticatedPipeline) CallID() string { return p.ID }

// OutboundRequestedPipeline is emitted when the API/telephony layer requests an outbound call.
// First stage for outbound calls.
type OutboundRequestedPipeline struct {
	ID        string
	Config    *Config
	ToPhone   string
	FromPhone string
	Metadata  map[string]interface{}
}

func (p OutboundRequestedPipeline) CallID() string { return p.ID }

// InviteSentPipeline is emitted after the outbound INVITE is sent and we're waiting for answer.
type InviteSentPipeline struct {
	ID        string
	Config    *Config
	ToPhone   string
	FromPhone string
	Metadata  map[string]interface{}
}

func (p InviteSentPipeline) CallID() string { return p.ID }

// AnswerReceivedPipeline is emitted when an outbound call is answered (200 OK).
type AnswerReceivedPipeline struct {
	ID      string
	Session *Session
	SDP     *SDPMediaInfo
}

func (p AnswerReceivedPipeline) CallID() string { return p.ID }

// =============================================================================
// Media pipeline — RTP, codec, session establishment, hold
// =============================================================================

// SessionEstablishedPipeline is emitted after RTP allocation, session creation,
// and 200 OK is sent. Converges inbound and outbound flows.
type SessionEstablishedPipeline struct {
	ID              string
	Session         *Session
	Config          *Config
	VaultCredential *protos.VaultCredential
	Direction       CallDirection
	AssistantID     uint64
	Auth            types.SimplePrinciple
	FromURI         string
	ConversationID  uint64 // Non-zero for outbound (already created by channel pipeline)
}

func (p SessionEstablishedPipeline) CallID() string { return p.ID }

// CallStartedPipeline is emitted after the streamer and talker are created.
// The call is now active and audio is flowing.
type CallStartedPipeline struct {
	ID      string
	Session *Session
}

func (p CallStartedPipeline) CallID() string { return p.ID }

// HoldRequestedPipeline is emitted on re-INVITE with hold SDP (sendonly/inactive/0.0.0.0).
type HoldRequestedPipeline struct {
	ID     string
	IsHold bool // true = hold, false = resume
	SDP    *SDPMediaInfo
}

func (p HoldRequestedPipeline) CallID() string { return p.ID }

// ReInviteReceivedPipeline is emitted on re-INVITE for codec renegotiation or media update.
type ReInviteReceivedPipeline struct {
	ID  string
	SDP *SDPMediaInfo
	Req *sip.Request
	Tx  sip.ServerTransaction
}

func (p ReInviteReceivedPipeline) CallID() string { return p.ID }

// =============================================================================
// Signal pipeline — BYE, CANCEL, transfer (preempts everything)
// =============================================================================

// ByeReceivedPipeline is emitted when a SIP BYE is received.
type ByeReceivedPipeline struct {
	ID     string
	Reason string
}

func (p ByeReceivedPipeline) CallID() string { return p.ID }

// CancelReceivedPipeline is emitted when a SIP CANCEL is received during setup.
type CancelReceivedPipeline struct {
	ID string
}

func (p CancelReceivedPipeline) CallID() string { return p.ID }

// TransferRequestedPipeline is emitted when a SIP REFER is received (call transfer).
type TransferRequestedPipeline struct {
	ID        string
	TargetURI string
}

func (p TransferRequestedPipeline) CallID() string { return p.ID }

// CallEndedPipeline is emitted when the call is fully torn down.
type CallEndedPipeline struct {
	ID       string
	Duration time.Duration
	Reason   string
}

func (p CallEndedPipeline) CallID() string { return p.ID }

// CallFailedPipeline is emitted when a call setup or active call fails.
type CallFailedPipeline struct {
	ID      string
	Error   error
	SIPCode int
}

func (p CallFailedPipeline) CallID() string { return p.ID }

// =============================================================================
// Control pipeline — metrics, events, recording, DTMF, registration
// =============================================================================

// EventEmittedPipeline is a generic event for logging and observability.
type EventEmittedPipeline struct {
	ID    string
	Event string
	Data  map[string]string
}

func (p EventEmittedPipeline) CallID() string { return p.ID }

// MetricEmittedPipeline carries metrics for a call.
type MetricEmittedPipeline struct {
	ID      string
	Metrics []*protos.Metric
}

func (p MetricEmittedPipeline) CallID() string { return p.ID }

// RecordingStartedPipeline is emitted when call recording begins.
type RecordingStartedPipeline struct {
	ID          string
	RecordingID string
}

func (p RecordingStartedPipeline) CallID() string { return p.ID }

// DTMFReceivedPipeline is emitted when a DTMF digit is detected via RTP (RFC 4733).
type DTMFReceivedPipeline struct {
	ID       string
	Digit    string
	Duration int // milliseconds
}

func (p DTMFReceivedPipeline) CallID() string { return p.ID }

// RegisterRequestedPipeline is emitted to initiate SIP REGISTER for a DID.
type RegisterRequestedPipeline struct {
	ID           string // synthetic, e.g. "reg-{DID}"
	DID          string
	Registration *Registration
}

func (p RegisterRequestedPipeline) CallID() string { return p.ID }

// RegisterActivePipeline is emitted when a SIP registration succeeds.
type RegisterActivePipeline struct {
	ID          string
	DID         string
	AssistantID uint64
	ExpiresAt   time.Time
}

func (p RegisterActivePipeline) CallID() string { return p.ID }

// RegisterFailedPipeline is emitted when a SIP registration fails.
type RegisterFailedPipeline struct {
	ID    string
	DID   string
	Error error
}

func (p RegisterFailedPipeline) CallID() string { return p.ID }

// RegisterExpiringPipeline is emitted when a registration is about to expire and needs renewal.
type RegisterExpiringPipeline struct {
	ID  string
	DID string
}

func (p RegisterExpiringPipeline) CallID() string { return p.ID }
