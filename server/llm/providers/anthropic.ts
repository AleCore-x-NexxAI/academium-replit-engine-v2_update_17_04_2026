import { BaseProvider } from "./base";
import type { ProviderKeyConfig, GenerateResult } from "./types";
import type { ChatMessage, CompletionOptions } from "../provider";

export class AnthropicProvider extends BaseProvider {
  private anthropicKeys: ProviderKeyConfig[];

  constructor(keys: ProviderKeyConfig[], maxConcurrentPerKey = 20) {
    super("Anthropic Direct", "anthropic", keys, maxConcurrentPerKey, 4);
    this.anthropicKeys = keys;
  }

  protected async doGenerate(
    messages: ChatMessage[],
    options: CompletionOptions,
    signal: AbortSignal
  ): Promise<GenerateResult> {
    const keyIdx = this.keyIndex % this.anthropicKeys.length;
    this.keyIndex++;
    const key = this.anthropicKeys[keyIdx];

    const model = options.model || "claude-sonnet-4-20250514";

    const systemMessages = messages.filter((m) => m.role === "system");
    const nonSystemMessages = messages.filter((m) => m.role !== "system");
    const systemText = systemMessages.map((m) => m.content).join("\n\n");

    let finalSystemText = systemText;
    if (options.responseFormat === "json") {
      finalSystemText += "\n\nIMPORTANT: You MUST respond with valid JSON only. No markdown, no explanation, just pure JSON.";
    }

    const anthropicMessages = nonSystemMessages.map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    }));

    if (anthropicMessages.length === 0 || anthropicMessages[0].role !== "user") {
      anthropicMessages.unshift({
        role: "user",
        content: "Proceed with the task as described in the system prompt.",
      });
    }

    const body = JSON.stringify({
      model,
      max_tokens: options.maxTokens || 4096,
      ...(finalSystemText && { system: finalSystemText }),
      messages: anthropicMessages,
      ...(options.temperature !== undefined && { temperature: options.temperature }),
    });

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": key.apiKey,
        "anthropic-version": "2023-06-01",
      },
      body,
      signal,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Anthropic ${response.status}: ${errorText.substring(0, 200)}`);
    }

    const data = (await response.json()) as any;
    const content =
      data.content
        ?.filter((c: any) => c.type === "text")
        .map((c: any) => c.text)
        .join("") || "";

    const inputTokens = data.usage?.input_tokens || 0;
    const outputTokens = data.usage?.output_tokens || 0;

    if (options.responseFormat === "json" && content) {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          JSON.parse(jsonMatch[0]);
          return {
            text: jsonMatch[0],
            inputTokens,
            outputTokens,
            totalTokens: inputTokens + outputTokens,
            model,
          };
        } catch {
          throw new Error(`Anthropic returned invalid JSON: ${content.substring(0, 100)}...`);
        }
      }
      throw new Error(`Anthropic returned no JSON object: ${content.substring(0, 100)}...`);
    }

    return {
      text: content,
      inputTokens,
      outputTokens,
      totalTokens: inputTokens + outputTokens,
      model,
    };
  }
}
