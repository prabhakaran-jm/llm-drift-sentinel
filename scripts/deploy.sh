#!/bin/bash
set -e

# Deploy script for LLM Sentinel to Cloud Run
# This script builds Docker images and deploys them to Cloud Run

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# Change to project root (one level up from scripts/)
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_ROOT"

PROJECT_ID=${GOOGLE_CLOUD_PROJECT_ID:-""}
REGION=${GOOGLE_CLOUD_REGION:-"us-east1"}
ENVIRONMENT=${ENVIRONMENT:-"dev"}

if [ -z "$PROJECT_ID" ]; then
  echo "Error: GOOGLE_CLOUD_PROJECT_ID environment variable is required"
  exit 1
fi

echo "🚀 Deploying LLM Sentinel to Cloud Run"
echo "Project: $PROJECT_ID"
echo "Region: $REGION"
echo "Environment: $ENVIRONMENT"
echo ""

# Generate package-lock.json files if they don't exist
echo "📦 Checking for package-lock.json files..."
if [ ! -f "services/gateway/package-lock.json" ]; then
  echo "  Generating package-lock.json for gateway..."
  cd services/gateway && npm install --package-lock-only && cd ../..
fi

if [ ! -f "services/analyzer/package-lock.json" ]; then
  echo "  Generating package-lock.json for analyzer..."
  cd services/analyzer && npm install --package-lock-only && cd ../..
fi

if [ ! -f "web/client/package-lock.json" ]; then
  echo "  Generating package-lock.json for frontend..."
  cd web/client && npm install --package-lock-only && cd ../..
fi

# Authenticate with gcloud
echo ""
echo "📋 Authenticating with gcloud..."
gcloud auth configure-docker ${REGION}-docker.pkg.dev

# Set project
gcloud config set project $PROJECT_ID

# Repository name
REPO_NAME="llm-sentinel"
REPO_URL="${REGION}-docker.pkg.dev/${PROJECT_ID}/${REPO_NAME}"

# Ensure Artifact Registry repository exists via Terraform
echo ""
echo "📦 Ensuring Artifact Registry repository exists..."
cd infra
echo "  Applying Terraform to ensure repository exists (idempotent)..."
terraform apply -target=google_project_service.artifact_registry -target=google_artifact_registry_repository.docker_repo -auto-approve
cd ..

# Build and push Gateway image
echo ""
echo "🏗️  Building Gateway Docker image..."
docker build -f services/gateway/Dockerfile -t ${REPO_URL}/gateway:latest .
docker push ${REPO_URL}/gateway:latest

# Build and push Analyzer image
echo ""
echo "🏗️  Building Analyzer Docker image..."
docker build -f services/analyzer/Dockerfile -t ${REPO_URL}/analyzer:latest .
docker push ${REPO_URL}/analyzer:latest

# Build and push Frontend image
# Note: Gateway URL will be injected at build time
# Get gateway URL from Terraform output or set manually
GATEWAY_URL=${GATEWAY_URL:-""}
if [ -z "$GATEWAY_URL" ]; then
  echo "⚠️  Warning: GATEWAY_URL not set. Frontend will use relative API paths."
  echo "   Set GATEWAY_URL environment variable to the Gateway Cloud Run URL"
fi

echo ""
echo "🏗️  Building Frontend Docker image..."
docker build -f web/client/Dockerfile --build-arg VITE_API_URL="${GATEWAY_URL}" -t ${REPO_URL}/frontend:latest .
docker push ${REPO_URL}/frontend:latest

echo ""
echo "✅ All Docker images built and pushed successfully!"
echo ""
echo "📝 Next steps:"
echo "1. Run 'terraform apply' in the infra/ directory to deploy Cloud Run services"
echo "2. Check outputs for service URLs:"
echo "   terraform output gateway_service_url"
echo "   terraform output frontend_service_url"
echo ""

