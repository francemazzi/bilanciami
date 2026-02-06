#!/bin/bash

# Sync Bilanciami to Raspberry Pi
# Usage: ./sync-to-raspberry.sh [user@]raspberry-ip

RASPBERRY_HOST=${1:-"frasma@192.168.68.106"}
REMOTE_DIR="/home/frasma/bilanciami"

echo "Syncing to $RASPBERRY_HOST:$REMOTE_DIR ..."

# Create remote directory
ssh $RASPBERRY_HOST "mkdir -p $REMOTE_DIR"

# Sync files (excluding node_modules, .git, etc.)
rsync -avz --progress \
    --exclude 'node_modules' \
    --exclude '.git' \
    --exclude 'dist' \
    --exclude 'data' \
    --exclude 'uploads/*' \
    --exclude '*.log' \
    --exclude '.env' \
    ./ $RASPBERRY_HOST:$REMOTE_DIR/

echo ""
echo "Files synced! Now SSH into the Raspberry and run:"
echo ""
echo "  ssh $RASPBERRY_HOST"
echo "  cd $REMOTE_DIR"
echo "  sudo ./deploy-raspberry.sh"
echo ""
