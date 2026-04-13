package server

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"time"

	"github.com/rapidaai/voice-ai/config"
)

// Server holds the HTTP server and its dependencies.
type Server struct {
	httpServer *http.Server
	cfg        *config.Config
	router     *http.ServeMux
}

// New creates and configures a new Server instance.
func New(cfg *config.Config) *Server {
	s := &Server{
		cfg:    cfg,
		router: http.NewServeMux(),
	}
	s.registerRoutes()
	return s
}

// registerRoutes sets up all HTTP routes for the server.
func (s *Server) registerRoutes() {
	s.router.HandleFunc("/health", s.handleHealth)
	s.router.HandleFunc("/api/v1/voice", s.handleVoice)
}

// Start begins listening for incoming HTTP connections.
func (s *Server) Start() error {
	addr := fmt.Sprintf("%s:%d", s.cfg.Host, s.cfg.Port)
	s.httpServer = &http.Server{
		Addr:         addr,
		Handler:      s.router,
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 15 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	log.Printf("Server starting on %s", addr)
	return s.httpServer.ListenAndServe()
}

// Shutdown gracefully stops the HTTP server.
func (s *Server) Shutdown(ctx context.Context) error {
	if s.httpServer == nil {
		return nil
	}
	log.Println("Server shutting down gracefully...")
	return s.httpServer.Shutdown(ctx)
}

// handleHealth responds to health check requests.
func (s *Server) handleHealth(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write([]byte(`{"status":"ok"}`))
}

// handleVoice is a placeholder for the primary voice AI endpoint.
func (s *Server) handleVoice(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	// TODO: wire up voice processing pipeline
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusAccepted)
	_, _ = w.Write([]byte(`{"message":"voice request accepted"}`))
}
