// Copyright (c) 2023-2025 RapidaAI
// Author: Prashant Srivastav <prashant@rapida.ai>
//
// Licensed under GPL-2.0 with Rapida Additional Terms.
// See LICENSE.md or contact sales@rapida.ai for commercial usage.

// Package internal_model implements the model-based assistant executor.
//
// The model executor manages the full LLM conversation loop internally: it
// maintains conversation history, builds chat requests with system prompts,
// streams responses via a persistent bidirectional gRPC connection to the
// integration-api, and orchestrates tool calls when the LLM requests them.
//
// # Lifecycle
//
//  1. Initialize — fetches provider credentials and initializes tools in
//     parallel, opens a persistent StreamChat bidi stream, and spawns a
//     listener goroutine.
//  2. Execute (called per user turn) — snapshots history, builds a chat
//     request, appends the user message to history, and sends atomically
//     under a single lock acquisition.
//  3. Close — tears down the stream, clears history, and waits for the
//     listener goroutine to exit (with a 5 s timeout).
//
// # Concurrency
//
// A single sync.RWMutex (mu) guards both the history slice and the gRPC
// stream. Write paths (chat, handleResponse, executeToolCalls, handleStaticPacket,
// Close) acquire mu.Lock; read paths (snapshotHistory, chatWithHistory, listen
// for stream ref) acquire mu.RLock. The sendLocked helper allows callers that
// already hold mu to send without double-locking.
//
// # ConversationEvent contract
//
// The executor emits ConversationEventPacket at every critical point so the
// debugger, analytics, and webhook pipelines have full visibility:
//
//	Initialize      → {type: "llm_initialized", provider, init_ms, ...model options}
//	Execute (user)  → {type: "executing",  script, input_char_count, history_count}
//	Response error  → {type: "error",      error}
//	Response done   → {type: "completed",  text, response_char_count, finish_reason}
//	Tool call error → LLMErrorPacket (no separate event — error is on the follow-up send)
package internal_model

import (
	"context"
	"errors"
	"fmt"
	"io"
	"strings"
	"sync"
	"time"

	internal_agent_executor "github.com/rapidaai/api/assistant-api/internal/agent/executor"
	internal_agent_tool "github.com/rapidaai/api/assistant-api/internal/agent/executor/tool"
	internal_type "github.com/rapidaai/api/assistant-api/internal/type"
	integration_client_builders "github.com/rapidaai/pkg/clients/integration/builders"
	"github.com/rapidaai/pkg/commons"
	"github.com/rapidaai/pkg/utils"
	"github.com/rapidaai/protos"
	"golang.org/x/sync/errgroup"
	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
)

type modelAssistantExecutor struct {
	logger             commons.Logger
	toolExecutor       internal_agent_executor.ToolExecutor
	providerCredential *protos.VaultCredential
	inputBuilder       integration_client_builders.InputChatBuilder
	history            []*protos.Message
	stream             grpc.BidiStreamingClient[protos.ChatRequest, protos.ChatResponse]
	mu                 sync.RWMutex
	done               chan struct{}
}

func NewModelAssistantExecutor(logger commons.Logger) internal_agent_executor.AssistantExecutor {
	return &modelAssistantExecutor{
		logger:       logger,
		inputBuilder: integration_client_builders.NewChatInputBuilder(logger),
		toolExecutor: internal_agent_tool.NewToolExecutor(logger),
		history:      make([]*protos.Message, 0),
	}
}

func (executor *modelAssistantExecutor) Name() string {
	return "model"
}

func (executor *modelAssistantExecutor) Initialize(ctx context.Context, communication internal_type.Communication, cfg *protos.ConversationInitialization) error {
	start := time.Now()
	g, gCtx := errgroup.WithContext(ctx)
	var providerCredential *protos.VaultCredential

	// Goroutine to fetch provider credentials
	g.Go(func() error {
		credentialID, err := communication.Assistant().AssistantProviderModel.GetOptions().GetUint64("rapida.credential_id")
		if err != nil {
			executor.logger.Errorf("Error while getting provider model credential ID: %v", err)
			return fmt.Errorf("failed to get credential ID: %w", err)
		}
		cred, err := communication.VaultCaller().GetCredential(gCtx, communication.Auth(), credentialID)
		if err != nil {
			executor.logger.Errorf("Error while getting provider model credentials: %v", err)
			return fmt.Errorf("failed to get provider credential: %w", err)
		}
		providerCredential = cred
		return nil
	})

	// Goroutine to initialize tool executor
	g.Go(func() error {
		if err := executor.toolExecutor.Initialize(gCtx, communication); err != nil {
			executor.logger.Errorf("Error initializing tool executor: %v", err)
			return fmt.Errorf("failed to initialize tool executor: %w", err)
		}
		return nil
	})

	// Wait for all goroutines to complete
	if err := g.Wait(); err != nil {
		executor.logger.Errorf("Error during initialization: %v", err)
		return err
	}

	// Assign after goroutines complete to avoid race conditions
	executor.providerCredential = providerCredential

	// Open bidirectional stream for persistent connection
	stream, err := communication.IntegrationCaller().StreamChat(
		ctx,
		communication.Auth(),
		communication.Assistant().AssistantProviderModel.ModelProviderName,
	)
	if err != nil {
		executor.logger.Errorf("Failed to open stream: %v", err)
		return fmt.Errorf("failed to open stream: %w", err)
	}
	executor.stream = stream

	// Start listener goroutine - handles server responses and connection close
	executor.done = make(chan struct{})
	utils.Go(ctx, func() {
		defer close(executor.done)
		executor.listen(ctx, communication)
	})

	llmData := communication.Assistant().AssistantProviderModel.GetOptions().ToStringMap()
	llmData["type"] = "llm_initialized"
	llmData["provider"] = communication.Assistant().AssistantProviderModel.ModelProviderName
	llmData["init_ms"] = fmt.Sprintf("%d", time.Since(start).Milliseconds())
	communication.OnPacket(ctx, internal_type.ConversationEventPacket{
		Name: "llm",
		Data: llmData,
		Time: time.Now(),
	})
	return nil
}

func (executor *modelAssistantExecutor) chat(
	ctx context.Context,
	communication internal_type.Communication,
	contextID string,
	in *protos.Message,
	histories ...*protos.Message,
) error {
	// Build request from the caller-provided snapshot (no lock needed)
	request := executor.buildChatRequest(communication, contextID, append(histories, in)...)
	// Atomically append to history and send — single lock acquisition
	executor.mu.Lock()
	executor.history = append(executor.history, in)
	err := executor.sendLocked(request)
	executor.mu.Unlock()
	if err != nil {
		executor.logger.Errorf("error sending chat request: %v", err)
		return fmt.Errorf("failed to send chat request: %w", err)
	}
	return nil
}

// chatWithHistory sends a chat request using all messages already in executor.history.
// Unlike chat(), it does not append any new message — the caller is responsible for
// ensuring history is already up-to-date before calling this.
func (executor *modelAssistantExecutor) chatWithHistory(
	ctx context.Context,
	communication internal_type.Communication,
	contextID string,
) error {
	// Hold lock through build+send: avoids a snapshot allocation and guarantees
	// the request reflects the exact history that was current at send time.
	executor.mu.Lock()
	request := executor.buildChatRequest(communication, contextID, executor.history...)
	err := executor.sendLocked(request)
	executor.mu.Unlock()
	if err != nil {
		executor.logger.Errorf("error sending chat request: %v", err)
		return fmt.Errorf("failed to send chat request: %w", err)
	}
	return nil
}

// sendLocked writes to the gRPC stream. Caller MUST hold mu.
func (executor *modelAssistantExecutor) sendLocked(req *protos.ChatRequest) error {
	if executor.stream == nil {
		return fmt.Errorf("stream not connected")
	}
	return executor.stream.Send(req)
}

// listen reads messages from the stream until context is cancelled or connection closes.
func (executor *modelAssistantExecutor) listen(ctx context.Context, communication internal_type.Communication) {
	for {
		select {
		case <-ctx.Done():
			return
		default:
		}

		executor.mu.RLock()
		stream := executor.stream
		executor.mu.RUnlock()

		if stream == nil {
			return
		}

		resp, err := stream.Recv()
		if err != nil {
			reason := executor.streamErrorReason(err)
			communication.OnPacket(ctx, internal_type.DirectivePacket{
				Directive: protos.ConversationDirective_END_CONVERSATION,
				Arguments: map[string]interface{}{"reason": reason},
			})
			return
		}
		executor.handleResponse(ctx, communication, resp)
	}
}

// streamErrorReason maps a stream error to a human-readable reason string.
func (executor *modelAssistantExecutor) streamErrorReason(err error) string {
	executor.logger.Debugf("Listener received error: %v", err)
	switch {
	case errors.Is(err, io.EOF):
		return "server closed connection"
	case status.Code(err) == codes.Canceled:
		return "connection canceled"
	case status.Code(err) == codes.Unavailable:
		return "server unavailable"
	default:
		return err.Error()
	}
}

// handleResponse processes a single response from the server.
func (executor *modelAssistantExecutor) handleResponse(ctx context.Context, communication internal_type.Communication, resp *protos.ChatResponse) {
	output := resp.GetData()
	metrics := resp.GetMetrics()
	// Handle error responses
	if !resp.GetSuccess() && resp.GetError() != nil {
		errMsg := resp.GetError().GetErrorMessage()
		communication.OnPacket(ctx,
			internal_type.LLMErrorPacket{
				ContextID: resp.GetRequestId(),
				Error:     errors.New(errMsg),
			},
			internal_type.ConversationEventPacket{
				ContextID: resp.GetRequestId(),
				Name:      "llm",
				Data:      map[string]string{"type": "error", "error": errMsg},
				Time:      time.Now(),
			},
		)
		return
	}
	if output == nil {
		return
	}

	// Check if this is the final message (has metrics)
	if len(metrics) > 0 {
		hasToolCalls := len(output.GetAssistant().GetToolCalls()) > 0
		responseText := strings.Join(output.GetAssistant().GetContents(), "")
		now := time.Now()

		// When tool_calls are present, defer adding the assistant message to history
		// until tool results are ready. This prevents a race where a concurrent user
		// message could see the assistant message with tool_calls but no tool results,
		// causing OpenAI to reject with: "An assistant message with 'tool_calls' must
		// be followed by tool messages responding to each 'tool_call_id'."
		if !hasToolCalls {
			executor.mu.Lock()
			executor.history = append(executor.history, output)
			executor.mu.Unlock()
		}

		communication.OnPacket(ctx,
			internal_type.LLMResponseDonePacket{
				ContextID: resp.GetRequestId(),
				Text:      responseText,
			},
			internal_type.ConversationEventPacket{
				ContextID: resp.GetRequestId(),
				Name:      "llm",
				Data: map[string]string{
					"type":                "completed",
					"text":                responseText,
					"response_char_count": fmt.Sprintf("%d", len(responseText)),
					"finish_reason":       "stop",
				},
				Time: now,
			},
			internal_type.MessageMetricPacket{
				ContextID: resp.GetRequestId(),
				Metrics:   metrics,
			},
		)

		if hasToolCalls {
			if err := executor.executeToolCalls(ctx, communication, resp.GetRequestId(), output); err != nil {
				executor.logger.Errorf("tool call follow-up failed: %v", err)
				communication.OnPacket(ctx, internal_type.LLMErrorPacket{
					ContextID: resp.GetRequestId(),
					Error:     fmt.Errorf("tool call follow-up failed: %w", err),
				})
			}
		}
		return
	}
	if len(output.GetAssistant().GetContents()) > 0 {
		communication.OnPacket(ctx, internal_type.LLMResponseDeltaPacket{
			ContextID: resp.GetRequestId(),
			Text:      strings.Join(output.GetAssistant().GetContents(), ""),
		})
	}
}

// buildChatRequest constructs the chat request with all necessary parameters.
// The caller provides the complete conversation messages (system prompt is prepended automatically).
func (executor *modelAssistantExecutor) buildChatRequest(communication internal_type.Communication, contextID string, messages ...*protos.Message) *protos.ChatRequest {
	assistant := communication.Assistant()
	template := assistant.AssistantProviderModel.Template.GetTextChatCompleteTemplate()
	systemMessages := executor.inputBuilder.Message(
		template.Prompt,
		utils.MergeMaps(executor.inputBuilder.PromptArguments(template.Variables), communication.GetArgs()),
	)
	return executor.inputBuilder.Chat(
		contextID,
		&protos.Credential{
			Id:    executor.providerCredential.GetId(),
			Value: executor.providerCredential.GetValue(),
		},
		executor.inputBuilder.Options(utils.MergeMaps(assistant.AssistantProviderModel.GetOptions(), communication.GetOptions()), nil),
		executor.toolExecutor.GetFunctionDefinitions(),
		map[string]string{
			"assistant_id":                fmt.Sprintf("%d", assistant.Id),
			"message_id":                  contextID,
			"assistant_provider_model_id": fmt.Sprintf("%d", assistant.AssistantProviderModel.Id),
		},
		append(systemMessages, messages...)...,
	)
}

// executeToolCalls handles tool execution and recursive chat.
// The assistant message (output) is NOT yet in executor.history — we add both
// the assistant message and tool result atomically to prevent a race where a
// concurrent user message could see the assistant message with tool_calls but
// without the corresponding tool results (which causes OpenAI 400 errors).
func (executor *modelAssistantExecutor) executeToolCalls(ctx context.Context, communication internal_type.Communication, contextID string, output *protos.Message,
) error {
	toolExecution := executor.toolExecutor.ExecuteAll(ctx, contextID, output.GetAssistant().GetToolCalls(), communication)
	// Atomically append both the assistant message (with tool_calls) and the tool
	// result to history, so any concurrent reader always sees them as a pair.
	executor.mu.Lock()
	executor.history = append(executor.history, output, toolExecution)
	executor.mu.Unlock()
	// Build the follow-up request using the full history (which now includes
	// output + toolExecution). chatWithHistory reads history under lock.
	return executor.chatWithHistory(ctx, communication, contextID)
}

// Execute processes incoming packets when user triggers a message
func (executor *modelAssistantExecutor) Execute(ctx context.Context, communication internal_type.Communication, pctk internal_type.Packet) error {
	switch plt := pctk.(type) {
	case internal_type.UserTextPacket:
		return executor.handleUserTextPacket(ctx, communication, plt)
	case internal_type.StaticPacket:
		return executor.handleStaticPacket(plt)
	default:
		return fmt.Errorf("unsupported packet type: %T", pctk)
	}
}

// handleUserTextPacket processes user text input
func (executor *modelAssistantExecutor) handleUserTextPacket(ctx context.Context, communication internal_type.Communication, packet internal_type.UserTextPacket,
) error {
	snapshot := executor.snapshotHistory()
	communication.OnPacket(ctx, internal_type.ConversationEventPacket{
		ContextID: packet.ContextID,
		Name:      "llm",
		Data: map[string]string{
			"type":             "executing",
			"script":           packet.Text,
			"input_char_count": fmt.Sprintf("%d", len(packet.Text)),
			"history_count":    fmt.Sprintf("%d", len(snapshot)),
		},
		Time: time.Now(),
	})
	return executor.chat(ctx, communication, packet.ContextID, &protos.Message{Role: "user", Message: &protos.Message_User{User: &protos.UserMessage{Content: packet.Text}}}, snapshot...)
}

// handleStaticPacket appends static assistant response to history
func (executor *modelAssistantExecutor) handleStaticPacket(packet internal_type.StaticPacket) error {
	executor.mu.Lock()
	executor.history = append(executor.history, &protos.Message{
		Role: "assistant",
		Message: &protos.Message_Assistant{Assistant: &protos.AssistantMessage{
			Contents: []string{packet.Text},
		}},
	})
	executor.mu.Unlock()
	return nil
}

// snapshotHistory returns a point-in-time copy of the conversation history.
func (executor *modelAssistantExecutor) snapshotHistory() []*protos.Message {
	executor.mu.RLock()
	snapshot := make([]*protos.Message, len(executor.history))
	copy(snapshot, executor.history)
	executor.mu.RUnlock()
	return snapshot
}

func (executor *modelAssistantExecutor) Close(ctx context.Context) error {
	executor.mu.Lock()

	// Close the stream
	if executor.stream != nil {
		executor.stream.CloseSend()
		executor.stream = nil
	}

	// Clear history
	executor.history = make([]*protos.Message, 0)
	done := executor.done
	executor.mu.Unlock()

	// Wait for listener goroutine to exit
	if done != nil {
		select {
		case <-done:
		case <-time.After(5 * time.Second):
			executor.logger.Errorf("Timed out waiting for listener goroutine to exit")
		}
	}
	return nil
}
