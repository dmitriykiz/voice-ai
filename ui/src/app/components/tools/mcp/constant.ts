import { Metadata } from '@rapidaai/react';
import { getOptionValue, buildDefaultMetadata } from '../common';

// ============================================================================
// Constants
// ============================================================================

const REQUIRED_KEYS = ['mcp.server_url'];
const OPTIONAL_KEYS = ['mcp.tool_name', 'mcp.protocol', 'mcp.timeout', 'mcp.headers'];
const ALL_KEYS = [...REQUIRED_KEYS, ...OPTIONAL_KEYS];

export const MCP_PROTOCOL_OPTIONS = [
  { value: 'sse', name: 'SSE (Server-Sent Events)' },
  { value: 'streamable_http', name: 'Streamable HTTP' },
  { value: 'websocket', name: 'WebSocket' },
];

// ============================================================================
// Default Options
// ============================================================================

export const GetMCPDefaultOptions = (current: Metadata[]): Metadata[] =>
  buildDefaultMetadata(
    current,
    [
      { key: 'mcp.server_url' },
      { key: 'mcp.tool_name' },
      { key: 'mcp.protocol', defaultValue: 'sse' },
      { key: 'mcp.timeout', defaultValue: '30' },
      { key: 'mcp.headers' },
    ],
    ALL_KEYS,
  );

// ============================================================================
// Validation
// ============================================================================

const validateRequiredKeys = (options: Metadata[]): string | undefined => {
  const missingKeys = REQUIRED_KEYS.filter(
    key => !options.some(opt => opt.getKey() === key),
  );
  if (missingKeys.length > 0) {
    return `Missing required configuration: ${missingKeys.join(', ')}`;
  }
  return undefined;
};

const validateServerUrl = (options: Metadata[]): string | undefined => {
  const serverUrl = getOptionValue(options, 'mcp.server_url');
  if (!serverUrl || serverUrl.trim() === '') {
    return 'MCP Server URL is required.';
  }
  try {
    new URL(serverUrl);
  } catch {
    return 'Invalid MCP Server URL format.';
  }
  if (
    !serverUrl.startsWith('http://') &&
    !serverUrl.startsWith('https://') &&
    !serverUrl.startsWith('wss://')
  ) {
    return 'MCP Server URL must start with http://, https://, or wss://';
  }
  return undefined;
};

const validateProtocol = (options: Metadata[]): string | undefined => {
  const protocol = getOptionValue(options, 'mcp.protocol');
  if (protocol && !['sse', 'websocket', 'streamable_http', ''].includes(protocol)) {
    return 'Protocol must be "sse", "websocket", or "streamable_http".';
  }
  return undefined;
};

const validateTimeout = (options: Metadata[]): string | undefined => {
  const timeout = getOptionValue(options, 'mcp.timeout');
  if (timeout) {
    const n = parseInt(timeout, 10);
    if (isNaN(n) || n < 1 || n > 300) {
      return 'Timeout must be a number between 1 and 300 seconds.';
    }
  }
  return undefined;
};

const validateHeaders = (options: Metadata[]): string | undefined => {
  const headers = getOptionValue(options, 'mcp.headers');
  if (headers && headers.trim() !== '') {
    try {
      const parsed = JSON.parse(headers);
      if (typeof parsed !== 'object' || Array.isArray(parsed)) {
        return 'Headers must be a JSON object.';
      }
    } catch {
      return 'Invalid JSON format for headers.';
    }
  }
  return undefined;
};

export const ValidateMCPDefaultOptions = (
  options: Metadata[],
): string | undefined =>
  validateRequiredKeys(options) ||
  validateServerUrl(options) ||
  validateProtocol(options) ||
  validateTimeout(options) ||
  validateHeaders(options);
