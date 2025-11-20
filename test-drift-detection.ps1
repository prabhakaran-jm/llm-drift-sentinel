# Test script for drift detection with real embeddings
Write-Host "=== Testing Drift Detection ===" -ForegroundColor Cyan
Write-Host ""

# Send multiple requests to build baseline and detect drift
$messages = @(
    "What is the capital of France?",
    "What is the capital of France?",
    "What is the capital of France?",
    "What is the capital of France?",
    "What is the capital of France?",
    "Tell me about Paris, the city of lights",
    "What is the main city in France?",
    "Explain quantum computing in simple terms"
)

Write-Host "Sending $($messages.Count) requests to build baseline and test drift..." -ForegroundColor Yellow
Write-Host ""

foreach ($msg in $messages) {
    Write-Host "Sending: $msg" -ForegroundColor Gray
    
    try {
        $body = @{ message = $msg } | ConvertTo-Json
        $response = Invoke-WebRequest -Uri http://localhost:3000/api/chat -Method POST -Headers @{"Content-Type"="application/json"} -Body $body -ErrorAction Stop
        $result = $response.Content | ConvertFrom-Json
        
        Write-Host "  Request ID: $($result.requestId)" -ForegroundColor DarkGray
        Write-Host "  Response: $($result.response.Substring(0, [Math]::Min(60, $result.response.Length)))..." -ForegroundColor DarkGray
        
        Start-Sleep -Seconds 2
    } catch {
        Write-Host "  Error: $_" -ForegroundColor Red
    }
    
    Write-Host ""
}

Write-Host "=== Test Complete ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "Check analyzer logs for:" -ForegroundColor Yellow
Write-Host "- Baseline creation messages" -ForegroundColor Gray
Write-Host "- Similarity scores (should be high for similar questions)" -ForegroundColor Gray
Write-Host "- Drift scores (should be low for similar, higher for different)" -ForegroundColor Gray
Write-Host ""
Write-Host "Expected behavior:" -ForegroundColor Yellow
Write-Host "- First 5 requests: Build baseline (similarity ~1.0)" -ForegroundColor Gray
Write-Host "- Request 6-7: Similar to baseline (high similarity, low drift)" -ForegroundColor Gray
Write-Host "- Request 8: Different topic (lower similarity, higher drift)" -ForegroundColor Gray

