# Detection Rules Documentation

## Overview

This document describes the detection rules (monitors) configured in Datadog for the LLM Drift & Abuse Sentinel. Each monitor is designed to detect specific issues and trigger appropriate alerts.

## Monitor Configurations

### 1. LLM High Error Rate Alert

**Type**: Metric Alert  
**Priority**: Critical (P1)  
**File**: `datadog/monitors/llm-high-error-rate.json`

**Query**:
```
sum(last_5m):sum:llm.error.count{*}.as_count() > 10
```

**Description**:  
Detects when more than 10 errors occur in a 5-minute window. This indicates service degradation or API issues.

**Thresholds**:
- **Warning**: 5 errors in 5 minutes
- **Critical**: 10 errors in 5 minutes

**Evaluation Window**: 5 minutes  
**Renotify Interval**: 60 seconds

**Recommended Actions**:
1. Check gateway logs for error patterns
2. Verify Vertex AI API status
3. Review recent telemetry events in BigQuery
4. Check for rate limiting or quota issues

**Tags**: `service:sentinel`, `team:platform`, `component:llm`, `severity:critical`

---

### 2. LLM High Latency Warning

**Type**: Metric Alert  
**Priority**: Warning (P2)  
**File**: `datadog/monitors/llm-high-latency.json`

**Query**:
```
avg(last_10m):avg:llm.latency_ms{*} > 5000
```

**Description**:  
Detects when average latency exceeds 5 seconds over a 10-minute window. This indicates performance degradation.

**Thresholds**:
- **Warning**: Average latency > 5 seconds
- **Critical**: Average latency > 10 seconds

**Evaluation Window**: 10 minutes  
**Renotify Interval**: 120 seconds

**Recommended Actions**:
1. Check Vertex AI API response times
2. Review model selection (consider using `gemini-1.5-flash` for faster responses)
3. Check network connectivity to Vertex AI
4. Review concurrent request volume

**Tags**: `service:sentinel`, `team:platform`, `component:llm`, `severity:warning`

---

### 3. LLM Drift Detection Alert

**Type**: Metric Alert  
**Priority**: Warning (P2)  
**File**: `datadog/monitors/llm-drift-detection.json`

**Query**:
```
avg(last_15m):avg:llm.drift_score{baseline_ready:true} > 0.2
```

**Description**:  
Detects when average drift score exceeds 0.2 (20% dissimilarity) over a 15-minute window. This indicates that LLM responses are deviating significantly from the established baseline.

**What Drift Means**:
- **Drift Score**: 0 = no drift, 1 = maximum drift
- **Similarity Score**: 1 = identical to baseline, 0 = completely different
- **Baseline Ready**: Requires at least 5 samples per endpoint

**Thresholds**:
- **Warning**: Average drift > 0.2
- **Critical**: Average drift > 0.4

**Evaluation Window**: 15 minutes  
**Renotify Interval**: 300 seconds (5 minutes)

**Possible Causes**:
- Model behavior changes
- Input pattern shifts
- Prompt engineering issues
- Model version updates
- Intentional changes to system behavior

**Recommended Actions**:
1. Review recent prompts and responses in BigQuery
2. Check if model version changed
3. Analyze drift trends in Datadog dashboard
4. Consider retraining baseline if intentional change

**Tags**: `service:sentinel`, `team:platform`, `component:drift-detection`, `severity:warning`

---

### 4. LLM Safety Score Critical

**Type**: Metric Alert  
**Priority**: Critical (P1)  
**File**: `datadog/monitors/llm-safety-score-critical.json`

**Query**:
```
avg(last_5m):avg:llm.safety.score{*} < 0.5
```

**Description**:  
Detects when average safety score falls below 0.5 over a 5-minute window. This indicates unsafe or abusive interactions.

**Safety Score Range**:
- **1.0**: Completely safe
- **0.5**: Potentially unsafe (warning threshold)
- **0.3**: Unsafe (critical threshold)
- **0.0**: Highly unsafe

**Safety Categories**:
- `TOXIC`: Hate speech, harassment, offensive content
- `PII`: Personally identifiable information
- `JAILBREAK`: Attempts to bypass safety guidelines
- `PROMPT_INJECTION`: Malicious instruction injection
- `RISKY`: Potentially harmful but not clearly categorized
- `CLEAN`: Normal, safe interaction

**Thresholds**:
- **Warning**: Average safety score < 0.5
- **Critical**: Average safety score < 0.3

**Evaluation Window**: 5 minutes  
**Renotify Interval**: 30 seconds  
**Notify Audit**: Yes (for compliance)

**Recommended Actions**:
1. **IMMEDIATE**: Review safety events in Datadog Events stream
2. Check BigQuery for recent unsafe interactions
3. Review prompt filtering and validation
4. Consider implementing additional safety filters
5. Document incident for compliance

**Tags**: `service:sentinel`, `team:platform`, `component:safety`, `severity:critical`

---

### 5. LLM Availability SLO

**Type**: SLO Alert  
**Priority**: Warning (P2)  
**File**: `datadog/monitors/llm-availability-slo.json`

**Query**:
```json
{
  "numerator": "sum:llm.request.count{status:success}.as_count()",
  "denominator": "sum:llm.request.count{*}.as_count()"
}
```

**Description**:  
Tracks service availability as a Service Level Objective (SLO). Measures the percentage of successful requests over a 30-day rolling window.

**SLO Target**: 99% availability

**Calculation**:
- **Numerator**: Successful requests (`status:success`)
- **Denominator**: Total requests
- **Timeframe**: 30-day rolling window

**Error Budget**:
- **Target**: 99% = 1% error budget
- **30 days**: ~43,200 minutes
- **Error Budget**: ~432 minutes of downtime allowed

**Thresholds**:
- **Target**: 99% availability
- **Warning**: Approaching threshold (99.5%)

**Evaluation Window**: 30 days (rolling)  
**Renotify Interval**: 1440 minutes (24 hours)

**Recommended Actions**:
1. Review error rate monitor for root causes
2. Check Vertex AI service status
3. Review recent incidents and outages
4. Consider increasing error budget if needed

**Tags**: `service:sentinel`, `team:platform`, `component:llm`, `slo:availability`

---

## Alert Severity Levels

### P1 - Critical
- **Response Time**: Immediate (< 15 minutes)
- **Examples**: Safety issues, high error rates
- **Escalation**: Automatic after 15 minutes

### P2 - Warning
- **Response Time**: Within 1 hour
- **Examples**: High latency, drift detection, SLO degradation
- **Escalation**: Automatic after 1 hour

## Notification Channels

All monitors are configured to:
1. **Create Datadog Events**: For visibility in Events stream
2. **Trigger Webhooks**: For incident creation (configure `@webhook-datadog-incidents`)
3. **Send to Slack/Email**: Configure notification channels in Datadog UI

## Testing Detection Rules

Use the traffic generator script to test monitors:

```bash
# Test error rate monitor
npm run traffic:generate -- --duration=5m --rate=20/s --concurrent=5

# Test safety monitor
npm run traffic:generate -- --duration=2m --rate=10/s --toxic=50%

# Test drift monitor
npm run traffic:generate -- --duration=10m --rate=5/s --repetitive=100%
```

## Importing Monitors

To import these monitors into Datadog:

1. **Via UI**:
   - Go to Monitors → New Monitor
   - Select "Import from JSON"
   - Paste contents of monitor JSON file
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

### Custom Notification Messages

Modify the `message` field in each monitor JSON to include:
- Runbook links
- On-call rotation information
- Escalation procedures

## Best Practices

1. **Start Conservative**: Set thresholds based on baseline analysis
2. **Monitor Trends**: Review dashboard before adjusting thresholds
3. **Document Changes**: Update this document when modifying monitors
4. **Test Regularly**: Use traffic generator to verify alerts work
5. **Review False Positives**: Adjust thresholds if alerts fire too frequently
6. **Maintain Runbooks**: Keep recommended actions up to date

## Troubleshooting

### Monitor Not Firing

1. Check metric exists: `sum:llm.error.count{*}` in Metrics Explorer
2. Verify tags match: Ensure tags in query match emitted tags
3. Check evaluation window: Metrics may need time to accumulate
4. Verify threshold: May be too high/low

### Too Many Alerts

1. Increase thresholds gradually
2. Increase evaluation window
3. Add tag filters to reduce scope
4. Increase renotify interval

### Missing Metrics

1. Verify Datadog API key is configured
2. Check analyzer service is running
3. Review analyzer logs for metric emission errors
4. Verify metric names match exactly (case-sensitive)

