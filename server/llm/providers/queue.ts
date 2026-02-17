import { randomUUID } from "crypto";
import type { QueuedJob } from "./types";
import type { ChatMessage, CompletionOptions } from "../provider";
import { routeRequest, hasAvailableSlots } from "./router";
import { registry } from "./registry";

interface QueueEntry {
  job: QueuedJob;
  messages: ChatMessage[];
  options: CompletionOptions;
  resolve: (value: string) => void;
  reject: (error: Error) => void;
}

const MAX_QUEUE_SIZE = 200;
const MAX_JOB_AGE_MS = 5 * 60 * 1000;
const POLL_INTERVAL_MS = 500;
const CLEANUP_INTERVAL_MS = 30000;

class JobQueue {
  private queue: QueueEntry[] = [];
  private completedJobs: Map<string, QueuedJob> = new Map();
  private processing = false;
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private cleanupTimer: ReturnType<typeof setInterval> | null = null;

  constructor() {
    this.pollTimer = setInterval(() => this.processQueue(), POLL_INTERVAL_MS);
    this.cleanupTimer = setInterval(() => this.cleanup(), CLEANUP_INTERVAL_MS);
  }

  get queueLength(): number {
    return this.queue.length;
  }

  get activeJobCount(): number {
    return this.queue.filter((e) => e.job.status === "processing").length;
  }

  enqueue(messages: ChatMessage[], options: CompletionOptions): QueuedJob {
    if (this.queue.length >= MAX_QUEUE_SIZE) {
      throw new Error("AI request queue is full. Please try again in a moment.");
    }

    const avgLatency = this.getAvgProcessingTime();
    const position = this.queue.filter((e) => e.job.status === "queued").length + 1;

    const job: QueuedJob = {
      id: randomUUID(),
      status: "queued",
      position,
      estimatedWaitMs: position * avgLatency,
      createdAt: Date.now(),
    };

    const entry: QueueEntry = {
      job,
      messages,
      options,
      resolve: () => {},
      reject: () => {},
    };

    new Promise<string>((resolve, reject) => {
      entry.resolve = resolve;
      entry.reject = reject;
    })
      .then((result) => {
        job.status = "completed";
        job.result = result;
        job.completedAt = Date.now();
        this.completedJobs.set(job.id, { ...job });
      })
      .catch((error) => {
        job.status = "failed";
        job.error = error.message;
        job.completedAt = Date.now();
        this.completedJobs.set(job.id, { ...job });
      });

    this.queue.push(entry);
    console.log(`[LLM Queue] Job ${job.id.substring(0, 8)} queued at position ${position}`);

    this.processQueue();
    return job;
  }

  getJobStatus(jobId: string): QueuedJob | null {
    const queued = this.queue.find((e) => e.job.id === jobId);
    if (queued) {
      const queuedEntries = this.queue.filter((e) => e.job.status === "queued");
      const position = queuedEntries.findIndex((e) => e.job.id === jobId) + 1;
      queued.job.position = position > 0 ? position : 0;
      queued.job.estimatedWaitMs = position * this.getAvgProcessingTime();
      return { ...queued.job };
    }

    const completed = this.completedJobs.get(jobId);
    if (completed) return { ...completed };

    return null;
  }

  private async processQueue(): Promise<void> {
    if (this.processing) return;
    this.processing = true;

    try {
      while (true) {
        if (!hasAvailableSlots()) break;

        const nextEntry = this.queue.find((e) => e.job.status === "queued");
        if (!nextEntry) break;

        nextEntry.job.status = "processing";
        nextEntry.job.position = 0;

        this.processEntry(nextEntry);
      }

      this.updatePositions();
    } finally {
      this.processing = false;
    }
  }

  private async processEntry(entry: QueueEntry): Promise<void> {
    try {
      const result = await routeRequest(entry.messages, entry.options);
      entry.resolve(result.result);
      console.log(
        `[LLM Queue] Job ${entry.job.id.substring(0, 8)} completed via ${result.provider} in ${(result.latencyMs / 1000).toFixed(1)}s`
      );
    } catch (error) {
      entry.reject(error instanceof Error ? error : new Error(String(error)));
      console.error(
        `[LLM Queue] Job ${entry.job.id.substring(0, 8)} failed: ${error instanceof Error ? error.message : error}`
      );
    } finally {
      const idx = this.queue.findIndex((e) => e.job.id === entry.job.id);
      if (idx >= 0) this.queue.splice(idx, 1);
    }
  }

  private updatePositions(): void {
    let pos = 1;
    for (const entry of this.queue) {
      if (entry.job.status === "queued") {
        entry.job.position = pos;
        entry.job.estimatedWaitMs = pos * this.getAvgProcessingTime();
        pos++;
      }
    }
  }

  private getAvgProcessingTime(): number {
    const providers = registry.getProviders();
    if (providers.length === 0) return 15000;

    const withStats = providers.filter((p) => p.avgLatencyMs > 0);
    if (withStats.length === 0) return 15000;

    return (
      withStats.reduce((sum, p) => sum + p.avgLatencyMs, 0) / withStats.length
    );
  }

  private cleanup(): void {
    const now = Date.now();
    const keysToDelete: string[] = [];
    this.completedJobs.forEach((job, id) => {
      if (now - (job.completedAt || job.createdAt) > MAX_JOB_AGE_MS) {
        keysToDelete.push(id);
      }
    });
    keysToDelete.forEach((id) => this.completedJobs.delete(id));
  }

  getQueueStatus(): {
    queueLength: number;
    processing: number;
    avgWaitMs: number;
  } {
    return {
      queueLength: this.queue.filter((e) => e.job.status === "queued").length,
      processing: this.queue.filter((e) => e.job.status === "processing").length,
      avgWaitMs: Math.round(this.getAvgProcessingTime()),
    };
  }
}

export const jobQueue = new JobQueue();
