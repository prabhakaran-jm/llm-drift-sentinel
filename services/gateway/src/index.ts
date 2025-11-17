import express from 'express';
import cors from 'cors';
import { loadConfig } from './config.js';
import { VertexClient } from './vertexClient.js';
import { createChatRouter } from './routes/chat.js';

const config = loadConfig();
const app = express();

app.use(cors());
app.use(express.json());

const vertexClient = new VertexClient(config.vertex, config.useStub);
app.use(createChatRouter(vertexClient));

app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok',
    mode: config.useStub ? 'stub' : 'vertex-ai'
  });
});

app.listen(config.port, () => {
  console.log(`Gateway running on port ${config.port}`);
  if (config.useStub) {
    console.log('⚠️  Running in STUB mode (USE_STUB=true)');
  } else {
    console.log(`Vertex AI config: ${config.vertex.projectId}/${config.vertex.location}/${config.vertex.model}`);
  }
});

