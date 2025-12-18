#!/bin/bash
set -e

# Quick script to update Cloud Run services with latest images
# Use this after rebuilding Docker images with the same tag

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_ROOT"

PROJECT_ID=${GOOGLE_CLOUD_PROJECT_ID:-""}
REGION=${GOOGLE_CLOUD_REGION:-"us-east1"}

if [ -z "$PROJECT_ID" ]; then
  echo "Error: GOOGLE_CLOUD_PROJECT_ID environment variable is required"
  exit 1
fi

REPO_URL="${REGION}-docker.pkg.dev/${PROJECT_ID}/llm-sentinel"

echo "🔄 Updating Cloud Run services with latest images..."
echo "Project: $PROJECT_ID"
echo "Region: $REGION"
echo ""

# Update Gateway
echo "📦 Updating Gateway service..."
gcloud run services update sentinel-gateway \
  --image=${REPO_URL}/gateway:latest \
  --region=${REGION} \
  --project=${PROJECT_ID} \
  --quiet

# Update Analyzer
echo "📦 Updating Analyzer service..."
gcloud run services update sentinel-analyzer \
  --image=${REPO_URL}/analyzer:latest \
  --region=${REGION} \
  --project=${PROJECT_ID} \
  --quiet

# Update Frontend
echo "📦 Updating Frontend service..."
gcloud run services update sentinel-frontend \
  --image=${REPO_URL}/frontend:latest \
  --region=${REGION} \
  --project=${PROJECT_ID} \
  --quiet

echo ""
echo "✅ All Cloud Run services updated with latest images!"
echo ""
echo "💡 Note: Terraform won't detect these changes because the image tag"
echo "   (latest) hasn't changed. Use this script for quick updates, or"
echo "   use versioned tags for Terraform-managed deployments."

