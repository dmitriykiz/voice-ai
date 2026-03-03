// Copyright (c) 2023-2025 RapidaAI
// Author: Prashant Srivastav <prashant@rapida.ai>
//
// Licensed under GPL-2.0 with Rapida Additional Terms.
// See LICENSE.md or contact sales@rapida.ai for commercial usage.

package internal_transformer_sarvam

import (
	"context"
	"regexp"
	"strings"

	internal_normalizers "github.com/rapidaai/api/assistant-api/internal/normalizers"
	internal_type "github.com/rapidaai/api/assistant-api/internal/type"
	"github.com/rapidaai/pkg/commons"
	"github.com/rapidaai/pkg/utils"
)

// Compiled once at package init; Normalize() is called for every LLM delta token.
var (
	reHeadings   = regexp.MustCompile(`(?m)^#{1,6}\s*`)
	reEmphasis   = regexp.MustCompile(`\*{1,2}([^*]+?)\*{1,2}|_{1,2}([^_]+?)_{1,2}`)
	reInlineCode = regexp.MustCompile("`([^`]+)`")
	reCodeBlock  = regexp.MustCompile("(?s)```[^`]*```")
	reBlockquote = regexp.MustCompile(`(?m)^>\s?`)
	reLink       = regexp.MustCompile(`\[(.*?)\]\(.*?\)`)
	reImage      = regexp.MustCompile(`!\[(.*?)\]\(.*?\)`)
	reHRule      = regexp.MustCompile(`(?m)^(-{3,}|\*{3,}|_{3,})$`)
	reLeftover   = regexp.MustCompile(`[*_]+`)
	reWhitespace = regexp.MustCompile(`\s+`)
)

// =============================================================================
// Sarvam Text Normalizer
// =============================================================================

// sarvamNormalizer handles Sarvam AI TTS text preprocessing.
// Sarvam does NOT support SSML - only plain text is accepted.
// Sarvam specializes in Indian languages (Hindi, Tamil, Telugu, etc.).
type sarvamNormalizer struct {
	logger   commons.Logger
	config   internal_type.NormalizerConfig
	language string

	// normalizer pipeline
	normalizers []internal_normalizers.Normalizer
}

// NewSarvamNormalizer creates a Sarvam-specific text normalizer.
func NewSarvamNormalizer(logger commons.Logger, opts utils.Option) internal_type.TextNormalizer {
	cfg := internal_type.DefaultNormalizerConfig()

	language, _ := opts.GetString("speaker.language")
	if language == "" {
		language = "hi-IN" // Default to Hindi
	}

	// Build normalizer pipeline based on speaker.pronunciation.dictionaries
	var normalizers []internal_normalizers.Normalizer
	if dictionaries, err := opts.GetString("speaker.pronunciation.dictionaries"); err == nil && dictionaries != "" {
		normalizerNames := strings.Split(dictionaries, commons.SEPARATOR)
		normalizers = internal_type.BuildNormalizerPipeline(logger, normalizerNames)
	}

	return &sarvamNormalizer{
		logger:      logger,
		config:      cfg,
		language:    language,
		normalizers: normalizers,
	}
}

// Normalize applies Sarvam-specific text transformations.
// Sarvam does NOT support SSML, so we only normalize text without XML escaping.
func (n *sarvamNormalizer) Normalize(ctx context.Context, text string) string {
	if text == "" {
		return text
	}

	text = n.removeMarkdown(text)

	for _, normalizer := range n.normalizers {
		text = normalizer.Normalize(text)
	}

	// NO XML escaping — Sarvam uses plain text only
	// NO SSML breaks — Sarvam doesn't support SSML

	return strings.TrimSpace(reWhitespace.ReplaceAllString(text, " "))
}

// =============================================================================
// Private Helpers
// =============================================================================

func (n *sarvamNormalizer) removeMarkdown(input string) string {
	output := reHeadings.ReplaceAllString(input, "")
	output = reEmphasis.ReplaceAllString(output, "$1$2")
	output = reInlineCode.ReplaceAllString(output, "$1")
	output = reCodeBlock.ReplaceAllString(output, "")
	output = reBlockquote.ReplaceAllString(output, "")
	output = reImage.ReplaceAllString(output, "$1")
	output = reLink.ReplaceAllString(output, "$1")
	output = reHRule.ReplaceAllString(output, "")
	output = reLeftover.ReplaceAllString(output, "")
	return output
}
