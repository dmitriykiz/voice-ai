// Copyright (c) 2023-2025 RapidaAI
// Author: Prashant Srivastav <prashant@rapida.ai>
//
// Licensed under GPL-2.0 with Rapida Additional Terms.
// See LICENSE.md or contact sales@rapida.ai for commercial usage.

package channel_telephony

import (
	"context"
	"fmt"

	"github.com/rapidaai/api/assistant-api/config"
	callcontext "github.com/rapidaai/api/assistant-api/internal/callcontext"
	internal_services "github.com/rapidaai/api/assistant-api/internal/services"
	web_client "github.com/rapidaai/pkg/clients/web"
	"github.com/rapidaai/pkg/commons"
	"github.com/rapidaai/pkg/types"
	type_enums "github.com/rapidaai/pkg/types/enums"
)

// OutboundDispatcher handles outbound call dispatching across all telephony
// channels (SIP, Asterisk, Twilio, Exotel, Vonage). It resolves the call
// context from Redis and places the call via the appropriate provider.
type OutboundDispatcher struct {
	cfg                 *config.AssistantConfig
	store               callcontext.Store
	logger              commons.Logger
	vaultClient         web_client.VaultClient
	assistantService    internal_services.AssistantService
	conversationService internal_services.AssistantConversationService
	telephonyOpt        TelephonyOption
}

// NewOutboundDispatcher creates a new outbound call dispatcher.
func NewOutboundDispatcher(deps TelephonyDispatcherDeps) *OutboundDispatcher {
	return &OutboundDispatcher{
		cfg:                 deps.Cfg,
		store:               deps.Store,
		logger:              deps.Logger,
		vaultClient:         deps.VaultClient,
		assistantService:    deps.AssistantService,
		conversationService: deps.ConversationService,
		telephonyOpt:        deps.TelephonyOpt,
	}
}

// Dispatch resolves the call context for the given contextID and places the
// outbound call. It should be called in a goroutine so the caller does not
// block on telephony provider latency.
func (d *OutboundDispatcher) Dispatch(ctx context.Context, contextID string) error {
	cc, err := d.store.Claim(ctx, contextID)
	if err != nil {
		d.logger.Errorf("outbound dispatcher: failed to claim call context %s: %v", contextID, err)
		return err
	}

	d.logger.Infof("outbound dispatcher[%s]: processing call contextId=%s, assistant=%d, conversation=%d",
		cc.Provider, cc.ContextID, cc.AssistantID, cc.ConversationID)

	if err := d.performOutbound(ctx, cc); err != nil {
		d.logger.Errorf("outbound dispatcher[%s]: call failed for contextId=%s: %v", cc.Provider, contextID, err)
		if updateErr := d.store.UpdateField(ctx, contextID, "status", callcontext.StatusFailed); updateErr != nil {
			d.logger.Errorf("outbound dispatcher[%s]: failed to update status for %s: %v", cc.Provider, contextID, updateErr)
		}
		return err
	}

	d.logger.Infof("outbound dispatcher[%s]: call initiated for contextId=%s", cc.Provider, contextID)
	return nil
}

// performOutbound resolves the telephony provider from the call context and places the call.
func (d *OutboundDispatcher) performOutbound(ctx context.Context, cc *callcontext.CallContext) error {
	telephony, err := GetTelephony(Telephony(cc.Provider), d.cfg, d.logger, d.telephonyOpt)
	if err != nil {
		return fmt.Errorf("telephony provider %s not available: %w", cc.Provider, err)
	}

	auth := cc.ToAuth()

	// Load assistant with phone deployment
	assistant, err := d.assistantService.Get(ctx, auth, cc.AssistantID, nil, &internal_services.GetAssistantOption{InjectPhoneDeployment: true})
	if err != nil {
		d.conversationService.ApplyConversationMetrics(ctx, auth, cc.AssistantID, cc.ConversationID,
			[]*types.Metric{types.NewStatusMetric(type_enums.RECORD_FAILED)})
		return fmt.Errorf("failed to load assistant %d: %w", cc.AssistantID, err)
	}

	if !assistant.IsPhoneDeploymentEnable() {
		d.conversationService.ApplyConversationMetrics(ctx, auth, cc.AssistantID, cc.ConversationID,
			[]*types.Metric{types.NewStatusMetric(type_enums.RECORD_FAILED)})
		return fmt.Errorf("phone deployment not enabled for assistant %d", cc.AssistantID)
	}

	// Get vault credential
	credentialID, err := assistant.AssistantPhoneDeployment.GetOptions().GetUint64("rapida.credential_id")
	if err != nil {
		d.conversationService.ApplyConversationMetrics(ctx, auth, cc.AssistantID, cc.ConversationID,
			[]*types.Metric{types.NewStatusMetric(type_enums.RECORD_FAILED)})
		return fmt.Errorf("failed to get credential ID: %w", err)
	}

	vltC, err := d.vaultClient.GetCredential(ctx, auth, credentialID)
	if err != nil {
		d.conversationService.ApplyConversationMetrics(ctx, auth, cc.AssistantID, cc.ConversationID,
			[]*types.Metric{types.NewStatusMetric(type_enums.RECORD_FAILED)})
		return fmt.Errorf("failed to get vault credential: %w", err)
	}

	// Build options with contextId for channel variables (ARI, SIP headers, etc.)
	opts := assistant.AssistantPhoneDeployment.GetOptions()
	opts["rapida.context_id"] = cc.ContextID

	// Place the outbound call via the telephony provider
	callInfo, callErr := telephony.OutboundCall(auth, cc.CallerNumber, cc.FromNumber, cc.AssistantID, cc.ConversationID, vltC, opts)
	if callErr != nil {
		d.logger.Errorf("outbound dispatcher[%s]: telephony call failed for contextId=%s: %v", cc.Provider, cc.ContextID, callErr)
	}

	if callInfo == nil {
		return callErr
	}

	// Build and apply telemetry from CallInfo — the dispatcher owns telemetry construction.

	// Persist the provider call UUID in the call context so that
	// downstream operations (transfer, disconnect) can reference the live call.
	if callInfo.ChannelUUID != "" {
		if updateErr := d.store.UpdateField(ctx, cc.ContextID, "channel_uuid", callInfo.ChannelUUID); updateErr != nil {
			d.logger.Warnf("outbound dispatcher[%s]: failed to store channel UUID for contextId=%s: %v", cc.Provider, cc.ContextID, updateErr)
		}
	}

	// Apply metadata: provider, toPhone, fromPhone, error (if any), plus provider-specific Extra fields
	metadatas := []*types.Metadata{
		types.NewMetadata("telephony.toPhone", cc.CallerNumber),
		types.NewMetadata("telephony.fromPhone", cc.FromNumber),
		types.NewMetadata("telephony.provider", cc.Provider),
	}
	if callInfo.ChannelUUID != "" {
		metadatas = append(metadatas, types.NewMetadata("telephony.uuid", callInfo.ChannelUUID))
	}
	if callInfo.ErrorMessage != "" {
		metadatas = append(metadatas, types.NewMetadata("telephony.error", callInfo.ErrorMessage))
	}
	for k, v := range callInfo.Extra {
		metadatas = append(metadatas, types.NewMetadata(k, v))
	}
	d.conversationService.ApplyConversationMetadata(ctx, auth, cc.AssistantID, cc.ConversationID, metadatas)

	// Apply metric from CallInfo.Status
	metric := types.NewMetric("STATUS", callInfo.Status, nil)
	d.conversationService.ApplyConversationMetrics(ctx, auth, cc.AssistantID, cc.ConversationID, []*types.Metric{metric})

	// Apply telephony event from CallInfo.StatusInfo
	if callInfo.StatusInfo.Event != "" {
		event := types.NewEvent(callInfo.StatusInfo.Event, callInfo.StatusInfo.Payload)
		d.conversationService.ApplyConversationTelephonyEvent(ctx, auth, cc.Provider, cc.AssistantID, cc.ConversationID, []*types.Event{event})
	}

	return callErr
}
