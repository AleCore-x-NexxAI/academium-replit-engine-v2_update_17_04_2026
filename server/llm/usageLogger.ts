import { db } from "../db";
import { llmUsageLogs } from "@shared/schema";

const MODEL_NORMALIZE: Record<string, string> = {
  "gpt-4o-mini": "gpt-4o-mini",
  "openai/gpt-4o-mini": "gpt-4o-mini",
  "gpt-4o": "gpt-4o",
  "openai/gpt-4o": "gpt-4o",
  "gemini-2.5-flash": "gemini-2.5-flash",
  "google/gemini-2.5-flash-preview": "gemini-2.5-flash",
  "gemini-2.5-pro": "gemini-2.5-pro",
  "google/gemini-2.5-pro-preview": "gemini-2.5-pro",
  "claude-sonnet-4-20250514": "claude-sonnet-4",
};

const PROVIDER_PRICING: Record<string, Record<string, { input: number; output: number }>> = {
  "Replit OpenAI": { "gpt-4o": { input: 0, output: 0 }, "gpt-4o-mini": { input: 0, output: 0 } },
  "Replit Gemini": { "gemini-2.5-flash": { input: 0, output: 0 }, "gemini-2.5-pro": { input: 0, output: 0 } },
  "Gemini Direct": { "gemini-2.5-flash": { input: 0.15, output: 0.60 }, "gemini-2.5-pro": { input: 1.25, output: 10.00 } },
  "OpenRouter": { "gpt-4o-mini": { input: 0.15, output: 0.60 }, "gpt-4o": { input: 2.50, output: 10.00 }, "gemini-2.5-flash": { input: 0.15, output: 0.60 }, "gemini-2.5-pro": { input: 1.25, output: 10.00 } },
  "OpenAI Direct": { "gpt-4o": { input: 2.50, output: 10.00 }, "gpt-4o-mini": { input: 0.15, output: 0.60 } },
  "Anthropic Direct": { "claude-sonnet-4": { input: 3.00, output: 15.00 } },
};

function calculateCost(provider: string, model: string, inputTokens: number, outputTokens: number): number {
  const normalizedModel = MODEL_NORMALIZE[model] || model;
  const providerPrices = PROVIDER_PRICING[provider];
  const pricing = providerPrices?.[normalizedModel];
  if (!pricing) {
    if (provider.startsWith("Replit")) return 0;
    return (inputTokens * 0.5 + outputTokens * 1.5) / 1_000_000;
  }
  return (inputTokens * pricing.input + outputTokens * pricing.output) / 1_000_000;
}

export async function logUsage(params: {
  provider: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  durationMs: number;
  success: boolean;
  errorMessage?: string;
  agentName?: string;
  sessionId?: number;
  userId?: string;
}): Promise<void> {
  const cost = calculateCost(params.provider, params.model, params.inputTokens, params.outputTokens);

  try {
    await db.insert(llmUsageLogs).values({
      provider: params.provider,
      model: params.model,
      inputTokens: params.inputTokens,
      outputTokens: params.outputTokens,
      totalTokens: params.totalTokens,
      costUsd: cost.toFixed(8),
      agentName: params.agentName || null,
      sessionId: params.sessionId || null,
      userId: params.userId || null,
      durationMs: params.durationMs,
      success: params.success,
      errorMessage: params.errorMessage || null,
    });
  } catch (e) {
    console.warn("[Usage Logger] Failed to log usage:", e);
  }
}
