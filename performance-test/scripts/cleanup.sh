#!/bin/bash

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
echo "🧹 Cleanup Performance Test Environment"
echo "======================================================================"
echo ""

# Ask for confirmation
read -p "This will stop containers, remove images, and clean build artifacts. Continue? (y/N) " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${YELLOW}Cleanup cancelled.${NC}"
    exit 0
fi

echo ""

# Stop and remove containers
echo -e "${BLUE}🛑 Stopping and removing containers...${NC}"
docker-compose -f docker/docker-compose.yml down
echo -e "${GREEN}✓ Containers removed${NC}"
echo ""

# Remove Docker images
echo -e "${BLUE}🗑️  Removing Docker images...${NC}"
docker rmi performance-test-nestjs-default 2>/dev/null && echo -e "${GREEN}✓ Removed nestjs-default image${NC}" || echo -e "${YELLOW}  (nestjs-default image not found)${NC}"
docker rmi performance-test-nestjs-ssr 2>/dev/null && echo -e "${GREEN}✓ Removed nestjs-ssr image${NC}" || echo -e "${YELLOW}  (nestjs-ssr image not found)${NC}"
docker rmi performance-test-nextjs 2>/dev/null && echo -e "${GREEN}✓ Removed nextjs image${NC}" || echo -e "${YELLOW}  (nextjs image not found)${NC}"
docker rmi performance-test-remix 2>/dev/null && echo -e "${GREEN}✓ Removed remix image${NC}" || echo -e "${YELLOW}  (remix image not found)${NC}"
echo ""

# Clean build artifacts
echo -e "${BLUE}🧹 Cleaning build artifacts...${NC}"

# NestJS Default
if [ -d "apps/nestjs-default/dist" ]; then
    rm -rf apps/nestjs-default/dist
    echo -e "${GREEN}✓ Cleaned nestjs-default/dist${NC}"
fi

if [ -d "apps/nestjs-default/node_modules" ]; then
    rm -rf apps/nestjs-default/node_modules
    echo -e "${GREEN}✓ Cleaned nestjs-default/node_modules${NC}"
fi

# NestJS SSR
if [ -d "apps/nestjs-ssr/dist" ]; then
    rm -rf apps/nestjs-ssr/dist
    echo -e "${GREEN}✓ Cleaned nestjs-ssr/dist${NC}"
fi

if [ -d "apps/nestjs-ssr/dist-client" ]; then
    rm -rf apps/nestjs-ssr/dist-client
    echo -e "${GREEN}✓ Cleaned nestjs-ssr/dist-client${NC}"
fi

if [ -d "apps/nestjs-ssr/dist-server" ]; then
    rm -rf apps/nestjs-ssr/dist-server
    echo -e "${GREEN}✓ Cleaned nestjs-ssr/dist-server${NC}"
fi

if [ -d "apps/nestjs-ssr/node_modules" ]; then
    rm -rf apps/nestjs-ssr/node_modules
    echo -e "${GREEN}✓ Cleaned nestjs-ssr/node_modules${NC}"
fi

# Next.js
if [ -d "apps/nextjs/.next" ]; then
    rm -rf apps/nextjs/.next
    echo -e "${GREEN}✓ Cleaned nextjs/.next${NC}"
fi

if [ -d "apps/nextjs/node_modules" ]; then
    rm -rf apps/nextjs/node_modules
    echo -e "${GREEN}✓ Cleaned nextjs/node_modules${NC}"
fi

# Remix
if [ -d "apps/remix/build" ]; then
    rm -rf apps/remix/build
    echo -e "${GREEN}✓ Cleaned remix/build${NC}"
fi

if [ -d "apps/remix/.cache" ]; then
    rm -rf apps/remix/.cache
    echo -e "${GREEN}✓ Cleaned remix/.cache${NC}"
fi

if [ -d "apps/remix/node_modules" ]; then
    rm -rf apps/remix/node_modules
    echo -e "${GREEN}✓ Cleaned remix/node_modules${NC}"
fi

# Root node_modules
if [ -d "node_modules" ]; then
    rm -rf node_modules
    echo -e "${GREEN}✓ Cleaned root node_modules${NC}"
fi

echo ""

# Optionally clean results
read -p "Do you want to remove benchmark results? (y/N) " -n 1 -r
echo ""

if [[ $REPLY =~ ^[Yy]$ ]]; then
    if [ -d "results" ]; then
        # Keep .gitkeep
        find results -type f ! -name '.gitkeep' -delete
        echo -e "${GREEN}✓ Cleaned benchmark results${NC}"
    fi
fi

echo ""
echo "======================================================================"
echo -e "${GREEN}✅ Cleanup complete!${NC}"
echo "======================================================================"
echo ""
