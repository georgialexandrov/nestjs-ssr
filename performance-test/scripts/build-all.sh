#!/bin/bash

set -e  # Exit on error

echo "======================================================================"
echo "🏗️  Building All Applications"
echo "======================================================================"

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_ROOT"

echo ""
echo -e "${BLUE}Project root: ${PROJECT_ROOT}${NC}"
echo ""

# Function to build an app
build_app() {
    local app_name=$1
    local app_dir=$2

    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo -e "${YELLOW}📦 Building: ${app_name}${NC}"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

    cd "$PROJECT_ROOT/apps/$app_dir"

    echo -e "${BLUE}Installing dependencies...${NC}"
    pnpm install --frozen-lockfile || pnpm install

    echo -e "${BLUE}Building application...${NC}"
    pnpm run build

    echo -e "${GREEN}✅ ${app_name} built successfully!${NC}"
    echo ""
}

# Build NestJS Default
build_app "NestJS Default (Pug)" "nestjs-default"

# Build NestJS SSR
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "${YELLOW}📦 Building: NestJS SSR${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
cd "$PROJECT_ROOT/apps/nestjs-ssr"
echo -e "${BLUE}Installing dependencies...${NC}"
# Need to install from monorepo root for SSR
cd "$PROJECT_ROOT/../.."
pnpm install --frozen-lockfile || pnpm install
cd "$PROJECT_ROOT/apps/nestjs-ssr"
echo -e "${BLUE}Building Vite client bundle...${NC}"
pnpm run build:client
echo -e "${BLUE}Building Vite server bundle...${NC}"
pnpm run build:server
echo -e "${BLUE}Building NestJS application...${NC}"
pnpm run build
echo -e "${GREEN}✅ NestJS SSR built successfully!${NC}"
echo ""

# Build Next.js
build_app "Next.js" "nextjs"

# Build Remix
build_app "Remix (React Router 7)" "remix"

echo "======================================================================"
echo -e "${GREEN}✅ All applications built successfully!${NC}"
echo "======================================================================"
echo ""
echo "Next steps:"
echo "  1. Build Docker images: docker-compose -f docker/docker-compose.yml build"
echo "  2. Run benchmark: ./scripts/run-benchmark.sh"
echo ""
