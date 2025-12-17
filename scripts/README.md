# Scripts

Utility scripts for the LLM Drift & Abuse Sentinel.

## Traffic Generator

**File**: `traffic-generator.ts`

Generates configurable test traffic to the `/api/chat` endpoint for:
- Testing detection rules and monitors
- Load testing the gateway service
- Triggering alerts in Datadog
- Validating drift and safety detection

### Installation

```bash
cd scripts
npm install
```

### Usage

```bash
npm run traffic:generate [options]
```

### Options

- `--duration=DURATION`: Duration (e.g., `5m`, `30s`, `1h`). Default: `5m`
- `--rate=RATE`: Request rate (e.g., `10/s`, `5/m`). Default: `10/s`
- `--concurrent=N`: Number of concurrent requests. Default: `1`
- `--normal=PERCENT`: Percentage of normal prompts (e.g., `60%`). Default: `60%`
- `--toxic=PERCENT`: Percentage of toxic prompts (e.g., `20%`). Default: `10%`
- `--jailbreak=PERCENT`: Percentage of jailbreak prompts. Default: `10%`
- `--pii=PERCENT`: Percentage of PII prompts. Default: `10%`
- `--repetitive=PERCENT`: Percentage of repetitive prompts. Default: `10%`
- `--verbose, -v`: Enable verbose logging
- `--help, -h`: Show help message

### Environment Variables

- `GATEWAY_URL`: Gateway URL (default: `http://localhost:3000`)

### Examples

```bash
# Normal traffic mix
npm run traffic:generate -- --duration=10m --rate=10/s --normal=100%

# Test error rate monitor (high load)
npm run traffic:generate -- --duration=5m --rate=20/s --concurrent=5

# Test safety monitor (high toxic mix)
npm run traffic:generate -- --duration=2m --rate=10/s --toxic=50%

# Test drift monitor (repetitive prompts)
npm run traffic:generate -- --duration=10m --rate=5/s --repetitive=100%

# Mixed traffic with verbose logging
npm run traffic:generate -- --duration=5m --rate=10/s --toxic=20% --jailbreak=10% --verbose
```

### Output

The script displays:
- Configuration summary
- Real-time progress (if verbose)
- Final statistics:
  - Total requests
  - Success/error counts and percentages
  - Latency statistics (average, p50, p95, p99)

### Prompt Types

The generator includes various prompt types:

- **Normal**: Safe, typical user prompts
- **Toxic**: Hate speech, harassment, offensive content
- **Jailbreak**: Attempts to bypass safety guidelines
- **PII**: Personally identifiable information
- **Repetitive**: Repeated similar prompts (for drift testing)

### Testing Monitors

Use the traffic generator to test specific monitors:

1. **Error Rate Monitor**: High load with concurrent requests
2. **Latency Monitor**: Normal traffic (monitor for slow responses)
3. **Drift Monitor**: Repetitive prompts to establish baseline, then varied prompts
4. **Safety Monitor**: High toxic/jailbreak/PII mix

### Best Practices

1. **Start Small**: Begin with low rates and short durations
2. **Monitor Dashboard**: Watch Datadog dashboard while generating traffic
3. **Check Logs**: Review gateway and analyzer logs for errors
4. **Verify Alerts**: Confirm monitors fire as expected
5. **Clean Up**: Stop traffic generator after testing

### Troubleshooting

**Script fails to connect**:
- Verify gateway is running: `curl http://localhost:3000/health`
- Check `GATEWAY_URL` environment variable

**No metrics in Datadog**:
- Verify analyzer service is running
- Check Datadog API key configuration
- Review analyzer logs for errors

**Monitors not firing**:
- Verify metrics are being emitted (check Datadog Metrics Explorer)
- Check monitor thresholds (may be too high)
- Ensure evaluation window has passed

