#!/usr/bin/env node

/**
 * Advanced Load Testing for PinPoint India API
 * 
 * Uses autocannon for HTTP load testing with detailed metrics
 * 
 * Usage: node scripts/load-test.js <API_KEY>
 * 
 * Features:
 * - Progressive load testing (ramp up from light to heavy)
 * - Detailed latency percentiles (p50, p75, p90, p99)
 * - Requests per second (RPS) measurement
 * - Error rate tracking
 * - Multiple endpoint testing
 */

const autocannon = require('autocannon');
const Table = require('cli-table3');
const chalk = require('chalk');
const dns = require('dns').promises;

// Use Google DNS for resolution (8.8.8.8)
dns.setServers(['8.8.8.8', '8.8.4.4']);

const API_KEY = process.argv[2];
const BASE_URL = process.env.BASE_URL || 'https://pynpoint-production.up.railway.app';

if (!API_KEY) {
  console.error(chalk.red('❌ Error: API key required'));
  console.error('Usage: node scripts/load-test.js <API_KEY>');
  process.exit(1);
}

// Test configurations
const tests = [
  { name: 'Warm-up', duration: 5, connections: 1, pipelining: 1 },
  { name: 'Light Load', duration: 10, connections: 10, pipelining: 1 },
  { name: 'Medium Load', duration: 20, connections: 50, pipelining: 1 },
  { name: 'Heavy Load', duration: 30, connections: 100, pipelining: 1 },
  { name: 'Stress Test', duration: 30, connections: 200, pipelining: 1 },
  { name: 'Ultra Stress', duration: 30, connections: 500, pipelining: 1 },
];

// Endpoints to test
const endpoints = [
  { path: '/api/v1/pincodes/110001', name: 'Single Pincode Lookup' },
  { path: '/api/v1/administrative/states', name: 'List States (Cached)' },
  { path: '/api/v1/pincodes?state=Delhi&limit=10', name: 'Search Pincodes' },
];

const results = [];

async function runTest(endpoint, config) {
  console.log(chalk.blue('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'));
  console.log(chalk.yellow(`🔥 ${config.name} - ${endpoint.name}`));
  console.log(chalk.blue('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'));
  console.log(chalk.gray(`Duration: ${config.duration}s | Connections: ${config.connections}`));

  return new Promise((resolve) => {
    const instance = autocannon({
      url: `${BASE_URL}${endpoint.path}`,
      connections: config.connections,
      pipelining: config.pipelining,
      duration: config.duration,
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
      },
    }, (err, result) => {
      if (err) {
        console.error(chalk.red('Error:'), err);
        resolve(null);
        return;
      }

      // Store results
      results.push({
        test: config.name,
        endpoint: endpoint.name,
        ...result,
      });

      // Display results
      displayResults(result, config.name);
      resolve(result);
    });

    autocannon.track(instance, { renderProgressBar: true });
  });
}

function displayResults(result, testName) {
  const table = new Table({
    head: [chalk.cyan('Metric'), chalk.cyan('Value')],
    colWidths: [30, 30],
  });

  table.push(
    ['Total Requests', result.requests.total.toLocaleString()],
    ['Requests/sec (avg)', result.requests.average.toFixed(2)],
    ['Requests/sec (min)', result.requests.min.toFixed(2)],
    ['Requests/sec (max)', result.requests.max.toFixed(2)],
    ['', ''],
    ['Latency p50', `${result.latency.p50}ms`],
    ['Latency p75', `${result.latency.p75}ms`],
    ['Latency p90', `${result.latency.p90}ms`],
    ['Latency p99', `${result.latency.p99}ms`],
    ['Latency p99.9', `${result.latency.p99_9}ms`],
    ['Latency (avg)', `${result.latency.mean}ms`],
    ['', ''],
    ['Throughput (avg)', `${(result.throughput.average / 1024).toFixed(2)} KB/s`],
    ['Throughput (total)', `${(result.throughput.total / 1024 / 1024).toFixed(2)} MB`],
    ['', ''],
    ['2xx responses', result['2xx']],
    ['Non-2xx responses', result.non2xx],
    ['Errors', result.errors],
  );

  console.log(table.toString());

  // Status indicators
  const errorRate = (result.errors / result.requests.total * 100) || 0;
  const avgLatency = result.latency.mean;
  
  if (errorRate > 5) {
    console.log(chalk.red(`⚠️  High error rate: ${errorRate.toFixed(2)}%`));
  } else if (errorRate > 1) {
    console.log(chalk.yellow(`⚠️  Moderate error rate: ${errorRate.toFixed(2)}%`));
  } else {
    console.log(chalk.green(`✅ Low error rate: ${errorRate.toFixed(2)}%`));
  }

  if (avgLatency > 1000) {
    console.log(chalk.red(`⚠️  High latency: ${avgLatency}ms average`));
  } else if (avgLatency > 500) {
    console.log(chalk.yellow(`⚠️  Moderate latency: ${avgLatency}ms average`));
  } else if (avgLatency > 200) {
    console.log(chalk.blue(`ℹ️  Acceptable latency: ${avgLatency}ms average`));
  } else {
    console.log(chalk.green(`✅ Low latency: ${avgLatency}ms average`));
  }
}

async function main() {
  console.log(chalk.blue('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'));
  console.log(chalk.bold.blue('🚀 PinPoint India - Advanced Load Testing'));
  console.log(chalk.blue('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'));
  console.log(chalk.gray(`Base URL: ${BASE_URL}`));
  console.log(chalk.gray(`API Key: ${API_KEY.substring(0, 20)}...`));
  console.log(chalk.gray(`Total Tests: ${tests.length} × ${endpoints.length} = ${tests.length * endpoints.length}`));

  // Test each endpoint with each configuration
  for (const endpoint of endpoints) {
    for (const config of tests) {
      await runTest(endpoint, config);
      
      // Wait between tests to let server recover
      if (config !== tests[tests.length - 1]) {
        console.log(chalk.gray('\nWaiting 5 seconds before next test...'));
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
    }
  }

  // Final summary
  console.log(chalk.blue('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'));
  console.log(chalk.green('✅ All Load Tests Complete!'));
  console.log(chalk.blue('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n'));
}

main().catch(console.error);
