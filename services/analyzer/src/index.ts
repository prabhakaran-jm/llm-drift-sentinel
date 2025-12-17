import { loadConfig } from './config.js';
import { PubSubConsumer } from './services/pubsubConsumer.js';
import { BigQueryWriter } from './services/bigqueryWriter.js';
import { EmbeddingsClient } from './services/embeddingsClient.js';
import { BaselineStore } from './services/baselineStore.js';
import { SafetyClassifier } from './services/safetyClassifier.js';
import { DatadogClient } from './services/datadogClient.js';

const config = loadConfig();

console.log('Starting Sentinel Analyzer...');
console.log(`Environment: ${config.environment}`);
console.log(`Pub/Sub subscription: ${config.pubsub.subscriptionName}`);
console.log(`BigQuery: ${config.bigquery.enabled ? `${config.bigquery.datasetId}.${config.bigquery.tableId}` : 'disabled'}`);
console.log(`Vertex AI: ${config.vertex.projectId}/${config.vertex.location}/${config.vertex.embeddingModel}`);
console.log(`Safety: Using Gemini for classification`);
console.log(`Datadog: ${config.datadog.enabled ? `enabled (${config.datadog.site})` : 'disabled'}`);

const bigQueryWriter = new BigQueryWriter(config.bigquery);
const embeddingsClient = new EmbeddingsClient(config.vertex);
const baselineStore = new BaselineStore();
const safetyClassifier = new SafetyClassifier(config.vertex);
const datadogClient = new DatadogClient(config.datadog, config.environment);
const consumer = new PubSubConsumer(config, bigQueryWriter, embeddingsClient, baselineStore, safetyClassifier, datadogClient);

// Graceful shutdown handler
let isShuttingDown = false;

async function gracefulShutdown(signal: string): Promise<void> {
  if (isShuttingDown) {
    console.log(`[${signal}] Already shutting down, forcing exit...`);
    process.exit(1);
  }

  isShuttingDown = true;
  console.log(`\n[${signal}] Received, starting graceful shutdown...`);

  try {
    // Stop accepting new messages
    console.log('[Shutdown] Stopping message consumer...');
    await consumer.stop();

    // Wait for in-flight messages to complete (5 second timeout)
    console.log('[Shutdown] Waiting for in-flight messages...');
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Close BigQuery connections
    if (bigQueryWriter && typeof (bigQueryWriter as any).close === 'function') {
      console.log('[Shutdown] Closing BigQuery connections...');
      await (bigQueryWriter as any).close();
    }

    console.log('[Shutdown] Graceful shutdown complete');
    process.exit(0);
  } catch (error) {
    console.error('[Shutdown] Error during graceful shutdown:', error);
    process.exit(1);
  }
}

// Handle shutdown signals
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  console.error('[Fatal] Uncaught exception:', error);
  gracefulShutdown('uncaughtException').catch(() => process.exit(1));
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('[Fatal] Unhandled rejection at:', promise, 'reason:', reason);
  gracefulShutdown('unhandledRejection').catch(() => process.exit(1));
});

// Start consuming messages
consumer.start().catch((error) => {
  console.error('Failed to start consumer:', error);
  process.exit(1);
});

