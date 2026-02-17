import type { ProviderAdapter } from "./types";
import { getEquivalentModel } from "./types";
import { registry } from "./registry";
import type { ChatMessage, CompletionOptions } from "../provider";

export interface RouteResult {
  result: string;
  provider: string;
  latencyMs: number;
  failoverAttempts: number;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  model: string;
}

function selectBestProvider(providers: ProviderAdapter[]): ProviderAdapter | null {
  const now = Date.now();
  const available = providers.filter(
    (p) => p.healthy && p.activeRequests < p.maxConcurrent && p.rateLimitedUntil < now
  );

  if (available.length === 0) {
    const withoutRateLimit = providers.filter(
      (p) => p.healthy && p.activeRequests < p.maxConcurrent
    );
    if (withoutRateLimit.length > 0) {
      return withoutRateLimit[0];
    }
    return null;
  }

  available.sort((a, b) => {
    if (a.costTier !== b.costTier) {
      return a.costTier - b.costTier;
    }

    const aUtilization = a.activeRequests / a.maxConcurrent;
    const bUtilization = b.activeRequests / b.maxConcurrent;

    if (Math.abs(aUtilization - bUtilization) > 0.3) {
      return aUtilization - bUtilization;
    }

    const bSlots = b.maxConcurrent - b.activeRequests;
    const aSlots = a.maxConcurrent - a.activeRequests;
    return bSlots - aSlots;
  });

  return available[0];
}

export async function routeRequest(
  messages: ChatMessage[],
  options: CompletionOptions
): Promise<RouteResult> {
  const allProviders = registry.getProviders();

  if (allProviders.length === 0) {
    throw new Error("No LLM providers configured. Set API keys in environment variables.");
  }

  const tried = new Set<string>();
  let lastError: Error | null = null;
  let failoverAttempts = 0;

  const untried = () => allProviders.filter((p) => !tried.has(p.name));

  while (untried().length > 0) {
    const provider = selectBestProvider(untried());
    if (!provider) {
      break;
    }

    tried.add(provider.name);
    const mappedModel = getEquivalentModel(
      options.model || "gpt-4o",
      provider.type
    );
    const providerOptions: CompletionOptions = {
      ...options,
      model: mappedModel as any,
    };

    const start = Date.now();
    try {
      const genResult = await provider.generate(messages, providerOptions);
      const latency = Date.now() - start;

      console.log(
        `[LLM Router] ${provider.name} completed in ${(latency / 1000).toFixed(1)}s` +
          (failoverAttempts > 0 ? ` (after ${failoverAttempts} failover(s))` : "")
      );

      return {
        result: genResult.text,
        provider: provider.name,
        latencyMs: latency,
        failoverAttempts,
        inputTokens: genResult.inputTokens,
        outputTokens: genResult.outputTokens,
        totalTokens: genResult.totalTokens,
        model: genResult.model,
      };
    } catch (error) {
      failoverAttempts++;
      lastError = error instanceof Error ? error : new Error(String(error));
      const elapsed = Date.now() - start;

      console.warn(
        `[LLM Router] ${provider.name} failed after ${(elapsed / 1000).toFixed(1)}s: ${lastError.message.substring(0, 100)}`
      );

      if (elapsed > 90000) {
        console.warn(`[LLM Router] ${provider.name} timed out, trying next provider...`);
      }
    }
  }

  const totalCapacity = registry.getTotalCapacity();
  const activeRequests = registry.getTotalActiveRequests();

  throw new Error(
    `All ${tried.size} LLM provider(s) failed. ` +
      `Active: ${activeRequests}/${totalCapacity}. ` +
      `Last error: ${lastError?.message || "unknown"}`
  );
}

export function hasAvailableSlots(): boolean {
  return registry.getTotalAvailableSlots() > 0;
}

export function getAvailableSlotCount(): number {
  return registry.getTotalAvailableSlots();
}
