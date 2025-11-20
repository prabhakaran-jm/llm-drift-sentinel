import dotenv from 'dotenv';

dotenv.config();

export interface Config {
  pubsub: {
    projectId: string;
    topicName: string;
    subscriptionName: string;
  };
  bigquery: {
    projectId: string;
    datasetId: string;
    tableId: string;
    enabled: boolean;
  };
  vertex: {
    projectId: string;
    location: string;
    embeddingModel: string;
  };
  environment: string;
}

export function loadConfig(): Config {
  return {
    pubsub: {
      projectId: process.env.GOOGLE_CLOUD_PROJECT_ID || '',
      topicName: process.env.PUBSUB_TOPIC_NAME || 'sentinel-llm-telemetry',
      subscriptionName: process.env.PUBSUB_SUBSCRIPTION_NAME || 'sentinel-analyzer-sub',
    },
    bigquery: {
      projectId: process.env.GOOGLE_CLOUD_PROJECT_ID || '',
      datasetId: process.env.BIGQUERY_DATASET_ID || 'sentinel_telemetry',
      tableId: process.env.BIGQUERY_TABLE_ID || 'llm_events',
      enabled: process.env.BIGQUERY_ENABLED !== 'false',
    },
    vertex: {
      projectId: process.env.GOOGLE_CLOUD_PROJECT_ID || '',
      location: process.env.VERTEX_EMBEDDING_LOCATION || process.env.GOOGLE_CLOUD_LOCATION || 'us-central1',
      embeddingModel: process.env.VERTEX_EMBEDDING_MODEL || 'text-embedding-004',
    },
    environment: process.env.ENVIRONMENT || 'dev',
  };
}

