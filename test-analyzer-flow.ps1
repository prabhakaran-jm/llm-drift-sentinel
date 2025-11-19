# Test script to verify Gateway -> Analyzer flow
Write-Host "=== Testing Gateway -> Analyzer Flow ===" -ForegroundColor Cyan
Write-Host ""

# Step 1: Check if subscription exists
Write-Host "1. Checking Pub/Sub subscription..." -ForegroundColor Yellow
$sub = gcloud pubsub subscriptions list --project=llm-drift-sentinel --filter="name:sentinel-analyzer-sub" --format="value(name)" 2>&1
if ($sub -match "sentinel-analyzer-sub") {
    Write-Host "   Subscription exists: $sub" -ForegroundColor Green
} else {
    Write-Host "   Subscription not found. Run: cd infra; terraform apply" -ForegroundColor Red
    exit 1
}

# Step 2: Check pending messages before
Write-Host ""
Write-Host "2. Checking pending messages before test..." -ForegroundColor Yellow
$before = gcloud pubsub subscriptions describe sentinel-analyzer-sub --project=llm-drift-sentinel --format="value(numUndeliveredMessages)" 2>&1
Write-Host "   Pending messages: $before" -ForegroundColor Gray

# Step 3: Send test request to gateway
Write-Host ""
Write-Host "3. Sending test request to gateway..." -ForegroundColor Yellow
$testId = [guid]::NewGuid().ToString()
$body = @{
    message = "Test message for analyzer - $testId"
} | ConvertTo-Json

try {
    $response = Invoke-WebRequest -Uri http://localhost:3000/api/chat -Method POST -Headers @{"Content-Type"="application/json"} -Body $body -ErrorAction Stop
    $result = $response.Content | ConvertFrom-Json
    Write-Host "   Request sent successfully" -ForegroundColor Green
    Write-Host "   Request ID: $($result.requestId)" -ForegroundColor Gray
    $responsePreview = $result.response.Substring(0, [Math]::Min(50, $result.response.Length))
    Write-Host "   Response: $responsePreview..." -ForegroundColor Gray
    
    # Wait a bit for processing
    Write-Host ""
    Write-Host "4. Waiting 5 seconds for analyzer to process..." -ForegroundColor Yellow
    Start-Sleep -Seconds 5
    
    # Step 4: Check pending messages after
    Write-Host ""
    Write-Host "5. Checking pending messages after processing..." -ForegroundColor Yellow
    $after = gcloud pubsub subscriptions describe sentinel-analyzer-sub --project=llm-drift-sentinel --format="value(numUndeliveredMessages)" 2>&1
    Write-Host "   Pending messages: $after" -ForegroundColor Gray
    
    $beforeInt = [int]$before
    $afterInt = [int]$after
    
    if ($afterInt -lt $beforeInt) {
        Write-Host "   Messages were processed! (decreased from $before to $after)" -ForegroundColor Green
    } elseif ($afterInt -eq $beforeInt) {
        Write-Host "   Messages count unchanged. Analyzer may not be running." -ForegroundColor Yellow
        Write-Host "   Check analyzer logs to see if it is consuming messages." -ForegroundColor Yellow
    } else {
        Write-Host "   Messages increased. More messages arrived than processed." -ForegroundColor Yellow
    }
    
} catch {
    Write-Host "   Failed to send request: $_" -ForegroundColor Red
    Write-Host "   Make sure gateway is running on http://localhost:3000" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "=== Test Complete ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "To verify analyzer is processing:" -ForegroundColor Yellow
Write-Host "1. Check analyzer console logs for Processing event messages" -ForegroundColor Gray
Write-Host "2. Check BigQuery table: sentinel_telemetry.llm_events" -ForegroundColor Gray
Write-Host "3. Monitor subscription metrics in GCP Console" -ForegroundColor Gray
