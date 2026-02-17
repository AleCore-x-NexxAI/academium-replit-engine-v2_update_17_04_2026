import pLimit from "p-limit";
import type { ChatMessage, CompletionOptions } from "../provider";
import type { ProviderAdapter, ProviderType, ProviderKeyConfig } from "./types";

const EMA_ALPHA = 0.3;
const RATE_LIMIT_COOLDOWN_MS = 30000;

function isRateLimitError(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : String(error);
  return (
    msg.includes("429") ||
    msg.includes("RATELIMIT_EXCEEDED") ||
    msg.toLowerCase().includes("quota") ||
    msg.toLowerCase().includes("rate limit") ||
    msg.toLowerCase().includes("too many requests") ||
    msg.toLowerCase().includes("resource exhausted")
  );
}

export abstract class BaseProvider implements ProviderAdapter {
  readonly name: string;
  readonly type: ProviderType;
  readonly maxConcurrent: number;

  activeRequests = 0;
  totalRequests = 0;
  totalErrors = 0;
  avgLatencyMs = 0;
  healthy = true;
  rateLimitedUntil = 0;

  protected limiter: ReturnType<typeof pLimit>;
  protected keys: ProviderKeyConfig[];
  protected keyIndex = 0;
  protected timeoutMs: number;

  constructor(
    name: string,
    type: ProviderType,
    keys: ProviderKeyConfig[],
    maxConcurrentPerKey: number,
    timeoutMs = 90000
  ) {
    this.name = name;
    this.type = type;
    this.keys = keys;
    this.maxConcurrent = maxConcurrentPerKey * keys.length;
    this.limiter = pLimit(this.maxConcurrent);
    this.timeoutMs = timeoutMs;
  }

  protected getNextKey(): ProviderKeyConfig {
    const key = this.keys[this.keyIndex % this.keys.length];
    this.keyIndex++;
    return key;
  }

  protected updateLatency(latencyMs: number): void {
    if (this.avgLatencyMs === 0) {
      this.avgLatencyMs = latencyMs;
    } else {
      this.avgLatencyMs = EMA_ALPHA * latencyMs + (1 - EMA_ALPHA) * this.avgLatencyMs;
    }
  }

  async generate(messages: ChatMessage[], options: CompletionOptions): Promise<string> {
    return this.limiter(async () => {
      this.activeRequests++;
      this.totalRequests++;
      const start = Date.now();

      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

        try {
          const result = await this.doGenerate(messages, options, controller.signal);
          const latency = Date.now() - start;
          this.updateLatency(latency);
          this.healthy = true;
          return result;
        } finally {
          clearTimeout(timeout);
        }
      } catch (error) {
        this.totalErrors++;
        const elapsed = Date.now() - start;
        this.updateLatency(elapsed);

        if (isRateLimitError(error)) {
          this.rateLimitedUntil = Date.now() + RATE_LIMIT_COOLDOWN_MS;
          console.warn(
            `[LLM] ${this.name} rate-limited, skipping for ${RATE_LIMIT_COOLDOWN_MS / 1000}s`
          );
        }

        if (this.totalRequests > 5 && this.totalErrors / this.totalRequests > 0.5) {
          this.healthy = false;
        }
        throw error;
      } finally {
        this.activeRequests--;
      }
    });
  }

  protected abstract doGenerate(
    messages: ChatMessage[],
    options: CompletionOptions,
    signal: AbortSignal
  ): Promise<string>;

  async checkHealth(): Promise<boolean> {
    try {
      await this.doGenerate(
        [{ role: "user", content: "Say 'ok'" }],
        { maxTokens: 5, temperature: 0 },
        AbortSignal.timeout(15000)
      );
      this.healthy = true;
      return true;
    } catch {
      this.healthy = false;
      return false;
    }
  }

  async warmUp(): Promise<void> {
    try {
      await this.checkHealth();
      console.log(`[LLM] ${this.name} warmed up successfully (${this.avgLatencyMs.toFixed(0)}ms)`);
    } catch {
      console.warn(`[LLM] ${this.name} warm-up failed - will retry on first real request`);
    }
  }

  get availableSlots(): number {
    return Math.max(0, this.maxConcurrent - this.activeRequests);
  }
}
