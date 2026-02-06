#!/bin/bash

# Bilanciami - Deploy script for Raspberry Pi
# This script deploys the application with Cloudflare Tunnel for public access

set -e

echo "=========================================="
echo "  Bilanciami - Raspberry Pi Deployment"
echo "=========================================="
echo ""

# Check if running as root or with sudo
if [ "$EUID" -ne 0 ]; then
    echo "Please run with sudo: sudo ./deploy-raspberry.sh"
    exit 1
fi

# Create .env file if not exists or missing required secrets
if [ ! -f .env.production ] || ! grep -q "JWT_SECRET" .env.production; then
    echo "Creating/updating .env.production file with secure secrets..."
    ENCRYPTION_KEY=$(openssl rand -hex 32)
    JWT_SECRET=$(openssl rand -hex 64)
    JWT_REFRESH_SECRET=$(openssl rand -hex 64)
    COOKIE_SECRET=$(openssl rand -hex 32)
    cat > .env.production << EOF
# Production environment - KEEP THIS FILE SECURE!
# Generated on $(date)

# Encryption key for API keys storage (AES-256)
ENCRYPTION_KEY=${ENCRYPTION_KEY}

# JWT secrets for authentication
JWT_SECRET=${JWT_SECRET}
JWT_REFRESH_SECRET=${JWT_REFRESH_SECRET}

# Cookie signing secret
COOKIE_SECRET=${COOKIE_SECRET}
EOF
    chmod 600 .env.production
    echo "Generated secure secrets (file permissions: 600)"
fi

# Create uploads directory
mkdir -p uploads
chmod 777 uploads

echo ""
echo "Starting Docker build and deployment..."
echo "This may take a while on Raspberry Pi..."
echo ""

# Build and start containers
docker compose -f docker-compose.raspberry.yml --env-file .env.production up -d --build

echo ""
echo "=========================================="
echo "  Waiting for services to start..."
echo "=========================================="
echo ""

# Wait for cloudflared to generate the URL
sleep 15

echo ""
echo "=========================================="
echo "  Getting public URL from Cloudflare..."
echo "=========================================="
echo ""

# Get the cloudflared logs to find the public URL
docker compose -f docker-compose.raspberry.yml logs cloudflared 2>&1 | grep -o 'https://[^[:space:]]*trycloudflare.com' | tail -1

echo ""
echo "=========================================="
echo "  Deployment Complete!"
echo "=========================================="
echo ""
echo "Local access:    http://localhost"
echo "Public URL:      Check above (*.trycloudflare.com)"
echo ""
echo "To view logs:    docker compose -f docker-compose.raspberry.yml logs -f"
echo "To stop:         docker compose -f docker-compose.raspberry.yml down"
echo "To get URL:      docker compose -f docker-compose.raspberry.yml logs cloudflared | grep trycloudflare"
echo ""
