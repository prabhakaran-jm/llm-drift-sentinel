import { PubSub, Message } from '@google-cloud/pubsub';
import { TelemetryEvent } from '../types/telemetry.js';
import { Config } from '../config.js';
import { computeDrift } from '../engines/driftEngine.js';
import { checkSafety } from '../engines/safetyEngine.js';
import { BigQueryWriter } from './bigqueryWriter.js';
import { EmbeddingsClient } from './embeddingsClient.js';
import { BaselineStore } from './baselineStore.js';

export class PubSubConsumer {
  private pubsub: PubSub;
  private subscriptionName: string;
  private bigQueryWriter: BigQueryWriter;
  private embeddingsClient: EmbeddingsClient;
  private baselineStore: BaselineStore;
  private isRunning: boolean = false;

  constructor(
    config: Config,
    bigQueryWriter: BigQueryWriter,
    embeddingsClient: EmbeddingsClient,
    baselineStore: BaselineStore
  ) {
    this.pubsub = new PubSub({
      projectId: config.pubsub.projectId,
    });
    this.subscriptionName = config.pubsub.subscriptionName;
    this.bigQueryWriter = bigQueryWriter;
    this.embeddingsClient = embeddingsClient;
    this.baselineStore = baselineStore;
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

      // Process in parallel
      const [driftResult, safetyResult] = await Promise.all([
        computeDrift(event, this.embeddingsClient, this.baselineStore),
        checkSafety(event),
      ]);

      // Log results
      console.log(`[Consumer] Event ${event.requestId}:`, {
        drift: driftResult,
        safety: safetyResult,
      });

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

