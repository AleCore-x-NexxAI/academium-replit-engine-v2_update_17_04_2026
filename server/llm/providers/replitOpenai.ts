import OpenAI from "openai";
import { BaseProvider } from "./base";
import type { ProviderKeyConfig } from "./types";
import type { ChatMessage, CompletionOptions } from "../provider";

export class ReplitOpenAIProvider extends BaseProvider {
  private client: OpenAI;

  constructor() {
    const key: ProviderKeyConfig = {
      apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY || "",
      baseUrl: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
    };
    super("Replit OpenAI", "replit-openai", [key], 10);

    this.client = new OpenAI({
      baseURL: key.baseUrl,
      apiKey: key.apiKey,
    });
  }

  protected async doGenerate(
    messages: ChatMessage[],
    options: CompletionOptions,
    signal: AbortSignal
  ): Promise<string> {
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

    return response.choices[0]?.message?.content || "";
  }
}
