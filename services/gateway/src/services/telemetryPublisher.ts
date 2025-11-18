import { PubSub } from '@google-cloud/pubsub';
import { TelemetryEvent } from '../types/telemetry.js';
import { Config } from '../config.js';

export class TelemetryPublisher {
  private pubsub: PubSub | null = null;
  private topicName: string;
  private enabled: boolean;
  private projectId: string;

  constructor(config: Config['pubsub'], enabled: boolean = true) {
    this.projectId = config.projectId;
    this.topicName = config.topicName;
    this.enabled = enabled && config.enabled;

    if (this.enabled && this.projectId) {
      this.pubsub = new PubSub({
        projectId: this.projectId,
      });
    }
  }

  async publish(event: TelemetryEvent): Promise<void> {
    if (!this.enabled || !this.pubsub) {
      console.log('[Telemetry] Stub mode - event not published:', event.requestId);
      return;
    }

    try {
      const topic = this.pubsub.topic(this.topicName);
      const messageBuffer = Buffer.from(JSON.stringify(event));

      await topic.publishMessage({ data: messageBuffer });
      console.log(`[Telemetry] Published event ${event.requestId} to ${this.topicName}`);
    } catch (error) {
      console.error(`[Telemetry] Failed to publish event ${event.requestId}:`, error);
      // Don't throw - telemetry failures shouldn't break the request
    }
  }

  async ensureTopicExists(): Promise<void> {
    if (!this.enabled || !this.pubsub) {
      return;
    }

    try {
      const topic = this.pubsub.topic(this.topicName);
      const [exists] = await topic.exists();

      if (!exists) {
        console.warn(`[Telemetry] Topic ${this.topicName} does not exist. Create it with Terraform.`);
      }
    } catch (error) {
      console.error(`[Telemetry] Failed to check topic existence:`, error);
    }
  }
}

