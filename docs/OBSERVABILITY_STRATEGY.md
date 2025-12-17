# Observability Strategy for LLM Drift & Abuse Sentinel

## Overview

The LLM Drift & Abuse Sentinel implements a comprehensive observability strategy that goes beyond basic metrics collection. Our approach combines **real-time monitoring**, **predictive drift detection**, and **AI-powered safety classification** to provide actionable insights for LLM applications running on Vertex AI/Gemini.

## Architecture

```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│   Gateway   │────▶│   Pub/Sub    │────▶│  Analyzer   │
│  (Express)  │     │   (GCP)      │     │  (Worker)   │
└─────────────┘     └──────────────┘     └─────────────┘
                            │                     │
                            │                     ▼
                            │              ┌─────────────┐
                            │              │  Datadog    │
                            │              │ (Metrics +  │
                            │              │   Events)   │
                            │              └─────────────┘
                            │
                            ▼
                     ┌─────────────┐
                     │  BigQuery   │
                     │  (Storage)  │
                     └─────────────┘
```

## Three Pillars of Observability

### 1. Metrics (What's Happening)

We emit **15+ custom metrics** to Datadog covering:

- **Request Metrics**: Count, errors, latency
- **Token Usage**: Input, output, total tokens per request
- **Cost Tracking**: Estimated USD cost per request
- **Drift Detection**: Similarity scores, drift scores, baseline readiness
- **Safety Classification**: Safety scores, event counts by label
- **Service Health**: Events processed, processing latency

**Key Innovation**: Every metric is tagged with rich context:
- `env`, `service`, `endpoint`, `method`
- `model`, `model_version`, `status`
- `safety_label`, `baseline_ready`, `drift_threshold`

This enables powerful filtering and correlation in Datadog dashboards.

### 2. Events (What's Important)

High-risk safety issues automatically trigger **Datadog events** with:

- **Alert Type**: `error` (score < 0.3) or `warning` (score < 0.5)
- **Context**: Request ID, safety label, score, details
- **Content Excerpts**: First 200 chars of prompt and response
- **Metadata**: Model, endpoint, environment

Events appear in the Datadog Events stream and can trigger incident creation.

### 3. Traces (How It Flows)

While not explicitly implemented with distributed tracing, we maintain:

- **Request IDs**: UUIDs for every request, propagated through the system
- **Timestamps**: Precise timing at each stage
- **BigQuery Storage**: Full telemetry events for historical analysis

## Detection Strategy

### Drift Detection

**Approach**: Embedding-based similarity analysis

1. **Baseline Creation**: 
   - Collects first 5 responses per endpoint
   - Computes embeddings using Vertex AI (`text-embedding-004`)
   - Stores baseline embedding (exponential moving average)

2. **Drift Calculation**:
   - Computes embedding for each new response
   - Calculates cosine similarity vs. baseline
   - Drift score = 1 - similarity (0 = no drift, 1 = maximum drift)

3. **Alerting**:
   - Monitor: `avg:llm.drift_score{baseline_ready:true} > 0.2`
   - Thresholds: Warning at 0.2, Critical at 0.4
   - Indicates: Model behavior changes, input pattern shifts, prompt engineering issues

**Why This Works**: Embeddings capture semantic meaning, not just keywords. This detects subtle changes in response quality and style.

### Safety Detection

**Approach**: AI-powered classification using Gemini

1. **Classification**:
   - Uses `gemini-1.5-flash` for fast, cost-effective classification
   - Analyzes both prompt and response
   - Returns safety label and score (0-1)

2. **Categories Detected**:
   - `TOXIC`: Hate speech, harassment, offensive content
   - `PII`: Personally identifiable information
   - `JAILBREAK`: Attempts to bypass safety guidelines
   - `PROMPT_INJECTION`: Malicious instruction injection
   - `RISKY`: Potentially harmful but not clearly categorized
   - `CLEAN`: Normal, safe interaction

3. **Alerting**:
   - Monitor: `avg:llm.safety.score{*} < 0.5`
   - Thresholds: Warning at 0.5, Critical at 0.3
   - Events: Automatically created for high-risk interactions

**Why This Works**: AI classification is more nuanced than keyword matching. It understands context and intent, catching sophisticated attacks.

## Monitoring Strategy

### Detection Rules

We've configured **5 monitors** in Datadog:

1. **LLM High Error Rate Alert**
   - Query: `sum:llm.error.count{*}.as_count() > 10` (last 5m)
   - Purpose: Detect service degradation
   - Action: Check gateway logs, Vertex AI status

2. **LLM High Latency Warning**
   - Query: `avg:llm.latency_ms{*} > 5000` (last 10m)
   - Purpose: Detect performance issues
   - Action: Review model selection, network connectivity

3. **LLM Drift Detection Alert**
   - Query: `avg:llm.drift_score{baseline_ready:true} > 0.2` (last 15m)
   - Purpose: Detect response quality degradation
   - Action: Review prompts, check model version changes

4. **LLM Safety Score Critical**
   - Query: `avg:llm.safety.score{*} < 0.5` (last 5m)
   - Purpose: Detect abuse and unsafe interactions
   - Action: Review safety events, implement filters

5. **LLM Availability SLO**
   - Query: Success rate over 30 days
   - Target: 99% availability
   - Purpose: Track service reliability

### Dashboard

The **LLM Sentinel - Application Health Overview** dashboard provides:

- **Request Rate & Error Rate**: Real-time traffic visualization
- **Latency Percentiles**: p50, p95, p99 trends
- **Token Usage**: Input/output/total over time
- **Cost Tracking**: USD spend per second
- **Drift Score Trends**: Average and max drift with thresholds
- **Safety Score Distribution**: Average and min with thresholds
- **Key Metrics**: Total requests, error rate, avg latency, drift, safety
- **Top Lists**: Safety events by label, requests by model
- **Active Alerts**: Current monitor status
- **Safety Events Stream**: Real-time event feed

## Incident Management

### Workflow

1. **Detection**: Monitor triggers alert based on threshold
2. **Event Creation**: High-risk safety issues create Datadog events
3. **Incident Creation**: Configured webhook creates incident from alert
4. **Investigation**: Engineers review:
   - Datadog dashboard for trends
   - BigQuery for detailed event data
   - Safety events stream for context
5. **Resolution**: Update status, document root cause

### Runbooks

Each monitor includes recommended actions in its message:

- **Error Rate**: Check logs, verify API status, review rate limits
- **Latency**: Check API response times, consider model optimization
- **Drift**: Review prompts, check model version, analyze trends
- **Safety**: Review events, check filters, document for compliance

## Best Practices

### Metric Naming

- Prefix: `llm.*` for LLM-specific metrics
- Prefix: `sentinel.*` for service metrics
- Consistent units: `_ms` for milliseconds, `_count` for counts, `_usd` for currency

### Tagging Strategy

- **Environment**: `env:dev`, `env:prod`
- **Service**: `service:gateway`, `service:analyzer`
- **Model**: `model:gemini-1.5-pro`, `model:gemini-1.5-flash`
- **Status**: `status:success`, `status:error`
- **Safety**: `safety_label:TOXIC`, `safety_label:CLEAN`

### Alert Fatigue Prevention

- **Thresholds**: Set based on baseline analysis, not arbitrary values
- **Evaluation Windows**: Longer windows (10-15m) for drift, shorter (5m) for critical safety
- **Renotify Intervals**: 30-60s for critical, 2-5m for warnings
- **Escalation**: Clear escalation messages with context

## Future Enhancements

1. **Distributed Tracing**: Add OpenTelemetry for request tracing
2. **Anomaly Detection**: ML-based anomaly detection for drift
3. **Predictive Alerts**: Alert before thresholds are breached
4. **Cost Optimization**: Alerts for unexpected cost spikes
5. **Multi-Model Comparison**: Track drift across model versions
6. **Custom Dashboards**: Per-endpoint or per-model dashboards

## Conclusion

Our observability strategy provides **actionable insights** rather than just data collection. By combining metrics, events, and intelligent detection, we enable teams to:

- **Detect issues early**: Before they impact users
- **Understand root causes**: Rich context in every alert
- **Respond quickly**: Clear runbooks and recommended actions
- **Improve continuously**: Historical data in BigQuery for analysis

This approach transforms observability from a reactive tool into a proactive system for maintaining LLM application quality and safety.

