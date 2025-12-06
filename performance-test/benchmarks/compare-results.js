#!/usr/bin/env node

import Table from 'cli-table3';
import chalk from 'chalk';
import { readdirSync, readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function formatNumber(num) {
  if (num === undefined || num === null) return 'N/A';
  return num.toLocaleString('en-US', { maximumFractionDigits: 2 });
}

function getLatestSummary() {
  const resultsDir = join(__dirname, '..', 'results');

  try {
    const files = readdirSync(resultsDir)
      .filter(f => f.startsWith('summary_') && f.endsWith('.json'))
      .sort()
      .reverse();

    if (files.length === 0) {
      console.error(chalk.red('❌ No benchmark results found!'));
      console.log(chalk.yellow('\nRun the benchmark first:'));
      console.log(chalk.cyan('  node benchmarks/autocannon-test.js\n'));
      process.exit(1);
    }

    const latestFile = files[0];
    const content = readFileSync(join(resultsDir, latestFile), 'utf-8');
    return { filename: latestFile, data: JSON.parse(content) };
  } catch (err) {
    console.error(chalk.red('❌ Error reading results:'), err.message);
    process.exit(1);
  }
}

function compareResults() {
  const { filename, data } = getLatestSummary();

  console.log('\n' + '='.repeat(80));
  console.log(chalk.bold.cyan('📊 NestJS SSR Performance Comparison'));
  console.log('='.repeat(80));
  console.log(chalk.gray(`\nResults from: ${filename}\n`));

  // Create comparison table
  const table = new Table({
    head: [
      chalk.bold('Framework'),
      chalk.bold('Req/sec'),
      chalk.bold('Avg (ms)'),
      chalk.bold('p95 (ms)'),
      chalk.bold('p99 (ms)'),
      chalk.bold('Throughput'),
      chalk.bold('Total Req'),
      chalk.bold('Errors'),
    ],
    colWidths: [20, 12, 11, 11, 11, 14, 12, 10],
  });

  // Collect metrics for ranking
  const metrics = data
    .filter(item => !item.error)
    .map(item => ({
      framework: item.framework,
      reqPerSec: item.result.requests.average,
      latencyAvg: item.result.latency.mean,
      latencyP95: item.result.latency.p95,
      latencyP99: item.result.latency.p99,
      throughput: item.result.throughput.average,
      totalReq: item.result.requests.total,
      errors: item.result.errors,
    }));

  // Find best values for highlighting
  const bestReqPerSec = Math.max(...metrics.map(m => m.reqPerSec));
  const bestLatency = Math.min(...metrics.map(m => m.latencyAvg));
  const p95Values = metrics.map(m => m.latencyP95).filter(v => v !== undefined && v !== null);
  const p99Values = metrics.map(m => m.latencyP99).filter(v => v !== undefined && v !== null);
  const bestP95 = p95Values.length > 0 ? Math.min(...p95Values) : undefined;
  const bestP99 = p99Values.length > 0 ? Math.min(...p99Values) : undefined;

  // Add rows to table
  metrics.forEach(m => {
    const isWinner = m.reqPerSec === bestReqPerSec;

    table.push([
      isWinner ? chalk.bold.green(m.framework) : m.framework,
      m.reqPerSec === bestReqPerSec
        ? chalk.bold.green(formatNumber(m.reqPerSec))
        : formatNumber(m.reqPerSec),
      m.latencyAvg === bestLatency
        ? chalk.bold.green(formatNumber(m.latencyAvg))
        : formatNumber(m.latencyAvg),
      m.latencyP95 !== undefined && m.latencyP95 === bestP95
        ? chalk.bold.green(formatNumber(m.latencyP95))
        : formatNumber(m.latencyP95),
      m.latencyP99 !== undefined && m.latencyP99 === bestP99
        ? chalk.bold.green(formatNumber(m.latencyP99))
        : formatNumber(m.latencyP99),
      `${(m.throughput / 1024 / 1024).toFixed(2)} MB/s`,
      formatNumber(m.totalReq),
      m.errors > 0 ? chalk.red(m.errors) : chalk.green(m.errors),
    ]);
  });

  // Add error rows
  data.filter(item => item.error).forEach(item => {
    table.push([
      chalk.red(item.framework),
      chalk.red('ERROR'),
      chalk.red('-'),
      chalk.red('-'),
      chalk.red('-'),
      chalk.red('-'),
      chalk.red('-'),
      chalk.red('-'),
    ]);
  });

  console.log(table.toString());

  // Performance insights
  console.log('\n' + '='.repeat(80));
  console.log(chalk.bold.cyan('🎯 Performance Insights'));
  console.log('='.repeat(80) + '\n');

  const winner = metrics.reduce((prev, current) =>
    current.reqPerSec > prev.reqPerSec ? current : prev
  );

  console.log(chalk.green('🏆 Highest Throughput:'), chalk.bold(winner.framework));
  console.log(chalk.gray(`   ${formatNumber(winner.reqPerSec)} requests/second\n`));

  const fastest = metrics.reduce((prev, current) =>
    current.latencyAvg < prev.latencyAvg ? current : prev
  );

  console.log(chalk.green('⚡ Lowest Latency:'), chalk.bold(fastest.framework));
  console.log(chalk.gray(`   ${formatNumber(fastest.latencyAvg)}ms average\n`));

  // Relative comparison to NestJS SSR
  const nestjsSsr = metrics.find(m => m.framework === 'NestJS SSR');

  if (nestjsSsr) {
    console.log(chalk.cyan('📈 NestJS SSR Performance:'));

    metrics.forEach(m => {
      if (m.framework !== 'NestJS SSR') {
        const diff = ((m.reqPerSec / nestjsSsr.reqPerSec - 1) * 100).toFixed(1);
        const symbol = diff > 0 ? '+' : '';
        const color = diff > 0 ? chalk.red : chalk.green;

        console.log(`   vs ${m.framework}: ${color(symbol + diff + '%')} throughput`);
      }
    });
  }

  console.log('\n' + '='.repeat(80));
  console.log(chalk.bold.yellow('💡 Understanding the Metrics'));
  console.log('='.repeat(80) + '\n');

  console.log(chalk.bold('Req/sec (Requests per second):'));
  console.log('  Higher is better. Measures throughput under load.\n');

  console.log(chalk.bold('Avg (Average latency):'));
  console.log('  Lower is better. Average response time across all requests.\n');

  console.log(chalk.bold('p95/p99 (95th/99th percentile):'));
  console.log('  Lower is better. Shows worst-case latency for 5% and 1% of requests.\n');

  console.log(chalk.bold('Throughput:'));
  console.log('  Higher is better. Total data transferred per second.\n');

  console.log('='.repeat(80) + '\n');
}

compareResults();
