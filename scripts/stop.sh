#!/bin/bash
# ==========================================
# SmartQuote Stop Script
# ==========================================

echo "[-] Stopping SmartQuote Services..."

# Stop specific processes managed by PM2
pm2 stop smartquote-api smartquote-web 2>/dev/null

# Save the current state (so they remain stopped if the server reboots)
pm2 save --force

echo ">>> Services stopped."
pm2 list
