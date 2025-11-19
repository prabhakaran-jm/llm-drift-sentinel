import { BigQuery } from '@google-cloud/bigquery';
import { TelemetryEvent } from '../types/telemetry.js';
import { Config } from '../config.js';

export class BigQueryWriter {
  private bigquery: BigQuery | null = null;
  private datasetId: string;
  private tableId: string;
  private enabled: boolean;

  constructor(config: Config['bigquery']) {
    this.enabled = config.enabled && config.projectId !== '';
    this.datasetId = config.datasetId;
    this.tableId = config.tableId;

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
}

