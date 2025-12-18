#!/usr/bin/env node

/**
 * Import Datadog Monitors and Dashboard
 * 
 * This script imports all monitors and the dashboard from JSON files
 * into your Datadog organization using the Datadog API.
 * 
 * Usage:
 *   npm run datadog:import
 * 
 * Environment Variables:
 *   DD_API_KEY - Your Datadog API key (required)
 *   DD_APP_KEY - Your Datadog Application key (required)
 *   DD_SITE - Datadog site (default: datadoghq.com)
 */

import axios, { AxiosError } from 'axios';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

interface Config {
  apiKey: string;
  appKey: string;
  site: string;
}

interface ImportResult {
  success: boolean;
  name: string;
  id?: string;
  error?: string;
  skipped?: boolean;
}

function loadConfig(): Config {
  const apiKey = process.env.DD_API_KEY || process.env.DATADOG_API_KEY;
  const appKey = process.env.DD_APP_KEY || process.env.DATADOG_APP_KEY;
  const site = process.env.DD_SITE || process.env.DATADOG_SITE || 'datadoghq.com';

  if (!apiKey) {
    throw new Error('DD_API_KEY or DATADOG_API_KEY environment variable is required');
  }
  if (!appKey) {
    throw new Error('DD_APP_KEY or DATADOG_APP_KEY environment variable is required');
  }

  return { apiKey, appKey, site };
}

function getApiUrl(site: string, endpoint: string): string {
  const baseUrl = site === 'datadoghq.com' 
    ? 'https://api.datadoghq.com'
    : `https://api.${site}`;
  return `${baseUrl}${endpoint}`;
}

async function importMonitor(
  config: Config,
  monitorPath: string
): Promise<ImportResult> {
  try {
    const monitorJson = JSON.parse(fs.readFileSync(monitorPath, 'utf-8'));
    const monitorName = monitorJson.name || path.basename(monitorPath, '.json');

    const url = getApiUrl(config.site, '/api/v1/monitor');
    
    try {
      // Try to create new monitor
      const response = await axios.post(
        url,
        monitorJson,
        {
          headers: {
            'Content-Type': 'application/json',
            'DD-API-KEY': config.apiKey,
            'DD-APPLICATION-KEY': config.appKey,
          },
        }
      );

      return {
        success: true,
        name: monitorName,
        id: response.data.id?.toString(),
      };
    } catch (createError) {
      // If duplicate, try to find and update existing monitor
      if (createError instanceof AxiosError && 
          createError.response?.data?.errors?.some((e: string) => e.includes('Duplicate'))) {
        
        // Extract monitor ID from error message
        const errorText = createError.response.data.errors?.join(' ') || '';
        const duplicateMatch = errorText.match(/monitor_id:(\d+)/);
        
        if (duplicateMatch) {
          const existingId = duplicateMatch[1];
          // Update existing monitor
          const updateUrl = `${url}/${existingId}`;
          await axios.put(
            updateUrl,
            monitorJson,
            {
              headers: {
                'Content-Type': 'application/json',
                'DD-API-KEY': config.apiKey,
                'DD-APPLICATION-KEY': config.appKey,
              },
            }
          );

          return {
            success: true,
            name: monitorName,
            id: existingId,
          };
        } else {
          return {
            success: false,
            name: monitorName,
            error: 'Monitor already exists but could not update',
          };
        }
      }
      throw createError;
    }
  } catch (error) {
    const errorMessage = error instanceof AxiosError
      ? error.response?.data?.errors?.join(', ') || error.message
      : error instanceof Error
      ? error.message
      : 'Unknown error';

    return {
      success: false,
      name: path.basename(monitorPath, '.json'),
      error: errorMessage,
    };
  }
}

async function importDashboard(
  config: Config,
  dashboardPath: string
): Promise<ImportResult> {
  try {
    const dashboardJson = JSON.parse(fs.readFileSync(dashboardPath, 'utf-8'));
    const dashboardTitle = dashboardJson.title || path.basename(dashboardPath, '.json');

    const url = getApiUrl(config.site, '/api/v1/dashboard');
    
    // First, try to find existing dashboard by title
    try {
      const listUrl = getApiUrl(config.site, '/api/v1/dashboard');
      const listResponse = await axios.get(listUrl, {
        params: {
          filter: 'all',
        },
        headers: {
          'DD-API-KEY': config.apiKey,
          'DD-APPLICATION-KEY': config.appKey,
        },
      });

      // Datadog API returns dashboards in different formats, check both
      const dashboards = listResponse.data?.dashboards || listResponse.data || [];
      const existingDashboard = Array.isArray(dashboards)
        ? dashboards.find((d: any) => d.title === dashboardTitle)
        : null;

      if (existingDashboard) {
        // Update existing dashboard - include the ID in the JSON
        const dashboardId = existingDashboard.id;
        const updateUrl = `${url}/${dashboardId}`;
        
        // Preserve the dashboard ID in the JSON for update
        const dashboardToUpdate = { ...dashboardJson };
        
        const response = await axios.put(
          updateUrl,
          dashboardToUpdate,
          {
            headers: {
              'Content-Type': 'application/json',
              'DD-API-KEY': config.apiKey,
              'DD-APPLICATION-KEY': config.appKey,
            },
          }
        );

        console.log(`    🔄 Updated existing dashboard`);
        return {
          success: true,
          name: dashboardTitle,
          id: dashboardId?.toString() || response.data.id?.toString(),
        };
      }
    } catch (listError) {
      // If listing fails, continue with create
      // This is expected if no dashboards exist yet
    }
    
    // Create new dashboard if not found
    const response = await axios.post(
      url,
      dashboardJson,
      {
        headers: {
          'Content-Type': 'application/json',
          'DD-API-KEY': config.apiKey,
          'DD-APPLICATION-KEY': config.appKey,
        },
      }
    );

    return {
      success: true,
      name: dashboardTitle,
      id: response.data.id?.toString(),
    };
  } catch (error) {
    let errorMessage = 'Unknown error';
    
    if (error instanceof AxiosError) {
      if (error.response?.data) {
        const data = error.response.data;
        if (data.errors) {
          errorMessage = Array.isArray(data.errors) 
            ? data.errors.map((e: any) => typeof e === 'string' ? e : JSON.stringify(e)).join(', ')
            : JSON.stringify(data.errors);
        } else if (data.error) {
          errorMessage = typeof data.error === 'string' ? data.error : JSON.stringify(data.error);
        } else {
          errorMessage = JSON.stringify(data);
        }
      } else {
        errorMessage = error.message;
      }
    } else if (error instanceof Error) {
      errorMessage = error.message;
    }

    return {
      success: false,
      name: path.basename(dashboardPath, '.json'),
      error: errorMessage,
    };
  }
}

async function importAll(): Promise<void> {
  console.log('\n🚀 Starting Datadog Configuration Import\n');

  const config = loadConfig();
  console.log(`Datadog Site: ${config.site}`);
  console.log(`API Key: ${config.apiKey.substring(0, 8)}...`);
  console.log(`App Key: ${config.appKey.substring(0, 8)}...\n`);

  const results: ImportResult[] = [];

  // Import monitors
  const monitorsDir = path.join(__dirname, '..', 'datadog', 'monitors');
  const monitorFiles = fs.readdirSync(monitorsDir).filter(f => f.endsWith('.json'));

  console.log(`📊 Importing ${monitorFiles.length} monitors...\n`);

  for (const file of monitorFiles) {
    const monitorPath = path.join(monitorsDir, file);
    
    // Skip SLO monitors - they need to be created via SLO API
    const monitorJson = JSON.parse(fs.readFileSync(monitorPath, 'utf-8'));
    if (monitorJson.type === 'slo alert' || file.includes('slo')) {
      console.log(`  Skipping ${file} (SLO monitors need to be created manually via SLO API)`);
      results.push({
        success: false,
        name: path.basename(monitorPath, '.json'),
        error: 'SLO monitors require different API endpoint - create manually',
        skipped: true,
      });
      continue;
    }
    
    console.log(`  Importing ${file}...`);
    const result = await importMonitor(config, monitorPath);
    results.push(result);
    
    if (result.success) {
      console.log(`    ✅ Success! Monitor ID: ${result.id}`);
    } else {
      console.log(`    ❌ Failed: ${result.error}`);
    }
  }

  // Import dashboard
  const dashboardPath = path.join(__dirname, '..', 'datadog', 'dashboards', 'llm-sentinel-overview.json');
  
  if (fs.existsSync(dashboardPath)) {
    console.log(`\n📈 Importing dashboard...\n`);
    console.log(`  Importing llm-sentinel-overview.json...`);
    const result = await importDashboard(config, dashboardPath);
    results.push(result);
    
    if (result.success) {
      console.log(`    ✅ Success! Dashboard ID: ${result.id}`);
    } else {
      console.log(`    ❌ Failed: ${result.error}`);
    }
  } else {
    console.log(`\n⚠️  Dashboard file not found: ${dashboardPath}`);
  }

  // Summary
  console.log('\n📋 Import Summary\n');
  const successful = results.filter(r => r.success);
  const failed = results.filter(r => !r.success && !r.skipped);
  const skipped = results.filter(r => r.skipped);

  const totalProcessed = successful.length + failed.length;
  const totalItems = results.length;

  console.log(`✅ Successful: ${successful.length}${totalProcessed > 0 ? `/${totalProcessed}` : ''}`);
  successful.forEach(r => {
    console.log(`   - ${r.name}${r.id ? ` (ID: ${r.id})` : ''}`);
  });

  if (failed.length > 0) {
    console.log(`\n❌ Failed: ${failed.length}${totalProcessed > 0 ? `/${totalProcessed}` : ''}`);
    failed.forEach(r => {
      console.log(`   - ${r.name}: ${r.error}`);
    });
  }

  if (skipped.length > 0) {
    console.log(`\n⏭️  Skipped: ${skipped.length}`);
    skipped.forEach(r => {
      console.log(`   - ${r.name}: ${r.error}`);
    });
  }

  console.log('\n✨ Import complete!\n');
  console.log('Next steps:');
  console.log('1. Go to https://app.datadoghq.com/monitors to view your monitors');
  console.log('2. Go to https://app.datadoghq.com/dashboard/lists to view your dashboard');
  console.log('3. Configure notification channels for your monitors\n');
}

// Main execution
importAll().catch((error) => {
  console.error('\n❌ Fatal error:', error.message);
  process.exit(1);
});

export { importAll, importMonitor, importDashboard };

