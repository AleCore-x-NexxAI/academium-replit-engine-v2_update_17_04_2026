import { GoogleGenAI } from "@google/genai";
import { BaseProvider } from "./base";
import type { ProviderKeyConfig, GenerateResult } from "./types";
import type { ChatMessage, CompletionOptions } from "../provider";

export class ReplitGeminiProvider extends BaseProvider {
  private client: GoogleGenAI;

  constructor() {
    const key: ProviderKeyConfig = {
      apiKey: process.env.AI_INTEGRATIONS_GEMINI_API_KEY || "",
      baseUrl: process.env.AI_INTEGRATIONS_GEMINI_BASE_URL,
    };
    super("Replit Gemini", "replit-gemini", [key], 10, 1);

    this.client = new GoogleGenAI({
      apiKey: key.apiKey,
      httpOptions: {
        apiVersion: "",
        baseUrl: key.baseUrl,
      },
    });
  }

  private convertToGeminiMessages(
    messages: ChatMessage[]
  ): { role: "user" | "model"; parts: { text: string }[] }[] {
    const systemMessages = messages.filter((m) => m.role === "system");
    const conversationMessages = messages.filter((m) => m.role !== "system");

    const geminiMessages: { role: "user" | "model"; parts: { text: string }[] }[] = [];
    const systemContent = systemMessages.map((s) => s.content).join("\n\n");

    if (
      systemContent &&
      (conversationMessages.length === 0 || conversationMessages[0].role === "assistant")
    ) {
      geminiMessages.push({
        role: "user",
        parts: [
          {
            text:
              systemContent +
              (conversationMessages.length === 0 ? "\n\nProceed with the task." : ""),
          },
        ],
      });
    }

    let systemPrepended = geminiMessages.length > 0;

    for (const msg of conversationMessages) {
      let content = msg.content;

      if (!systemPrepended && msg.role === "user" && systemContent) {
        content = `${systemContent}\n\n${content}`;
        systemPrepended = true;
      }

      geminiMessages.push({
        role: msg.role === "assistant" ? "model" : "user",
        parts: [{ text: content }],
      });
    }

    return geminiMessages;
  }

  protected async doGenerate(
    messages: ChatMessage[],
    options: CompletionOptions,
    _signal: AbortSignal
  ): Promise<GenerateResult> {
    const model = options.model || "gemini-2.5-flash";
    const geminiMessages = this.convertToGeminiMessages(messages);

    const generationConfig: Record<string, unknown> = {};
    if (options.maxTokens) generationConfig.maxOutputTokens = options.maxTokens;
    if (options.temperature !== undefined) generationConfig.temperature = options.temperature;
    if (options.responseFormat === "json")
      generationConfig.responseMimeType = "application/json";

    const response = await this.client.models.generateContent({
      model,
      contents: geminiMessages,
      config: Object.keys(generationConfig).length > 0 ? generationConfig : undefined,
    });

    const text = response.text || "";

    if (options.responseFormat === "json" && text) {
      try {
        JSON.parse(text);
      } catch {
        throw new Error(`Replit Gemini returned invalid JSON: ${text.substring(0, 100)}...`);
      }
    }

    return {
      text,
      inputTokens: (response as any).usageMetadata?.promptTokenCount || 0,
      outputTokens: (response as any).usageMetadata?.candidatesTokenCount || 0,
      totalTokens: (response as any).usageMetadata?.totalTokenCount || 0,
      model,
    };
  }
}
