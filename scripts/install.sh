#!/bin/bash
# Installation script for cc-proxy

set -e

INSTALL_DIR="$HOME/.local/bin"
PROJECT_DIR="$(pwd)"

# Check if INSTALL_DIR exists, create if not
if [ ! -d "$INSTALL_DIR" ]; then
    echo "Creating $INSTALL_DIR..."
    mkdir -p "$INSTALL_DIR"
fi

# Create symlink
echo "Installing ccp command..."
ln -sf "$PROJECT_DIR/ccp" "$INSTALL_DIR/ccp"

# Check if INSTALL_DIR is in PATH
if [[ ":$PATH:" != *":$INSTALL_DIR:"* ]]; then
    echo ""
    echo "⚠️  $INSTALL_DIR is not in your PATH"
    echo ""
    echo "Add this to your shell profile (~/.zshrc or ~/.bashrc):"
    echo "  export PATH=\"\$HOME/.local/bin:\$PATH\""
    echo ""
    echo "Then run: source ~/.zshrc  # or source ~/.bashrc"
fi

echo "✅ ccp command installed!"
echo ""
echo "Usage:"
echo "  ccp start    - Start the proxy server"
echo "  ccp stop     - Stop the proxy server"
echo "  ccp restart  - Restart the proxy server"
echo "  ccp status   - Show server status"
echo "  ccp logs     - Show server logs"
echo "  ccp tail     - Tail server logs in real-time"
