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
5. **llm-availability-slo.json** - Tracks 99% availability SLO (30-day rolling)

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

## Documentation

- `../docs/DETECTION_RULES.md` - Detailed monitor documentation
- `../docs/OBSERVABILITY_STRATEGY.md` - Overall observability strategy
- `../docs/INCIDENT_EXAMPLE.md` - Incident management examples

