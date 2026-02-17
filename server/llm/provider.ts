/**
 * Unified LLM Provider Abstraction Layer
 * 
 * Multi-provider load balancer supporting:
 * - Replit OpenAI/Gemini proxies (built-in)
 * - OpenRouter (API aggregator, 200+ models)
 * - Anthropic Direct (Claude)
 * - OpenAI Direct
 * - Gemini Direct
 * 
 * Features:
 * - Automatic failover across all providers
 * - Least-loaded routing with latency awareness
 * - Per-provider rate limiting with multi-key support
 * - 90s per-request timeout with abort
 * - In-memory job queue for overflow (returns 202 + polling)
 * - Connection keep-alive
 * - Warm-up on startup
 */

import { registry, routeRequest, hasAvailableSlots, jobQueue } from "./providers";
import type { ProviderSlotInfo, QueuedJob } from "./providers";

export type ProviderType = "openai" | "gemini";

export const OPENAI_MODELS = ["gpt-4o", "gpt-4o-mini", "gpt-3.5-turbo"] as const;
export const GEMINI_MODELS = ["gemini-2.5-flash", "gemini-2.5-pro", "gemini-3-flash-preview", "gemini-3-pro-preview"] as const;

export type OpenAIModel = typeof OPENAI_MODELS[number];
export type GeminiModel = typeof GEMINI_MODELS[number];
export type SupportedModel = OpenAIModel | GeminiModel;

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface CompletionOptions {
  temperature?: number;
  maxTokens?: number;
  responseFormat?: "json" | "text";
  model?: SupportedModel;
  preferredProvider?: ProviderType;
  skipFailover?: boolean;
}

export interface ProviderStats {
  provider: ProviderType;
  model: string;
  latencyMs: number;
  success: boolean;
  error?: string;
  failedOver?: boolean;
  retryCount?: number;
}

const recentStats: ProviderStats[] = [];

function trackStats(providerName: string, model: string, latencyMs: number, success: boolean, error?: string): void {
  recentStats.push({
    provider: providerName.includes("Gemini") ? "gemini" : "openai",
    model,
    latencyMs,
    success,
    error,
  });

  if (recentStats.length > 1000) {
    recentStats.splice(0, 100);
  }
}

export function isRateLimitError(error: unknown): boolean {
  const errorMsg = error instanceof Error ? error.message : String(error);
  return (
    errorMsg.includes("429") ||
    errorMsg.includes("RATELIMIT_EXCEEDED") ||
    errorMsg.toLowerCase().includes("quota") ||
    errorMsg.toLowerCase().includes("rate limit") ||
    errorMsg.toLowerCase().includes("too many requests") ||
    errorMsg.toLowerCase().includes("resource exhausted")
  );
}

export function getProviderStats(limit = 50): ProviderStats[] {
  return recentStats.slice(-limit);
}

/**
 * Main unified completion function with multi-provider routing
 */
export async function generateChatCompletion(
  messages: ChatMessage[],
  options: CompletionOptions = {}
): Promise<string> {
  registry.initialize();

  try {
    const result = await routeRequest(messages, options);
    trackStats(result.provider, options.model || "gpt-4o", result.latencyMs, true);
    return result.result;
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    trackStats("unknown", options.model || "gpt-4o", 0, false, errMsg);
    throw error;
  }
}

/**
 * Enqueue a request when all providers are saturated.
 * Returns a QueuedJob with id, position, and estimated wait time.
 * The caller should poll getJobStatus() for results.
 */
export function enqueueRequest(
  messages: ChatMessage[],
  options: CompletionOptions = {}
): QueuedJob {
  registry.initialize();
  return jobQueue.enqueue(messages, options);
}

/**
 * Get the status of a queued job
 */
export function getJobStatus(jobId: string): QueuedJob | null {
  return jobQueue.getJobStatus(jobId);
}

/**
 * Check if there are available slots for immediate processing
 */
export { hasAvailableSlots };

/**
 * Get detailed capacity information for all providers
 */
export function getCapacityStatus(): {
  providers: ProviderSlotInfo[];
  queue: { queueLength: number; processing: number; avgWaitMs: number };
  totalCapacity: number;
  totalActive: number;
  totalAvailable: number;
} {
  registry.initialize();
  return {
    providers: registry.getStatus(),
    queue: jobQueue.getQueueStatus(),
    totalCapacity: registry.getTotalCapacity(),
    totalActive: registry.getTotalActiveRequests(),
    totalAvailable: registry.getTotalAvailableSlots(),
  };
}

/**
 * Warm up all configured providers
 */
export async function warmUpProviders(): Promise<void> {
  registry.initialize();
  await registry.warmUpAll();
}

/**
 * Initialize and get the OpenAI client (for backward compatibility)
 */
import OpenAI from "openai";

export const openai = new OpenAI({
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
});

import { GoogleGenAI } from "@google/genai";

export const gemini = new GoogleGenAI({
  apiKey: process.env.AI_INTEGRATIONS_GEMINI_API_KEY || "",
  httpOptions: {
    apiVersion: "",
    baseUrl: process.env.AI_INTEGRATIONS_GEMINI_BASE_URL,
  },
});
