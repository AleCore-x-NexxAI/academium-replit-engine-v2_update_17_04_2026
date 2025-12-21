import OpenAI from "openai";
import pLimit from "p-limit";
import pRetry, { AbortError } from "p-retry";

// Using Replit's AI Integrations service for OpenAI access
// Does not require your own API key - charges are billed to your credits
const openai = new OpenAI({
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
});

function isRateLimitError(error: any): boolean {
  const errorMsg = error?.message || String(error);
  return (
    errorMsg.includes("429") ||
    errorMsg.includes("RATELIMIT_EXCEEDED") ||
    errorMsg.toLowerCase().includes("quota") ||
    errorMsg.toLowerCase().includes("rate limit")
  );
}

const limit = pLimit(2);

// Supported models for per-scenario configuration
export const SUPPORTED_MODELS = ["gpt-4o", "gpt-4o-mini", "gpt-3.5-turbo"] as const;
export type SupportedModel = typeof SUPPORTED_MODELS[number];

export async function generateChatCompletion(
  messages: { role: "system" | "user" | "assistant"; content: string }[],
  options?: {
    temperature?: number;
    maxTokens?: number;
    responseFormat?: "json" | "text";
    model?: SupportedModel; // Allow per-scenario model selection
  }
): Promise<string> {
  const model = options?.model || "gpt-4o"; // Default to gpt-4o
  
  return limit(() =>
    pRetry(
      async () => {
        try {
          const response = await openai.chat.completions.create({
            model,
            messages,
            max_completion_tokens: options?.maxTokens || 4096,
            ...(options?.responseFormat === "json" && {
              response_format: { type: "json_object" },
            }),
          });
          return response.choices[0]?.message?.content || "";
        } catch (error: any) {
          if (isRateLimitError(error)) {
            throw error;
          }
          throw new AbortError(error.message || "API call failed");
        }
      },
      {
        retries: 5,
        minTimeout: 2000,
        maxTimeout: 32000,
        factor: 2,
      }
    )
  );
}

export { openai };
