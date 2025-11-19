import { loadConfig } from './config.js';
import { PubSubConsumer } from './services/pubsubConsumer.js';
import { BigQueryWriter } from './services/bigqueryWriter.js';

const config = loadConfig();

console.log('Starting Sentinel Analyzer...');
console.log(`Environment: ${config.environment}`);
console.log(`Pub/Sub subscription: ${config.pubsub.subscriptionName}`);
console.log(`BigQuery: ${config.bigquery.enabled ? `${config.bigquery.datasetId}.${config.bigquery.tableId}` : 'disabled'}`);

const bigQueryWriter = new BigQueryWriter(config.bigquery);
const consumer = new PubSubConsumer(config, bigQueryWriter);

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

