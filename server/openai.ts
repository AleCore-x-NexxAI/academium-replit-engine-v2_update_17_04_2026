/**
 * OpenAI Module - Now uses unified LLM provider with automatic failover
 * 
 * This module re-exports the unified provider for backward compatibility.
 * The new provider supports both OpenAI and Gemini with automatic failover.
 */

import {
  generateChatCompletion as unifiedGenerate,
  openai,
  OPENAI_MODELS,
  type OpenAIModel,
  type ChatMessage,
} from "./llm";

// Re-export for backward compatibility
export const SUPPORTED_MODELS = OPENAI_MODELS;
export type SupportedModel = OpenAIModel;

/**
 * Generate chat completion with automatic failover to Gemini
 * 
 * @param messages - Array of chat messages
 * @param options - Configuration options
 * @returns Promise<string> - The generated text
 */
export async function generateChatCompletion(
  messages: ChatMessage[],
  options?: {
    temperature?: number;
    maxTokens?: number;
    responseFormat?: "json" | "text";
    model?: SupportedModel;
    agentName?: string;
    sessionId?: number;
    userId?: string;
  }
): Promise<string> {
  return unifiedGenerate(messages, {
    temperature: options?.temperature,
    maxTokens: options?.maxTokens,
    responseFormat: options?.responseFormat,
    model: options?.model,
    preferredProvider: "openai",
    agentName: options?.agentName,
    sessionId: options?.sessionId,
    userId: options?.userId,
  });
}

export { openai };
