# LLM Drift & Abuse Sentinel

Monitor LLM applications on Vertex AI / Gemini. Detect drift and abuse, push metrics to Datadog.

## Architecture

- Web React client → Sentinel Gateway (Cloud Run) → Vertex AI / Gemini
- Gateway emits telemetry events for each LLM call
- Telemetry flows to Pub/Sub and BigQuery
- Sentinel Analyzer consumes telemetry, computes drift and safety signals
- Analyzer sends metrics and events to Datadog

## Tech Stack

- **Backend**: TypeScript, Express, Vertex AI SDK
- **Frontend**: React + Vite
- **Infrastructure**: Google Cloud (Cloud Run, Pub/Sub, BigQuery)
- **Monitoring**: Datadog

## Getting Started

### Prerequisites

- Node.js 18+
- Google Cloud account
- Google Cloud credentials configured (`gcloud auth application-default login`)
- Terraform (optional, for IaC) - https://www.terraform.io/downloads

### Setup

1. Install dependencies:
```bash
npm install
cd services/gateway
npm install
```

2. Configure gateway:

Create `.env` file in `services/gateway/`:
```bash
PORT=3000
GOOGLE_CLOUD_PROJECT_ID=your-project-id
GOOGLE_CLOUD_LOCATION=us-central1
VERTEX_MODEL=gemini-1.5-pro
# Note: gemini-2.5-pro is available in europe-west4
USE_STUB=true
ENVIRONMENT=dev
# Telemetry (Phase 2)
PUBSUB_TOPIC_NAME=sentinel-llm-telemetry
PUBSUB_ENABLED=true
```

**Stub Mode**: Set `USE_STUB=true` to test without Vertex AI enabled. This returns mock responses.

**Real Vertex AI**: Set `USE_STUB=false` and ensure:
- APIs are enabled (use Terraform in `infra/` or enable manually)
- You've run `gcloud auth application-default login`
- Your project ID is correct
- Use a supported region: `us-central1` (recommended), `europe-west4` (for gemini-2.5-pro), or check [Gemini availability](https://cloud.google.com/vertex-ai/generative-ai/docs/learn/models)
- Use a valid model name: `gemini-2.5-pro`, `gemini-1.5-pro`, `gemini-1.5-flash`, or `gemini-1.0-pro`

3. Start gateway:
```bash
cd services/gateway
npm run dev
```

### Testing

Test the chat endpoint:

```bash
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "Hello, how are you?"}'
```

Check health:
```bash
curl http://localhost:3000/health
```

**If you get a 403 error**: 
- Use Terraform: `cd infra && terraform apply` (see `infra/README.md`)
- Or enable manually: https://console.cloud.google.com/apis/library/aiplatform.googleapis.com

## Project Structure

```
.
├── services/
│   ├── gateway/          # Express API for /api/chat
│   └── analyzer/          # Worker service (coming soon)
├── web/
│   └── client/           # React frontend (coming soon)
└── infra/                # Terraform IaC for GCP resources
```

## Infrastructure Setup

Enable required Google Cloud APIs using Terraform:

```bash
cd infra
cp terraform.tfvars.example terraform.tfvars
# Edit terraform.tfvars with your project_id
terraform init
terraform plan
terraform apply
```

See `infra/README.md` for details.

## Development Phases

- **Phase 1**: Gateway with real Vertex AI calls ✅
- **Infra**: Terraform IaC for APIs ✅
- **Phase 2**: Telemetry pipeline (Pub/Sub → BigQuery) ✅
- **Phase 3**: Analyzer as Pub/Sub consumer
- **Phase 4**: Drift engine with embeddings
- **Phase 5**: Safety and abuse engine
- **Phase 6**: Datadog metrics and monitors
- **Phase 7**: Frontend polish

## Phase 2: Telemetry Pipeline

After deploying infrastructure with Terraform, the gateway automatically emits telemetry events to Pub/Sub:

**Telemetry includes:**
- Request/response data (prompt, response text)
- Token usage (input, output, total)
- Latency metrics
- Model information
- Error tracking
- Request IDs for tracing

**To deploy infrastructure:**
```bash
cd infra
terraform apply
```

**To verify telemetry:**
- Check Pub/Sub topic: `sentinel-llm-telemetry`
- Query BigQuery: `sentinel_telemetry.llm_events`
- Each API call emits a telemetry event automatically

