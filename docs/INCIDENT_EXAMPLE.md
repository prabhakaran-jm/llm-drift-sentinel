# Incident Management Example

## Overview

This document demonstrates how detection rules create actionable incidents in Datadog. When monitors trigger alerts, they can automatically create incidents with rich context for engineers to investigate and resolve.

## Incident Workflow

### 1. Detection

A monitor detects an issue and triggers an alert. For example:

**Monitor**: LLM Safety Score Critical  
**Trigger**: Average safety score < 0.5 over 5 minutes  
**Status**: Alert

### 2. Event Creation

The monitor creates a Datadog event with:

- **Title**: "LLM Safety Score Critical"
- **Alert Type**: Error or Warning
- **Message**: Includes context, recommended actions, and metric values
- **Tags**: Service, environment, component, severity
- **Timestamp**: When the alert fired

### 3. Incident Creation

If configured, the event triggers incident creation via webhook:

- **Incident Title**: Based on monitor name
- **Status**: Open → Investigating → Resolved
- **Severity**: Based on monitor priority (P1/P2)
- **Assignees**: Based on on-call rotation or team assignment
- **Timeline**: Automatic updates as status changes

### 4. Investigation

Engineers investigate using:

- **Datadog Dashboard**: View trends and patterns
- **Events Stream**: Review safety events with context
- **BigQuery**: Query detailed telemetry data
- **Logs**: Check gateway and analyzer logs

### 5. Resolution

After identifying root cause:

- **Update Status**: Investigating → Resolved
- **Add Notes**: Document root cause and resolution
- **Post-Mortem**: Review incident for improvements

## Example Incident: Safety Score Alert

### Scenario

During traffic generation testing, the safety monitor detects multiple unsafe interactions.

### Incident Details

**Title**: LLM Safety Score Critical  
**Status**: Open  
**Severity**: P1 - Critical  
**Created**: 2024-12-17 22:15:00 UTC  
**Assigned**: Platform Team

**Description**:
```
Critical: Average safety score below 0.5 over the last 5 minutes.

Context:
- Service: sentinel
- Environment: dev
- Endpoint: /api/chat
- Model: gemini-1.5-pro
- Safety Label: TOXIC
- Current Safety Score: 0.35

Safety Categories Detected:
- TOXIC: Hate speech, harassment, offensive content
- PII: Personally identifiable information
- JAILBREAK: Attempts to bypass safety guidelines
- PROMPT_INJECTION: Malicious instruction injection
- RISKY: Potentially harmful content

Recommended Actions:
1. IMMEDIATE: Review safety events in Datadog Events stream
2. Check BigQuery for recent unsafe interactions
3. Review prompt filtering and validation
4. Consider implementing additional safety filters
5. Document incident for compliance
```

### Investigation Steps

1. **Check Events Stream**
   - Navigate to Datadog → Events
   - Filter: `source:sentinel`, `alert_type:error`
   - Review recent safety events
   - Identify patterns in unsafe prompts

2. **Review Dashboard**
   - Open "LLM Sentinel - Application Health Overview"
   - Check "Safety Score Distribution" widget
   - Review "Safety Events by Label" top list
   - Identify which safety labels are most common

3. **Query BigQuery**
   ```sql
   SELECT 
     request_id,
     timestamp,
     prompt,
     response,
     safety_label,
     safety_score
   FROM `sentinel_telemetry.llm_events`
   WHERE safety_score < 0.5
     AND timestamp >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 10 MINUTE)
   ORDER BY timestamp DESC
   LIMIT 50
   ```

4. **Check Logs**
   - Review analyzer logs for safety classification details
   - Check gateway logs for incoming prompts
   - Verify safety classifier is functioning correctly

### Root Cause

After investigation, root cause identified:

**Issue**: Traffic generator script was running with `--toxic=50%` mix, generating a high volume of intentionally unsafe prompts for testing purposes.

**Impact**: 
- 45 unsafe interactions detected in 5 minutes
- Average safety score dropped to 0.35
- Safety events created for each high-risk interaction

**Resolution**:
- Confirmed this was expected behavior during testing
- Traffic generator completed its test run
- Safety scores returned to normal after test completed
- No production impact

### Resolution

**Status**: Resolved  
**Resolution Notes**:
```
Incident resolved. Root cause: Traffic generator test with high toxic prompt mix.

Actions taken:
- Verified safety classifier is working correctly
- Confirmed all unsafe interactions were detected
- Reviewed safety events - all properly classified
- No production impact - test environment only

Follow-up:
- Consider adding test mode flag to suppress alerts during testing
- Document traffic generator usage in runbook
```

**Resolved**: 2024-12-17 22:25:00 UTC  
**Duration**: 10 minutes

## Example Incident: Drift Detection Alert

### Scenario

LLM responses begin deviating from baseline after a model version update.

### Incident Details

**Title**: LLM Drift Detection Alert  
**Status**: Investigating  
**Severity**: P2 - Warning  
**Created**: 2024-12-17 23:00:00 UTC

**Description**:
```
Alert: Average drift score exceeds 0.2 (20% dissimilarity) over the last 15 minutes.

Context:
- Service: sentinel
- Environment: prod
- Endpoint: /api/chat
- Model: gemini-1.5-pro
- Current Drift Score: 0.28
- Similarity Score: 0.72

What This Means:
LLM responses are deviating significantly from the established baseline. This could indicate:
- Model behavior changes
- Input pattern shifts
- Prompt engineering issues
- Model version updates

Recommended Actions:
1. Review recent prompts and responses in BigQuery
2. Check if model version changed
3. Analyze drift trends in Datadog dashboard
4. Consider retraining baseline if intentional change
```

### Investigation Steps

1. **Check Model Version**
   - Review recent deployments
   - Check if Vertex AI model version changed
   - Verify model configuration

2. **Analyze Drift Trends**
   - Open dashboard → "Drift Score Trends" widget
   - Identify when drift started increasing
   - Compare with model version change timeline

3. **Review Sample Responses**
   ```sql
   SELECT 
     request_id,
     timestamp,
     prompt,
     response,
     drift_score,
     similarity_score
   FROM `sentinel_telemetry.llm_events`
   WHERE drift_score > 0.2
     AND baseline_ready = true
     AND timestamp >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 1 HOUR)
   ORDER BY drift_score DESC
   LIMIT 20
   ```

4. **Compare Baselines**
   - Review baseline embeddings in analyzer logs
   - Check if baseline needs updating
   - Verify baseline calculation is correct

### Root Cause

**Issue**: Model version updated from `gemini-1.5-pro-001` to `gemini-1.5-pro-002`, causing subtle response style changes.

**Impact**:
- Average drift score: 0.28 (28% dissimilarity)
- Similarity score: 0.72 (still relatively similar)
- Responses still accurate, but style slightly different

**Resolution**:
- Confirmed model update was intentional
- Responses remain accurate and safe
- Baseline will adapt over time with exponential moving average
- No action required - expected behavior

### Resolution

**Status**: Resolved  
**Resolution Notes**:
```
Incident resolved. Root cause: Model version update (gemini-1.5-pro-001 → gemini-1.5-pro-002).

Actions taken:
- Verified model update was intentional
- Confirmed responses remain accurate
- Baseline will adapt automatically via EMA
- No action required

Follow-up:
- Monitor drift score over next 24 hours
- Consider updating baseline if drift persists
```

## Screenshots

> **Note**: Add screenshots here after testing with traffic generator:
> 
> 1. **Monitor Alert**: Screenshot of monitor firing in Datadog
> 2. **Event Created**: Screenshot of event in Events stream
> 3. **Incident Page**: Screenshot of incident with context
> 4. **Dashboard View**: Screenshot of dashboard showing alert
> 5. **Timeline**: Screenshot of incident timeline

### How to Capture Screenshots

1. **Start Traffic Generator**:
   ```bash
   npm run traffic:generate -- --duration=5m --rate=10/s --toxic=30%
   ```

2. **Wait for Alert**: Monitor should fire within 5 minutes

3. **Capture Screenshots**:
   - Datadog → Monitors → [Monitor Name] → View Alert
   - Datadog → Events → Filter by monitor name
   - Datadog → Incidents → [Incident Name]
   - Datadog → Dashboards → LLM Sentinel Overview

4. **Add to This Document**: Insert screenshots in this section

## Best Practices

### Incident Response

1. **Acknowledge Quickly**: Update status to "Investigating" within 15 minutes
2. **Gather Context**: Use dashboard, events, and BigQuery for investigation
3. **Document Findings**: Add notes to incident as you investigate
4. **Resolve Promptly**: Update status when resolved
5. **Post-Mortem**: Review incidents weekly for improvements

### Prevention

1. **Test Monitors**: Use traffic generator to verify alerts work
2. **Review Thresholds**: Adjust based on baseline analysis
3. **Document Runbooks**: Keep recommended actions up to date
4. **Monitor Trends**: Review dashboard regularly for early warning signs
5. **Automate Responses**: Consider auto-remediation for known issues

### Communication

1. **Clear Titles**: Use descriptive incident titles
2. **Rich Context**: Include all relevant information in description
3. **Status Updates**: Keep status current as investigation progresses
4. **Resolution Notes**: Document root cause and actions taken
5. **Follow-up**: Schedule post-mortem for critical incidents

## Integration with Other Tools

### Slack Integration

Configure Datadog → Integrations → Slack to:
- Post incident notifications to #alerts channel
- Include incident details and links
- Update channel when status changes

### PagerDuty Integration

Configure Datadog → Integrations → PagerDuty to:
- Create PagerDuty incidents from Datadog alerts
- Escalate based on severity
- Track on-call rotations

### Jira Integration

Configure Datadog → Integrations → Jira to:
- Create Jira tickets from incidents
- Link incidents to tickets
- Track resolution in Jira

## Conclusion

Effective incident management requires:
- **Fast Detection**: Monitors with appropriate thresholds
- **Rich Context**: Events with actionable information
- **Clear Workflows**: Defined investigation and resolution steps
- **Continuous Improvement**: Regular review and adjustment

By following these practices, the LLM Sentinel provides a robust incident management system that enables teams to quickly detect, investigate, and resolve issues.

