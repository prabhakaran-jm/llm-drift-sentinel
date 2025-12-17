import { v1, client } from '@datadog/datadog-api-client';
import { Config } from '../config.js';
import { TelemetryEvent } from '../types/telemetry.js';
import { DriftResult } from '../engines/driftEngine.js';
import { SafetyResult } from '../engines/safetyEngine.js';
import { AnomalyResult } from '../engines/anomalyEngine.js';

export class DatadogClient {
  private metricsApi: v1.MetricsApi;
  private eventsApi: v1.EventsApi;
  private enabled: boolean;
  private environment: string;

  constructor(config: Config['datadog'], environment: string) {
    this.enabled = config.enabled && !!config.apiKey;
    this.environment = environment;

    if (this.enabled) {
      const configuration = client.createConfiguration({
        authMethods: {
          apiKeyAuth: config.apiKey,
          appKeyAuth: config.appKey || '',
        },
      });

      configuration.setServerVariables({
        site: config.site,
      });

      this.metricsApi = new v1.MetricsApi(configuration);
      this.eventsApi = new v1.EventsApi(configuration);
    } else {
      // Create dummy APIs for stub mode
      this.metricsApi = {} as any;
      this.eventsApi = {} as any;
    }
  }

  async emitMetrics(
    event: TelemetryEvent,
    driftResult: DriftResult,
    safetyResult: SafetyResult,
    anomalyResult?: AnomalyResult
  ): Promise<void> {
    if (!this.enabled) {
      console.log('[Datadog] Stub mode - metrics not sent');
      return;
    }

    try {
      const timestamp = Math.floor(new Date(event.timestamp).getTime() / 1000);
      const tags = this.buildTags(event, safetyResult);

      const metrics: v1.Series[] = [
        // Request metrics
        {
          metric: 'llm.request.count',
          points: [[timestamp, 1]],
          tags,
        },
        {
          metric: 'llm.latency_ms',
          points: [[timestamp, event.latencyMs]],
          tags,
        },
        {
          metric: 'llm.tokens.input',
          points: [[timestamp, event.tokensIn]],
          tags,
        },
        {
          metric: 'llm.tokens.output',
          points: [[timestamp, event.tokensOut]],
          tags,
        },
        {
          metric: 'llm.tokens.total',
          points: [[timestamp, event.tokensTotal]],
          tags,
        },
        // Cost estimation (rough: $0.00001 per 1K tokens)
        {
          metric: 'llm.cost_usd',
          points: [[timestamp, (event.tokensTotal / 1000) * 0.00001]],
          tags,
        },
        // Drift metrics
        {
          metric: 'llm.drift_score',
          points: [[timestamp, driftResult.driftScore]],
          tags: [...tags, `baseline_ready:${driftResult.baselineReady}`],
        },
        {
          metric: 'llm.similarity_score',
          points: [[timestamp, driftResult.similarityScore]],
          tags: [...tags, `baseline_ready:${driftResult.baselineReady}`],
        },
        // Safety metrics
        {
          metric: 'llm.safety.score',
          points: [[timestamp, safetyResult.safetyScore]],
          tags: [...tags, `safety_label:${safetyResult.safetyLabel}`],
        },
        {
          metric: 'llm.safety.event.count',
          points: [[timestamp, 1]],
          tags: [...tags, `safety_label:${safetyResult.safetyLabel}`],
        },
        // Service metrics
        {
          metric: 'sentinel.analyzer.events_processed',
          points: [[timestamp, 1]],
          tags,
        },
      ];

      // Add error count if status is error
      if (event.status === 'error') {
        metrics.push({
          metric: 'llm.error.count',
          points: [[timestamp, 1]],
          tags,
        });
      }

      // Add drift count if drift is significant
      if (driftResult.driftScore > 0.2) {
        metrics.push({
          metric: 'llm.drift.count',
          points: [[timestamp, 1]],
          tags: [...tags, `drift_threshold:0.2`],
        });
      }

      // Add anomaly metrics if anomaly detected
      if (anomalyResult && anomalyResult.isAnomaly) {
        metrics.push({
          metric: 'llm.drift.anomaly',
          points: [[timestamp, 1]],
          tags: [
            ...tags,
            `z_score:${anomalyResult.zScore.toFixed(2)}`,
            `anomaly_threshold:${anomalyResult.threshold.toFixed(3)}`,
          ],
        });
        metrics.push({
          metric: 'llm.drift.z_score',
          points: [[timestamp, Math.abs(anomalyResult.zScore)]],
          tags: [...tags],
        });
      }

      await this.metricsApi.submitMetrics({
        body: {
          series: metrics,
        },
      });

      console.log(`[Datadog] Emitted ${metrics.length} metrics for ${event.requestId}`);
    } catch (error: any) {
      console.error(`[Datadog] Failed to emit metrics for ${event.requestId}:`, error.message);
      // Don't throw - metrics failures shouldn't break processing
    }
  }

  async emitSafetyEvent(event: TelemetryEvent, safetyResult: SafetyResult): Promise<void> {
    if (!this.enabled || !safetyResult.isHighRisk) {
      return;
    }

    try {
      const title = `LLM Safety Alert: ${safetyResult.safetyLabel}`;
      const text = `High-risk safety issue detected in LLM interaction.

**Request ID:** ${event.requestId}
**Safety Label:** ${safetyResult.safetyLabel}
**Safety Score:** ${safetyResult.safetyScore.toFixed(2)}
**Details:** ${safetyResult.details || 'No details available'}

**Prompt:** ${event.prompt.substring(0, 200)}${event.prompt.length > 200 ? '...' : ''}
**Response:** ${event.response.substring(0, 200)}${event.response.length > 200 ? '...' : ''}

**Model:** ${event.modelName} (${event.modelVersion})
**Endpoint:** ${event.endpoint}
**Environment:** ${this.environment}`;

      await this.eventsApi.createEvent({
        body: {
          title,
          text,
          alertType: safetyResult.safetyScore < 0.3 ? 'error' : 'warning',
          tags: this.buildTags(event, safetyResult),
          sourceTypeName: 'sentinel',
        },
      });

      console.log(`[Datadog] Emitted safety event for ${event.requestId}: ${safetyResult.safetyLabel}`);
    } catch (error: any) {
      console.error(`[Datadog] Failed to emit safety event for ${event.requestId}:`, error.message);
    }
  }

  private buildTags(event: TelemetryEvent, safetyResult: SafetyResult): string[] {
    return [
      `env:${this.environment}`,
      `service:${event.service}`,
      `endpoint:${event.endpoint}`,
      `method:${event.method}`,
      `model:${event.modelName}`,
      `model_version:${event.modelVersion}`,
      `status:${event.status}`,
      `safety_label:${safetyResult.safetyLabel}`,
    ];
  }
}

