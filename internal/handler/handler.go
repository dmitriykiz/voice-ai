// Package handler provides HTTP request handlers for the voice-ai API.
package handler

import (
	"encoding/json"
	"log/slog"
	"net/http"

	"github.com/rapidaai/voice-ai/config"
)

// Handler holds dependencies for HTTP handlers.
type Handler struct {
	cfg    *config.Config
	logger *slog.Logger
}

// New creates a new Handler with the given configuration and logger.
func New(cfg *config.Config, logger *slog.Logger) *Handler {
	return &Handler{
		cfg:    cfg,
		logger: logger,
	}
}

// errorResponse represents a JSON error payload.
type errorResponse struct {
	Error   string `json:"error"`
	Message string `json:"message,omitempty"`
}

// successResponse represents a generic JSON success payload.
type successResponse struct {
	Status  string `json:"status"`
	Message string `json:"message,omitempty"`
}

// Health handles GET /health and returns service liveness status.
func (h *Handler) Health(w http.ResponseWriter, r *http.Request) {
	h.writeJSON(w, http.StatusOK, successResponse{
		Status:  "ok",
		Message: "voice-ai is running",
	})
}

// Ready handles GET /ready and returns service readiness status.
// Extend this to check downstream dependencies (DB, AI provider, etc.).
func (h *Handler) Ready(w http.ResponseWriter, r *http.Request) {
	h.writeJSON(w, http.StatusOK, successResponse{
		Status:  "ready",
		Message: "all systems operational",
	})
}

// NotFound handles unmatched routes with a structured JSON 404 response.
func (h *Handler) NotFound(w http.ResponseWriter, r *http.Request) {
	h.logger.Warn("route not found", "method", r.Method, "path", r.URL.Path)
	h.writeJSON(w, http.StatusNotFound, errorResponse{
		Error:   "not_found",
		Message: "the requested resource does not exist",
	})
}

// MethodNotAllowed handles requests with unsupported HTTP methods.
func (h *Handler) MethodNotAllowed(w http.ResponseWriter, r *http.Request) {
	h.logger.Warn("method not allowed", "method", r.Method, "path", r.URL.Path)
	h.writeJSON(w, http.StatusMethodNotAllowed, errorResponse{
		Error:   "method_not_allowed",
		Message: "the HTTP method is not supported for this endpoint",
	})
}

// writeJSON serialises v as JSON and writes it to the response with the given status code.
func (h *Handler) writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)

	if err := json.NewEncoder(w).Encode(v); err != nil {
		h.logger.Error("failed to encode JSON response", "error", err)
	}
}
