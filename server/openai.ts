import OpenAI from "openai";
import pLimit from "p-limit";
import pRetry from "p-retry";

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

export async function generateChatCompletion(
  messages: { role: "system" | "user" | "assistant"; content: string }[],
  options?: {
    temperature?: number;
    maxTokens?: number;
    responseFormat?: "json" | "text";
  }
): Promise<string> {
  return limit(() =>
    pRetry(
      async () => {
        try {
          // the newest OpenAI model is "gpt-5" which was released August 7, 2025. do not change this unless explicitly requested by the user
          const response = await openai.chat.completions.create({
            model: "gpt-4o",
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
          throw new pRetry.AbortError(error);
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
