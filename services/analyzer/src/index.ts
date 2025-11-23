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

// Handle graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n[SIGINT] Received, shutting down gracefully...');
  await consumer.stop();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n[SIGTERM] Received, shutting down gracefully...');
  await consumer.stop();
  process.exit(0);
});

// Start consuming messages
consumer.start().catch((error) => {
  console.error('Failed to start consumer:', error);
  process.exit(1);
});

