/**
 * Unified LLM Provider Abstraction Layer
 * 
 * Provides a single interface for both OpenAI and Gemini providers with:
 * - Automatic failover between providers on rate limits/errors
 * - Retry with exponential backoff
 * - Rate limiting to prevent quota exhaustion
 * - Graceful degradation (no user-visible errors during provider switching)
 * - Logging for cost analysis and debugging
 */

import OpenAI from "openai";
import { GoogleGenAI } from "@google/genai";
import pLimit from "p-limit";
import pRetry, { AbortError } from "p-retry";

// Provider types
export type ProviderType = "openai" | "gemini";

// Supported models per provider
export const OPENAI_MODELS = ["gpt-4o", "gpt-4o-mini", "gpt-3.5-turbo"] as const;
export const GEMINI_MODELS = ["gemini-2.5-flash", "gemini-2.5-pro", "gemini-3-flash-preview", "gemini-3-pro-preview"] as const;

export type OpenAIModel = typeof OPENAI_MODELS[number];
export type GeminiModel = typeof GEMINI_MODELS[number];
export type SupportedModel = OpenAIModel | GeminiModel;

// Message format for chat completions
export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

// Options for generating completions
export interface CompletionOptions {
  temperature?: number;
  maxTokens?: number;
  responseFormat?: "json" | "text";
  model?: SupportedModel;
  preferredProvider?: ProviderType;
  skipFailover?: boolean; // If true, don't failover to other provider
}

// Provider usage stats for logging/debugging
export interface ProviderStats {
  provider: ProviderType;
  model: string;
  latencyMs: number;
  success: boolean;
  error?: string;
  failedOver?: boolean;
  retryCount?: number;
}

// Initialize OpenAI client (Replit AI Integrations)
const openai = new OpenAI({
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
});

// Initialize Gemini client (Replit AI Integrations)
const gemini = new GoogleGenAI({
  apiKey: process.env.AI_INTEGRATIONS_GEMINI_API_KEY,
  httpOptions: {
    apiVersion: "",
    baseUrl: process.env.AI_INTEGRATIONS_GEMINI_BASE_URL,
  },
});

// Rate limiters per provider to prevent quota exhaustion
const openaiLimit = pLimit(8); // Max 8 concurrent OpenAI requests (supports ~20 simultaneous students)
const geminiLimit = pLimit(8); // Max 8 concurrent Gemini requests (supports ~20 simultaneous students)

// Track stats for logging
const providerStats: ProviderStats[] = [];

/**
 * Detect if an error is a rate limit or quota error that should trigger failover
 */
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

/**
 * Detect if error is transient and should be retried
 */
function isTransientError(error: unknown): boolean {
  const errorMsg = error instanceof Error ? error.message : String(error);
  return (
    isRateLimitError(error) ||
    errorMsg.includes("500") ||
    errorMsg.includes("502") ||
    errorMsg.includes("503") ||
    errorMsg.includes("504") ||
    errorMsg.toLowerCase().includes("timeout") ||
    errorMsg.toLowerCase().includes("network")
  );
}

/**
 * Map OpenAI model to equivalent Gemini model for failover
 */
function mapOpenAIToGemini(model: OpenAIModel): GeminiModel {
  switch (model) {
    case "gpt-4o":
      return "gemini-2.5-pro";
    case "gpt-4o-mini":
      return "gemini-2.5-flash";
    case "gpt-3.5-turbo":
      return "gemini-2.5-flash";
    default:
      return "gemini-2.5-flash";
  }
}

/**
 * Map Gemini model to equivalent OpenAI model for failover
 */
function mapGeminiToOpenAI(model: GeminiModel): OpenAIModel {
  switch (model) {
    case "gemini-2.5-pro":
    case "gemini-3-pro-preview":
      return "gpt-4o";
    case "gemini-2.5-flash":
    case "gemini-3-flash-preview":
      return "gpt-4o-mini";
    default:
      return "gpt-4o-mini";
  }
}

/**
 * Generate completion using OpenAI
 */
async function generateOpenAI(
  messages: ChatMessage[],
  options: CompletionOptions
): Promise<string> {
  const model = (options.model as OpenAIModel) || "gpt-4o";
  
  const response = await openai.chat.completions.create({
    model,
    messages,
    max_completion_tokens: options.maxTokens || 4096,
    ...(options.temperature !== undefined && { temperature: options.temperature }),
    ...(options.responseFormat === "json" && {
      response_format: { type: "json_object" },
    }),
  });
  
  return response.choices[0]?.message?.content || "";
}

/**
 * Convert ChatMessage format to Gemini format
 * Handles system messages by prepending to first user message or creating synthetic user message
 */
function convertToGeminiMessages(messages: ChatMessage[]): { role: "user" | "model"; parts: { text: string }[] }[] {
  const systemMessages = messages.filter(m => m.role === "system");
  const conversationMessages = messages.filter(m => m.role !== "system");
  
  const geminiMessages: { role: "user" | "model"; parts: { text: string }[] }[] = [];
  const systemContent = systemMessages.map(s => s.content).join("\n\n");
  
  // If we have system messages and no conversation, or first message is assistant, inject synthetic user message
  if (systemContent && (conversationMessages.length === 0 || conversationMessages[0].role === "assistant")) {
    geminiMessages.push({
      role: "user",
      parts: [{ text: systemContent + (conversationMessages.length === 0 ? "\n\nProceed with the task." : "") }]
    });
  }
  
  let systemPrepended = geminiMessages.length > 0;
  
  for (let i = 0; i < conversationMessages.length; i++) {
    const msg = conversationMessages[i];
    let content = msg.content;
    
    // Prepend system prompt to first user message if not already done
    if (!systemPrepended && msg.role === "user" && systemContent) {
      content = `${systemContent}\n\n${content}`;
      systemPrepended = true;
    }
    
    geminiMessages.push({
      role: msg.role === "assistant" ? "model" : "user",
      parts: [{ text: content }]
    });
  }
  
  return geminiMessages;
}

/**
 * Generate completion using Gemini
 */
async function generateGemini(
  messages: ChatMessage[],
  options: CompletionOptions
): Promise<string> {
  const model = (options.model as GeminiModel) || "gemini-2.5-flash";
  const geminiMessages = convertToGeminiMessages(messages);
  
  // Build generation config
  const generationConfig: Record<string, unknown> = {};
  if (options.maxTokens) {
    generationConfig.maxOutputTokens = options.maxTokens;
  }
  if (options.temperature !== undefined) {
    generationConfig.temperature = options.temperature;
  }
  if (options.responseFormat === "json") {
    generationConfig.responseMimeType = "application/json";
  }
  
  const response = await gemini.models.generateContent({
    model,
    contents: geminiMessages,
    config: Object.keys(generationConfig).length > 0 ? generationConfig : undefined,
  });
  
  const result = response.text || "";
  
  // Validate JSON output if JSON format was requested
  if (options.responseFormat === "json" && result) {
    try {
      JSON.parse(result); // Validate it's valid JSON
    } catch (e) {
      throw new Error(`Gemini returned invalid JSON: ${result.substring(0, 100)}...`);
    }
  }
  
  return result;
}

/**
 * Log provider stats for debugging and cost analysis
 */
function logStats(stats: ProviderStats): void {
  providerStats.push(stats);
  
  // Keep only last 1000 entries to prevent memory growth
  if (providerStats.length > 1000) {
    providerStats.splice(0, 100);
  }
  
  // Log for debugging
  const emoji = stats.success ? "✓" : "✗";
  const failoverNote = stats.failedOver ? " (failover)" : "";
  console.log(
    `[LLM] ${emoji} ${stats.provider}/${stats.model}${failoverNote} - ${stats.latencyMs}ms` +
    (stats.error ? ` - Error: ${stats.error}` : "") +
    (stats.retryCount ? ` (${stats.retryCount} retries)` : "")
  );
}

/**
 * Get recent provider stats for debugging
 */
export function getProviderStats(limit = 50): ProviderStats[] {
  return providerStats.slice(-limit);
}

/**
 * Main unified completion function with automatic failover
 * 
 * @param messages - Array of chat messages
 * @param options - Configuration options
 * @returns Promise<string> - The generated text
 */
export async function generateChatCompletion(
  messages: ChatMessage[],
  options: CompletionOptions = {}
): Promise<string> {
  const primaryProvider = options.preferredProvider || "openai";
  const secondaryProvider = primaryProvider === "openai" ? "gemini" : "openai";
  
  let primaryModel = options.model;
  let secondaryModel: SupportedModel;
  
  // Determine models for both providers
  if (primaryProvider === "openai") {
    primaryModel = primaryModel || "gpt-4o";
    secondaryModel = mapOpenAIToGemini(primaryModel as OpenAIModel);
  } else {
    primaryModel = primaryModel || "gemini-2.5-flash";
    secondaryModel = mapGeminiToOpenAI(primaryModel as GeminiModel);
  }
  
  // Each provider has its own rate limiter - decoupled so secondary can run even if primary is saturated
  const primaryLimiter = primaryProvider === "openai" ? openaiLimit : geminiLimit;
  const secondaryLimiter = secondaryProvider === "openai" ? openaiLimit : geminiLimit;
  
  let retryCount = 0;
  
  // Try primary provider with retries (rate limited independently)
  const tryPrimary = async (): Promise<string> => {
    const startTime = Date.now();
    try {
      const result = await primaryLimiter(() =>
        pRetry(
          async () => {
            try {
              if (primaryProvider === "openai") {
                return await generateOpenAI(messages, { ...options, model: primaryModel });
              } else {
                return await generateGemini(messages, { ...options, model: primaryModel });
              }
            } catch (error) {
              if (isTransientError(error)) {
                retryCount++;
                throw error; // Will retry
              }
              throw new AbortError(error instanceof Error ? error.message : String(error));
            }
          },
          {
            retries: 3,
            minTimeout: 2000,
            maxTimeout: 16000,
            factor: 2,
          }
        )
      );
      
      logStats({
        provider: primaryProvider,
        model: primaryModel!,
        latencyMs: Date.now() - startTime,
        success: true,
        retryCount: retryCount > 0 ? retryCount : undefined,
      });
      
      return result;
    } catch (error) {
      logStats({
        provider: primaryProvider,
        model: primaryModel!,
        latencyMs: Date.now() - startTime,
        success: false,
        error: error instanceof Error ? error.message : String(error),
        retryCount: retryCount > 0 ? retryCount : undefined,
      });
      throw error;
    }
  };
  
  // Try secondary provider (failover) - rate limited independently
  const trySecondary = async (): Promise<string> => {
    retryCount = 0;
    const startTime = Date.now();
    
    try {
      const result = await secondaryLimiter(() =>
        pRetry(
          async () => {
            try {
              if (secondaryProvider === "openai") {
                return await generateOpenAI(messages, { ...options, model: secondaryModel });
              } else {
                return await generateGemini(messages, { ...options, model: secondaryModel });
              }
            } catch (error) {
              if (isTransientError(error)) {
                retryCount++;
                throw error;
              }
              throw new AbortError(error instanceof Error ? error.message : String(error));
            }
          },
          {
            retries: 3,
            minTimeout: 2000,
            maxTimeout: 16000,
            factor: 2,
          }
        )
      );
      
      logStats({
        provider: secondaryProvider,
        model: secondaryModel,
        latencyMs: Date.now() - startTime,
        success: true,
        failedOver: true,
        retryCount: retryCount > 0 ? retryCount : undefined,
      });
      
      return result;
    } catch (error) {
      logStats({
        provider: secondaryProvider,
        model: secondaryModel,
        latencyMs: Date.now() - startTime,
        success: false,
        failedOver: true,
        error: error instanceof Error ? error.message : String(error),
        retryCount: retryCount > 0 ? retryCount : undefined,
      });
      throw error;
    }
  };
  
  // Execute - failover happens immediately without waiting for primary rate limiter queue
  try {
    return await tryPrimary();
  } catch (primaryError) {
    // If failover is disabled, throw immediately
    if (options.skipFailover) {
      throw primaryError;
    }
    
    // Log that we're failing over
    console.log(
      `[LLM] Primary provider ${primaryProvider} failed, failing over to ${secondaryProvider}...`
    );
    
    try {
      return await trySecondary();
    } catch (secondaryError) {
      // Both providers failed - throw a combined error
      const primaryMsg = primaryError instanceof Error ? primaryError.message : String(primaryError);
      const secondaryMsg = secondaryError instanceof Error ? secondaryError.message : String(secondaryError);
      throw new Error(
        `All LLM providers failed. Primary (${primaryProvider}): ${primaryMsg}. Secondary (${secondaryProvider}): ${secondaryMsg}`
      );
    }
  }
}

// Export clients for direct access if needed
export { openai, gemini };
