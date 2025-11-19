# Testing Guide: Gateway → Analyzer Flow

## Prerequisites

1. **Infrastructure deployed:**
   ```bash
   cd infra
   terraform apply
   ```

2. **Gateway running** (in one terminal):
   ```bash
   cd services/gateway
   npm run dev
   ```
   Should see: `Gateway running on port 3000` and `Telemetry enabled: sentinel-llm-telemetry`

3. **Analyzer running** (in another terminal):
   ```bash
   cd services/analyzer
   npm run dev
   ```
   Should see: `Starting Sentinel Analyzer...` and `Consumer started and listening for messages`

## Test Steps

### Step 1: Send Test Request

```powershell
# PowerShell
$body = '{"message": "Hello, test analyzer!"}' | ConvertTo-Json
Invoke-WebRequest -Uri http://localhost:3000/api/chat -Method POST -Headers @{"Content-Type"="application/json"} -Body $body
```

Or use curl:
```bash
curl -X POST http://localhost:3000/api/chat -H "Content-Type: application/json" -d '{"message": "Hello, test analyzer!"}'
```

### Step 2: Check Analyzer Logs

In the analyzer terminal, you should see:
```
[Consumer] Processing event <requestId>
[Consumer] Event <requestId>: { drift: {...}, safety: {...} }
[BigQuery] Wrote event <requestId> to sentinel_telemetry.llm_events
[Consumer] Processed and acknowledged event <requestId>
```

### Step 3: Verify Pub/Sub Messages

Check pending messages:
```bash
gcloud pubsub subscriptions describe sentinel-analyzer-sub --project=llm-drift-sentinel --format="value(numUndeliveredMessages)"
```

If analyzer is working, this should be 0 or low (messages are being consumed).

### Step 4: Check BigQuery

Query BigQuery to see if events were written:
```bash
bq query --use_legacy_sql=false "SELECT requestId, timestamp, status, tokensTotal, latencyMs FROM sentinel_telemetry.llm_events ORDER BY timestamp DESC LIMIT 5"
```

## Automated Test Script

Run the test script:
```powershell
powershell -File test-analyzer-flow.ps1
```

This script will:
1. Check if subscription exists
2. Count pending messages
3. Send a test request
4. Wait 5 seconds
5. Check if messages were processed

## Troubleshooting

**Gateway not responding:**
- Check if gateway is running: `curl http://localhost:3000/health`
- Check gateway logs for errors

**Analyzer not processing:**
- Check analyzer logs for errors
- Verify `.env` file has correct `GOOGLE_CLOUD_PROJECT_ID`
- Check if subscription exists: `gcloud pubsub subscriptions list --project=llm-drift-sentinel`

**Messages piling up:**
- Analyzer might not be running
- Check analyzer logs for connection errors
- Verify Pub/Sub permissions

## Expected Flow

```
1. Request → Gateway
2. Gateway → Vertex AI (gets response)
3. Gateway → Pub/Sub Topic (emits telemetry)
4. Pub/Sub Topic → Analyzer Subscription
5. Analyzer → Processes event (drift + safety)
6. Analyzer → BigQuery (writes event)
7. Analyzer → Acknowledges message
```

