#!/usr/bin/env node

/**
 * Send Test Metrics to Datadog
 * 
 * Sends sample metrics directly to Datadog API to make them appear
 * in Metrics Explorer, allowing SLO creation.
 * 
 * Usage:
 *   npx tsx send-test-metrics.ts
 */

import axios, { AxiosError } from 'axios';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

interface Config {
  apiKey: string;
  site: string;
}

function loadConfig(): Config {
  const apiKey = process.env.DD_API_KEY || process.env.DATADOG_API_KEY;
  const site = process.env.DD_SITE || process.env.DATADOG_SITE || 'datadoghq.com';

  if (!apiKey) {
    throw new Error('DD_API_KEY or DATADOG_API_KEY environment variable is required');
  }

  return { apiKey, site };
}

function getApiUrl(site: string, endpoint: string): string {
  const baseUrl = site === 'datadoghq.com' 
    ? 'https://api.datadoghq.com'
    : `https://api.${site}`;
  return `${baseUrl}${endpoint}`;
}

async function sendTestMetrics(config: Config): Promise<void> {
  console.log('\n🚀 Sending Test Metrics to Datadog\n');
  console.log(`Site: ${config.site}`);
  console.log(`API Key: ${config.apiKey.substring(0, 8)}...\n`);

  const url = getApiUrl(config.site, '/api/v1/series');
  const timestamp = Math.floor(Date.now() / 1000);
  
  // Send metrics for the last hour to make them visible
  const metrics = [];
  const now = Math.floor(Date.now() / 1000);
  const oneHourAgo = now - 3600;
  
  // Generate metrics for the past hour (one point per minute)
  for (let t = oneHourAgo; t <= now; t += 60) {
    // Request count (varying)
    const requestCount = 10 + Math.floor(Math.random() * 20);
    const successCount = Math.floor(requestCount * 0.95); // 95% success rate
    const errorCount = requestCount - successCount;
    
    metrics.push(
      {
        metric: 'llm.request.count',
        points: [[t, requestCount]],
        tags: ['env:dev', 'service:gateway', 'endpoint:/api/chat', 'status:success'],
      },
      {
        metric: 'llm.request.count',
        points: [[t, errorCount]],
        tags: ['env:dev', 'service:gateway', 'endpoint:/api/chat', 'status:error'],
      },
      {
        metric: 'llm.error.count',
        points: [[t, errorCount]],
        tags: ['env:dev', 'service:gateway', 'endpoint:/api/chat'],
      },
      {
        metric: 'llm.latency_ms',
        points: [[t, 500 + Math.random() * 1000]],
        tags: ['env:dev', 'service:gateway', 'endpoint:/api/chat'],
      },
      {
        metric: 'llm.tokens.input',
        points: [[t, 50 + Math.floor(Math.random() * 100)]],
        tags: ['env:dev', 'service:gateway', 'endpoint:/api/chat'],
      },
      {
        metric: 'llm.tokens.output',
        points: [[t, 100 + Math.floor(Math.random() * 200)]],
        tags: ['env:dev', 'service:gateway', 'endpoint:/api/chat'],
      },
      {
        metric: 'llm.tokens.total',
        points: [[t, 150 + Math.floor(Math.random() * 300)]],
        tags: ['env:dev', 'service:gateway', 'endpoint:/api/chat'],
      },
      {
        metric: 'llm.drift_score',
        points: [[t, Math.random() * 0.3]],
        tags: ['env:dev', 'service:gateway', 'endpoint:/api/chat', 'baseline_ready:true'],
      },
      {
        metric: 'llm.safety.score',
        points: [[t, 0.7 + Math.random() * 0.3]],
        tags: ['env:dev', 'service:gateway', 'endpoint:/api/chat', 'safety_label:CLEAN'],
      }
    );
  }

  try {
    const response = await axios.post(
      url,
      { series: metrics },
      {
        headers: {
          'Content-Type': 'application/json',
          'DD-API-KEY': config.apiKey,
        },
      }
    );

    console.log(`✅ Successfully sent ${metrics.length} metric points`);
    console.log(`   Response: ${response.status} ${response.statusText}\n`);
    console.log('📊 Metrics sent:');
    console.log('   - llm.request.count (with status:success and status:error)');
    console.log('   - llm.error.count');
    console.log('   - llm.latency_ms');
    console.log('   - llm.tokens.input');
    console.log('   - llm.tokens.output');
    console.log('   - llm.tokens.total');
    console.log('   - llm.drift_score');
    console.log('   - llm.safety.score\n');
    console.log('⏳ Wait 1-2 minutes, then check:');
    console.log('   https://app.datadoghq.com/metric/explorer');
    console.log('   Search for: llm.request.count\n');
    console.log('✨ Once the metric appears, you can create the SLO!\n');
  } catch (error) {
    if (error instanceof AxiosError) {
      console.error('❌ Failed to send metrics:', error.response?.data || error.message);
    } else {
      console.error('❌ Error:', error);
    }
    process.exit(1);
  }
}

// Main execution
const config = loadConfig();
sendTestMetrics(config).catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});

