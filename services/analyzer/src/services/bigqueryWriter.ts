import { BigQuery } from '@google-cloud/bigquery';
import { TelemetryEvent } from '../types/telemetry.js';
import { Config } from '../config.js';

export class BigQueryWriter {
  private bigquery: BigQuery | null = null;
  private datasetId: string;
  private tableId: string;
  private baselineTableId: string;
  private enabled: boolean;

  constructor(config: Config['bigquery']) {
    this.enabled = config.enabled && config.projectId !== '';
    this.datasetId = config.datasetId;
    this.tableId = config.tableId;
    this.baselineTableId = config.baselineTableId;

    if (this.enabled) {
      this.bigquery = new BigQuery({
        projectId: config.projectId,
      });
    }
  }

  async writeEvent(event: TelemetryEvent): Promise<void> {
    if (!this.enabled || !this.bigquery) {
      console.log('[BigQuery] Stub mode - event not written:', event.requestId);
      return;
    }

    try {
      const rows = [
        {
          requestId: event.requestId,
          timestamp: event.timestamp,
          endpoint: event.endpoint,
          method: event.method,
          prompt: event.prompt,
          promptLength: event.promptLength,
          response: event.response,
          responseLength: event.responseLength,
          modelName: event.modelName,
          modelVersion: event.modelVersion,
          tokensIn: event.tokensIn,
          tokensOut: event.tokensOut,
          tokensTotal: event.tokensTotal,
          latencyMs: event.latencyMs,
          status: event.status,
          errorMessage: event.errorMessage || null,
          environment: event.environment || null,
          service: event.service,
        },
      ];

      await this.bigquery.dataset(this.datasetId).table(this.tableId).insert(rows);
      console.log(`[BigQuery] Wrote event ${event.requestId} to ${this.datasetId}.${this.tableId}`);
    } catch (error) {
      console.error(`[BigQuery] Failed to write event ${event.requestId}:`, error);
      // Don't throw - BigQuery failures shouldn't break processing
    }
  }

  /**
   * Write baseline to BigQuery (upsert: delete old, insert new)
   */
  async writeBaseline(baseline: {
    endpoint: string;
    embedding: number[];
    sampleCount: number;
    lastUpdated: string;
    createdAt: string;
  }): Promise<void> {
    if (!this.enabled || !this.bigquery) {
      console.log('[BigQuery] Stub mode - baseline not written:', baseline.endpoint);
      return;
    }

    try {
      // Delete existing baseline for this endpoint
      const deleteQuery = `
        DELETE FROM \`${this.datasetId}.${this.baselineTableId}\`
        WHERE endpoint = @endpoint
      `;

      await this.bigquery.query({
        query: deleteQuery,
        location: 'US',
        params: {
          endpoint: baseline.endpoint,
        },
      });

      // Insert new baseline
      const rows = [
        {
          endpoint: baseline.endpoint,
          embedding: baseline.embedding,
          sampleCount: baseline.sampleCount,
          lastUpdated: baseline.lastUpdated,
          createdAt: baseline.createdAt,
        },
      ];

      await this.bigquery.dataset(this.datasetId).table(this.baselineTableId).insert(rows);
      console.log(`[BigQuery] Persisted baseline for ${baseline.endpoint} to ${this.datasetId}.${this.baselineTableId}`);
    } catch (error) {
      console.error(`[BigQuery] Failed to write baseline for ${baseline.endpoint}:`, error);
      // Don't throw - BigQuery failures shouldn't break processing
    }
  }

  /**
   * Load all baselines from BigQuery
   */
  async loadBaselines(): Promise<Array<{
    endpoint: string;
    embedding: number[];
    sampleCount: number;
    lastUpdated: string;
    createdAt?: string;
  }>> {
    if (!this.enabled || !this.bigquery) {
      console.log('[BigQuery] Stub mode - baselines not loaded');
      return [];
    }

    try {
      const query = `
        SELECT endpoint, embedding, sampleCount, lastUpdated, createdAt
        FROM \`${this.datasetId}.${this.baselineTableId}\`
        ORDER BY lastUpdated DESC
      `;

      const [rows] = await this.bigquery.query({ query, location: 'US' });
      
      const baselines = rows.map((row: any) => ({
        endpoint: row.endpoint,
        embedding: row.embedding || [],
        sampleCount: row.sampleCount || 0,
        lastUpdated: row.lastUpdated,
        createdAt: row.createdAt || row.lastUpdated,
      }));

      console.log(`[BigQuery] Loaded ${baselines.length} baselines from ${this.datasetId}.${this.baselineTableId}`);
      return baselines;
    } catch (error) {
      console.error('[BigQuery] Failed to load baselines:', error);
      // Return empty array on error - system will rebuild baselines
      return [];
    }
  }
}

