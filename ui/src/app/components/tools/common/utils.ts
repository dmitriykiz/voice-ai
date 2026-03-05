import { Metadata } from '@rapidaai/react';
import { SetMetadata } from '@/utils/metadata';

/**
 * Safely retrieves the string value of a Metadata entry by key.
 * Returns undefined if not found.
 */
export const getOptionValue = (
  options: Metadata[],
  key: string,
): string | undefined => {
  return options.find(opt => opt.getKey() === key)?.getValue();
};

/**
 * Builds a Metadata array from a list of key/defaultValue entries.
 *
 * For each entry, delegates to SetMetadata to either preserve the
 * existing value from `current` or initialise from `defaultValue`.
 *
 * @param current   Existing Metadata array (may be empty)
 * @param entries   Keys with optional defaults to initialise
 * @param allowedKeys  When provided, filters output to only these keys
 */
export const buildDefaultMetadata = (
  current: Metadata[],
  entries: { key: string; defaultValue?: string }[],
  allowedKeys?: string[],
): Metadata[] => {
  const metadata: Metadata[] = [];

  for (const { key, defaultValue } of entries) {
    const meta = SetMetadata(current, key, defaultValue);
    if (meta) metadata.push(meta);
  }

  return allowedKeys
    ? metadata.filter(m => allowedKeys.includes(m.getKey()))
    : metadata;
};
