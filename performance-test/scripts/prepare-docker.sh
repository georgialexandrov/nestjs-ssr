#!/bin/bash

set -e

echo "======================================================================"
echo "🔧 Preparing for Docker Build"
echo "======================================================================"
echo ""

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Get absolute path to monorepo root
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

# Navigate to monorepo root
cd "$REPO_ROOT"

echo -e "${BLUE}📦 Building @nestjs-ssr/react package...${NC}"
cd packages/react
pnpm run build
echo -e "${GREEN}✅ Package built${NC}"
echo ""

echo -e "${BLUE}📦 Creating tarball of @nestjs-ssr/react...${NC}"
pnpm pack --pack-destination "$REPO_ROOT"
echo -e "${GREEN}✅ Tarball created${NC}"
echo ""

# Go back to root and rename tarball
cd "$REPO_ROOT"
TARBALL=$(ls nestjs-ssr-react-*.tgz 2>/dev/null | head -1)

if [ -n "$TARBALL" ]; then
    echo -e "${BLUE}📦 Renaming tarball to consistent name...${NC}"
    mv "$TARBALL" nestjs-ssr-react.tgz
    echo -e "${GREEN}✅ Renamed to: nestjs-ssr-react.tgz${NC}"
else
    echo -e "${YELLOW}⚠️  Could not find tarball${NC}"
    exit 1
fi

echo ""
echo -e "${BLUE}📝 Updating package.json to use tarball...${NC}"
cd "$REPO_ROOT/performance-test/apps/nestjs-ssr"

# Temporarily update package.json to use file: instead of link:
if grep -q "link:../../../packages/react" package.json; then
    sed -i.bak 's|"link:../../../packages/react"|"file:../../../nestjs-ssr-react.tgz"|' package.json
    rm -f package.json.bak
    echo -e "${GREEN}✅ Updated package.json${NC}"
fi

echo ""
echo "======================================================================"
echo -e "${GREEN}✅ Ready for Docker build!${NC}"
echo "======================================================================"
echo ""
echo "Next steps:"
echo "  cd $REPO_ROOT/performance-test"
echo "  docker-compose -f docker/docker-compose.yml build"
echo ""
