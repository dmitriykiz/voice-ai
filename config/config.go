package config

import (
	"fmt"
	"os"
	"strconv"
	"time"
)

// Config holds all configuration for the voice-ai service.
type Config struct {
	Server   ServerConfig
	AI       AIConfig
	Audio    AudioConfig
	Logging  LoggingConfig
}

// ServerConfig contains HTTP/gRPC server settings.
type ServerConfig struct {
	Host            string
	Port            int
	ReadTimeout     time.Duration
	WriteTimeout    time.Duration
	ShutdownTimeout time.Duration
}

// AIConfig contains settings for the AI/LLM backend.
type AIConfig struct {
	APIKey      string
	Model       string
	BaseURL     string
	MaxTokens   int
	Temperature float64
	Timeout     time.Duration
}

// AudioConfig contains settings for audio processing.
type AudioConfig struct {
	SampleRate    int
	Channels      int
	BitDepth      int
	MaxDuration   time.Duration
	TempDir       string
}

// LoggingConfig contains logging settings.
type LoggingConfig struct {
	Level  string
	Format string // "json" or "text"
}

// Load reads configuration from environment variables and returns a Config.
// It returns an error if any required variable is missing or invalid.
func Load() (*Config, error) {
	cfg := &Config{
		Server: ServerConfig{
			Host:            getEnv("SERVER_HOST", "0.0.0.0"),
			Port:            getEnvInt("SERVER_PORT", 8080),
			ReadTimeout:     getEnvDuration("SERVER_READ_TIMEOUT", 30*time.Second),
			WriteTimeout:    getEnvDuration("SERVER_WRITE_TIMEOUT", 30*time.Second),
			ShutdownTimeout: getEnvDuration("SERVER_SHUTDOWN_TIMEOUT", 10*time.Second),
		},
		AI: AIConfig{
			APIKey:      os.Getenv("AI_API_KEY"),
			Model:       getEnv("AI_MODEL", "gpt-4o-realtime-preview"),
			BaseURL:     getEnv("AI_BASE_URL", "https://api.openai.com/v1"),
			MaxTokens:   getEnvInt("AI_MAX_TOKENS", 1024),
			Temperature: getEnvFloat("AI_TEMPERATURE", 0.7),
			Timeout:     getEnvDuration("AI_TIMEOUT", 60*time.Second),
		},
		Audio: AudioConfig{
			SampleRate:  getEnvInt("AUDIO_SAMPLE_RATE", 16000),
			Channels:    getEnvInt("AUDIO_CHANNELS", 1),
			BitDepth:    getEnvInt("AUDIO_BIT_DEPTH", 16),
			MaxDuration: getEnvDuration("AUDIO_MAX_DURATION", 5*time.Minute),
			TempDir:     getEnv("AUDIO_TEMP_DIR", os.TempDir()),
		},
		Logging: LoggingConfig{
			Level:  getEnv("LOG_LEVEL", "info"),
			Format: getEnv("LOG_FORMAT", "json"),
		},
	}

	if cfg.AI.APIKey == "" {
		return nil, fmt.Errorf("AI_API_KEY environment variable is required")
	}

	return cfg, nil
}

// Addr returns the full server address string.
func (s *ServerConfig) Addr() string {
	return fmt.Sprintf("%s:%d", s.Host, s.Port)
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

func getEnvInt(key string, fallback int) int {
	v := os.Getenv(key)
	if v == "" {
		return fallback
	}
	n, err := strconv.Atoi(v)
	if err != nil {
		return fallback
	}
	return n
}

func getEnvFloat(key string, fallback float64) float64 {
	v := os.Getenv(key)
	if v == "" {
		return fallback
	}
	f, err := strconv.ParseFloat(v, 64)
	if err != nil {
		return fallback
	}
	return f
}

func getEnvDuration(key string, fallback time.Duration) time.Duration {
	v := os.Getenv(key)
	if v == "" {
		return fallback
	}
	d, err := time.ParseDuration(v)
	if err != nil {
		return fallback
	}
	return d
}
