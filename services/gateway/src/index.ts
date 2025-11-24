import express from 'express';
import cors from 'cors';
import { loadConfig } from './config.js';
import { VertexClient } from './vertexClient.js';
import { TelemetryPublisher } from './services/telemetryPublisher.js';
import { createChatRouter } from './routes/chat.js';

const config = loadConfig();
const app = express();

app.use(cors());
app.use(express.json());

const vertexClient = new VertexClient(config.vertex, config.useStub);
const telemetryPublisher = new TelemetryPublisher(config.pubsub, !config.useStub);

// Check topic existence on startup
telemetryPublisher.ensureTopicExists().catch(console.error);

app.use(createChatRouter(vertexClient, telemetryPublisher, config));

// Health check endpoints
const healthHandler = (req: express.Request, res: express.Response): void => {
  res.json({ 
    status: 'ok',
    mode: config.useStub ? 'stub' : 'vertex-ai',
    telemetry: config.pubsub.enabled ? 'enabled' : 'disabled'
  });
};

app.get('/health', healthHandler);
app.get('/api/health', healthHandler);

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

