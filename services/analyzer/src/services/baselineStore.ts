import { TelemetryEvent } from '../types/telemetry.js';

export interface Baseline {
  endpoint: string;
  embedding: number[];
  sampleCount: number;
  lastUpdated: string;
}

/**
 * In-memory baseline storage.
 * Keyed by endpoint (e.g., '/api/chat').
 * Phase 4: Simple in-memory implementation.
 * Future: Could be moved to BigQuery or Redis.
 */
export class BaselineStore {
  private baselines: Map<string, Baseline> = new Map();
  private readonly minSamplesForBaseline = 5;

  /**
   * Get or create baseline for an endpoint.
   * Returns null if not enough samples yet.
   */
  getBaseline(endpoint: string): Baseline | null {
    return this.baselines.get(endpoint) || null;
  }

  /**
   * Update baseline with a new sample.
   * Uses exponential moving average for embedding updates.
   */
  updateBaseline(endpoint: string, embedding: number[], event: TelemetryEvent): void {
    const existing = this.baselines.get(endpoint);

    if (!existing) {
      // Create new baseline if we have enough samples
      // For now, we'll create it immediately (can be improved with sampling)
      this.baselines.set(endpoint, {
        endpoint,
        embedding: [...embedding],
        sampleCount: 1,
        lastUpdated: event.timestamp,
      });
      console.log(`[Baseline] Created baseline for ${endpoint}`);
    } else {
      // Update existing baseline with exponential moving average
      const alpha = 0.1; // Learning rate
      const updatedEmbedding = existing.embedding.map((val, i) => {
        return val * (1 - alpha) + embedding[i] * alpha;
      });

      this.baselines.set(endpoint, {
        endpoint,
        embedding: updatedEmbedding,
        sampleCount: existing.sampleCount + 1,
        lastUpdated: event.timestamp,
      });

      if (existing.sampleCount < this.minSamplesForBaseline) {
        console.log(`[Baseline] Updating baseline for ${endpoint} (${existing.sampleCount + 1}/${this.minSamplesForBaseline} samples)`);
      }
    }
  }

  /**
   * Check if baseline is ready (has enough samples).
   */
  isBaselineReady(endpoint: string): boolean {
    const baseline = this.baselines.get(endpoint);
    return baseline !== undefined && baseline.sampleCount >= this.minSamplesForBaseline;
  }

  /**
   * Get all baselines (for debugging).
   */
  getAllBaselines(): Baseline[] {
    return Array.from(this.baselines.values());
  }
}

