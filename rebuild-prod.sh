#!/bin/bash

set -e

WORKING_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$WORKING_DIR"

echo "Rebuilding production build for ralph-kata-2..."

# Install dependencies
echo "Installing dependencies..."
bun i

# Generate Prisma client
echo "Generating Prisma client..."
bun x prisma generate

# Build for production
echo "Building for production..."
bun run build

# Copy static assets for standalone mode
echo "Copying static assets to standalone..."
cp -r .next/static .next/standalone/.next/
if [ -d "public" ]; then
    cp -r public .next/standalone/
fi

echo "Production build complete."
echo "Run ./reboot-prod.sh to restart the service."
