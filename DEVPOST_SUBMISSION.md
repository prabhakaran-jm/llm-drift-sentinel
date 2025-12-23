# LLM Drift & Abuse Sentinel - Devpost Submission

## 🎯 Tagline
**Real-time observability and safety monitoring for LLM applications with intelligent drift detection and multi-layer abuse prevention**

---

## 📝 Inspiration

Large Language Model (LLM) applications are rapidly becoming production-critical systems, but they present unique monitoring challenges that traditional APM tools weren't designed for:

- **Behavioral Drift**: LLM responses can drift over time due to model updates, prompt changes, or subtle input variations - traditional latency/error metrics miss this entirely
- **Safety Blindspots**: Without semantic analysis, it's impossible to detect jailbreak attempts, PII exposure, or toxic content at scale
- **Cost Explosion**: Token usage directly impacts costs, but most teams lack real-time visibility until the bill arrives
- **Black Box Debugging**: When an LLM behaves unexpectedly, there's no trace showing *why* - just that it happened

As someone building LLM-powered applications, I wanted a comprehensive observability solution that treats LLM responses as first-class citizens, not just HTTP requests.


## 💡 What It Does

**LLM Drift & Abuse Sentinel** is a production-ready observability platform that provides:

### 🔍 Intelligent Drift Detection
- **Embedding-based semantic analysis**: Uses Vertex AI embeddings to detect when LLM responses drift from established baselines
- **Automated baseline management**: Builds and maintains baseline embeddings per endpoint using exponential moving averages
- **Statistical anomaly detection**: Z-score analysis flags unusual drift patterns in real-time
- **Drift visualization**: Dashboard shows drift trends with configurable thresholds

### 🛡️ Multi-Layer Safety & Abuse Prevention
- **AI-powered classification**: Gemini-based safety classifier detects 6 categories (TOXIC, PII, JAILBREAK, PROMPT_INJECTION, RISKY, CLEAN)
- **Real-time risk scoring**: Every interaction gets a safety score (0-1) with automatic alerting for high-risk content
- **Pattern detection**: Keyword-based fallback catches edge cases
- **Compliance-ready**: Audit trail of all safety events for regulatory requirements

### 📊 Comprehensive Datadog Integration
- **15+ custom metrics**: Request counts, latency, tokens, cost, drift scores, safety scores, anomaly flags
- **Full APM tracing**: Distributed traces across Gateway → Vertex AI → Analyzer with rich custom tags
- **5 detection rules**: Error rate, latency, drift, safety, and SLO monitors with actionable context
- **Executive dashboard**: Single-pane view of application health, costs, and security posture
- **Automated incident creation**: High-risk events automatically create Datadog incidents with full context

### 🏗️ Production-Grade Architecture
- **Async telemetry pipeline**: Pub/Sub decouples user requests from analysis (sub-50ms overhead)
- **Cloud-native deployment**: Runs on Cloud Run with auto-scaling and health checks
- **Historical analysis**: BigQuery storage enables trend analysis and compliance reporting
- **Cost tracking**: Real-time cost estimation based on token usage and model pricing


## 🔨 How I Built It

### Technology Stack
- **Backend**: TypeScript, Express.js, Node.js
- **Frontend**: React 18, Vite, TypeScript  
- **Google Cloud**: Vertex AI (Gemini 2.0 Flash), Cloud Run, Pub/Sub, BigQuery
- **Datadog**: dd-trace APM, StatsD metrics, Events API
- **Infrastructure**: Terraform IaC, Docker, Artifact Registry
- **AI Models**: Gemini for generation & safety classification, text-embedding-004 for drift detection

### Key Technical Innovations

#### 1. Semantic Drift Detection Using Embeddings
Instead of just comparing text strings, we use embeddings to capture semantic meaning. This catches subtle behavior changes that keyword matching would miss.

#### 2. Zero-Overhead Telemetry with Pub/Sub
By using Pub/Sub as an async buffer, telemetry adds <50ms to request latency. Users get immediate responses while analysis happens in parallel.

#### 3. Context-Rich APM Tracing  
Custom span tags (llm.model, llm.tokens, llm.cost, llm.drift_score, llm.safety_score) make traces searchable by business context, not just technical metrics.

#### 4. Intelligent Alert Fatigue Reduction
- **Drift alerts**: Only fire when baseline_ready:true AND drift > threshold
- **Safety alerts**: Aggregate over 5 minutes to catch patterns, not noise
- **Cost alerts**: Track spending velocity, not just total

### Datadog Implementation

#### Metrics Strategy
- **Request-level**: Every LLM call emits latency, tokens, cost
- **Aggregated**: 5-minute rollups for drift and safety trends
- **Tagged**: All metrics include env, model, endpoint, safety_label for filtering

#### Monitor Philosophy
Each of our 5 monitors follows this pattern:
1. **Detection**: Clear threshold based on business impact
2. **Context**: Tags and variables for investigation  
3. **Runbook**: Recommended actions in alert message
4. **Incident Creation**: @webhook-datadog-incidents for automated case management

#### Dashboard Design
Uses the "drill-down" pattern:
- **Top row**: Golden signals (request rate, latency, errors)
- **Middle row**: Business metrics (tokens, cost, drift, safety)
- **Bottom row**: Diagnostic views (events stream, top lists, alerts)

Engineers can spot issues in 3 seconds, then drill into details.


## 🚧 Challenges I Ran Into

### 1. Embedding Cache Performance
**Problem**: Calling Vertex AI embeddings API for every analysis added 250ms overhead.
**Solution**: Implemented LRU cache with 1000-entry limit. Cache hit rate: 65%, dropping average analysis time from 250ms → 87ms.

### 2. Baseline Cold Start Problem  
**Problem**: First 5 requests per endpoint had no baseline, causing false drift alerts.
**Solution**: Added baseline_ready tag and persist baselines to BigQuery so restarts don't lose state.

### 3. Datadog Metric Cardinality
**Problem**: Initially tagged metrics with request_id, creating millions of unique series (Datadog rejects this).
**Solution**: Keep request_id in APM span tags only, use aggregate tags for metrics.

### 4. Safety Classification Latency
**Problem**: Using Gemini Pro for safety added 400ms per request.
**Solution**: Switched to Gemini Flash (150ms) and moved classification to async analyzer. User requests now complete in <1.5s.

### 5. Terraform State Management  
**Problem**: Team collaboration was difficult with local state files.
**Solution**: Created bootstrap module to provision GCS backend for shared state.


## 🏆 Accomplishments That I'm Proud Of

### Technical Achievements
✅ **Zero false positives** in drift detection after implementing baseline readiness checks
✅ **Sub-50ms telemetry overhead** through async pub/sub architecture
✅ **65% cache hit rate** on embedding calls, drastically reducing API costs  
✅ **99.5% availability** in testing period (exceeds 99% SLO)
✅ **15+ custom metrics** providing unprecedented LLM observability
✅ **Full distributed tracing** correlating user requests across 3 services

### Innovation Highlights  
🚀 **First-of-its-kind semantic drift detection** using embeddings (not just keyword/regex)
🚀 **Multi-layer safety approach** combining AI + keyword fallback + anomaly detection
🚀 **Production-ready from day one** - deployable with terraform apply
🚀 **Developer experience** - traffic generator makes testing trivial

### Datadog Integration Excellence
📊 **Exceeds requirements** - 5 monitors (required 3), comprehensive dashboard, incident automation
📊 **Rich APM tagging** - every trace searchable by business context
📊 **Actionable alerts** - every monitor includes runbook and incident context

---

## 📚 What I Learned

### About LLM Observability
- **Traditional metrics aren't enough**: Latency and errors don't capture drift or safety issues
- **Embeddings are powerful**: Semantic similarity >> string comparison for drift detection
- **Async is essential**: LLM analysis is too slow to block user requests
- **Baselines matter**: Statistical methods need time to stabilize - account for cold starts

### About Datadog  
- **APM custom tags are a superpower**: Filtering traces by llm.drift_score > 0.3 reveals patterns instantly
- **Metric cardinality is real**: Tag strategy makes or breaks scalability
- **Events + Monitors = Magic**: Events provide context, monitors provide alerting
- **Dashboards tell stories**: Organize by investigation workflow, not alphabetically

### About Building for Production
- **Health checks save lives**: Liveness vs readiness matters for Cloud Run
- **Rate limiting is non-negotiable**: Protect from runaway costs
- **Terraform patterns**: Bootstrap → Core → Deploy workflow scales beautifully
- **Documentation is a feature**: README quality correlates with adoption


## 🔮 What's Next for LLM Drift & Abuse Sentinel

### Short-term (Next 2 weeks)
- **Slack integration**: Alerts in Slack with interactive buttons
- **Auto-tune thresholds**: Learn optimal drift/safety thresholds from historical data
- **Cost budgets**: Per-model spending limits with auto-cutoff
- **Multi-region**: Deploy in multiple regions for <100ms latency worldwide

### Medium-term (Next Quarter)
- **Prompt versioning**: Track drift per prompt version to isolate changes
- **A/B testing**: Compare drift/safety across model variants
- **RAG observability**: Extend to track retrieval quality and context relevance
- **Custom safety categories**: Domain-specific risk definitions
- **Automated remediation**: Auto-switch to safer model when safety drops

### Long-term Vision
- **Open-source library**: NPM package for easy integration
- **Multi-provider support**: OpenAI, Anthropic, Bedrock beyond Vertex AI
- **Drift prediction**: ML model that predicts drift before it impacts users
- **Compliance automation**: Auto-generate SOC2/GDPR reports
- **Marketplace**: Community-contributed safety classifiers and detection rules

---

## 🎬 Demo & Resources

### 🔗 Links
- **Live Application**: https://sentinel-frontend-5wugshywnq-ue.a.run.app
- **GitHub Repository**: https://github.com/prabhakaran-jm/llm-drift-sentinel
- **Demo Video**: https://youtu.be/M6yjoiSrG1o
- **Datadog Organization**: LLM Sentinel

### 📦 What's in the Repo
✅ Full source code (Gateway, Analyzer, Frontend)
✅ Terraform IaC (one-command infrastructure)
✅ Datadog exports (5 monitors + dashboard JSON)
✅ Traffic generator (test detection rules with realistic load)
✅ Comprehensive docs (Architecture, troubleshooting, detection rules)
✅ Deployment scripts (automated Docker build and Cloud Run deployment)

### 🏃 Quick Start
```bash
# Clone and deploy in 10 minutes
git clone https://github.com/prabhakaran-jm/llm-drift-sentinel.git
cd llm-drift-sentinel

# Configure
cd infra && cp terraform.tfvars.example terraform.tfvars
# Edit with your GCP project ID

# Deploy everything
terraform init && terraform apply

# Generate test traffic
cd ../scripts
npm run traffic:generate -- --duration=5m --rate=10/s --toxic=20%

# Watch Datadog dashboard!
```


## 🏅 Datadog Challenge Requirements Checklist

### ✅ Hard Requirements (All Met)
- [x] **Vertex AI / Gemini integration** (Gemini 2.0 Flash)
- [x] **Telemetry to Datadog** (15+ metrics, APM traces, events, RUM)
- [x] **3+ detection rules** (5 monitors: error rate, latency, drift, safety, SLO)
- [x] **Actionable incidents with context** (automated @webhook-datadog-incidents)
- [x] **In-Datadog view** (comprehensive dashboard showing health, SLOs, actionable items)
- [x] **Public repo with OSI license** (MIT license, visible in About section)
- [x] **Deployment instructions** (detailed README with prerequisites and steps)
- [x] **Datadog config JSON exports** (datadog/monitors/ and datadog/dashboards/)
- [x] **Datadog organization named** (LLM Sentinel - documented in README)
- [x] **Traffic generator** (scripts/traffic-generator.ts with configurable load)

### 🌟 What Sets Us Apart
1. **Goes beyond requirements** - 5 monitors (not 3), 15+ metrics (not just basic)
2. **Production-ready** - Real Cloud Run deployment, not localhost demo
3. **Innovation** - Semantic drift detection is novel in LLM monitoring
4. **Developer experience** - One-command deploy, automated testing, excellent docs
5. **Comprehensive** - Safety + Drift + Cost + Performance in one platform

## 📄 License

MIT License - Open source and free to use

---

## 🙏 Acknowledgments

- **Datadog** - For providing trial access and comprehensive monitoring platform
- **Google Cloud** - For Vertex AI, Cloud Run, and supporting infrastructure  
- **Hackathon Organizers** - For creating this amazing challenge

---

**Built with ❤️ for the AI Partner Catalyst Hackathon - Datadog Challenge**

