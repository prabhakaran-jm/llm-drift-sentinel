# Datadog Import Guide

This guide helps you import monitors and dashboard into Datadog.

## Prerequisites

1. **API Keys**: You need both API Key and Application Key
2. **Environment Variables**: Set in your shell or `.env` file

## Method 1: Using the Import Script (Recommended)

### Step 1: Set Environment Variables

**Option A: Set in your shell (PowerShell)**
```powershell
$env:DD_API_KEY="your-api-key-here"
$env:DD_APP_KEY="your-app-key-here"
$env:DD_SITE="datadoghq.com"
```

**Option B: Create a `.env` file in `scripts/` directory**
```bash
DD_API_KEY=your-api-key-here
DD_APP_KEY=your-app-key-here
DD_SITE=datadoghq.com
```

### Step 2: Install Dependencies

```bash
cd scripts
npm install
```

### Step 3: Run the Import Script

```bash
npm run datadog:import
```

The script will:
- Import all 5 monitors from `datadog/monitors/`
- Import the dashboard from `datadog/dashboards/`
- Show success/failure status for each
- Display monitor and dashboard IDs

### Step 4: Verify Import

1. **Check Monitors**: https://app.datadoghq.com/monitors
2. **Check Dashboard**: https://app.datadoghq.com/dashboard/lists

## Method 2: Manual Import via UI

### Import Monitors

1. Go to: https://app.datadoghq.com/monitors/create
2. Click "Import from JSON" (or look for import option)
3. Copy contents of each monitor file from `datadog/monitors/`:
   - `llm-high-error-rate.json`
   - `llm-high-latency.json`
   - `llm-drift-detection.json`
   - `llm-safety-score-critical.json`
   - `llm-availability-slo.json` (Note: SLOs may need special handling)
4. Paste and import each one
5. Configure notification channels

### Import Dashboard

1. Go to: https://app.datadoghq.com/dashboard/lists
2. Click "New Dashboard"
3. Select "Import from JSON"
4. Copy contents of `datadog/dashboards/llm-sentinel-overview.json`
5. Paste and import

## Troubleshooting

### Script Fails with "API Key Required"

- Make sure `DD_API_KEY` and `DD_APP_KEY` are set
- Check that keys are correct (no extra spaces)

### Monitor Import Fails

- Check monitor JSON format is valid
- Verify API keys have correct permissions
- SLO monitors may need to be created via SLO API (different endpoint)

### Dashboard Import Fails

- Verify dashboard JSON is valid
- Check that metrics exist (dashboard needs metrics to display)
- Some widgets may need adjustment after import

### "SLO Alert" Type Not Supported

The `llm-availability-slo.json` uses "slo alert" type which may need to be created via the SLO API instead. You can:
1. Skip it for now and create SLO manually in UI
2. Or use the SLO API endpoint separately

## Next Steps After Import

1. **Configure Notification Channels**:
   - Go to each monitor → Edit → Notifications
   - Add email, Slack, PagerDuty, etc.

2. **Test Monitors**:
   - Run traffic generator to generate metrics
   - Verify monitors receive data
   - Check alert thresholds

3. **Customize Dashboard**:
   - Adjust widget sizes/layouts if needed
   - Add filters or template variables
   - Set refresh intervals

## Support

If you encounter issues:
- Check Datadog API documentation: https://docs.datadoghq.com/api/
- Review monitor/dashboard JSON for syntax errors
- Verify API key permissions in Organization Settings

