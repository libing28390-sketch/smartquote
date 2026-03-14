#!/bin/bash
# ==========================================
# SmartQuote Restart Script
# ==========================================

echo "[~] Restarting SmartQuote Services..."

# Restart processes
pm2 restart smartquote-api smartquote-web

# Verify status immediately
echo ">>> Restart command issued."
sleep 2
pm2 list
