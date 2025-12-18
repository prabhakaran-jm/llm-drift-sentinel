import express from 'express';
import cors from 'cors';
import tracer from 'dd-trace';
import { loadConfig } from './config.js';
import { VertexClient } from './vertexClient.js';
import { TelemetryPublisher } from './services/telemetryPublisher.js';
import { createChatRouter } from './routes/chat.js';
import { chatRateLimiter } from './middleware/rateLimiter.js';

// Initialize Datadog APM tracing
tracer.init({
  service: 'llm-sentinel-gateway',
  env: process.env.ENVIRONMENT || 'dev',
  version: '1.0.0',
  logInjection: true,
  runtimeMetrics: true,
});

const config = loadConfig();
const app = express();

// CORS configuration - allow all origins for now (can be restricted in production)
app.use(cors({
  origin: true, // Allow all origins
  credentials: true,
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(express.json());

// Apply rate limiting to API routes
app.use('/api', chatRateLimiter);

const vertexClient = new VertexClient(config.vertex, config.useStub);
const telemetryPublisher = new TelemetryPublisher(config.pubsub, !config.useStub);

// Check topic existence on startup
telemetryPublisher.ensureTopicExists().catch(console.error);

app.use(createChatRouter(vertexClient, telemetryPublisher, config));

// Liveness probe - simple alive check
app.get('/health/liveness', (req: express.Request, res: express.Response): void => {
  res.json({ 
    status: 'alive',
    timestamp: new Date().toISOString()
  });
});

// Readiness probe - check dependencies
app.get('/health/readiness', async (req: express.Request, res: express.Response): Promise<void> => {
  const checks: Record<string, string> = {};
  let allHealthy = true;

  try {
    // Check Vertex AI (if not in stub mode)
    if (!config.useStub) {
      try {
        // Simple check - verify client is initialized
        if (vertexClient) {
          checks.vertexAI = 'healthy';
        } else {
          checks.vertexAI = 'unhealthy';
          allHealthy = false;
        }
      } catch (error) {
        checks.vertexAI = 'unhealthy';
        allHealthy = false;
      }
    } else {
      checks.vertexAI = 'stub_mode';
    }

    // Check Pub/Sub (if enabled)
    if (config.pubsub.enabled) {
      try {
        await telemetryPublisher.ensureTopicExists();
        checks.pubsub = 'healthy';
      } catch (error) {
        checks.pubsub = 'unhealthy';
        allHealthy = false;
      }
    } else {
      checks.pubsub = 'disabled';
    }

    if (allHealthy) {
      res.json({
        status: 'ready',
        checks,
        timestamp: new Date().toISOString(),
      });
    } else {
      res.status(503).json({
        status: 'not_ready',
        checks,
        timestamp: new Date().toISOString(),
      });
    }
  } catch (error) {
    res.status(503).json({
      status: 'not_ready',
      error: error instanceof Error ? error.message : 'Unknown error',
      checks,
      timestamp: new Date().toISOString(),
    });
  }
});

// Legacy health endpoint (backwards compatibility)
app.get('/health', (req: express.Request, res: express.Response): void => {
  res.json({ 
    status: 'ok',
    mode: config.useStub ? 'stub' : 'vertex-ai',
    telemetry: config.pubsub.enabled ? 'enabled' : 'disabled',
    timestamp: new Date().toISOString()
  });
});

app.get('/api/health', (req: express.Request, res: express.Response): void => {
  res.json({ 
    status: 'ok',
    mode: config.useStub ? 'stub' : 'vertex-ai',
    telemetry: config.pubsub.enabled ? 'enabled' : 'disabled',
    timestamp: new Date().toISOString()
  });
});

app.listen(config.port, () => {
  console.log(`Gateway running on port ${config.port}`);
  if (config.useStub) {
    console.log('⚠️  Running in STUB mode (USE_STUB=true)');
  } else {
    console.log(`Vertex AI config: ${config.vertex.projectId}/${config.vertex.location}/${config.vertex.model}`);
  }
  if (config.pubsub.enabled) {
    console.log(`📊 Telemetry enabled: ${config.pubsub.topicName}`);
  } else {
    console.log('📊 Telemetry disabled');
  }
});

