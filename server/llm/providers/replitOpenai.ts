import OpenAI from "openai";
import { BaseProvider } from "./base";
import type { ProviderKeyConfig, GenerateResult } from "./types";
import type { ChatMessage, CompletionOptions } from "../provider";

export class ReplitOpenAIProvider extends BaseProvider {
  private client: OpenAI;

  constructor() {
    const key: ProviderKeyConfig = {
      apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY || "",
      baseUrl: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
    };
    super("Replit OpenAI", "replit-openai", [key], 10, 1);

    this.client = new OpenAI({
      baseURL: key.baseUrl,
      apiKey: key.apiKey,
    });
  }

  protected async doGenerate(
    messages: ChatMessage[],
    options: CompletionOptions,
    signal: AbortSignal
  ): Promise<GenerateResult> {
    const model = options.model || "gpt-4o";

    const response = await this.client.chat.completions.create(
      {
        model,
        messages,
        max_completion_tokens: options.maxTokens || 4096,
        ...(options.temperature !== undefined && { temperature: options.temperature }),
        ...(options.responseFormat === "json" && {
          response_format: { type: "json_object" },
        }),
      },
      { signal }
    );

    return {
      text: response.choices[0]?.message?.content || "",
      inputTokens: response.usage?.prompt_tokens || 0,
      outputTokens: response.usage?.completion_tokens || 0,
      totalTokens: response.usage?.total_tokens || 0,
      model,
    };
  }
}
