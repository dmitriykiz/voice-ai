// Copyright (c) 2023-2025 RapidaAI
// Author: Prashant Srivastav <prashant@rapida.ai>
//
// Licensed under GPL-2.0 with Rapida Additional Terms.
// See LICENSE.md or contact sales@rapida.ai for commercial usage.
package adapter_internal

import (
	"context"

	endpoint_client_builders "github.com/rapidaai/pkg/clients/endpoint/builders"
	"github.com/rapidaai/protos"
)

// OnBeginConversation fires webhooks subscribed to ConversationBegin.
// Delegates to the shared ConversationHooks infrastructure.
func (md *genericRequestor) OnBeginConversation(ctx context.Context) error {
	if md.hooks != nil {
		md.hooks.OnBegin(ctx)
	}
	return nil
}

// OnResumeConversation fires webhooks subscribed to ConversationResume.
func (md *genericRequestor) OnResumeConversation(ctx context.Context) error {
	if md.hooks != nil {
		md.hooks.OnResume(ctx)
	}
	return nil
}

// OnErrorConversation fires webhooks subscribed to ConversationFailed.
func (md *genericRequestor) OnErrorConversation(ctx context.Context) error {
	if md.hooks != nil {
		md.hooks.OnError(ctx)
	}
	return nil
}

// OnEndConversation runs analyses then fires webhooks for ConversationCompleted.
// Refreshes the snapshot before execution so analysis/webhooks see the latest
// conversation state (messages, metadata accumulated during the call).
func (md *genericRequestor) OnEndConversation(ctx context.Context) error {
	if md.hooks != nil {
		// Refresh snapshot with current state (histories, metadata may have changed during call)
		md.hooks.RefreshSnapshot(md.buildSnapshot())
		md.hooks.OnEnd(ctx)
	}
	return nil
}

// invokeEndpoint calls a configured endpoint via the deployment client.
func (ae *genericRequestor) invokeEndpoint(ctx context.Context, endpointDef *protos.EndpointDefinition, arguments, metadata, opts map[string]interface{}) (*protos.InvokeResponse, error) {
	inputBuilder := endpoint_client_builders.NewInputInvokeBuilder(ae.logger)
	return ae.DeploymentCaller().Invoke(
		ctx,
		ae.Auth(),
		inputBuilder.Invoke(
			endpointDef,
			inputBuilder.Arguments(arguments, nil),
			inputBuilder.Metadata(metadata, nil),
			inputBuilder.Options(opts, nil),
		),
	)
}
