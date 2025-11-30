#!/usr/bin/env bash

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Get the script directory and project root
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
FIRMWARE_DIR="$PROJECT_ROOT/vendor/firmware"
PATCH_FILE="$PROJECT_ROOT/firmware-patch.diff"

echo "Generating firmware patch..."

# Check if vendor/firmware exists
if [ ! -d "$FIRMWARE_DIR" ]; then
  echo -e "${RED}Error: vendor/firmware directory not found${NC}"
  exit 1
fi

cd "$FIRMWARE_DIR"
echo "Changed to $FIRMWARE_DIR"

# Check if this is a git repository (handles both regular repos and submodules)
if ! git rev-parse --git-dir > /dev/null 2>&1; then
  echo -e "${RED}Error: vendor/firmware is not a git repository${NC}"
  exit 1
fi

# Check for uncommitted changes
if ! git diff-index --quiet HEAD --; then
  echo -e "${YELLOW}Warning: Uncommitted changes detected in vendor/firmware${NC}"
  echo "Please commit or stash your changes before generating the patch."
  exit 1
fi

# Ensure we're on the meshenvy/module-registry branch
CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
if [ "$CURRENT_BRANCH" != "meshenvy/module-registry" ]; then
  echo "Switching to meshenvy/module-registry branch..."
  git checkout meshenvy/module-registry || {
    echo -e "${RED}Error: Failed to checkout meshenvy/module-registry branch${NC}"
    exit 1
  }
fi

# Add upstream remote if it doesn't exist
if ! git remote | grep -q "^upstream$"; then
  echo "Adding upstream remote (meshtastic/firmware)..."
  git remote add upstream https://github.com/meshtastic/firmware.git
else
  # Update upstream URL in case it changed
  git remote set-url upstream https://github.com/meshtastic/firmware.git
fi

# Fetch from upstream
echo "Fetching from upstream..."
git fetch upstream

# Update local develop branch from upstream/develop
if git show-ref --verify --quiet refs/heads/develop; then
  echo "Updating local develop branch from upstream/develop..."
  git checkout develop
  git reset --hard upstream/develop
else
  echo "Creating local develop branch from upstream/develop..."
  git checkout -b develop upstream/develop
fi

# Switch back to meshenvy/module-registry
echo "Switching back to meshenvy/module-registry..."
git checkout meshenvy/module-registry

# Merge develop into meshenvy/module-registry
echo "Merging develop into meshenvy/module-registry..."
if ! git merge develop --no-edit; then
  echo -e "${RED}Error: Merge conflicts detected${NC}"
  echo "Please resolve conflicts manually and then run:"
  echo "  git diff develop..meshenvy/module-registry > ../../firmware-patch.diff"
  exit 1
fi

# Generate the patch
echo "Generating patch file..."
git diff develop..meshenvy/module-registry > "$PATCH_FILE"

if [ $? -eq 0 ]; then
  PATCH_SIZE=$(wc -l < "$PATCH_FILE")
  echo -e "${GREEN}Successfully generated firmware-patch.diff (${PATCH_SIZE} lines)${NC}"
else
  echo -e "${RED}Error: Failed to generate patch file${NC}"
  exit 1
fi
