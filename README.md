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
cd services/gateway && npm install
cd ../analyzer && npm install
cd ../../web/client && npm install
```

2. Configure gateway:

Create `.env` file in `services/gateway/`:
```bash
PORT=3000
GOOGLE_CLOUD_PROJECT_ID=your-project-id
GOOGLE_CLOUD_LOCATION=us-east1
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
- Use a supported region: `us-east1`, `us-central1`, `europe-west4` (for gemini-2.5-pro), or check [Gemini availability](https://cloud.google.com/vertex-ai/generative-ai/docs/learn/models)
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
│   └── analyzer/         # Worker service for drift/safety analysis
├── web/
│   └── client/           # React frontend with chat interface
├── infra/                # Terraform IaC for GCP resources
├── datadog/              # Datadog configurations
│   ├── monitors/         # Monitor JSON exports
│   └── dashboards/       # Dashboard JSON exports
├── scripts/              # Utility scripts
│   └── traffic-generator.ts  # Traffic generator for testing
└── docs/                 # Documentation
    ├── OBSERVABILITY_STRATEGY.md
    ├── DETECTION_RULES.md
    └── INCIDENT_EXAMPLE.md
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
- **Phase 6**: Datadog metrics, monitors, dashboard, and traffic generator ✅
- **Phase 7**: Frontend polish ✅

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
- `VERTEX_EMBEDDING_LOCATION`: Embedding region (default: `us-east1`)

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
- Triggers Datadog events for alerting

## Phase 6: Datadog Metrics and Monitors

The analyzer emits comprehensive metrics to Datadog for monitoring and alerting:

**Core LLM Metrics:**
- `llm.request.count` - Total requests
- `llm.error.count` - Failed requests
- `llm.latency_ms` - Request latency
- `llm.tokens.input` - Input tokens
- `llm.tokens.output` - Output tokens
- `llm.tokens.total` - Total tokens
- `llm.cost_usd` - Estimated cost

**Drift Metrics:**
- `llm.drift_score` - Drift score (0-1)
- `llm.similarity_score` - Similarity to baseline (0-1)
- `llm.drift.count` - Count of significant drift events

**Safety Metrics:**
- `llm.safety.score` - Safety score (0-1)
- `llm.safety.event.count` - Safety events by label

**Service Metrics:**
- `sentinel.analyzer.events_processed` - Events processed

**Tags Applied:**
- `env`, `service`, `endpoint`, `method`
- `model`, `model_version`, `status`
- `safety_label`, `baseline_ready`, `drift_threshold`

**Events:**
- High-risk safety issues trigger Datadog events
- Alert type: `error` (score < 0.3) or `warning` (score < 0.5)

**Configuration:**
Add to analyzer `.env`:
```bash
DATADOG_API_KEY=your-api-key
DATADOG_APP_KEY=your-app-key  # Optional - only needed for some admin operations
DATADOG_SITE=datadoghq.com  # or datadoghq.eu, us3.datadoghq.com, etc.
DATADOG_ENABLED=true
```

**To disable Datadog:**
- Set `DATADOG_ENABLED=false` or omit `DATADOG_API_KEY`

**Getting Datadog API Keys:**
1. Go to https://app.datadoghq.com/organization-settings/api-keys
2. Create a new API key (or use an existing one)
3. Optionally create an Application Key for admin operations: https://app.datadoghq.com/organization-settings/application-keys

### Datadog Configuration

**Organization**: LLM Sentinel  
**Organization URL**: https://app.datadoghq.com/organization-settings  
**Trial Period**: Started December 2025 (14-day trial)

> **Note**: Your Datadog organization is configured and ready to use. API keys should be added to `services/analyzer/.env`.

### Detection Rules (Monitors)

We've configured **5 monitors** in Datadog for comprehensive alerting:

1. **LLM High Error Rate Alert** (`datadog/monitors/llm-high-error-rate.json`)
   - Detects: > 10 errors in 5 minutes
   - Priority: Critical (P1)
   - Action: Check gateway logs, verify Vertex AI status

2. **LLM High Latency Warning** (`datadog/monitors/llm-high-latency.json`)
   - Detects: Average latency > 5 seconds over 10 minutes
   - Priority: Warning (P2)
   - Action: Review model selection, check network connectivity

3. **LLM Drift Detection Alert** (`datadog/monitors/llm-drift-detection.json`)
   - Detects: Average drift score > 0.2 over 15 minutes
   - Priority: Warning (P2)
   - Action: Review prompts, check model version changes

4. **LLM Safety Score Critical** (`datadog/monitors/llm-safety-score-critical.json`)
   - Detects: Average safety score < 0.5 over 5 minutes
   - Priority: Critical (P1)
   - Action: Review safety events, implement filters

5. **LLM Availability SLO** (`datadog/monitors/llm-availability-slo.json`)
   - Tracks: 99% availability over 30-day rolling window
   - Priority: Warning (P2)
   - Action: Review error rate, check service status

**Importing Monitors:**

1. **Via UI**:
   - Go to Datadog → Monitors → New Monitor
   - Select "Import from JSON"
   - Paste contents of monitor JSON file from `datadog/monitors/`
   - Configure notification channels
   - Save

2. **Via API**:
   ```bash
   curl -X POST "https://api.datadoghq.com/api/v1/monitor" \
     -H "Content-Type: application/json" \
     -H "DD-API-KEY: ${DD_API_KEY}" \
     -H "DD-APPLICATION-KEY: ${DD_APP_KEY}" \
     -d @datadog/monitors/llm-high-error-rate.json
   ```

See `docs/DETECTION_RULES.md` for detailed monitor documentation.

### Dashboard

The **LLM Sentinel - Application Health Overview** dashboard provides comprehensive visibility:

**Widgets:**
- Request rate & error rate graphs
- Latency percentiles (p50, p95, p99)
- Token usage over time (input/output/total)
- Cost tracking (USD per second)
- Drift score trends with thresholds
- Safety score distribution with thresholds
- Key metrics (total requests, error rate, avg latency, drift, safety)
- Top lists (safety events by label, requests by model)
- Active alerts status
- Safety events stream

**Importing Dashboard:**

1. **Via UI**:
   - Go to Datadog → Dashboards → New Dashboard
   - Select "Import from JSON"
   - Paste contents of `datadog/dashboards/llm-sentinel-overview.json`
   - Save

2. **Via API**:
   ```bash
   curl -X POST "https://api.datadoghq.com/api/v1/dashboard" \
     -H "Content-Type: application/json" \
     -H "DD-API-KEY: ${DD_API_KEY}" \
     -H "DD-APPLICATION-KEY: ${DD_APP_KEY}" \
     -d @datadog/dashboards/llm-sentinel-overview.json
   ```

### Traffic Generator

A configurable traffic generator script is available for testing detection rules and generating load:

**Location**: `scripts/traffic-generator.ts`

**Features:**
- Configurable duration and request rate
- Mix of prompt types (normal, toxic, jailbreak, PII, repetitive)
- Concurrent requests for load testing
- Progress logging and statistics

**Usage:**

1. Install dependencies:
   ```bash
   cd scripts
   npm install
   ```

2. Run traffic generator:
   ```bash
   npm run traffic:generate -- --duration=5m --rate=10/s --toxic=20%
   ```

**Options:**
- `--duration=DURATION`: Duration (e.g., `5m`, `30s`, `1h`). Default: `5m`
- `--rate=RATE`: Request rate (e.g., `10/s`, `5/m`). Default: `10/s`
- `--concurrent=N`: Number of concurrent requests. Default: `1`
- `--normal=PERCENT`: Percentage of normal prompts (e.g., `60%`). Default: `60%`
- `--toxic=PERCENT`: Percentage of toxic prompts (e.g., `20%`). Default: `10%`
- `--jailbreak=PERCENT`: Percentage of jailbreak prompts. Default: `10%`
- `--pii=PERCENT`: Percentage of PII prompts. Default: `10%`
- `--repetitive=PERCENT`: Percentage of repetitive prompts. Default: `10%`
- `--verbose, -v`: Enable verbose logging
- `--help, -h`: Show help message

**Environment Variables:**
- `GATEWAY_URL`: Gateway URL (default: `http://localhost:3000`)

**Examples:**
```bash
# Test error rate monitor
npm run traffic:generate -- --duration=5m --rate=20/s --concurrent=5

# Test safety monitor
npm run traffic:generate -- --duration=2m --rate=10/s --toxic=50%

# Test drift monitor
npm run traffic:generate -- --duration=10m --rate=5/s --repetitive=100%

# Normal traffic mix
npm run traffic:generate -- --duration=10m --rate=10/s --normal=100%
```

**Output:**
The script displays:
- Configuration summary
- Real-time progress (if verbose)
- Final statistics:
  - Total requests
  - Success/error counts and percentages
  - Latency statistics (average, p50, p95, p99)

### Incident Management

When detection rules fire, they create Datadog events that can trigger incident creation:

1. **Monitor Triggers**: Alert fires based on threshold
2. **Event Created**: Datadog event with context and recommended actions
3. **Incident Created**: Configure webhook to create incidents from alerts
4. **Investigation**: Engineers review dashboard, events, and BigQuery
5. **Resolution**: Update status and document root cause

See `docs/INCIDENT_EXAMPLE.md` for detailed incident workflow examples.

### Observability Strategy

For a comprehensive overview of our observability approach, see:
- `docs/OBSERVABILITY_STRATEGY.md` - Overall strategy and architecture
- `docs/DETECTION_RULES.md` - Detailed monitor documentation
- `docs/INCIDENT_EXAMPLE.md` - Incident management examples

## Phase 7: Frontend Polish

A modern React frontend provides a beautiful chat interface for interacting with the LLM:

**Features:**
- **Chat Interface**: Clean, modern UI for sending messages and viewing responses
- **Real-time Status**: Health check display showing gateway connection status
- **Message History**: Persistent conversation history with timestamps
- **Token Information**: Display of token usage (input/output) and model information
- **Error Handling**: User-friendly error messages and retry capabilities
- **Responsive Design**: Works seamlessly on desktop and mobile devices
- **Loading States**: Visual feedback during API calls

**Tech Stack:**
- React 18 with TypeScript
- Vite for fast development and building
- Modern CSS with gradients and animations
- Proxy configuration for seamless API integration

**To run the frontend:**

1. Install dependencies (if not already done):
```bash
npm install
cd web/client
npm install
```

2. Start the frontend (from project root):
```bash
npm run dev
```

Or run individually:
```bash
cd web/client
npm run dev
```

The frontend will start on `http://localhost:5173` and automatically proxy API requests to the gateway at `http://localhost:3000`.

**Frontend Structure:**
```
web/client/
├── src/
│   ├── components/
│   │   ├── ChatInterface.tsx    # Main chat UI component
│   │   └── StatusBar.tsx         # Gateway status indicator
│   ├── App.tsx                   # Main app component
│   ├── main.tsx                  # Entry point
│   └── index.css                 # Global styles
├── index.html                    # HTML template
└── vite.config.ts                # Vite configuration
```

**Usage:**
1. Ensure the gateway is running (`cd services/gateway && npm run dev`)
2. Start the frontend (`cd web/client && npm run dev`)
3. Open `http://localhost:5173` in your browser
4. Start chatting with the LLM!

The frontend automatically checks gateway health and displays connection status. All interactions are monitored by the analyzer service for drift and safety detection.

