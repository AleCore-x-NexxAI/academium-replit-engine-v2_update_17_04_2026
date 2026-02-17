import type { ProviderAdapter, ProviderSlotInfo, ProviderKeyConfig } from "./types";
import { ReplitOpenAIProvider } from "./replitOpenai";
import { ReplitGeminiProvider } from "./replitGemini";
import { OpenAIDirectProvider } from "./openaiDirect";
import { OpenRouterProvider } from "./openrouter";
import { AnthropicProvider } from "./anthropic";
import { GeminiDirectProvider } from "./geminiDirect";

function parseKeys(envVar: string | undefined): ProviderKeyConfig[] {
  if (!envVar) return [];
  return envVar
    .split(",")
    .map((k) => k.trim())
    .filter(Boolean)
    .map((apiKey) => ({ apiKey }));
}

class ProviderRegistry {
  private providers: ProviderAdapter[] = [];
  private initialized = false;

  initialize(): void {
    if (this.initialized) return;
    this.initialized = true;

    if (process.env.AI_INTEGRATIONS_OPENAI_API_KEY && process.env.AI_INTEGRATIONS_OPENAI_BASE_URL) {
      try {
        this.providers.push(new ReplitOpenAIProvider());
        console.log("[LLM Registry] Replit OpenAI proxy enabled (10 concurrent)");
      } catch (e) {
        console.warn("[LLM Registry] Failed to init Replit OpenAI:", e);
      }
    }

    if (process.env.AI_INTEGRATIONS_GEMINI_API_KEY && process.env.AI_INTEGRATIONS_GEMINI_BASE_URL) {
      try {
        this.providers.push(new ReplitGeminiProvider());
        console.log("[LLM Registry] Replit Gemini proxy enabled (10 concurrent)");
      } catch (e) {
        console.warn("[LLM Registry] Failed to init Replit Gemini:", e);
      }
    }

    const openRouterKeys = parseKeys(process.env.OPENROUTER_API_KEYS);
    if (process.env.OPENROUTER2_API_KEY) {
      openRouterKeys.push({ apiKey: process.env.OPENROUTER2_API_KEY.trim() });
    }
    if (openRouterKeys.length > 0) {
      try {
        this.providers.push(new OpenRouterProvider(openRouterKeys, 30));
        console.log(
          `[LLM Registry] OpenRouter enabled (${openRouterKeys.length} key(s), ${openRouterKeys.length * 30} concurrent)`
        );
      } catch (e) {
        console.warn("[LLM Registry] Failed to init OpenRouter:", e);
      }
    }

    const anthropicKeys = parseKeys(process.env.ANTHROPIC_API_KEYS);
    if (anthropicKeys.length > 0) {
      try {
        this.providers.push(new AnthropicProvider(anthropicKeys, 20));
        console.log(
          `[LLM Registry] Anthropic enabled (${anthropicKeys.length} key(s), ${anthropicKeys.length * 20} concurrent)`
        );
      } catch (e) {
        console.warn("[LLM Registry] Failed to init Anthropic:", e);
      }
    }

    const openaiKeys = parseKeys(process.env.OPENAI_DIRECT_API_KEYS);
    if (openaiKeys.length > 0) {
      try {
        this.providers.push(new OpenAIDirectProvider(openaiKeys, 15));
        console.log(
          `[LLM Registry] OpenAI Direct enabled (${openaiKeys.length} key(s), ${openaiKeys.length * 15} concurrent)`
        );
      } catch (e) {
        console.warn("[LLM Registry] Failed to init OpenAI Direct:", e);
      }
    }

    const geminiKeys = parseKeys(process.env.GEMINI_DIRECT_API_KEYS);
    if (geminiKeys.length > 0) {
      try {
        this.providers.push(new GeminiDirectProvider(geminiKeys, 25));
        console.log(
          `[LLM Registry] Gemini Direct enabled (${geminiKeys.length} key(s), ${geminiKeys.length * 25} concurrent)`
        );
      } catch (e) {
        console.warn("[LLM Registry] Failed to init Gemini Direct:", e);
      }
    }

    const totalSlots = this.providers.reduce((sum, p) => sum + p.maxConcurrent, 0);
    console.log(
      `[LLM Registry] ${this.providers.length} provider(s) active, ${totalSlots} total concurrent slots`
    );

    if (this.providers.length === 0) {
      console.error("[LLM Registry] WARNING: No LLM providers configured! AI features will not work.");
    }
  }

  getProviders(): ProviderAdapter[] {
    if (!this.initialized) this.initialize();
    return this.providers;
  }

  getHealthyProviders(): ProviderAdapter[] {
    return this.getProviders().filter((p) => p.healthy);
  }

  getTotalCapacity(): number {
    return this.getProviders().reduce((sum, p) => sum + p.maxConcurrent, 0);
  }

  getTotalAvailableSlots(): number {
    return this.getHealthyProviders().reduce(
      (sum, p) => sum + Math.max(0, p.maxConcurrent - p.activeRequests),
      0
    );
  }

  getTotalActiveRequests(): number {
    return this.getProviders().reduce((sum, p) => sum + p.activeRequests, 0);
  }

  getStatus(): ProviderSlotInfo[] {
    const now = Date.now();
    return this.getProviders().map((p) => ({
      name: p.name,
      type: p.type,
      activeRequests: p.activeRequests,
      maxConcurrent: p.maxConcurrent,
      availableSlots: Math.max(0, p.maxConcurrent - p.activeRequests),
      healthy: p.healthy,
      rateLimited: p.rateLimitedUntil > now,
      rateLimitedSecondsLeft: p.rateLimitedUntil > now ? Math.ceil((p.rateLimitedUntil - now) / 1000) : 0,
      avgLatencyMs: Math.round(p.avgLatencyMs),
      totalRequests: p.totalRequests,
      totalErrors: p.totalErrors,
      errorRate:
        p.totalRequests > 0
          ? `${((p.totalErrors / p.totalRequests) * 100).toFixed(1)}%`
          : "0%",
    }));
  }

  async warmUpAll(): Promise<void> {
    const providers = this.getProviders();
    if (providers.length === 0) return;

    console.log(`[LLM Registry] Warming up ${providers.length} provider(s)...`);
    const results = await Promise.allSettled(providers.map((p) => p.warmUp()));
    const succeeded = results.filter((r) => r.status === "fulfilled").length;
    console.log(
      `[LLM Registry] Warm-up complete: ${succeeded}/${providers.length} providers ready`
    );
  }
}

export const registry = new ProviderRegistry();
