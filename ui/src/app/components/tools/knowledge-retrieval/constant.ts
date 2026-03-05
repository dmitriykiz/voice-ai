import { Metadata } from '@rapidaai/react';
import { getOptionValue, buildDefaultMetadata } from '../common';

// ============================================================================
// Constants
// ============================================================================

const REQUIRED_KEYS = [
  'tool.search_type',
  'tool.knowledge_id',
  'tool.top_k',
  'tool.score_threshold',
];

const ALLOWED_SEARCH_TYPES = ['semantic', 'fullText', 'hybrid'];

const DEFAULTS = {
  search_type: 'hybrid',
  top_k: '5',
  score_threshold: '0.5',
} as const;

// ============================================================================
// Default Options
// ============================================================================

export const GetKnowledgeRetrievalDefaultOptions = (
  current: Metadata[],
): Metadata[] =>
  buildDefaultMetadata(
    current,
    [
      { key: 'tool.search_type', defaultValue: DEFAULTS.search_type },
      { key: 'tool.top_k', defaultValue: DEFAULTS.top_k },
      { key: 'tool.score_threshold', defaultValue: DEFAULTS.score_threshold },
      { key: 'tool.knowledge_id' },
    ],
    REQUIRED_KEYS,
  );

// ============================================================================
// Validation
// ============================================================================

const validateRequiredKeys = (options: Metadata[]): string | undefined => {
  for (const key of REQUIRED_KEYS) {
    if (!options.some(opt => opt.getKey() === key)) {
      return `Missing required metadata key: ${key}.`;
    }
  }
  return undefined;
};

const validateSearchType = (value: string | undefined): string | undefined => {
  if (value && !ALLOWED_SEARCH_TYPES.includes(value)) {
    return `Invalid search type. Accepted values: ${ALLOWED_SEARCH_TYPES.join(', ')}.`;
  }
  return undefined;
};

const validateTopK = (value: string | undefined): string | undefined => {
  if (value !== undefined) {
    const topK = Number(value);
    if (isNaN(topK) || topK < 1 || topK > 10) {
      return 'Top K must be a number between 1 and 10.';
    }
  }
  return undefined;
};

const validateScoreThreshold = (
  value: string | undefined,
): string | undefined => {
  if (value !== undefined) {
    const threshold = Number(value);
    if (isNaN(threshold) || threshold < 0.1 || threshold > 0.9) {
      return 'Score threshold must be a number between 0.1 and 0.9.';
    }
  }
  return undefined;
};

export const ValidateKnowledgeRetrievalDefaultOptions = (
  options: Metadata[],
): string | undefined =>
  validateRequiredKeys(options) ||
  validateSearchType(getOptionValue(options, 'tool.search_type')) ||
  validateTopK(getOptionValue(options, 'tool.top_k')) ||
  validateScoreThreshold(getOptionValue(options, 'tool.score_threshold'));
