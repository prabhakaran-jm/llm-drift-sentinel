# Datadog Configurations

This directory contains JSON exports of Datadog monitors and dashboards for the LLM Drift & Abuse Sentinel.

## Directory Structure

- `monitors/` - Monitor configurations (detection rules)
- `dashboards/` - Dashboard configurations

## Monitors

All monitors are configured to:
- Detect specific issues (errors, latency, drift, safety)
- Trigger alerts with appropriate thresholds
- Include recommended actions in alert messages
- Create Datadog events for visibility

### Available Monitors

1. **llm-high-error-rate.json** - Detects high error rates (> 10 errors in 5m)
2. **llm-high-latency.json** - Detects high latency (> 5s average over 10m)
3. **llm-drift-detection.json** - Detects response drift (> 0.2 drift score over 15m)
4. **llm-safety-score-critical.json** - Detects safety issues (< 0.5 safety score over 5m)
5. **llm-availability-slo.json** - Tracks 99% availability SLO (30-day rolling) - **Requires manual setup** (see SLO Setup below) 

See `docs/DETECTION_RULES.md` for detailed documentation.

## Dashboards

### llm-sentinel-overview.json

Comprehensive dashboard with:
- Request rate & error rate graphs
- Latency percentiles (p50, p95, p99)
- Token usage and cost tracking
- Drift score trends
- Safety score distribution
- Key metrics and top lists
- Active alerts and events stream

## Importing Configurations

### Via Datadog UI

1. **Monitors**:
   - Go to Monitors → New Monitor
   - Select "Import from JSON"
   - Paste contents of monitor JSON file
   - Configure notification channels
   - Save

2. **Dashboards**:
   - Go to Dashboards → New Dashboard
   - Select "Import from JSON"
   - Paste contents of dashboard JSON file
   - Save

### Via Datadog API

```bash
# Set environment variables
export DD_API_KEY="your-api-key"
export DD_APP_KEY="your-app-key"

# Import monitor
curl -X POST "https://api.datadoghq.com/api/v1/monitor" \
  -H "Content-Type: application/json" \
  -H "DD-API-KEY: ${DD_API_KEY}" \
  -H "DD-APPLICATION-KEY: ${DD_APP_KEY}" \
  -d @monitors/llm-high-error-rate.json

# Import dashboard
curl -X POST "https://api.datadoghq.com/api/v1/dashboard" \
  -H "Content-Type: application/json" \
  -H "DD-API-KEY: ${DD_API_KEY}" \
  -H "DD-APPLICATION-KEY: ${DD_APP_KEY}" \
  -d @dashboards/llm-sentinel-overview.json
```

## Customization

### Adjusting Thresholds

Edit the monitor JSON files to adjust thresholds:

```json
{
  "options": {
    "thresholds": {
      "critical": 10,  // Adjust this value
      "warning": 5     // Adjust this value
    }
  }
}
```

### Adding Filters

Add tag filters to queries:

```
avg:llm.latency_ms{env:prod,model:gemini-1.5-pro} > 5000
```

### Notification Channels

Configure notification channels in Datadog UI:
- Slack integration
- Email notifications
- PagerDuty integration
- Webhooks for incident creation

## Testing

Use the traffic generator to test monitors:

```bash
cd ../scripts
npm run traffic:generate -- --duration=5m --rate=10/s --toxic=20%
```

This will generate traffic that should trigger the safety monitor.

## SLO Setup

SLO (Service Level Objective) monitors require a two-step process:

1. **Create the SLO** via Datadog UI or SLO API
2. **Create a monitor** that watches the SLO

### Step 1: Create the SLO

**Via Datadog UI:**
1. Go to **SLOs** → **New SLO**
2. Select **Metric-based SLO**
3. Configure:
   - **Name**: `LLM Availability SLO`
   - **Numerator**: `sum:llm.request.count{status:success}.as_count()`
   - **Denominator**: `sum:llm.request.count{*}.as_count()`
   - **Target**: `99%`
   - **Timeframe**: `30 days`
   - **Tags**: `service:sentinel`, `team:platform`, `component:llm`, `slo:availability`
4. Save the SLO and note the SLO ID

**Via API:**
```bash
curl -X POST "https://api.datadoghq.com/api/v1/slo" \
  -H "Content-Type: application/json" \
  -H "DD-API-KEY: ${DD_API_KEY}" \
  -H "DD-APPLICATION-KEY: ${DD_APP_KEY}" \
  -d '{
    "type": "metric",
    "name": "LLM Availability SLO",
    "description": "99% availability over 30-day rolling window",
    "query": {
      "numerator": "sum:llm.request.count{status:success}.as_count()",
      "denominator": "sum:llm.request.count{*}.as_count()"
    },
    "target_threshold": 0.99,
    "timeframe": "30d",
    "tags": ["service:sentinel", "team:platform", "component:llm", "slo:availability"]
  }'
```

### Step 2: Create SLO Alert Monitor

Once the SLO is created, create a monitor that watches it. Replace `<SLO_ID>` with the SLO ID from Step 1:

```bash
curl -X POST "https://api.datadoghq.com/api/v1/monitor" \
  -H "Content-Type: application/json" \
  -H "DD-API-KEY: ${DD_API_KEY}" \
  -H "DD-APPLICATION-KEY: ${DD_APP_KEY}" \
  -d '{
    "type": "slo alert",
    "name": "LLM Availability SLO",
    "query": "slo(\"<SLO_ID>\").overall_status()",
    "message": "LLM Availability SLO Status: {{#is_alert}}Critical: SLO below target (99% availability).{{/is_alert}} {{#is_warn}}Warning: SLO approaching threshold.{{/is_warn}}\n\n**SLO Details:**\n- Target: 99% availability (30-day rolling window)\n- Current Status: {{slo.status}}\n- Error Budget Remaining: {{slo.error_budget_remaining}}\n- Burn Rate: {{slo.burn_rate}}\n\n**Context:**\n- Service: {{service.name}}\n- Environment: {{env.name}}\n\n**Recommended Actions:**\n1. Review error rate monitor for root causes\n2. Check Vertex AI service status\n3. Review recent incidents and outages\n4. Consider increasing error budget if needed\n\n@webhook-datadog-incidents",
    "tags": ["service:sentinel", "team:platform", "component:llm", "slo:availability"],
    "options": {
      "thresholds": {
        "critical": 0.99,
        "warning": 0.995
      }
    }
  }'
```

**Note:** The SLO must exist before you can create a monitor that references it.

## Documentation

- `../docs/DETECTION_RULES.md` - Detailed monitor documentation
- `../docs/OBSERVABILITY_STRATEGY.md` - Overall observability strategy
- `../docs/INCIDENT_EXAMPLE.md` - Incident management examples

