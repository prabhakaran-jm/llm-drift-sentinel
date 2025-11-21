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
- **Phase 3**: Analyzer as Pub/Sub consumer ✅
- **Phase 4**: Drift engine with embeddings ✅
- **Phase 5**: Safety and abuse engine ✅
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

## Phase 3: Analyzer Service

The analyzer service consumes telemetry events from Pub/Sub and processes them:

**Features:**
- Subscribes to Pub/Sub topic `sentinel-llm-telemetry`
- Parses TelemetryEvent messages
- Runs drift detection (placeholder - Phase 4)
- Runs safety checks (placeholder - Phase 5)
- Writes events to BigQuery for storage

**To run analyzer:**
```bash
cd services/analyzer
npm install
# Set up .env with GOOGLE_CLOUD_PROJECT_ID, PUBSUB_SUBSCRIPTION_NAME, etc.
npm run dev
```

**Analyzer processes:**
- Reads messages from Pub/Sub subscription
- Computes drift scores using embeddings (Phase 4)
- Checks safety labels (placeholder with keyword detection)
- Writes to BigQuery table
- Acknowledges messages after processing

## Phase 4: Drift Engine with Embeddings

The drift engine uses Vertex AI embeddings to detect response drift:

**How it works:**
1. Gets embedding for each response using Vertex AI
2. Maintains baseline embeddings per endpoint (in-memory)
3. Calculates cosine similarity between response and baseline
4. Computes drift score (1 - similarity)
5. Updates baseline with exponential moving average

**Features:**
- Real embeddings from Vertex AI (`textembedding-gecko@003`)
- Baseline storage (in-memory, keyed by endpoint)
- Cosine similarity calculation
- Automatic baseline creation and updates
- Handles errors gracefully

**Configuration:**
- `VERTEX_EMBEDDING_MODEL`: Embedding model (default: `text-embedding-004`)
- `VERTEX_EMBEDDING_LOCATION`: Embedding region (default: `us-central1`)

**Drift scores:**
- `similarityScore`: 0-1 (1 = identical to baseline)
- `driftScore`: 0-1 (0 = no drift, 1 = maximum drift)
- `baselineReady`: Whether baseline has enough samples (5+)

## Phase 5: Safety and Abuse Engine

The safety engine uses Vertex AI Gemini to classify prompts and responses for safety issues:

**Safety Labels:**
- `CLEAN`: Normal, safe interaction
- `TOXIC`: Contains hate speech, harassment, or offensive content
- `PII`: Contains personally identifiable information
- `JAILBREAK`: Attempts to bypass safety guidelines
- `PROMPT_INJECTION`: Attempts to inject malicious instructions
- `RISKY`: Potentially harmful but not clearly categorized

**How it works:**
1. Uses Gemini (gemini-1.5-flash) to classify prompt + response
2. Returns safety label and score (0-1, where 1 = safe)
3. Detects high-risk interactions (score < 0.5 or high-risk labels)
4. Falls back to keyword-based detection if classification fails

**Safety scores:**
- `safetyScore`: 0-1 (1 = completely safe, 0 = unsafe)
- `safetyLabel`: One of the safety categories
- `isHighRisk`: Boolean indicating if interaction is high risk
- `details`: Explanation of the classification

**High-risk detection:**
- Labels: TOXIC, JAILBREAK, PROMPT_INJECTION
- Score threshold: < 0.5
- Triggers alerts (Phase 6: Datadog events)

