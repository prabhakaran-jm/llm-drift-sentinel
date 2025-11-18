import dotenv from 'dotenv';

dotenv.config();

export interface Config {
  port: number;
  useStub: boolean;
  environment: string;
  vertex: {
    projectId: string;
    location: string;
    model: string;
  };
  pubsub: {
    projectId: string;
    topicName: string;
    enabled: boolean;
  };
}

export function loadConfig(): Config {
  return {
    port: parseInt(process.env.PORT || '3000', 10),
    useStub: process.env.USE_STUB === 'true',
    environment: process.env.ENVIRONMENT || 'dev',
    vertex: {
      projectId: process.env.GOOGLE_CLOUD_PROJECT_ID || '',
      location: process.env.GOOGLE_CLOUD_LOCATION || 'us-central1',
      model: process.env.VERTEX_MODEL || 'gemini-1.5-pro',
    },
    pubsub: {
      projectId: process.env.GOOGLE_CLOUD_PROJECT_ID || '',
      topicName: process.env.PUBSUB_TOPIC_NAME || 'sentinel-llm-telemetry',
      enabled: process.env.PUBSUB_ENABLED !== 'false',
    },
  };
}

