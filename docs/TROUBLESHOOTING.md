# Troubleshooting Guide

This guide covers common issues and their solutions.

## Table of Contents

1. [Vertex AI Model Errors (404)](#vertex-ai-model-errors-404)
2. [Frontend "Failed to fetch" Errors](#frontend-failed-to-fetch-errors)
3. [Service Account Permissions](#service-account-permissions)
4. [Deployment Issues](#deployment-issues)

---

## Vertex AI Model Errors (404)

### Error Message
```
Publisher Model 'projects/.../models/gemini-2.0-flash' was not found or your project does not have access to it.
```

### Common Causes

1. **Model Name Format** - Vertex AI requires specific model version format
2. **Region Availability** - Model may not be available in your region
3. **API Not Enabled** - Vertex AI API may not be enabled
4. **Project Access** - Project may not have access to the model
5. **Billing Not Enabled** - Billing account may not be linked

### Solutions

#### Solution 1: Verify Vertex AI API is Enabled

```bash
# Check if enabled
gcloud services list --enabled --project=YOUR_PROJECT_ID | grep aiplatform

# Enable if not enabled
gcloud services enable aiplatform.googleapis.com --project=YOUR_PROJECT_ID
```

Or use Terraform:
```bash
cd infra
terraform apply -target=google_project_service.vertex_ai
```

#### Solution 2: Use Correct Model Name

The system defaults to `gemini-2.0-flash` and automatically tries variants. If you need to change it:

```bash
# In Cloud Run environment variables or .env file
VERTEX_MODEL=gemini-2.0-flash
```

**Available Models:**
- `gemini-2.0-flash` (default, recommended)
- `gemini-1.5-pro`
- `gemini-1.5-flash`
- `gemini-1.0-pro`

**Note:** The VertexClient automatically tries multiple variants:
1. Short name: `gemini-2.0-flash`
2. Versioned: `gemini-2.0-flash-001` (if available)
3. Fallback: `gemini-1.5-pro` if 2.0-flash fails

#### Solution 3: Verify Region Configuration

Vertex AI models must use `us-central1`:

```bash
# For Gateway
VERTEX_LOCATION=us-central1

# For Analyzer
VERTEX_EMBEDDING_LOCATION=us-central1

# Note: GOOGLE_CLOUD_LOCATION can remain us-east1 for other GCP resources
```

#### Solution 4: Check Service Account Permissions

See [Service Account Permissions](#service-account-permissions) section below.

#### Solution 5: Verify Billing

```bash
# Check billing status
gcloud billing projects describe YOUR_PROJECT_ID

# If no billing account linked:
gcloud billing projects link YOUR_PROJECT_ID --billing-account=BILLING_ACCOUNT_ID
```

#### Solution 6: Use Stub Mode for Testing

If you just need to test the system without Vertex AI:

```bash
# Set in Cloud Run environment variables
USE_STUB=true
```

This will use mock responses instead of real Vertex AI calls.

### Quick Fix Checklist

1. ✅ Enable Vertex AI API: `gcloud services enable aiplatform.googleapis.com --project=YOUR_PROJECT_ID`
2. ✅ Verify billing is enabled
3. ✅ Check service account has `roles/aiplatform.user` role
4. ✅ Verify `VERTEX_LOCATION=us-central1` is set
5. ✅ Rebuild and redeploy: `./scripts/deploy.sh && ./scripts/update-cloud-run.sh`

---

## Frontend "Failed to fetch" Errors

### Error Message
```
Error: Failed to fetch
Network error: Cannot reach Gateway API at ...
```

### Common Causes

1. **Gateway URL not configured** - Frontend doesn't know where to send requests
2. **Gateway service not running** - The Cloud Run service is down or not accessible
3. **CORS issues** - Browser blocking cross-origin requests
4. **Network connectivity** - Firewall or network issues

### Solutions

#### Solution 1: Check Gateway URL Configuration

**Method 1: Check Network Tab (Recommended)**
1. Open Browser DevTools (F12)
2. Go to **Network** tab
3. Try sending a message
4. Look for the `/api/chat` request
5. Check the **Request URL** column

**Expected:** Should show the Gateway Cloud Run URL (e.g., `https://sentinel-gateway-xxxxx-uc.a.run.app/api/chat`)

**If shows relative path like `/api/chat`:**
- The frontend was built without the Gateway URL
- Rebuild the frontend with the correct URL

#### Solution 2: Verify Gateway Service is Running

```bash
# Get Gateway URL from Terraform
cd infra
terraform output gateway_service_url

# Test Gateway health endpoint
curl $(terraform output -raw gateway_service_url)/health/liveness
```

**Expected:** Should return `{"status":"alive","timestamp":"..."}`

**If it fails:**
- Gateway service may not be deployed
- Check Cloud Run console: https://console.cloud.google.com/run

#### Solution 3: Rebuild Frontend with Gateway URL

```bash
# Get Gateway URL
cd infra
GATEWAY_URL=$(terraform output -raw gateway_service_url)
cd ..

# Rebuild frontend with Gateway URL
./scripts/deploy.sh

# Update Cloud Run service
./scripts/update-cloud-run.sh
```

#### Solution 4: Check CORS Configuration

The Gateway should allow CORS. Verify the Gateway code includes:

```typescript
app.use(cors({
  origin: true, // Allow all origins
  credentials: true,
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
```

**If CORS errors in browser console:**
- Check Gateway logs for CORS-related errors
- Verify Gateway code is deployed with latest changes

#### Solution 5: Test API Endpoint Directly

```bash
# Get Gateway URL
GATEWAY_URL=$(cd infra && terraform output -raw gateway_service_url)

# Test chat endpoint
curl -X POST "${GATEWAY_URL}/api/chat" \
  -H "Content-Type: application/json" \
  -d '{"message":"Hello"}'
```

**Expected:** Should return a JSON response with `response`, `requestId`, etc.

**If it fails:**
- Gateway may have internal errors (check logs)
- Service account permissions may be missing

### Quick Fix Checklist

1. ✅ Verify Gateway is deployed: `gcloud run services list --region=us-east1`
2. ✅ Get Gateway URL: `cd infra && terraform output gateway_service_url`
3. ✅ Rebuild frontend: `./scripts/deploy.sh`
4. ✅ Update Cloud Run: `./scripts/update-cloud-run.sh`
5. ✅ Test Gateway health: `curl GATEWAY_URL/health/liveness`

---

## Service Account Permissions

### Required Roles

**Gateway Service Account:**
- `roles/aiplatform.user` (for Vertex AI)
- `roles/pubsub.publisher` (for telemetry)

**Analyzer Service Account:**
- `roles/aiplatform.user` (for Vertex AI embeddings)
- `roles/pubsub.subscriber` (for Pub/Sub)
- `roles/bigquery.dataEditor` (for BigQuery)
- `roles/bigquery.jobUser` (for BigQuery jobs)

### Verify Permissions

```bash
# Check Gateway service account
gcloud run services describe sentinel-gateway \
  --region=us-east1 \
  --project=YOUR_PROJECT_ID \
  --format="value(spec.template.spec.serviceAccountName)"

# Check IAM policy
gcloud projects get-iam-policy YOUR_PROJECT_ID \
  --flatten="bindings[].members" \
  --filter="bindings.members:*sentinel-gateway*"
```

### Add Missing Permissions

Terraform should automatically set these, but if needed:

```bash
# Get service account email
SERVICE_ACCOUNT=$(gcloud run services describe sentinel-gateway \
  --region=us-east1 \
  --project=YOUR_PROJECT_ID \
  --format="value(spec.template.spec.serviceAccountName)")

# Add Vertex AI User role
gcloud projects add-iam-policy-binding YOUR_PROJECT_ID \
  --member="serviceAccount:${SERVICE_ACCOUNT}" \
  --role="roles/aiplatform.user"
```

---

## Deployment Issues

### Terraform Not Detecting Image Changes

If `terraform apply` doesn't detect changes after rebuilding images:

**Cause:** Terraform tracks image *references* (tags), not image *content*. Rebuilding with the same `:latest` tag doesn't change the reference.

**Solution:** Use the update script instead:

```bash
./scripts/update-cloud-run.sh
```

This directly forces Cloud Run to pull the latest image, even with the `:latest` tag.

Use `scripts/update-cloud-run.sh` to force Cloud Run to pull the latest image, even with the `:latest` tag.

### Verify Deployment

```bash
# Check service status
gcloud run services list --region=us-east1 --project=YOUR_PROJECT_ID

# Check logs
gcloud run services logs read sentinel-gateway \
  --region=us-east1 \
  --project=YOUR_PROJECT_ID \
  --limit=50
```

---

## Additional Resources

- [Vertex AI Model Versions](https://cloud.google.com/vertex-ai/generative-ai/docs/learn/model-versions)
- [Model Availability by Region](https://cloud.google.com/vertex-ai/generative-ai/docs/learn/models)
- [Vertex AI API Documentation](https://cloud.google.com/vertex-ai/docs)
- [Cloud Run Troubleshooting](https://cloud.google.com/run/docs/troubleshooting)

