# NestJS SSR Performance Testing Suite

A comprehensive performance testing framework comparing **@nestjs-ssr/react** against Next.js, Remix (React Router 7), and traditional NestJS template rendering.

## Overview

This test suite benchmarks four different SSR approaches rendering identical HTML output:

1. **NestJS Default** - Traditional NestJS with Pug template engine
2. **NestJS SSR** - Your `@nestjs-ssr/react` module with React SSR
3. **Next.js** - Next.js 15 with App Router
4. **Remix** - React Router 7 (formerly Remix)

All applications:
- Render the same HTML structure
- Use identical data (10 items list + interactive counter)
- Run in production mode
- Run in Docker containers with identical resource limits (1 CPU, 512MB RAM)

## Prerequisites

- **Node.js** 18+
- **pnpm** (package manager)
- **Docker** and Docker Compose
- **Git** (for cloning the repository)

## Quick Start

```bash
# Run the complete benchmark (builds apps, Docker images, runs tests)
./scripts/run-benchmark.sh
```

That's it! The script will:
1. Install dependencies
2. Build Docker images
3. Start containers with resource limits
4. Wait for health checks
5. Run autocannon benchmarks
6. Generate comparison report
7. Clean up containers

## Project Structure

```
performance-test/
├── apps/                          # Test applications
│   ├── nestjs-default/           # NestJS + Pug
│   ├── nestjs-ssr/               # NestJS + @nestjs-ssr/react
│   ├── nextjs/                   # Next.js 15
│   └── remix/                    # React Router 7
├── benchmarks/
│   ├── autocannon-test.js        # Main benchmark runner
│   └── compare-results.js        # Results comparison & analysis
├── docker/
│   ├── Dockerfile.nestjs-default
│   ├── Dockerfile.nestjs-ssr
│   ├── Dockerfile.nextjs
│   ├── Dockerfile.remix
│   └── docker-compose.yml        # Orchestration with resource limits
├── scripts/
│   ├── build-all.sh              # Build all apps
│   ├── run-benchmark.sh          # Main benchmark orchestrator
│   └── cleanup.sh                # Clean up everything
├── results/                      # Benchmark results (JSON)
├── package.json                  # Benchmark dependencies
└── README.md                     # This file
```

## Manual Usage

### Step-by-Step Execution

If you want more control, run each step manually:

```bash
# 1. Install benchmark dependencies
pnpm install

# 2. Build all applications (optional, Docker will build anyway)
./scripts/build-all.sh

# 3. Build Docker images
docker-compose -f docker/docker-compose.yml build

# 4. Start containers
docker-compose -f docker/docker-compose.yml up -d

# 5. Wait for services to be healthy
docker-compose -f docker/docker-compose.yml ps

# 6. Run benchmarks
node benchmarks/autocannon-test.js

# 7. View comparison
node benchmarks/compare-results.js

# 8. Stop containers
docker-compose -f docker/docker-compose.yml down
```

### Individual App Testing

Test a single application:

```bash
# Start only one service
docker-compose -f docker/docker-compose.yml up -d nestjs-ssr

# Test manually with curl
curl http://localhost:3002

# Or use autocannon directly
npx autocannon -c 100 -d 30 http://localhost:3002

# Stop the service
docker-compose -f docker/docker-compose.yml down
```

## Benchmark Configuration

Edit `benchmarks/autocannon-test.js` to customize:

```javascript
const WARMUP_DURATION = 10;   // Warmup seconds
const TEST_DURATION = 30;     // Test duration seconds
const CONNECTIONS = 100;      // Concurrent connections
```

### What Gets Measured

| Metric | Description | Good Value |
|--------|-------------|------------|
| **Req/sec** | Requests per second (throughput) | Higher is better |
| **Avg Latency** | Average response time | Lower is better (< 50ms great) |
| **p95 Latency** | 95th percentile response time | Lower is better (< 100ms great) |
| **p99 Latency** | 99th percentile response time | Lower is better (< 200ms acceptable) |
| **Throughput** | Data transferred per second | Higher is better |
| **Errors** | Failed requests | 0 is ideal |

## Understanding Results

### Sample Output

```
┌─────────────────┬──────────┬─────────┬─────────┬─────────┬────────┐
│ Framework       │ Req/sec  │ Avg(ms) │ p95(ms) │ p99(ms) │ Memory │
├─────────────────┼──────────┼─────────┼─────────┼─────────┼────────┤
│ NestJS Default  │ 5,234    │ 19.1    │ 28.3    │ 35.2    │ 145MB  │
│ NestJS SSR      │ 4,891    │ 20.4    │ 31.5    │ 38.9    │ 178MB  │
│ Next.js         │ 3,456    │ 28.9    │ 42.1    │ 51.3    │ 234MB  │
│ Remix           │ 4,123    │ 24.3    │ 36.8    │ 44.5    │ 201MB  │
└─────────────────┴──────────┴─────────┴─────────┴─────────┴────────┘
```

### Interpretation

**Higher Req/sec = Better Throughput**
- Can handle more users simultaneously
- Better for high-traffic applications

**Lower Latency = Faster Response**
- Better user experience
- Faster page loads

**p95/p99 Percentiles**
- p95: 95% of requests finish within this time
- p99: 99% of requests finish within this time
- These matter more than average for user experience

### Expected Results

Typical performance characteristics:

1. **NestJS Default (Pug)** - Fastest
   - Simple template rendering
   - No client-side JavaScript hydration
   - Lowest overhead

2. **NestJS SSR** - Slightly slower than Pug
   - React SSR + hydration
   - More features (component composition, hooks)
   - Still very competitive

3. **Next.js** - Moderate performance
   - Full-featured framework
   - React Server Components overhead
   - More abstraction layers

4. **Remix** - Good performance
   - Efficient data loading
   - Streaming support
   - Framework overhead present

## Resource Constraints

All containers are limited to ensure fair comparison:

```yaml
deploy:
  resources:
    limits:
      cpus: '1.0'        # 1 CPU core
      memory: 512M       # 512MB RAM
    reservations:
      cpus: '0.5'        # 0.5 CPU minimum
      memory: 256M       # 256MB minimum
```

This simulates a typical production environment with limited resources.

## Ports

| Application | Port |
|-------------|------|
| NestJS Default | 3001 |
| NestJS SSR | 3002 |
| Next.js | 3003 |
| Remix | 3004 |

## Cleanup

Remove all Docker containers, images, and build artifacts:

```bash
./scripts/cleanup.sh
```

This will:
- Stop and remove all containers
- Remove Docker images
- Clean build artifacts (dist/, .next/, build/)
- Optionally remove benchmark results

## Troubleshooting

### Containers won't start

```bash
# Check Docker is running
docker info

# Check container logs
docker-compose -f docker/docker-compose.yml logs nestjs-ssr

# Rebuild images
docker-compose -f docker/docker-compose.yml build --no-cache
```

### Port already in use

```bash
# Find what's using the port
lsof -i :3001

# Kill the process or change port in docker-compose.yml
```

### Build failures

```bash
# Clean everything and start fresh
./scripts/cleanup.sh
./scripts/build-all.sh
```

### Memory issues

If Docker runs out of memory:

```bash
# Increase Docker memory limit in Docker Desktop settings
# Or reduce memory limits in docker-compose.yml
```

## Advanced Usage

### Profiling with Clinic.js

For deep performance analysis:

```bash
# Install clinic globally
npm install -g clinic

# Start a container
docker-compose -f docker/docker-compose.yml up -d nestjs-ssr

# Profile the application
clinic doctor -- node apps/nestjs-ssr/dist/main.js

# Run load test
npx autocannon -c 100 -d 30 http://localhost:3002

# Stop profiling and view report
# Clinic will open a browser with flame graphs
```

### Custom Benchmarks

Create your own benchmark scenarios:

```javascript
// benchmarks/custom-test.js
import autocannon from 'autocannon';

autocannon({
  url: 'http://localhost:3002',
  connections: 500,        // Heavy load
  duration: 60,            // 1 minute
  pipelining: 10,          // Request pipelining
  requests: [
    {
      method: 'GET',
      path: '/'
    }
  ]
}, console.log);
```

### CI/CD Integration

Run benchmarks in GitHub Actions:

```yaml
# .github/workflows/benchmark.yml
name: Performance Benchmark

on:
  push:
    branches: [main]
  pull_request:

jobs:
  benchmark:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: pnpm/action-setup@v2
      - uses: actions/setup-node@v3
        with:
          node-version: 18
          cache: 'pnpm'

      - name: Run benchmarks
        run: |
          cd performance-test
          ./scripts/run-benchmark.sh

      - name: Upload results
        uses: actions/upload-artifact@v3
        with:
          name: benchmark-results
          path: performance-test/results/
```

## Learning Resources

### Understanding Performance Metrics

- **Latency vs Throughput**: Latency is response time, throughput is requests/second
- **Percentiles**: p95 and p99 show worst-case performance, not averages
- **Concurrency**: More connections = more realistic load testing

### Tools Used

- **autocannon**: Fast HTTP benchmarking (Node.js native)
- **Docker**: Consistent testing environment
- **cli-table3**: Pretty terminal tables
- **chalk**: Colored output

### Further Reading

- [autocannon Documentation](https://github.com/mcollina/autocannon)
- [Docker Resource Constraints](https://docs.docker.com/config/containers/resource_constraints/)
- [Understanding Percentiles](https://www.dynatrace.com/news/blog/why-averages-suck-and-percentiles-are-great/)
- [Node.js Performance Best Practices](https://nodejs.org/en/docs/guides/simple-profiling/)

## Contributing

Ideas for improvements:

1. Add more frameworks (Fastify, Hono, etc.)
2. Test streaming SSR performance
3. Add cache scenarios
4. Test with different payload sizes
5. Memory leak detection
6. CPU profiling integration

## License

MIT - This is a testing framework for educational purposes.
