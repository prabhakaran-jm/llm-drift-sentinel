import http from 'http';
import { loadConfig } from './config.js';
import { PubSubConsumer } from './services/pubsubConsumer.js';
import { BigQueryWriter } from './services/bigqueryWriter.js';
import { EmbeddingsClient } from './services/embeddingsClient.js';
import { BaselineStore } from './services/baselineStore.js';
import { SafetyClassifier } from './services/safetyClassifier.js';
import { DatadogClient } from './services/datadogClient.js';

const config = loadConfig();

// Create a simple HTTP server for Cloud Run health checks
const port = parseInt(process.env.PORT || '8080', 10);
const server = http.createServer((req, res) => {
  if (req.url === '/health' || req.url === '/') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'healthy', service: 'sentinel-analyzer' }));
  } else {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not found' }));
  }
});

server.listen(port, () => {
  console.log(`Health check server listening on port ${port}`);
});

console.log('Starting Sentinel Analyzer...');
console.log(`Environment: ${config.environment}`);
console.log(`Pub/Sub subscription: ${config.pubsub.subscriptionName}`);
console.log(`BigQuery: ${config.bigquery.enabled ? `${config.bigquery.datasetId}.${config.bigquery.tableId}` : 'disabled'}`);
console.log(`Vertex AI: ${config.vertex.projectId}/${config.vertex.location}/${config.vertex.embeddingModel}`);
console.log(`Safety: Using Gemini for classification`);
console.log(`Datadog: ${config.datadog.enabled ? `enabled (${config.datadog.site})` : 'disabled'}`);

const bigQueryWriter = new BigQueryWriter(config.bigquery);
const embeddingsClient = new EmbeddingsClient(config.vertex);
const baselineStore = new BaselineStore(bigQueryWriter);
const safetyClassifier = new SafetyClassifier(config.vertex);
const datadogClient = new DatadogClient(config.datadog, config.environment);
let consumer: PubSubConsumer | null = null;

// Load baselines from BigQuery on startup before starting consumer
async function initialize(): Promise<void> {
  try {
    console.log('[Startup] Loading baselines from BigQuery...');
    await baselineStore.loadBaselines();
    console.log('[Startup] Baselines loaded successfully');
  } catch (error) {
    console.error('[Startup] Failed to load baselines:', error);
    console.log('[Startup] Continuing without baselines - they will be rebuilt');
  }

  consumer = new PubSubConsumer(config, bigQueryWriter, embeddingsClient, baselineStore, safetyClassifier, datadogClient);
  
  // Start consuming messages
  await consumer.start();
  console.log('[Startup] Consumer started successfully');
}

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
    if (consumer) {
      console.log('[Shutdown] Stopping message consumer...');
      await consumer.stop();
    }

    // Persist any pending baselines before shutdown
    console.log('[Shutdown] Persisting baselines...');
    const allBaselines = baselineStore.getAllBaselines();
    for (const baseline of allBaselines) {
      if (baseline.createdAt) {
        await bigQueryWriter.writeBaseline({
          endpoint: baseline.endpoint,
          embedding: baseline.embedding,
          sampleCount: baseline.sampleCount,
          lastUpdated: baseline.lastUpdated,
          createdAt: baseline.createdAt,
        }).catch(err => console.error(`[Shutdown] Failed to persist baseline ${baseline.endpoint}:`, err));
      }
    }

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

// Initialize and start
initialize().catch((error) => {
  console.error('Failed to initialize:', error);
  process.exit(1);
});

