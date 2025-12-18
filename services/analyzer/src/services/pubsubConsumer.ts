import { PubSub, Message } from '@google-cloud/pubsub';
import { TelemetryEvent } from '../types/telemetry.js';
import { Config } from '../config.js';
import { computeDrift } from '../engines/driftEngine.js';
import { checkSafety } from '../engines/safetyEngine.js';
import { AnomalyDetector } from '../engines/anomalyEngine.js';
import { CostOptimizer } from '../engines/costOptimizer.js';
import { PatternDetector } from '../engines/patternEngine.js';
import { BigQueryWriter } from './bigqueryWriter.js';
import { EmbeddingsClient } from './embeddingsClient.js';
import { BaselineStore } from './baselineStore.js';
import { SafetyClassifier } from './safetyClassifier.js';
import { DatadogClient } from './datadogClient.js';

export class PubSubConsumer {
  private pubsub: PubSub;
  private subscriptionName: string;
  private bigQueryWriter: BigQueryWriter;
  private embeddingsClient: EmbeddingsClient;
  private baselineStore: BaselineStore;
  private safetyClassifier: SafetyClassifier;
  private datadogClient: DatadogClient;
  private anomalyDetector: AnomalyDetector;
  private costOptimizer: CostOptimizer;
  private patternDetector: PatternDetector;
  private isRunning: boolean = false;

  constructor(
    config: Config,
    bigQueryWriter: BigQueryWriter,
    embeddingsClient: EmbeddingsClient,
    baselineStore: BaselineStore,
    safetyClassifier: SafetyClassifier,
    datadogClient: DatadogClient
  ) {
    this.pubsub = new PubSub({
      projectId: config.pubsub.projectId,
    });
    this.subscriptionName = config.pubsub.subscriptionName;
    this.bigQueryWriter = bigQueryWriter;
    this.embeddingsClient = embeddingsClient;
    this.baselineStore = baselineStore;
    this.safetyClassifier = safetyClassifier;
    this.datadogClient = datadogClient;
    this.anomalyDetector = new AnomalyDetector();
    this.costOptimizer = new CostOptimizer(embeddingsClient);
    this.patternDetector = new PatternDetector();
  }

  async start(): Promise<void> {
    if (this.isRunning) {
      console.log('[Consumer] Already running');
      return;
    }

    this.isRunning = true;
    const subscription = this.pubsub.subscription(this.subscriptionName);

    console.log(`[Consumer] Starting to listen on subscription: ${this.subscriptionName}`);

    subscription.on('message', async (message: Message) => {
      await this.handleMessage(message);
    });

    subscription.on('error', (error: Error) => {
      console.error('[Consumer] Subscription error:', error);
    });

    console.log('[Consumer] Consumer started and listening for messages');
  }

  async stop(): Promise<void> {
    this.isRunning = false;
    console.log('[Consumer] Stopping consumer');
  }

  private async handleMessage(message: Message): Promise<void> {
    try {
      const event = this.parseMessage(message);
      
      console.log(`[Consumer] Processing event ${event.requestId}`);

      // Process in parallel with timing
      const driftStart = Date.now();
      const safetyStart = Date.now();
      
      const [driftResult, safetyResult] = await Promise.all([
        computeDrift(event, this.embeddingsClient, this.baselineStore).then(result => {
          const driftTime = Date.now() - driftStart;
          console.log(`[Consumer] Drift computation took ${driftTime}ms`);
          return { ...result, processingTimeMs: driftTime };
        }),
        checkSafety(event, this.safetyClassifier).then(result => {
          const safetyTime = Date.now() - safetyStart;
          console.log(`[Consumer] Safety check took ${safetyTime}ms`);
          return { ...result, processingTimeMs: safetyTime };
        }),
      ]);

      // Detect anomalies in drift scores
      const anomalyResult = this.anomalyDetector.detectAnomaly(
        event.endpoint,
        driftResult.driftScore
      );

      // Log results
      console.log(`[Consumer] Event ${event.requestId}:`, {
        drift: driftResult,
        safety: safetyResult,
        anomaly: anomalyResult.isAnomaly ? { zScore: anomalyResult.zScore } : null,
      });

      // Record event for cost analysis
      this.costOptimizer.recordEvent(event);

      // Record event for pattern detection
      this.patternDetector.recordEvent(event, safetyResult);

      // Detect attack patterns
      const patterns = this.patternDetector.detectPatterns();
      if (patterns.length > 0) {
        for (const pattern of patterns) {
          await this.datadogClient.emitPatternEvent(event, pattern);
        }
      }

      // Emit Datadog metrics (including anomaly if detected)
      await this.datadogClient.emitMetrics(event, driftResult, safetyResult, anomalyResult);

      // Emit cost metrics
      await this.datadogClient.emitCostMetrics(event, this.costOptimizer);

      // Emit cache metrics (periodically, not every request to avoid spam)
      // Emit every 10th request to track cache performance
      const requestNumber = parseInt(event.requestId.slice(-2), 16) || 0;
      if (requestNumber % 10 === 0) {
        const cacheStats = this.embeddingsClient.getCacheStats();
        await this.datadogClient.emitCacheMetrics(cacheStats);
      }

      // Emit Datadog event for high-risk safety issues
      await this.datadogClient.emitSafetyEvent(event, safetyResult);

      // Write to BigQuery
      await this.bigQueryWriter.writeEvent(event);

      // Acknowledge message
      message.ack();
      console.log(`[Consumer] Processed and acknowledged event ${event.requestId}`);
    } catch (error) {
      console.error('[Consumer] Error processing message:', error);
      // Nack message to retry later
      message.nack();
    }
  }

  private parseMessage(message: Message): TelemetryEvent {
    const data = message.data.toString();
    const event: TelemetryEvent = JSON.parse(data);
    
    // Validate required fields
    if (!event.requestId || !event.timestamp) {
      throw new Error('Invalid telemetry event: missing required fields');
    }

    return event;
  }
}

