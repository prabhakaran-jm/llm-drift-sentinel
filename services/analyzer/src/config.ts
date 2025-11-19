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
    environment: process.env.ENVIRONMENT || 'dev',
  };
}

