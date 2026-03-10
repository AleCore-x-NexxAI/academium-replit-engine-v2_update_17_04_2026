import OpenAI from "openai";
import { BaseProvider } from "./base";
import type { ProviderKeyConfig, GenerateResult } from "./types";
import type { ChatMessage, CompletionOptions } from "../provider";
import { getEquivalentModel } from "./types";

export class OpenRouterProvider extends BaseProvider {
  private clients: OpenAI[];

  constructor(keys: ProviderKeyConfig[], maxConcurrentPerKey = 30) {
    super("OpenRouter", "openrouter", keys, maxConcurrentPerKey, 3);
    this.clients = keys.map(
      (k) =>
        new OpenAI({
          apiKey: k.apiKey,
          baseURL: "https://openrouter.ai/api/v1",
          defaultHeaders: {
            "HTTP-Referer": "https://scenarioplus.replit.app",
            "X-Title": "Academium",
          },
        })
    );
  }

  protected async doGenerate(
    messages: ChatMessage[],
    options: CompletionOptions,
    signal: AbortSignal
  ): Promise<GenerateResult> {
    const keyIdx = this.keyIndex % this.clients.length;
    this.keyIndex++;
    const client = this.clients[keyIdx];

    const model = getEquivalentModel(options.model || "gpt-4o", "openrouter");

    const response = await client.chat.completions.create(
      {
        model,
        messages,
        max_tokens: options.maxTokens || 4096,
        ...(options.temperature !== undefined && { temperature: options.temperature }),
        ...(options.responseFormat === "json" && {
          response_format: { type: "json_object" },
        }),
      },
      { signal }
    );

    const content = response.choices[0]?.message?.content || "";

    if (options.responseFormat === "json" && content) {
      try {
        JSON.parse(content);
      } catch {
        throw new Error(`OpenRouter returned invalid JSON: ${content.substring(0, 100)}...`);
      }
    }

    return {
      text: content,
      inputTokens: response.usage?.prompt_tokens || 0,
      outputTokens: response.usage?.completion_tokens || 0,
      totalTokens: response.usage?.total_tokens || 0,
      model,
    };
  }
}
