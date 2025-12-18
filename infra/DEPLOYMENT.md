# Cloud Run Deployment Guide

This guide explains how to deploy the LLM Sentinel application to Google Cloud Run using Terraform.

## Prerequisites

1. **Google Cloud Project** with billing enabled
2. **gcloud CLI** installed and authenticated
3. **Docker** installed
4. **Terraform** >= 1.5.0 installed
5. **Required APIs enabled** (Terraform will enable these automatically):
   - Cloud Run API
   - Artifact Registry API
   - Vertex AI API
   - Pub/Sub API
   - BigQuery API

## Deployment Steps

### 1. Configure Terraform Variables

Copy the example terraform.tfvars file and fill in your values:

```bash
cd infra
cp terraform.tfvars.example terraform.tfvars
```

Edit `terraform.tfvars`:
```hcl
project_id = "your-gcp-project-id"
region     = "us-east1"
environment = "dev"
```

### 2. Initialize Terraform

```bash
cd infra
terraform init
```

If using a GCS backend, configure it:
```bash
terraform init -backend-config=backend.tfvars
```

### 3. Ensure Infrastructure is Created

The deploy script will automatically ensure the Artifact Registry repository exists via Terraform (idempotent). You can also run Terraform manually:

```bash
cd infra
terraform apply -target=google_project_service.artifact_registry -target=google_artifact_registry_repository.docker_repo
```

**Note:** If you've already created the repository manually, import it into Terraform state first:
```bash
terraform import google_artifact_registry_repository.docker_repo projects/YOUR_PROJECT_ID/locations/YOUR_REGION/repositories/llm-sentinel
```

### 4. Build and Push Docker Images

**Important:** The frontend needs the Gateway URL at build time. You have two options:

**Option A: Use deployment script (recommended)**

The deployment script (`scripts/deploy.sh`) will:
1. Generate package-lock.json files if missing
2. Create Artifact Registry repository via Terraform (if needed)
3. Build and push all Docker images

```bash
# Set environment variables
export GOOGLE_CLOUD_PROJECT_ID="your-gcp-project-id"
export GOOGLE_CLOUD_REGION="us-east1"
export ENVIRONMENT="dev"

# Run deployment script
chmod +x scripts/deploy.sh
./scripts/deploy.sh
```

**Option B: Two-step deployment (if Gateway URL needed for frontend)**

1. **First, deploy Gateway and Analyzer:**
   ```bash
   # Build and push Gateway
   cd services/gateway
   docker build -t us-east1-docker.pkg.dev/YOUR_PROJECT_ID/llm-sentinel/gateway:latest .
   docker push us-east1-docker.pkg.dev/YOUR_PROJECT_ID/llm-sentinel/gateway:latest
   cd ../..
   
   # Build and push Analyzer
   cd services/analyzer
   docker build -t us-east1-docker.pkg.dev/YOUR_PROJECT_ID/llm-sentinel/analyzer:latest .
   docker push us-east1-docker.pkg.dev/YOUR_PROJECT_ID/llm-sentinel/analyzer:latest
   cd ../..
   ```

2. **Deploy Gateway and Analyzer with Terraform:**
   ```bash
   cd infra
   terraform apply -target=google_cloud_run_service.gateway -target=google_cloud_run_service.analyzer
   ```

3. **Get Gateway URL and build Frontend:**
   ```bash
   GATEWAY_URL=$(terraform output -raw gateway_service_url)
   cd web/client
   docker build --build-arg VITE_API_URL="${GATEWAY_URL}" -t us-east1-docker.pkg.dev/YOUR_PROJECT_ID/llm-sentinel/frontend:latest .
   docker push us-east1-docker.pkg.dev/YOUR_PROJECT_ID/llm-sentinel/frontend:latest
   cd ../..
   ```

4. **Deploy Frontend:**
   ```bash
   cd infra
   terraform apply -target=google_cloud_run_service.frontend
   ```

**Option B: Use deployment script (after Gateway is deployed)**

```bash
# Set environment variables
export GOOGLE_CLOUD_PROJECT_ID="your-gcp-project-id"
export GOOGLE_CLOUD_REGION="us-east1"
export ENVIRONMENT="dev"

# Get Gateway URL (after first deployment)
export GATEWAY_URL="https://sentinel-gateway-xxxxx-uc.a.run.app"

# Make script executable
chmod +x scripts/deploy.sh

# Run deployment script
./scripts/deploy.sh
```

**Option B: Manual build and push**

```bash
# Authenticate Docker with Artifact Registry
gcloud auth configure-docker us-east1-docker.pkg.dev

# Set project
gcloud config set project YOUR_PROJECT_ID

# Build and push Gateway
cd services/gateway
docker build -t us-east1-docker.pkg.dev/YOUR_PROJECT_ID/llm-sentinel/gateway:latest .
docker push us-east1-docker.pkg.dev/YOUR_PROJECT_ID/llm-sentinel/gateway:latest
cd ../..

# Build and push Analyzer
cd services/analyzer
docker build -t us-east1-docker.pkg.dev/YOUR_PROJECT_ID/llm-sentinel/analyzer:latest .
docker push us-east1-docker.pkg.dev/YOUR_PROJECT_ID/llm-sentinel/analyzer:latest
cd ../..

# Build and push Frontend
cd web/client
docker build -t us-east1-docker.pkg.dev/YOUR_PROJECT_ID/llm-sentinel/frontend:latest .
docker push us-east1-docker.pkg.dev/YOUR_PROJECT_ID/llm-sentinel/frontend:latest
cd ../..
```

### 4. Apply Terraform Configuration

```bash
cd infra
terraform plan  # Review changes
terraform apply # Deploy infrastructure
```

This will create:
- Artifact Registry repository
- Service accounts with proper IAM roles
- Cloud Run services for Gateway, Analyzer, and Frontend
- Public access permissions

### 5. Get Service URLs

After deployment, get the service URLs:

```bash
terraform output gateway_service_url
terraform output analyzer_service_url
terraform output frontend_service_url
```

### 6. Configure Frontend API Endpoint

The frontend needs to know the Gateway URL. Update the frontend code to use the gateway URL:

**Option A: Update vite.config.ts for build-time configuration**

Create a `.env.production` file in `web/client/`:
```
VITE_API_URL=https://sentinel-gateway-xxxxx-uc.a.run.app
```

Then update `vite.config.ts` to use this:
```typescript
export default defineConfig({
  plugins: [react()],
  define: {
    'import.meta.env.VITE_API_URL': JSON.stringify(process.env.VITE_API_URL || ''),
  },
})
```

**Option B: Use environment variable in Cloud Run**

The frontend Dockerfile can be updated to accept a `VITE_API_URL` environment variable and inject it at runtime.

### 7. Test the Deployment

1. **Test Gateway:**
   ```bash
   curl https://YOUR_GATEWAY_URL/health
   ```

2. **Test Frontend:**
   Open the frontend URL in a browser and verify it loads.

3. **Test End-to-End:**
   Send a chat message through the frontend and verify:
   - Request reaches Gateway
   - Response is returned
   - Telemetry is published to Pub/Sub
   - Analyzer processes the message

## Environment Variables

### Gateway Service
- `PORT`: 8080 (required by Cloud Run)
- `ENVIRONMENT`: dev/staging/prod
- `GOOGLE_CLOUD_PROJECT_ID`: GCP Project ID
- `GOOGLE_CLOUD_LOCATION`: GCP Region
- `VERTEX_MODEL`: Model name (default: gemini-1.5-pro)
- `PUBSUB_TOPIC_NAME`: Pub/Sub topic name
- `PUBSUB_ENABLED`: true/false
- `USE_STUB`: false (set to true for testing)

### Analyzer Service
- `ENVIRONMENT`: dev/staging/prod
- `GOOGLE_CLOUD_PROJECT_ID`: GCP Project ID
- `GOOGLE_CLOUD_LOCATION`: GCP Region
- `PUBSUB_TOPIC_NAME`: Pub/Sub topic name
- `PUBSUB_SUBSCRIPTION_NAME`: Pub/Sub subscription name
- `BIGQUERY_DATASET_ID`: BigQuery dataset ID
- `BIGQUERY_TABLE_ID`: BigQuery table ID
- `BIGQUERY_BASELINE_TABLE_ID`: BigQuery baseline table ID
- `BIGQUERY_ENABLED`: true/false
- `VERTEX_EMBEDDING_LOCATION`: GCP Region
- `VERTEX_EMBEDDING_MODEL`: Embedding model name
- `DATADOG_API_KEY`: (optional) Datadog API key
- `DATADOG_APP_KEY`: (optional) Datadog App key
- `DATADOG_SITE`: (optional) Datadog site
- `DATADOG_ENABLED`: (optional) true/false

## Updating Services

To update a service after code changes:

1. **Rebuild and push the Docker image:**
   ```bash
   cd services/gateway  # or analyzer, or web/client
   docker build -t us-east1-docker.pkg.dev/YOUR_PROJECT_ID/llm-sentinel/SERVICE_NAME:latest .
   docker push us-east1-docker.pkg.dev/YOUR_PROJECT_ID/llm-sentinel/SERVICE_NAME:latest
   ```

2. **Update Cloud Run service:**
   ```bash
   gcloud run services update SERVICE_NAME \
     --image us-east1-docker.pkg.dev/YOUR_PROJECT_ID/llm-sentinel/SERVICE_NAME:latest \
     --region us-east1
   ```

Or use Terraform:
```bash
cd infra
terraform apply
```

## Troubleshooting

### Service won't start
- Check Cloud Run logs: `gcloud run services logs read SERVICE_NAME --region us-east1`
- Verify environment variables are set correctly
- Check service account permissions

### 403 Forbidden errors
- Verify IAM roles are assigned to service accounts
- Check that APIs are enabled

### Image pull errors
- Verify Docker images are pushed to Artifact Registry
- Check image path matches Terraform configuration

### Frontend can't reach Gateway
- Verify Gateway URL is correct
- Check CORS settings in Gateway
- Verify Gateway service is publicly accessible

## Cleanup

To destroy all resources:

```bash
cd infra
terraform destroy
```

**Warning:** This will delete all resources including:
- Cloud Run services
- Service accounts
- Artifact Registry repository
- Pub/Sub topics and subscriptions
- BigQuery tables and datasets

Make sure to backup any important data before destroying.

