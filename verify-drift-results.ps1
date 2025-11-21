# Script to verify drift detection results from BigQuery
Write-Host "=== Verifying Drift Detection Results ===" -ForegroundColor Cyan
Write-Host ""

Write-Host "Querying BigQuery for recent events..." -ForegroundColor Yellow

# Query BigQuery for recent events
$query = @"
SELECT 
  requestId,
  TIMESTAMP(timestamp) as event_time,
  SUBSTR(prompt, 1, 50) as prompt_preview,
  tokensTotal,
  latencyMs,
  status
FROM \`llm-drift-sentinel.sentinel_telemetry.llm_events\`
ORDER BY timestamp DESC
LIMIT 10
"@

Write-Host "`nRecent events:" -ForegroundColor Yellow
try {
    $results = bq query --use_legacy_sql=false --format=prettyjson "$query" 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host $results -ForegroundColor Gray
    } else {
        Write-Host "BigQuery query failed. Make sure:" -ForegroundColor Yellow
        Write-Host "1. BigQuery API is enabled" -ForegroundColor Gray
        Write-Host "2. You have permissions to query the table" -ForegroundColor Gray
        Write-Host "3. Events were written to BigQuery" -ForegroundColor Gray
    }
} catch {
    Write-Host "Error querying BigQuery: $_" -ForegroundColor Red
}

Write-Host "`n=== Summary ===" -ForegroundColor Cyan
Write-Host "Check analyzer console logs for detailed drift scores." -ForegroundColor Yellow
Write-Host "Drift detection is working if you see:" -ForegroundColor Yellow
Write-Host "  - Embeddings being generated" -ForegroundColor Gray
Write-Host "  - Baseline creation/updates" -ForegroundColor Gray
Write-Host "  - Similarity and drift scores in event logs" -ForegroundColor Gray

