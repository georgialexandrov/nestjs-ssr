#!/bin/bash

set -e  # Exit on error

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_ROOT"

echo ""
echo "======================================================================"
echo "🚀 NestJS SSR Performance Benchmark Suite"
echo "======================================================================"
echo ""

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo -e "${RED}❌ Docker is not running. Please start Docker and try again.${NC}"
    exit 1
fi

# Check if pnpm is installed
if ! command -v pnpm &> /dev/null; then
    echo -e "${RED}❌ pnpm is not installed. Please install pnpm and try again.${NC}"
    exit 1
fi

# Install benchmark dependencies
echo -e "${BLUE}📦 Installing benchmark dependencies...${NC}"
pnpm install
echo ""

# Build Docker images
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "${YELLOW}🐳 Building Docker images...${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

docker-compose -f docker/docker-compose.yml build

echo ""
echo -e "${GREEN}✅ Docker images built successfully!${NC}"
echo ""

# Stop and remove existing containers
echo -e "${BLUE}🧹 Cleaning up existing containers...${NC}"
docker-compose -f docker/docker-compose.yml down
echo ""

# Start containers
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "${YELLOW}🚀 Starting containers...${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

docker-compose -f docker/docker-compose.yml up -d

echo ""
echo -e "${GREEN}✅ Containers started!${NC}"
echo ""

# Wait for health checks
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "${YELLOW}⏳ Waiting for services to be healthy...${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# SERVICES=("perf-nestjs-default" "perf-nestjs-ssr" "perf-nextjs" "perf-remix")
MAX_WAIT=60  # Maximum wait time in seconds
ELAPSED=0

for service in "${SERVICES[@]}"; do
    echo -n "Waiting for $service... "

    while [ $ELAPSED -lt $MAX_WAIT ]; do
        HEALTH=$(docker inspect --format='{{.State.Health.Status}}' "$service" 2>/dev/null || echo "starting")

        if [ "$HEALTH" = "healthy" ]; then
            echo -e "${GREEN}✓ Healthy${NC}"
            break
        fi

        sleep 2
        ELAPSED=$((ELAPSED + 2))

        if [ $ELAPSED -ge $MAX_WAIT ]; then
            echo -e "${RED}✗ Timeout${NC}"
            echo ""
            echo -e "${RED}❌ Service $service failed to become healthy within ${MAX_WAIT}s${NC}"
            echo ""
            echo "Container logs:"
            docker logs "$service" --tail 50
            echo ""
            docker-compose -f docker/docker-compose.yml down
            exit 1
        fi
    done

    ELAPSED=0
done

echo ""
echo -e "${GREEN}✅ All services are healthy!${NC}"
echo ""

# Give services a bit more time to stabilize
echo -e "${BLUE}⏳ Stabilizing services (5s)...${NC}"
sleep 5
echo ""

# Run benchmarks
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "${YELLOW}🔥 Running benchmarks...${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

node benchmarks/autocannon-test.js

# Show comparison
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "${YELLOW}📊 Generating comparison report...${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

node benchmarks/compare-results.js

# Stop containers
echo ""
echo -e "${BLUE}🛑 Stopping containers...${NC}"
docker-compose -f docker/docker-compose.yml down
echo ""

echo "======================================================================"
echo -e "${GREEN}✅ Benchmark complete!${NC}"
echo "======================================================================"
echo ""
echo "Results saved in: ./results/"
echo ""
echo "To keep containers running, use:"
echo "  docker-compose -f docker/docker-compose.yml up -d"
echo ""
echo "To stop containers manually:"
echo "  docker-compose -f docker/docker-compose.yml down"
echo ""
