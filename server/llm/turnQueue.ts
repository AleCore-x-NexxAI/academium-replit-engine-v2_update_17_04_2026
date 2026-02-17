/**
 * Turn-level async queue for when all AI providers are saturated.
 * 
 * When all provider slots are full, instead of making the student wait
 * with a hanging spinner, we:
 * 1. Return 202 immediately with a job ID and queue position
 * 2. Process the turn in the background (multiple in parallel)
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
}

const MAX_QUEUE_SIZE = 100;
const MAX_JOB_AGE_MS = 5 * 60 * 1000;
const PROCESS_INTERVAL_MS = 500;
const SLOTS_PER_TURN = 4;

class TurnQueue {
  private queue: TurnQueueEntry[] = [];
  private completedJobs: Map<string, TurnJob> = new Map();
  private activeCount = 0;
  private timer: ReturnType<typeof setInterval>;
  private cleanupTimer: ReturnType<typeof setInterval>;

  constructor() {
    this.timer = setInterval(() => this.drainQueue(), PROCESS_INTERVAL_MS);
    this.cleanupTimer = setInterval(() => this.cleanup(), 30000);
  }

  get queueLength(): number {
    return this.queue.filter((e) => e.job.status === "queued").length;
  }

  shouldQueue(): boolean {
    const available = registry.getTotalAvailableSlots();
    return available === 0;
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

    this.queue.push({ job, processFn });
    console.log(`[TurnQueue] Job ${job.id.substring(0, 8)} queued at position ${position} for session ${sessionId}`);

    this.drainQueue();
    return job;
  }

  getJobStatus(jobId: string): TurnJob | null {
    const entry = this.queue.find((e) => e.job.id === jobId);
    if (entry) {
      this.updatePositions();
      return { ...entry.job };
    }

    const completed = this.completedJobs.get(jobId);
    if (completed) return { ...completed };

    return null;
  }

  private drainQueue(): void {
    const available = registry.getTotalAvailableSlots();
    const canProcess = Math.floor(available / SLOTS_PER_TURN);
    const queued = this.queue.filter((e) => e.job.status === "queued");

    const toStart = Math.min(canProcess, queued.length);

    for (let i = 0; i < toStart; i++) {
      this.startJob(queued[i]);
    }
  }

  private async startJob(entry: TurnQueueEntry): Promise<void> {
    entry.job.status = "processing";
    entry.job.position = 0;
    this.activeCount++;
    this.updatePositions();

    console.log(`[TurnQueue] Processing job ${entry.job.id.substring(0, 8)} for session ${entry.job.sessionId}`);

    try {
      const result = await entry.processFn();
      entry.job.status = "completed";
      entry.job.result = result;
      entry.job.completedAt = Date.now();
      console.log(`[TurnQueue] Job ${entry.job.id.substring(0, 8)} completed`);
    } catch (error) {
      entry.job.status = "failed";
      entry.job.error = error instanceof Error ? error.message : String(error);
      entry.job.completedAt = Date.now();
      console.error(`[TurnQueue] Job ${entry.job.id.substring(0, 8)} failed: ${entry.job.error}`);
    } finally {
      this.activeCount--;
      this.completedJobs.set(entry.job.id, { ...entry.job });
      const idx = this.queue.findIndex((e) => e.job.id === entry.job.id);
      if (idx >= 0) this.queue.splice(idx, 1);

      this.drainQueue();
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
      processing: this.activeCount,
    };
  }
}

export const turnQueue = new TurnQueue();
