/**
 * Turn-level async queue for when all AI providers are saturated.
 * 
 * When all provider slots are full, instead of making the student wait
 * with a hanging spinner, we:
 * 1. Return 202 immediately with a job ID and queue position
 * 2. Process the turn in the background
 * 3. Frontend polls /api/queue/status/:jobId for updates
 * 4. When done, the poll returns the full turn result
 */

import { randomUUID } from "crypto";
import { registry } from "./providers/registry";

export interface TurnJob {
  id: string;
  status: "queued" | "processing" | "completed" | "failed";
  position: number;
  estimatedWaitMs: number;
  result?: any;
  error?: string;
  createdAt: number;
  completedAt?: number;
  sessionId: string;
}

interface TurnQueueEntry {
  job: TurnJob;
  processFn: () => Promise<any>;
  resolve: (value: any) => void;
  reject: (error: Error) => void;
}

const MAX_QUEUE_SIZE = 100;
const MAX_JOB_AGE_MS = 5 * 60 * 1000;
const PROCESS_INTERVAL_MS = 1000;

class TurnQueue {
  private queue: TurnQueueEntry[] = [];
  private completedJobs: Map<string, TurnJob> = new Map();
  private processing = false;
  private timer: ReturnType<typeof setInterval>;
  private cleanupTimer: ReturnType<typeof setInterval>;

  constructor() {
    this.timer = setInterval(() => this.processNext(), PROCESS_INTERVAL_MS);
    this.cleanupTimer = setInterval(() => this.cleanup(), 30000);
  }

  get queueLength(): number {
    return this.queue.filter((e) => e.job.status === "queued").length;
  }

  shouldQueue(): boolean {
    const available = registry.getTotalAvailableSlots();
    return available < 4;
  }

  enqueue(sessionId: string, processFn: () => Promise<any>): TurnJob {
    if (this.queue.length >= MAX_QUEUE_SIZE) {
      throw new Error("La cola de procesamiento está llena. Por favor intenta en un momento.");
    }

    const position = this.queueLength + 1;
    const avgWait = this.getAvgProcessingTime();

    const job: TurnJob = {
      id: randomUUID(),
      status: "queued",
      position,
      estimatedWaitMs: position * avgWait,
      createdAt: Date.now(),
      sessionId,
    };

    let resolve: any;
    let reject: any;
    new Promise<any>((res, rej) => {
      resolve = res;
      reject = rej;
    }).then((result) => {
      job.status = "completed";
      job.result = result;
      job.completedAt = Date.now();
      this.completedJobs.set(job.id, { ...job });
    }).catch((error) => {
      job.status = "failed";
      job.error = error.message || "Processing failed";
      job.completedAt = Date.now();
      this.completedJobs.set(job.id, { ...job });
    });

    this.queue.push({ job, processFn, resolve, reject });
    console.log(`[TurnQueue] Job ${job.id.substring(0, 8)} queued at position ${position} for session ${sessionId}`);

    this.processNext();
    return job;
  }

  getJobStatus(jobId: string): TurnJob | null {
    const entry = this.queue.find((e) => e.job.id === jobId);
    if (entry) {
      this.updatePositions();
      return {
        id: entry.job.id,
        status: entry.job.status,
        position: entry.job.position,
        estimatedWaitMs: entry.job.estimatedWaitMs,
        createdAt: entry.job.createdAt,
        sessionId: entry.job.sessionId,
      };
    }

    const completed = this.completedJobs.get(jobId);
    if (completed) return { ...completed };

    return null;
  }

  private async processNext(): Promise<void> {
    if (this.processing) return;

    const available = registry.getTotalAvailableSlots();
    if (available < 4) return;

    const next = this.queue.find((e) => e.job.status === "queued");
    if (!next) return;

    this.processing = true;
    next.job.status = "processing";
    next.job.position = 0;
    this.updatePositions();

    console.log(`[TurnQueue] Processing job ${next.job.id.substring(0, 8)} for session ${next.job.sessionId}`);

    try {
      const result = await next.processFn();
      next.resolve(result);
      console.log(`[TurnQueue] Job ${next.job.id.substring(0, 8)} completed`);
    } catch (error) {
      next.reject(error instanceof Error ? error : new Error(String(error)));
      console.error(`[TurnQueue] Job ${next.job.id.substring(0, 8)} failed: ${error}`);
    } finally {
      const idx = this.queue.findIndex((e) => e.job.id === next.job.id);
      if (idx >= 0) this.queue.splice(idx, 1);
      this.processing = false;

      setTimeout(() => this.processNext(), 100);
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

    const avgPerCall = withStats.reduce((sum, p) => sum + p.avgLatencyMs, 0) / withStats.length;
    return avgPerCall * 4;
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

  getStatus(): { queueLength: number; processing: number } {
    return {
      queueLength: this.queueLength,
      processing: this.queue.filter((e) => e.job.status === "processing").length,
    };
  }
}

export const turnQueue = new TurnQueue();
