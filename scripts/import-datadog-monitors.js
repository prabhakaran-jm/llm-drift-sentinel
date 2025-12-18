#!/usr/bin/env node

/**
 * Script to import Datadog monitors via API
 * 
 * Usage:
 *   node scripts/import-datadog-monitors.js [--dry-run] [--monitor <name>]
 * 
 * Environment variables required:
 *   DD_API_KEY - Datadog API key
 *   DD_APP_KEY - Datadog Application key (optional, but recommended)
 *   DD_SITE - Datadog site (default: datadoghq.com)
 * 
 * Examples:
 *   # Import all monitors
 *   DD_API_KEY=xxx DD_APP_KEY=yyy node scripts/import-datadog-monitors.js
 * 
 *   # Dry run (validate without importing)
 *   DD_API_KEY=xxx DD_APP_KEY=yyy node scripts/import-datadog-monitors.js --dry-run
 * 
 *   # Import specific monitor
 *   DD_API_KEY=xxx DD_APP_KEY=yyy node scripts/import-datadog-monitors.js --monitor llm-safety-score-critical
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import https from 'https';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = join(__dirname, '..');

// Parse command line arguments
const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');
const monitorIndex = args.indexOf('--monitor');
const specificMonitor = monitorIndex !== -1 ? args[monitorIndex + 1] : null;

// Get environment variables
const DD_API_KEY = process.env.DD_API_KEY;
const DD_APP_KEY = process.env.DD_APP_KEY;
const DD_SITE = process.env.DD_SITE || 'datadoghq.com';

if (!DD_API_KEY) {
  console.error('❌ Error: DD_API_KEY environment variable is required');
  console.error('   Get your API key from: https://app.datadoghq.com/organization-settings/api-keys');
  process.exit(1);
}

// Monitor files to import
const MONITORS_DIR = join(PROJECT_ROOT, 'datadog', 'monitors');
const MONITOR_FILES = [
  'llm-high-error-rate.json',
  'llm-high-latency.json',
  'llm-drift-detection.json',
  'llm-safety-score-critical.json',
  'llm-availability-slo.json',
];

/**
 * Make HTTP request to Datadog API
 */
function makeRequest(options, data = null) {
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => {
        try {
          const parsed = body ? JSON.parse(body) : {};
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve({ status: res.statusCode, data: parsed });
          } else {
            reject(new Error(`API error ${res.statusCode}: ${JSON.stringify(parsed)}`));
          }
        } catch (e) {
          reject(new Error(`Failed to parse response: ${body}`));
        }
      });
    });

    req.on('error', reject);

    if (data) {
      req.write(JSON.stringify(data));
    }

    req.end();
  });
}

/**
 * Check if monitor already exists using search endpoint
 */
async function checkMonitorExists(monitorName) {
  // Try using the search endpoint which has better permissions
  const searchQuery = encodeURIComponent(`name:"${monitorName}"`);
  const options = {
    hostname: `api.${DD_SITE}`,
    path: `/api/v1/monitor/search?query=${searchQuery}`,
    method: 'GET',
    headers: {
      'DD-API-KEY': DD_API_KEY,
      'Content-Type': 'application/json',
    },
  };

  if (DD_APP_KEY) {
    options.headers['DD-APPLICATION-KEY'] = DD_APP_KEY;
  }

  try {
    const response = await makeRequest(options);
    if (response.data && response.data.monitors && Array.isArray(response.data.monitors)) {
      const found = response.data.monitors.find(m => m.name === monitorName);
      if (found) {
        // Fetch full monitor details
        return await getMonitorDetails(found.id);
      }
    }
    return null;
  } catch (error) {
    // If search fails, try direct GET (might work with app key)
    if (DD_APP_KEY) {
      try {
        const getOptions = {
          hostname: `api.${DD_SITE}`,
          path: '/api/v1/monitor',
          method: 'GET',
          headers: {
            'DD-API-KEY': DD_API_KEY,
            'DD-APPLICATION-KEY': DD_APP_KEY,
            'Content-Type': 'application/json',
          },
        };
        const response = await makeRequest(getOptions);
        if (response.data && Array.isArray(response.data)) {
          return response.data.find(m => m.name === monitorName);
        }
      } catch (getError) {
        // Both methods failed, that's okay
      }
    }
    // If we can't check, return null (we'll try to create and handle errors)
    return null;
  }
}

/**
 * Get full monitor details by ID
 */
async function getMonitorDetails(monitorId) {
  const options = {
    hostname: `api.${DD_SITE}`,
    path: `/api/v1/monitor/${monitorId}`,
    method: 'GET',
    headers: {
      'DD-API-KEY': DD_API_KEY,
      'Content-Type': 'application/json',
    },
  };

  if (DD_APP_KEY) {
    options.headers['DD-APPLICATION-KEY'] = DD_APP_KEY;
  }

  try {
    const response = await makeRequest(options);
    return response.data;
  } catch (error) {
    return null;
  }
}

/**
 * Create or update a monitor
 */
async function importMonitor(monitorConfig, isUpdate = false, existingId = null) {
  const endpoint = isUpdate ? `/api/v1/monitor/${monitorConfig.id || existingId}` : '/api/v1/monitor';
  const method = isUpdate ? 'PUT' : 'POST';

  const options = {
    hostname: `api.${DD_SITE}`,
    path: endpoint,
    method: method,
    headers: {
      'DD-API-KEY': DD_API_KEY,
      'Content-Type': 'application/json',
    },
  };

  if (DD_APP_KEY) {
    options.headers['DD-APPLICATION-KEY'] = DD_APP_KEY;
  }

  if (isDryRun) {
    console.log(`  [DRY RUN] Would ${isUpdate ? 'update' : 'create'} monitor: ${monitorConfig.name}`);
    return { success: true, dryRun: true };
  }

  try {
    const response = await makeRequest(options, monitorConfig);
    return { success: true, data: response.data };
  } catch (error) {
    // If creation fails with a conflict/duplicate error, try to find and update
    if (!isUpdate && error.message.includes('already exists') || error.message.includes('409') || error.message.includes('duplicate')) {
      console.log(`   ℹ️  Monitor may already exist, attempting to find and update...`);
      // Try to search for it
      const existing = await checkMonitorExists(monitorConfig.name);
      if (existing) {
        monitorConfig.id = existing.id;
        return await importMonitor(monitorConfig, true, existing.id);
      }
    }
    return { success: false, error: error.message };
  }
}

/**
 * Main import function
 */
async function importMonitors() {
  console.log('📊 Datadog Monitor Import Script');
  console.log('================================\n');

  if (isDryRun) {
    console.log('🔍 DRY RUN MODE - No monitors will be created/updated\n');
  }

  console.log(`Site: ${DD_SITE}`);
  console.log(`API Key: ${DD_API_KEY.substring(0, 8)}...`);
  if (DD_APP_KEY) {
    console.log(`App Key: ${DD_APP_KEY.substring(0, 8)}...`);
  } else {
    console.log('⚠️  App Key: Not provided (some operations may require it)');
  }
  console.log('');

  const filesToImport = specificMonitor
    ? MONITOR_FILES.filter(f => f.includes(specificMonitor))
    : MONITOR_FILES;

  if (filesToImport.length === 0) {
    console.error(`❌ No monitors found matching: ${specificMonitor}`);
    process.exit(1);
  }

  console.log(`Found ${filesToImport.length} monitor(s) to import:\n`);

  const results = {
    created: [],
    updated: [],
    failed: [],
    skipped: [],
  };

  for (const filename of filesToImport) {
    const filePath = join(MONITORS_DIR, filename);
    
    try {
      // Read and parse monitor config
      const fileContent = readFileSync(filePath, 'utf-8');
      const monitorConfig = JSON.parse(fileContent);

      console.log(`📝 Processing: ${monitorConfig.name}`);
      console.log(`   File: ${filename}`);

      // Skip SLO monitors - they require creating the SLO first via SLO API
      if (monitorConfig.type === 'slo alert' || filename.includes('slo')) {
        console.log(`   ⚠️  Skipping SLO monitor (requires SLO to be created first)`);
        console.log(`   💡 SLO monitors need to be created in two steps:`);
        console.log(`      1. Create the SLO via Datadog UI or SLO API`);
        console.log(`      2. Create a monitor that references the SLO ID`);
        console.log(`   📖 See: datadog/README.md (SLO Setup section) for detailed instructions`);
        results.skipped.push({ 
          name: monitorConfig.name, 
          reason: 'SLO monitors require SLO to be created first via SLO API' 
        });
        console.log('');
        continue;
      }

      // Check if monitor already exists (may fail due to permissions, that's okay)
      let existing = null;
      try {
        existing = await checkMonitorExists(monitorConfig.name);
      } catch (checkError) {
        // Check failed, but we'll proceed anyway and handle errors during creation
        console.log(`   ℹ️  Could not verify if monitor exists (will attempt create/update)`);
      }
      
      if (existing) {
        console.log(`   ⚠️  Monitor already exists (ID: ${existing.id})`);
        
        if (!isDryRun) {
          // Update existing monitor
          monitorConfig.id = existing.id;
          const result = await importMonitor(monitorConfig, true, existing.id);
          
          if (result.success) {
            console.log(`   ✅ Updated monitor successfully`);
            results.updated.push({ name: monitorConfig.name, id: existing.id });
          } else {
            console.log(`   ❌ Failed to update: ${result.error}`);
            results.failed.push({ name: monitorConfig.name, error: result.error });
          }
        } else {
          results.skipped.push({ name: monitorConfig.name, reason: 'Already exists (dry run)' });
        }
      } else {
        // Create new monitor (or update if creation fails due to duplicate)
        const result = await importMonitor(monitorConfig, false);
        
        if (result.success) {
          if (result.dryRun) {
            results.skipped.push({ name: monitorConfig.name, reason: 'Dry run' });
          } else {
            console.log(`   ✅ Created monitor successfully (ID: ${result.data.id})`);
            results.created.push({ name: monitorConfig.name, id: result.data.id });
          }
        } else {
          console.log(`   ❌ Failed to create: ${result.error}`);
          results.failed.push({ name: monitorConfig.name, error: result.error });
        }
      }

      console.log('');
    } catch (error) {
      console.error(`   ❌ Error processing ${filename}:`, error.message);
      results.failed.push({ name: filename, error: error.message });
      console.log('');
    }
  }

  // Print summary
  console.log('\n📊 Import Summary');
  console.log('================\n');
  console.log(`✅ Created: ${results.created.length}`);
  console.log(`🔄 Updated: ${results.updated.length}`);
  console.log(`⏭️  Skipped: ${results.skipped.length}`);
  console.log(`❌ Failed: ${results.failed.length}\n`);

  if (results.created.length > 0) {
    console.log('Created monitors:');
    results.created.forEach(m => console.log(`  - ${m.name} (ID: ${m.id})`));
    console.log('');
  }

  if (results.updated.length > 0) {
    console.log('Updated monitors:');
    results.updated.forEach(m => console.log(`  - ${m.name} (ID: ${m.id})`));
    console.log('');
  }

  if (results.failed.length > 0) {
    console.log('Failed monitors:');
    results.failed.forEach(m => console.log(`  - ${m.name}: ${m.error}`));
    console.log('');
    process.exit(1);
  }

  if (isDryRun) {
    console.log('💡 Run without --dry-run to actually import monitors\n');
  } else {
    console.log('✅ All monitors imported successfully!\n');
    console.log('📝 Next steps:');
    console.log('   1. Go to Datadog → Monitors to verify');
    console.log('   2. Configure notification channels if needed');
    console.log('   3. Set up the @webhook-datadog-incidents webhook in Datadog Settings');
    console.log('   4. Test monitors with traffic generator\n');
  }
}

// Run the import
importMonitors().catch((error) => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});

