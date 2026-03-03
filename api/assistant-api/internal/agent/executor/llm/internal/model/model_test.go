package internal_model

import (
	"context"
	"errors"
	"fmt"
	"io"
	"sync"
	"testing"
	"time"

	internal_agent_executor "github.com/rapidaai/api/assistant-api/internal/agent/executor"
	internal_assistant_entity "github.com/rapidaai/api/assistant-api/internal/entity/assistants"
	internal_type "github.com/rapidaai/api/assistant-api/internal/type"
	integration_client_builders "github.com/rapidaai/pkg/clients/integration/builders"
	gorm_types "github.com/rapidaai/pkg/models/gorm/types"
	"github.com/rapidaai/pkg/utils"
	"github.com/rapidaai/protos"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"go.uber.org/zap/zapcore"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/metadata"
	"google.golang.org/grpc/status"
)

// =============================================================================
// Mock: nopLogger
// =============================================================================

type nopLogger struct{}

func (nopLogger) Level() zapcore.Level                           { return zapcore.DebugLevel }
func (nopLogger) Debug(...interface{})                           {}
func (nopLogger) Debugf(string, ...interface{})                  {}
func (nopLogger) Debugw(string, ...interface{})                  {}
func (nopLogger) Info(...interface{})                            {}
func (nopLogger) Infof(string, ...interface{})                   {}
func (nopLogger) Infow(string, ...interface{})                   {}
func (nopLogger) Warn(...interface{})                            {}
func (nopLogger) Warnf(string, ...interface{})                   {}
func (nopLogger) Warnw(string, ...interface{})                   {}
func (nopLogger) Error(...interface{})                           {}
func (nopLogger) Errorf(string, ...interface{})                  {}
func (nopLogger) Errorw(string, ...interface{})                  {}
func (nopLogger) DPanic(...interface{})                          {}
func (nopLogger) DPanicf(string, ...interface{})                 {}
func (nopLogger) Panic(...interface{})                           {}
func (nopLogger) Panicf(string, ...interface{})                  {}
func (nopLogger) Fatal(...interface{})                           {}
func (nopLogger) Fatalf(string, ...interface{})                  {}
func (nopLogger) Benchmark(string, time.Duration)                {}
func (nopLogger) Tracef(context.Context, string, ...interface{}) {}
func (nopLogger) Sync() error                                   { return nil }

// =============================================================================
// Mock: packetCollector
// =============================================================================

type packetCollector struct {
	mu   sync.Mutex
	pkts []internal_type.Packet
}

func (c *packetCollector) collect(_ context.Context, pkts ...internal_type.Packet) error {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.pkts = append(c.pkts, pkts...)
	return nil
}

func (c *packetCollector) all() []internal_type.Packet {
	c.mu.Lock()
	defer c.mu.Unlock()
	out := make([]internal_type.Packet, len(c.pkts))
	copy(out, c.pkts)
	return out
}

// =============================================================================
// Mock: mockStream — grpc.BidiStreamingClient[protos.ChatRequest, protos.ChatResponse]
// =============================================================================

type streamRecvResult struct {
	resp *protos.ChatResponse
	err  error
}

type mockStream struct {
	mu        sync.Mutex
	sendCalls []*protos.ChatRequest
	sendErr   error
	recvCh    chan streamRecvResult
	closeSent bool
}

func newMockStream() *mockStream {
	return &mockStream{
		recvCh: make(chan streamRecvResult, 16),
	}
}

func (m *mockStream) Send(req *protos.ChatRequest) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.sendCalls = append(m.sendCalls, req)
	return m.sendErr
}

func (m *mockStream) Recv() (*protos.ChatResponse, error) {
	r, ok := <-m.recvCh
	if !ok {
		return nil, io.EOF
	}
	return r.resp, r.err
}

func (m *mockStream) CloseSend() error {
	m.mu.Lock()
	m.closeSent = true
	m.mu.Unlock()
	return nil
}

func (m *mockStream) Header() (metadata.MD, error) { return nil, nil }
func (m *mockStream) Trailer() metadata.MD          { return nil }
func (m *mockStream) Context() context.Context       { return context.Background() }
func (m *mockStream) SendMsg(any) error              { return nil }
func (m *mockStream) RecvMsg(any) error              { return nil }

// =============================================================================
// Mock: mockCommunication
// =============================================================================

type mockCommunication struct {
	internal_type.Communication // embedded nil for unimplemented methods
	collector                   *packetCollector
	assistant                   *internal_assistant_entity.Assistant
}

func (m *mockCommunication) OnPacket(ctx context.Context, pkts ...internal_type.Packet) error {
	return m.collector.collect(ctx, pkts...)
}

func (m *mockCommunication) Assistant() *internal_assistant_entity.Assistant {
	return m.assistant
}

func (m *mockCommunication) GetArgs() map[string]interface{} {
	return nil
}

func (m *mockCommunication) GetOptions() utils.Option {
	return nil
}

// =============================================================================
// Mock: mockToolExecutor
// =============================================================================

type mockToolExecutor struct {
	executeFn func(ctx context.Context, contextID string, calls []*protos.ToolCall, comm internal_type.Communication) *protos.Message
}

var _ internal_agent_executor.ToolExecutor = (*mockToolExecutor)(nil)

func (m *mockToolExecutor) Initialize(context.Context, internal_type.Communication) error {
	return nil
}

func (m *mockToolExecutor) GetFunctionDefinitions() []*protos.FunctionDefinition {
	return nil
}

func (m *mockToolExecutor) ExecuteAll(ctx context.Context, contextID string, calls []*protos.ToolCall, comm internal_type.Communication) *protos.Message {
	if m.executeFn != nil {
		return m.executeFn(ctx, contextID, calls, comm)
	}
	return &protos.Message{Role: "tool"}
}

func (m *mockToolExecutor) Close(context.Context) error {
	return nil
}

// =============================================================================
// Helpers
// =============================================================================

func newTestComm() (*mockCommunication, *packetCollector) {
	c := &packetCollector{}
	return &mockCommunication{
		collector: c,
		assistant: &internal_assistant_entity.Assistant{
			AssistantProviderModel: &internal_assistant_entity.AssistantProviderModel{
				Template:              gorm_types.PromptMap{},
				AssistantModelOptions: []*internal_assistant_entity.AssistantProviderModelOption{},
			},
		},
	}, c
}

func newTestExecutor() *modelAssistantExecutor {
	logger := nopLogger{}
	return &modelAssistantExecutor{
		logger:       logger,
		toolExecutor: &mockToolExecutor{},
		inputBuilder: integration_client_builders.NewChatInputBuilder(logger),
		history:      make([]*protos.Message, 0),
	}
}

func findPacket[T internal_type.Packet](pkts []internal_type.Packet) (T, bool) {
	for _, p := range pkts {
		if v, ok := p.(T); ok {
			return v, true
		}
	}
	var zero T
	return zero, false
}

func findPackets[T internal_type.Packet](pkts []internal_type.Packet) []T {
	var out []T
	for _, p := range pkts {
		if v, ok := p.(T); ok {
			out = append(out, v)
		}
	}
	return out
}

// =============================================================================
// Tests: handleResponse — 5 cases
// =============================================================================

func TestHandleResponse_Error(t *testing.T) {
	e := newTestExecutor()
	comm, collector := newTestComm()

	resp := &protos.ChatResponse{
		RequestId: "req-1",
		Success:   false,
		Error:     &protos.Error{ErrorMessage: "rate limited"},
	}
	e.handleResponse(context.Background(), comm, resp)

	pkts := collector.all()
	require.Len(t, pkts, 2)

	errPkt, ok := pkts[0].(internal_type.LLMErrorPacket)
	require.True(t, ok)
	assert.Equal(t, "req-1", errPkt.ContextID)
	assert.Equal(t, "rate limited", errPkt.Error.Error())

	ev, ok := pkts[1].(internal_type.ConversationEventPacket)
	require.True(t, ok)
	assert.Equal(t, "error", ev.Data["type"])
	assert.Equal(t, "rate limited", ev.Data["error"])
}

func TestHandleResponse_NilOutput(t *testing.T) {
	e := newTestExecutor()
	comm, collector := newTestComm()

	resp := &protos.ChatResponse{
		RequestId: "req-2",
		Success:   true,
		Data:      nil,
	}
	e.handleResponse(context.Background(), comm, resp)
	assert.Empty(t, collector.all(), "nil output should emit no packets")
}

func TestHandleResponse_FinalWithoutToolCalls(t *testing.T) {
	e := newTestExecutor()
	comm, collector := newTestComm()

	resp := &protos.ChatResponse{
		RequestId: "req-3",
		Success:   true,
		Data: &protos.Message{
			Role: "assistant",
			Message: &protos.Message_Assistant{
				Assistant: &protos.AssistantMessage{
					Contents: []string{"Hello", " world"},
				},
			},
		},
		Metrics: []*protos.Metric{{Name: "tokens", Value: "10"}},
	}
	e.handleResponse(context.Background(), comm, resp)

	pkts := collector.all()
	require.Len(t, pkts, 3)

	done, ok := pkts[0].(internal_type.LLMResponseDonePacket)
	require.True(t, ok)
	assert.Equal(t, "req-3", done.ContextID)
	assert.Equal(t, "Hello world", done.Text)

	ev, ok := pkts[1].(internal_type.ConversationEventPacket)
	require.True(t, ok)
	assert.Equal(t, "completed", ev.Data["type"])
	assert.Equal(t, "11", ev.Data["response_char_count"])

	metric, ok := pkts[2].(internal_type.MessageMetricPacket)
	require.True(t, ok)
	assert.Equal(t, "req-3", metric.ContextID)
	require.Len(t, metric.Metrics, 1)
	assert.Equal(t, "tokens", metric.Metrics[0].Name)

	// Verify history was updated
	snapshot := e.snapshotHistory()
	require.Len(t, snapshot, 1)
	assert.Equal(t, "assistant", snapshot[0].Role)
}

func TestHandleResponse_FinalWithToolCalls(t *testing.T) {
	e := newTestExecutor()
	// Set stream to nil so chatWithHistory (inside executeToolCalls) fails
	e.stream = nil
	toolMsg := &protos.Message{Role: "tool"}
	e.toolExecutor = &mockToolExecutor{
		executeFn: func(_ context.Context, _ string, _ []*protos.ToolCall, _ internal_type.Communication) *protos.Message {
			return toolMsg
		},
	}

	comm, collector := newTestComm()

	resp := &protos.ChatResponse{
		RequestId: "req-4",
		Success:   true,
		Data: &protos.Message{
			Role: "assistant",
			Message: &protos.Message_Assistant{
				Assistant: &protos.AssistantMessage{
					Contents:  []string{"calling tool"},
					ToolCalls: []*protos.ToolCall{{Id: "tc1", Type: "function"}},
				},
			},
		},
		Metrics: []*protos.Metric{{Name: "tokens", Value: "5"}},
	}
	e.handleResponse(context.Background(), comm, resp)

	pkts := collector.all()
	// Should have: LLMResponseDonePacket, ConversationEventPacket(completed), MessageMetricPacket, LLMErrorPacket(tool call follow-up failed)
	require.GreaterOrEqual(t, len(pkts), 4)

	done, ok := findPacket[internal_type.LLMResponseDonePacket](pkts)
	require.True(t, ok)
	assert.Equal(t, "calling tool", done.Text)

	errPkts := findPackets[internal_type.LLMErrorPacket](pkts)
	require.Len(t, errPkts, 1)
	assert.Contains(t, errPkts[0].Error.Error(), "tool call follow-up failed")

	// Verify history: output + toolExecution were appended atomically
	snapshot := e.snapshotHistory()
	require.Len(t, snapshot, 2, "assistant msg + tool result should be in history")
}

func TestHandleResponse_StreamDelta(t *testing.T) {
	e := newTestExecutor()
	comm, collector := newTestComm()

	resp := &protos.ChatResponse{
		RequestId: "req-5",
		Success:   true,
		Data: &protos.Message{
			Role: "assistant",
			Message: &protos.Message_Assistant{
				Assistant: &protos.AssistantMessage{
					Contents: []string{"partial"},
				},
			},
		},
		// No Metrics → streaming delta
	}
	e.handleResponse(context.Background(), comm, resp)

	pkts := collector.all()
	require.Len(t, pkts, 1)
	delta, ok := pkts[0].(internal_type.LLMResponseDeltaPacket)
	require.True(t, ok)
	assert.Equal(t, "req-5", delta.ContextID)
	assert.Equal(t, "partial", delta.Text)
}

// =============================================================================
// Tests: streamErrorReason — 4 cases
// =============================================================================

func TestStreamErrorReason(t *testing.T) {
	e := newTestExecutor()

	tests := []struct {
		name string
		err  error
		want string
	}{
		{"eof", io.EOF, "server closed connection"},
		{"canceled", status.Error(codes.Canceled, "ctx"), "connection canceled"},
		{"unavailable", status.Error(codes.Unavailable, "down"), "server unavailable"},
		{"other", errors.New("broken pipe"), "broken pipe"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := e.streamErrorReason(tt.err)
			assert.Equal(t, tt.want, got)
		})
	}
}

// =============================================================================
// Tests: history mutex — 3 cases
// =============================================================================

func TestSnapshotHistory_ReturnsCopy(t *testing.T) {
	e := newTestExecutor()
	e.mu.Lock()
	e.history = append(e.history, &protos.Message{Role: "user"})
	e.mu.Unlock()

	snapshot := e.snapshotHistory()
	require.Len(t, snapshot, 1)

	// Modify snapshot — should not affect original
	snapshot[0] = &protos.Message{Role: "modified"}
	original := e.snapshotHistory()
	assert.Equal(t, "user", original[0].Role, "modifying snapshot should not affect original")
}

func TestConcurrency_HistoryAndSnapshot(t *testing.T) {
	e := newTestExecutor()

	var wg sync.WaitGroup
	wg.Add(2)

	// Writer: appends to history via handleStaticPacket
	go func() {
		defer wg.Done()
		for i := 0; i < 100; i++ {
			_ = e.handleStaticPacket(internal_type.StaticPacket{
				ContextID: fmt.Sprintf("ctx-%d", i),
				Text:      fmt.Sprintf("msg-%d", i),
			})
		}
	}()

	// Reader: reads snapshots concurrently
	go func() {
		defer wg.Done()
		for i := 0; i < 100; i++ {
			_ = e.snapshotHistory()
		}
	}()

	wg.Wait()
	snapshot := e.snapshotHistory()
	assert.Len(t, snapshot, 100, "all messages should be in history")
}

func TestHistoryClearedAfterClose(t *testing.T) {
	e := newTestExecutor()
	e.mu.Lock()
	e.history = append(e.history, &protos.Message{Role: "user"})
	e.mu.Unlock()
	e.done = make(chan struct{})
	close(e.done)

	_ = e.Close(context.Background())

	snapshot := e.snapshotHistory()
	assert.Empty(t, snapshot, "history should be empty after Close")
}

// =============================================================================
// Tests: handleStaticPacket
// =============================================================================

func TestHandleStaticPacket(t *testing.T) {
	e := newTestExecutor()

	err := e.handleStaticPacket(internal_type.StaticPacket{
		ContextID: "ctx-1",
		Text:      "hello",
	})
	require.NoError(t, err)

	snapshot := e.snapshotHistory()
	require.Len(t, snapshot, 1)
	assert.Equal(t, "assistant", snapshot[0].Role)
	assert.Equal(t, []string{"hello"}, snapshot[0].GetAssistant().GetContents())
}

// =============================================================================
// Tests: handleUserTextPacket
// =============================================================================

func TestHandleUserTextPacket(t *testing.T) {
	e := newTestExecutor()
	stream := newMockStream()
	e.stream = stream
	comm, collector := newTestComm()

	err := e.handleUserTextPacket(context.Background(), comm, internal_type.UserTextPacket{
		ContextID: "ctx-1",
		Text:      "say hello",
	})
	require.NoError(t, err)

	// Verify ConversationEventPacket
	evs := findPackets[internal_type.ConversationEventPacket](collector.all())
	require.Len(t, evs, 1)
	assert.Equal(t, "executing", evs[0].Data["type"])
	assert.Equal(t, "say hello", evs[0].Data["script"])
	assert.Equal(t, "9", evs[0].Data["input_char_count"])
	assert.Equal(t, "0", evs[0].Data["history_count"])

	// Verify stream.Send was called
	stream.mu.Lock()
	defer stream.mu.Unlock()
	require.Len(t, stream.sendCalls, 1)

	// Verify history was updated with the user message
	snapshot := e.snapshotHistory()
	require.Len(t, snapshot, 1)
	assert.Equal(t, "user", snapshot[0].Role)
}

// =============================================================================
// Tests: Execute routing — 3 cases
// =============================================================================

func TestExecute_UserTextPacket(t *testing.T) {
	e := newTestExecutor()
	stream := newMockStream()
	e.stream = stream
	comm, _ := newTestComm()

	err := e.Execute(context.Background(), comm, internal_type.UserTextPacket{
		ContextID: "ctx-1",
		Text:      "test",
	})
	require.NoError(t, err)

	stream.mu.Lock()
	defer stream.mu.Unlock()
	assert.Len(t, stream.sendCalls, 1, "should have sent a chat request")
}

func TestExecute_StaticPacket(t *testing.T) {
	e := newTestExecutor()
	comm, collector := newTestComm()

	err := e.Execute(context.Background(), comm, internal_type.StaticPacket{
		ContextID: "ctx-1",
		Text:      "static",
	})
	require.NoError(t, err)
	assert.Empty(t, collector.all(), "StaticPacket should not emit packets")

	snapshot := e.snapshotHistory()
	require.Len(t, snapshot, 1, "StaticPacket should append to history")
}

func TestExecute_UnsupportedPacket(t *testing.T) {
	e := newTestExecutor()
	comm, _ := newTestComm()

	err := e.Execute(context.Background(), comm, internal_type.InterruptionPacket{ContextID: "x"})
	require.Error(t, err)
	assert.Contains(t, err.Error(), "unsupported packet type")
}

// =============================================================================
// Tests: sendLocked — 2 cases
// =============================================================================

func TestSendLocked_NilStream(t *testing.T) {
	e := newTestExecutor()
	e.stream = nil

	err := e.sendLocked(&protos.ChatRequest{})
	require.Error(t, err)
	assert.Contains(t, err.Error(), "stream not connected")
}

func TestSendLocked_Success(t *testing.T) {
	e := newTestExecutor()
	stream := newMockStream()
	e.stream = stream

	err := e.sendLocked(&protos.ChatRequest{RequestId: "r1"})
	require.NoError(t, err)

	stream.mu.Lock()
	defer stream.mu.Unlock()
	require.Len(t, stream.sendCalls, 1)
	assert.Equal(t, "r1", stream.sendCalls[0].RequestId)
}

// =============================================================================
// Tests: Close — 3 cases
// =============================================================================

func TestClose_ClearsHistoryAndStream(t *testing.T) {
	e := newTestExecutor()
	stream := newMockStream()
	e.stream = stream
	e.mu.Lock()
	e.history = append(e.history, &protos.Message{Role: "user"})
	e.mu.Unlock()
	e.done = make(chan struct{})
	close(e.done)

	err := e.Close(context.Background())
	require.NoError(t, err)

	e.mu.RLock()
	defer e.mu.RUnlock()
	assert.Nil(t, e.stream)
	assert.Empty(t, e.history)
}

func TestClose_WaitsForDone(t *testing.T) {
	e := newTestExecutor()
	e.done = make(chan struct{})

	go func() {
		time.Sleep(50 * time.Millisecond)
		close(e.done)
	}()

	start := time.Now()
	err := e.Close(context.Background())
	require.NoError(t, err)
	assert.GreaterOrEqual(t, time.Since(start), 40*time.Millisecond,
		"Close should have waited for done channel")
}

func TestClose_NoPanicNilStream(t *testing.T) {
	e := newTestExecutor()
	e.stream = nil
	e.done = nil

	err := e.Close(context.Background())
	require.NoError(t, err, "Close on nil stream should not panic")
}

// =============================================================================
// Tests: listen — processes responses then exits on error
// =============================================================================

func TestListen_RecvEOF(t *testing.T) {
	e := newTestExecutor()
	stream := newMockStream()
	e.stream = stream
	comm, collector := newTestComm()

	stream.recvCh <- streamRecvResult{err: io.EOF}

	done := make(chan struct{})
	go func() {
		defer close(done)
		e.listen(context.Background(), comm)
	}()

	select {
	case <-done:
	case <-time.After(2 * time.Second):
		t.Fatal("listen did not exit on EOF")
	}

	dirs := findPackets[internal_type.DirectivePacket](collector.all())
	require.Len(t, dirs, 1)
	assert.Equal(t, protos.ConversationDirective_END_CONVERSATION, dirs[0].Directive)
	assert.Equal(t, "server closed connection", dirs[0].Arguments["reason"])
}

func TestListen_NilStream(t *testing.T) {
	e := newTestExecutor()
	e.stream = nil
	comm, _ := newTestComm()

	done := make(chan struct{})
	go func() {
		defer close(done)
		e.listen(context.Background(), comm)
	}()

	select {
	case <-done:
	case <-time.After(2 * time.Second):
		t.Fatal("listen did not exit with nil stream")
	}
}

func TestListen_ContextCancelled(t *testing.T) {
	e := newTestExecutor()
	stream := newMockStream()
	e.stream = stream
	comm, _ := newTestComm()

	ctx, cancel := context.WithCancel(context.Background())
	cancel()

	done := make(chan struct{})
	go func() {
		defer close(done)
		e.listen(ctx, comm)
	}()

	select {
	case <-done:
	case <-time.After(2 * time.Second):
		t.Fatal("listen did not exit on context cancel")
	}
}

func TestListen_ProcessesMultipleMessages(t *testing.T) {
	e := newTestExecutor()
	stream := newMockStream()
	e.stream = stream
	comm, collector := newTestComm()

	// Two deltas then EOF
	stream.recvCh <- streamRecvResult{resp: &protos.ChatResponse{
		RequestId: "r1",
		Success:   true,
		Data: &protos.Message{
			Role: "assistant",
			Message: &protos.Message_Assistant{
				Assistant: &protos.AssistantMessage{Contents: []string{"chunk1"}},
			},
		},
	}}
	stream.recvCh <- streamRecvResult{resp: &protos.ChatResponse{
		RequestId: "r1",
		Success:   true,
		Data: &protos.Message{
			Role: "assistant",
			Message: &protos.Message_Assistant{
				Assistant: &protos.AssistantMessage{Contents: []string{"chunk2"}},
			},
		},
	}}
	stream.recvCh <- streamRecvResult{err: io.EOF}

	done := make(chan struct{})
	go func() {
		defer close(done)
		e.listen(context.Background(), comm)
	}()

	select {
	case <-done:
	case <-time.After(2 * time.Second):
		t.Fatal("listen did not exit")
	}

	deltas := findPackets[internal_type.LLMResponseDeltaPacket](collector.all())
	assert.Len(t, deltas, 2)
}

// =============================================================================
// Tests: Name
// =============================================================================

func TestName(t *testing.T) {
	e := newTestExecutor()
	assert.Equal(t, "model", e.Name())
}

// =============================================================================
// Tests: handleResponse — empty contents delta emits nothing
// =============================================================================

func TestHandleResponse_EmptyContents(t *testing.T) {
	e := newTestExecutor()
	comm, collector := newTestComm()

	resp := &protos.ChatResponse{
		RequestId: "req-6",
		Success:   true,
		Data: &protos.Message{
			Role: "assistant",
			Message: &protos.Message_Assistant{
				Assistant: &protos.AssistantMessage{
					Contents: []string{},
				},
			},
		},
	}
	e.handleResponse(context.Background(), comm, resp)
	assert.Empty(t, collector.all(), "empty contents should emit no delta")
}

// =============================================================================
// Tests: concurrent listen + close (run with -race)
// =============================================================================

func TestConcurrency_ListenAndClose(t *testing.T) {
	e := newTestExecutor()
	stream := newMockStream()
	e.stream = stream
	e.done = make(chan struct{})
	comm, _ := newTestComm()

	ctx, cancel := context.WithCancel(context.Background())

	go func() {
		defer close(e.done)
		e.listen(ctx, comm)
	}()

	time.Sleep(5 * time.Millisecond)
	cancel()
	err := e.Close(context.Background())
	require.NoError(t, err)
}

// =============================================================================
// Tests: handleUserTextPacket includes correct history_count
// =============================================================================

func TestHandleUserTextPacket_HistoryCount(t *testing.T) {
	e := newTestExecutor()
	stream := newMockStream()
	e.stream = stream

	// Pre-populate history
	e.mu.Lock()
	e.history = append(e.history,
		&protos.Message{Role: "user"},
		&protos.Message{Role: "assistant"},
	)
	e.mu.Unlock()

	comm, collector := newTestComm()

	err := e.handleUserTextPacket(context.Background(), comm, internal_type.UserTextPacket{
		ContextID: "ctx-2",
		Text:      "follow up",
	})
	require.NoError(t, err)

	evs := findPackets[internal_type.ConversationEventPacket](collector.all())
	require.Len(t, evs, 1)
	assert.Equal(t, "2", evs[0].Data["history_count"], "should reflect 2 existing messages")
}

// =============================================================================
// Tests: Close with pending done channel times out
// =============================================================================

func TestClose_TimeoutsOnStuckDone(t *testing.T) {
	e := newTestExecutor()
	e.done = make(chan struct{}) // never closed

	start := time.Now()
	done := make(chan error, 1)
	go func() {
		done <- e.Close(context.Background())
	}()

	select {
	case err := <-done:
		require.NoError(t, err)
		elapsed := time.Since(start)
		assert.Greater(t, elapsed, 4*time.Second)
	case <-time.After(7 * time.Second):
		t.Fatal("Close did not return within expected timeout")
	}
}

// =============================================================================
// Tests: Execute with stream send error
// =============================================================================

func TestExecute_SendError(t *testing.T) {
	e := newTestExecutor()
	stream := newMockStream()
	stream.sendErr = fmt.Errorf("send failed")
	e.stream = stream
	comm, _ := newTestComm()

	err := e.Execute(context.Background(), comm, internal_type.UserTextPacket{
		ContextID: "ctx-1",
		Text:      "test",
	})
	require.Error(t, err)
	assert.Contains(t, err.Error(), "failed to send chat request")
}
