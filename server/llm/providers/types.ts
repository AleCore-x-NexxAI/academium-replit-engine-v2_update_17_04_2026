import type { ChatMessage, CompletionOptions } from "../provider";

export interface ProviderAdapter {
  readonly name: string;
  readonly type: ProviderType;
  readonly maxConcurrent: number;

  activeRequests: number;
  totalRequests: number;
  totalErrors: number;
  avgLatencyMs: number;
  healthy: boolean;

  generate(messages: ChatMessage[], options: CompletionOptions): Promise<string>;
  checkHealth(): Promise<boolean>;
  warmUp(): Promise<void>;
}

export type ProviderType =
  | "replit-openai"
  | "replit-gemini"
  | "openrouter"
  | "anthropic"
  | "openai-direct"
  | "gemini-direct";

export interface ProviderKeyConfig {
  apiKey: string;
  baseUrl?: string;
  orgId?: string;
}

export interface ProviderConfig {
  type: ProviderType;
  name: string;
  keys: ProviderKeyConfig[];
  maxConcurrentPerKey: number;
  models: string[];
  defaultModel: string;
  supportsJsonMode: boolean;
  timeoutMs: number;
}

export interface ProviderSlotInfo {
  name: string;
  type: ProviderType;
  activeRequests: number;
  maxConcurrent: number;
  availableSlots: number;
  healthy: boolean;
  avgLatencyMs: number;
  totalRequests: number;
  totalErrors: number;
  errorRate: string;
}

export interface QueuedJob {
  id: string;
  status: "queued" | "processing" | "completed" | "failed";
  position: number;
  estimatedWaitMs: number;
  result?: string;
  error?: string;
  createdAt: number;
  completedAt?: number;
}

export const MODEL_EQUIVALENTS: Record<string, Record<string, string>> = {
  "gpt-4o": {
    "anthropic": "claude-sonnet-4-20250514",
    "openrouter": "openai/gpt-4o",
    "openai-direct": "gpt-4o",
    "replit-openai": "gpt-4o",
    "gemini-direct": "gemini-2.5-flash",
    "replit-gemini": "gemini-2.5-flash",
  },
  "gpt-4o-mini": {
    "anthropic": "claude-sonnet-4-20250514",
    "openrouter": "openai/gpt-4o-mini",
    "openai-direct": "gpt-4o-mini",
    "replit-openai": "gpt-4o-mini",
    "gemini-direct": "gemini-2.5-flash",
    "replit-gemini": "gemini-2.5-flash",
  },
  "gemini-2.5-flash": {
    "anthropic": "claude-sonnet-4-20250514",
    "openrouter": "google/gemini-2.5-flash-preview",
    "openai-direct": "gpt-4o",
    "replit-openai": "gpt-4o",
    "gemini-direct": "gemini-2.5-flash",
    "replit-gemini": "gemini-2.5-flash",
  },
  "gemini-2.5-pro": {
    "anthropic": "claude-sonnet-4-20250514",
    "openrouter": "google/gemini-2.5-pro-preview",
    "openai-direct": "gpt-4o",
    "replit-openai": "gpt-4o",
    "gemini-direct": "gemini-2.5-pro",
    "replit-gemini": "gemini-2.5-pro",
  },
};

export function getEquivalentModel(requestedModel: string, targetProvider: ProviderType): string {
  const equivalents = MODEL_EQUIVALENTS[requestedModel];
  if (equivalents && equivalents[targetProvider]) {
    return equivalents[targetProvider];
  }
  if (targetProvider === "anthropic") return "claude-sonnet-4-20250514";
  if (targetProvider === "openrouter") return "openai/gpt-4o";
  if (targetProvider === "openai-direct" || targetProvider === "replit-openai") return "gpt-4o";
  if (targetProvider === "gemini-direct" || targetProvider === "replit-gemini") return "gemini-2.5-flash";
  return requestedModel;
}
