import OpenAI from "openai";
import { BaseProvider } from "./base";
import type { ProviderKeyConfig } from "./types";
import type { ChatMessage, CompletionOptions } from "../provider";

export class OpenAIDirectProvider extends BaseProvider {
  private clients: OpenAI[];

  constructor(keys: ProviderKeyConfig[], maxConcurrentPerKey = 15) {
    super("OpenAI Direct", "openai-direct", keys, maxConcurrentPerKey);
    this.clients = keys.map(
      (k) =>
        new OpenAI({
          apiKey: k.apiKey,
          organization: k.orgId,
        })
    );
  }

  protected async doGenerate(
    messages: ChatMessage[],
    options: CompletionOptions,
    signal: AbortSignal
  ): Promise<string> {
    const keyIdx = this.keyIndex % this.clients.length;
    this.keyIndex++;
    const client = this.clients[keyIdx];
    const model = options.model || "gpt-4o";

    const response = await client.chat.completions.create(
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
