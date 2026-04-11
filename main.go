package main

import (
	"context"
	"log/slog"
	"os"
	"os/signal"
	"syscall"

	"github.com/voice-ai/voice-ai/internal/config"
	"github.com/voice-ai/voice-ai/internal/server"
)

func main() {
	// Initialize structured logger
	// Using LevelDebug locally to get more verbose output while learning the codebase
	logLevel := slog.LevelDebug
	if os.Getenv("APP_ENV") == "production" {
		logLevel = slog.LevelInfo
	}

	logger := slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{
		Level: logLevel,
	}))
	slog.SetDefault(logger)

	// Load configuration from environment / config file
	cfg, err := config.Load()
	if err != nil {
		slog.Error("failed to load configuration", "error", err)
		os.Exit(1)
	}

	slog.Info("starting voice-ai server",
		"addr", cfg.Server.Addr,
		"env", cfg.Env,
	)

	// Create the HTTP/WebSocket server
	srv, err := server.New(cfg, logger)
	if err != nil {
		slog.Error("failed to create server", "error", err)
		os.Exit(1)
	}

	// Run server in a goroutine so we can listen for shutdown signals
	serverErr := make(chan error, 1)
	go func() {
		serverErr <- srv.Start()
	}()

	// Wait for interrupt or termination signal
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)

	select {
	case sig := <-quit:
		slog.Info("received shutdown signal", "signal", sig)
	case err := <-serverErr:
		if err != nil {
			slog.Error("server error", "error", err)
		}
	}

	// Graceful shutdown with timeout
	ctx, cancel := context.WithTimeout(context.Background(), cfg.Server.ShutdownTimeout)
	defer cancel()

	if err := srv.Shutdown(ctx); err != nil {
		slog.Error("graceful shutdown failed", "error", err)
		os.Exit(1)
	}

	slog.Info("server stopped gracefully")
}
