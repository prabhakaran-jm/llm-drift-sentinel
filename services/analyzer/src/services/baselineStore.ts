import { TelemetryEvent } from '../types/telemetry.js';
import { BigQueryWriter } from './bigqueryWriter.js';
import { Config } from '../config.js';

export interface Baseline {
  endpoint: string;
  embedding: number[];
  sampleCount: number;
  lastUpdated: string;
  createdAt?: string;
}

/**
 * Baseline storage with BigQuery persistence.
 * Keyed by endpoint (e.g., '/api/chat').
 * Persists baselines to BigQuery every 10 samples to avoid data loss on restart.
 */
export class BaselineStore {
  private baselines: Map<string, Baseline> = new Map();
  private readonly minSamplesForBaseline = 5;
  private readonly persistInterval = 10; // Persist every 10 samples
  private bigQueryWriter: BigQueryWriter | null = null;
  private pendingPersist: Map<string, NodeJS.Timeout> = new Map();

  constructor(bigQueryWriter?: BigQueryWriter) {
    this.bigQueryWriter = bigQueryWriter || null;
  }

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
   * Persists to BigQuery every persistInterval samples.
   */
  updateBaseline(endpoint: string, embedding: number[], event: TelemetryEvent): void {
    const existing = this.baselines.get(endpoint);
    const now = new Date().toISOString();

    if (!existing) {
      // Create new baseline
      const newBaseline: Baseline = {
        endpoint,
        embedding: [...embedding],
        sampleCount: 1,
        lastUpdated: event.timestamp,
        createdAt: now,
      };
      this.baselines.set(endpoint, newBaseline);
      console.log(`[Baseline] Created baseline for ${endpoint}`);
      
      // Persist new baseline immediately
      this.schedulePersist(endpoint, newBaseline);
    } else {
      // Update existing baseline with exponential moving average
      const alpha = 0.1; // Learning rate
      const updatedEmbedding = existing.embedding.map((val, i) => {
        return val * (1 - alpha) + embedding[i] * alpha;
      });

      const updatedBaseline: Baseline = {
        endpoint,
        embedding: updatedEmbedding,
        sampleCount: existing.sampleCount + 1,
        lastUpdated: event.timestamp,
        createdAt: existing.createdAt || now,
      };

      this.baselines.set(endpoint, updatedBaseline);

      if (existing.sampleCount < this.minSamplesForBaseline) {
        console.log(`[Baseline] Updating baseline for ${endpoint} (${existing.sampleCount + 1}/${this.minSamplesForBaseline} samples)`);
      }

      // Persist every persistInterval samples
      if (updatedBaseline.sampleCount % this.persistInterval === 0) {
        this.persistBaseline(endpoint, updatedBaseline);
      } else {
        // Schedule delayed persist (debounce)
        this.schedulePersist(endpoint, updatedBaseline);
      }
    }
  }

  /**
   * Schedule a delayed persist (debounce to avoid too many writes)
   */
  private schedulePersist(endpoint: string, baseline: Baseline): void {
    // Clear existing timeout
    const existingTimeout = this.pendingPersist.get(endpoint);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
    }

    // Schedule persist after 5 seconds (debounce)
    const timeout = setTimeout(() => {
      this.persistBaseline(endpoint, baseline);
      this.pendingPersist.delete(endpoint);
    }, 5000);

    this.pendingPersist.set(endpoint, timeout);
  }

  /**
   * Persist baseline to BigQuery (async, non-blocking)
   */
  private async persistBaseline(endpoint: string, baseline: Baseline): Promise<void> {
    if (!this.bigQueryWriter) {
      return; // No BigQuery writer configured
    }

    try {
      await this.bigQueryWriter.writeBaseline({
        endpoint: baseline.endpoint,
        embedding: baseline.embedding,
        sampleCount: baseline.sampleCount,
        lastUpdated: baseline.lastUpdated,
        createdAt: baseline.createdAt || baseline.lastUpdated,
      });
    } catch (error) {
      console.error(`[Baseline] Failed to persist baseline for ${endpoint}:`, error);
      // Don't throw - persistence failures shouldn't break processing
    }
  }

  /**
   * Load baselines from BigQuery on startup
   */
  async loadBaselines(): Promise<void> {
    if (!this.bigQueryWriter) {
      console.log('[Baseline] No BigQuery writer configured, skipping baseline load');
      return;
    }

    try {
      const baselines = await this.bigQueryWriter.loadBaselines();
      
      for (const baseline of baselines) {
        this.baselines.set(baseline.endpoint, {
          endpoint: baseline.endpoint,
          embedding: baseline.embedding,
          sampleCount: baseline.sampleCount,
          lastUpdated: baseline.lastUpdated,
          createdAt: (baseline as any).createdAt || baseline.lastUpdated,
        });
      }

      console.log(`[Baseline] Loaded ${baselines.length} baselines from BigQuery`);
    } catch (error) {
      console.error('[Baseline] Failed to load baselines from BigQuery:', error);
      // Continue without baselines - they'll be rebuilt
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

