# Datadog Keys Setup Guide

## Step 1: Create Environment File

Create a `.env` file in `services/analyzer/` directory with the following content:

```bash
# Google Cloud Configuration
GOOGLE_CLOUD_PROJECT_ID=your-project-id
GOOGLE_CLOUD_LOCATION=us-east1

# Pub/Sub Configuration
PUBSUB_TOPIC_NAME=sentinel-llm-telemetry
PUBSUB_SUBSCRIPTION_NAME=sentinel-analyzer-sub
PUBSUB_ENABLED=true

# BigQuery Configuration
BIGQUERY_DATASET_ID=sentinel_telemetry
BIGQUERY_TABLE_ID=llm_events
BIGQUERY_ENABLED=true

# Vertex AI Configuration
VERTEX_EMBEDDING_LOCATION=us-east1
VERTEX_EMBEDDING_MODEL=text-embedding-004

# Datadog Configuration
DATADOG_API_KEY=your-datadog-api-key-here
DATADOG_APP_KEY=your-datadog-app-key-here
DATADOG_SITE=datadoghq.com
DATADOG_ENABLED=true

# Environment
ENVIRONMENT=dev
```

## Step 2: Replace Placeholder Values

Replace the following in your `.env` file:

1. **DATADOG_API_KEY**: Your actual API key (the one you just created)
2. **DATADOG_APP_KEY**: Your actual Application key (the one you just created)
3. **DATADOG_SITE**: Should be `datadoghq.com` for US1-East region
4. **GOOGLE_CLOUD_PROJECT_ID**: Your GCP project ID (if you have one)

## Step 3: Security Note

⚠️ **Important**: The `.env` file is in `.gitignore` and should NEVER be committed to git. It contains sensitive credentials.

## Step 4: Verify Configuration

After creating the `.env` file, you can test it by running:

```bash
cd services/analyzer
npm run dev
```

The analyzer should start and connect to Datadog (if other services are configured).

