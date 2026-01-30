#!/bin/bash

set -e

echo "=========================================="
echo "  Bilanciami - Update Script"
echo "=========================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored messages
print_success() { echo -e "${GREEN}✓ $1${NC}"; }
print_warning() { echo -e "${YELLOW}⚠ $1${NC}"; }
print_error() { echo -e "${RED}✗ $1${NC}"; }

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Determine compose command
if docker compose version &> /dev/null; then
    COMPOSE_CMD="docker compose"
else
    COMPOSE_CMD="docker-compose"
fi

# Check if we're in a git repository
if [ ! -d ".git" ]; then
    print_error "This is not a git repository"
    echo "Please clone the repository first or run this script from the project root."
    exit 1
fi

# Check for uncommitted changes
if [ -n "$(git status --porcelain)" ]; then
    print_warning "You have uncommitted changes"
    read -p "Do you want to stash them and continue? (y/N): " stash_changes
    if [[ "$stash_changes" =~ ^[Yy]$ ]]; then
        git stash
        print_success "Changes stashed"
        STASHED=1
    else
        print_error "Please commit or stash your changes before updating"
        exit 1
    fi
fi

echo ""
echo "Pulling latest changes from GitHub..."
git fetch origin main
git pull origin main
print_success "Code updated to latest version"

# Restore stashed changes if any
if [ "$STASHED" = "1" ]; then
    echo ""
    echo "Restoring stashed changes..."
    git stash pop || print_warning "Could not restore stashed changes automatically"
fi

echo ""
echo "Stopping current services..."
$COMPOSE_CMD down
print_success "Services stopped"

echo ""
echo "Rebuilding containers..."
$COMPOSE_CMD build --no-cache
print_success "Containers rebuilt"

echo ""
echo "Starting services..."
$COMPOSE_CMD up -d
print_success "Services started"

echo ""
echo "=========================================="
echo "  Update Complete!"
echo "=========================================="
echo "  Frontend:  http://localhost"
echo "  API:       http://localhost:8372"
echo "=========================================="
echo ""
echo "Use 'docker compose logs -f' to view logs"
echo ""
