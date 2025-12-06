#!/usr/bin/env node

import autocannon from 'autocannon';
import { writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Benchmark configuration
const WARMUP_DURATION = 10; // seconds
const TEST_DURATION = 30; // seconds
const CONNECTIONS = 100;

const frameworks = [
  { name: 'NestJS Default', url: 'http://localhost:3001', port: 3001 },
  { name: 'NestJS SSR', url: 'http://localhost:3002', port: 3002 },
  { name: 'Next.js', url: 'http://localhost:3003', port: 3003 },
  { name: 'Remix', url: 'http://localhost:3004', port: 3004 },
];

async function runBenchmark(framework) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`🔥 Benchmarking: ${framework.name}`);
  console.log(`${'='.repeat(60)}\n`);

  // Warm-up phase
  console.log(`⏳ Warming up (${WARMUP_DURATION}s)...`);
  await new Promise((resolve) => {
    autocannon(
      {
        url: framework.url,
        connections: 10,
        duration: WARMUP_DURATION,
      },
      (err) => {
        if (err) console.error('Warmup error:', err);
        resolve();
      }
    );
  });

  console.log(`\n🏃 Running benchmark (${TEST_DURATION}s with ${CONNECTIONS} connections)...\n`);

  // Main benchmark
  return new Promise((resolve, reject) => {
    autocannon(
      {
        url: framework.url,
        connections: CONNECTIONS,
        duration: TEST_DURATION,
        pipelining: 1,
      },
      (err, result) => {
        if (err) {
          reject(err);
          return;
        }

        // Display results
        console.log('\n📊 Results:');
        console.log(`   Requests/sec: ${result.requests.average.toFixed(2)}`);
        console.log(`   Latency (avg): ${result.latency.mean.toFixed(2)}ms`);
        if (result.latency.p95) {
          console.log(`   Latency (p95): ${result.latency.p95.toFixed(2)}ms`);
        }
        if (result.latency.p99) {
          console.log(`   Latency (p99): ${result.latency.p99.toFixed(2)}ms`);
        }
        console.log(`   Throughput: ${(result.throughput.average / 1024 / 1024).toFixed(2)} MB/s`);
        console.log(`   Total Requests: ${result.requests.total}`);
        console.log(`   Errors: ${result.errors}`);

        // Save detailed results to JSON
        const resultsDir = join(__dirname, '..', 'results');
        mkdirSync(resultsDir, { recursive: true });

        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `${framework.name.toLowerCase().replace(/\s+/g, '-')}_${timestamp}.json`;
        const filepath = join(resultsDir, filename);

        writeFileSync(filepath, JSON.stringify(result, null, 2));
        console.log(`\n💾 Results saved to: ${filename}`);

        resolve({
          framework: framework.name,
          port: framework.port,
          result,
        });
      }
    );
  });
}

async function main() {
  console.log('\n' + '='.repeat(60));
  console.log('🚀 NestJS SSR Performance Benchmark Suite');
  console.log('='.repeat(60));
  console.log(`\nConfiguration:`);
  console.log(`  • Warmup: ${WARMUP_DURATION}s`);
  console.log(`  • Test Duration: ${TEST_DURATION}s`);
  console.log(`  • Concurrent Connections: ${CONNECTIONS}`);
  console.log(`  • Frameworks: ${frameworks.length}`);

  const results = [];

  for (const framework of frameworks) {
    try {
      const result = await runBenchmark(framework);
      results.push(result);
    } catch (err) {
      console.error(`\n❌ Error benchmarking ${framework.name}:`, err.message);
      results.push({
        framework: framework.name,
        port: framework.port,
        error: err.message,
      });
    }
  }

  // Save summary
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const summaryPath = join(__dirname, '..', 'results', `summary_${timestamp}.json`);
  writeFileSync(summaryPath, JSON.stringify(results, null, 2));

  console.log('\n' + '='.repeat(60));
  console.log('✅ Benchmark Complete!');
  console.log('='.repeat(60));
  console.log(`\nSummary saved to: summary_${timestamp}.json`);
  console.log('\nRun the comparison script to see detailed results:');
  console.log('  node benchmarks/compare-results.js\n');
}

main().catch(console.error);
