#!/bin/bash

set -e

echo "=========================================="
echo "  Bilanciami - Installation Script"
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

# Check if Docker is installed
check_docker() {
    echo "Checking Docker installation..."

    if command -v docker &> /dev/null; then
        print_success "Docker is installed"

        # Check if Docker daemon is running
        if docker info &> /dev/null; then
            print_success "Docker daemon is running"
        else
            print_error "Docker daemon is not running"
            echo "Please start Docker Desktop or the Docker service and try again."
            exit 1
        fi
    else
        print_warning "Docker is not installed"
        install_docker
    fi

    # Check Docker Compose
    if docker compose version &> /dev/null; then
        print_success "Docker Compose is available"
    elif command -v docker-compose &> /dev/null; then
        print_success "Docker Compose (standalone) is available"
    else
        print_error "Docker Compose is not available"
        echo "Please install Docker Compose and try again."
        exit 1
    fi
}

# Install Docker based on OS
install_docker() {
    echo ""
    echo "Attempting to install Docker..."

    case "$(uname -s)" in
        Linux*)
            if [ -f /etc/debian_version ]; then
                # Debian/Ubuntu
                echo "Detected Debian/Ubuntu system"
                sudo apt-get update
                sudo apt-get install -y apt-transport-https ca-certificates curl gnupg lsb-release
                curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg
                echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
                sudo apt-get update
                sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
                sudo usermod -aG docker $USER
                print_success "Docker installed successfully"
                print_warning "You may need to log out and back in for group changes to take effect"
            elif [ -f /etc/redhat-release ]; then
                # CentOS/RHEL/Fedora
                echo "Detected RedHat/CentOS/Fedora system"
                sudo yum install -y yum-utils
                sudo yum-config-manager --add-repo https://download.docker.com/linux/centos/docker-ce.repo
                sudo yum install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
                sudo systemctl start docker
                sudo systemctl enable docker
                sudo usermod -aG docker $USER
                print_success "Docker installed successfully"
            else
                print_error "Unsupported Linux distribution"
                echo "Please install Docker manually: https://docs.docker.com/engine/install/"
                exit 1
            fi
            ;;
        Darwin*)
            echo "Detected macOS"
            if command -v brew &> /dev/null; then
                echo "Installing Docker via Homebrew..."
                brew install --cask docker
                print_success "Docker installed via Homebrew"
                echo "Please open Docker Desktop to complete the installation, then run this script again."
                exit 0
            else
                print_error "Homebrew not found"
                echo "Please install Docker Desktop manually: https://www.docker.com/products/docker-desktop/"
                exit 1
            fi
            ;;
        *)
            print_error "Unsupported operating system"
            echo "Please install Docker manually: https://docs.docker.com/engine/install/"
            exit 1
            ;;
    esac
}

# Generate random hex string
generate_hex() {
    local length=$1
    if command -v openssl &> /dev/null; then
        openssl rand -hex $length
    elif [ -f /dev/urandom ]; then
        head -c $length /dev/urandom | xxd -p | tr -d '\n'
    else
        # Fallback using $RANDOM
        local result=""
        for i in $(seq 1 $((length * 2))); do
            result="${result}$(printf '%x' $((RANDOM % 16)))"
        done
        echo "${result:0:$((length * 2))}"
    fi
}

# Setup environment file
setup_env() {
    echo ""
    echo "Setting up environment..."

    ENV_FILE="$SCRIPT_DIR/.env"

    if [ -f "$ENV_FILE" ]; then
        # Check if ENCRYPTION_KEY exists and is not empty
        if grep -q "^ENCRYPTION_KEY=.\+" "$ENV_FILE" 2>/dev/null; then
            print_success ".env file already configured"
            return
        fi
    fi

    # Generate encryption key
    echo "Generating encryption key..."
    encryption_key=$(generate_hex 32)

    # Write .env file
    cat > "$ENV_FILE" << EOF
# Encryption key for sensitive data (auto-generated)
ENCRYPTION_KEY=$encryption_key
EOF

    print_success ".env file created"
    echo ""
    echo "Note: You can configure your OpenAI API key in the app settings after login."
}

# Create uploads directory
setup_directories() {
    echo ""
    echo "Setting up directories..."

    mkdir -p "$SCRIPT_DIR/uploads"
    print_success "Uploads directory ready"
}

# Start the application
start_app() {
    echo ""
    echo "Starting Bilanciami..."
    echo ""

    # Use docker compose (v2) or docker-compose (v1)
    if docker compose version &> /dev/null; then
        COMPOSE_CMD="docker compose"
    else
        COMPOSE_CMD="docker-compose"
    fi

    # Build and start
    $COMPOSE_CMD build
    $COMPOSE_CMD up -d

    echo ""
    print_success "Bilanciami is starting!"
    echo ""
    echo "=========================================="
    echo "  Application URLs:"
    echo "=========================================="
    echo "  Frontend:  http://localhost"
    echo "  API:       http://localhost:8372"
    echo "=========================================="
    echo ""
    echo "Use 'docker compose logs -f' to view logs"
    echo "Use 'docker compose down' to stop"
    echo ""
}

# Main execution
main() {
    check_docker
    setup_env
    setup_directories
    start_app
}

main
