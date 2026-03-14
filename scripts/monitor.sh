#!/bin/bash

# ==========================================
# SmartQuote Health Check & Auto-Restart Script
# ==========================================

# Configuration
# ---------------------
API_URL="http://127.0.0.1:5000/api/health"
PM2_APP_NAME="all"
LOG_DIR="/data/smartquote/logs"
LOG_FILE="$LOG_DIR/monitor.log"
RETENTION_DAYS=7
export TZ='Asia/Shanghai'

# Ensure log directory exists
mkdir -p "$LOG_DIR"

# Function to log messages with timestamp
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" >> "$LOG_FILE"
}

# Function to rotate logs daily and compress
# Logic: 
# 1. Check if current log file has content from previous day (simple check: if file exists and is not empty)
# 2. Rename current log to monitor-YYYY-MM-DD.log
# 3. Compress it to .gz
# 4. Delete logs older than 7 days
rotate_logs() {
    TODAY=$(date '+%Y-%m-%d')
    
    # If log file exists, check if it needs rotation (simplified: rotate if > 0 bytes)
    # Ideally, logrotate tool is better, but here is a self-contained implementation
    if [ -f "$LOG_FILE" ] && [ -s "$LOG_FILE" ]; then
        # Check if the file was created today? No, simplified: just rotate if size > 1MB or force daily
        # Actually, for "daily rotation", the standard way is to rename based on file modification time.
        # Here we use a simpler approach: Append to a daily file instead of a single monitor.log
        # BUT, user asked to "cut and compress".
        
        # Implementation:
        # We will log to monitor.log. 
        # Every time script runs, we check if there is a log file from YESTERDAY that needs compression.
        # Or more simply: We use 'find' to handle cleanup.
        
        # 1. Cleanup old logs (older than 7 days)
        find "$LOG_DIR" -name "monitor-*.log.gz" -mtime +$RETENTION_DAYS -delete
        
        # 2. Daily Rotation Logic
        # If monitor.log is large or simply we want to archive previous content?
        # A robust way without 'logrotate' daemon:
        # Let's just log directly to a daily file? No, user wants rotation.
        
        # Let's stick to the user's request: "Cut, compress, save 7 days"
        # We will use the system date for the current log file.
        CURRENT_DAY_LOG="$LOG_DIR/monitor-$TODAY.log"
        
        # Redirect LOG_FILE to point to today's file?
        # If we do that, we don't need explicit rotation/compression logic inside the script 
        # except for compressing YESTERDAY's log.
    fi
}

# Improved Logging Strategy:
# 1. Log to monitor-YYYY-MM-DD.log
# 2. Compress files that are NOT today's file
# 3. Delete files older than 7 days

TODAY=$(date '+%Y-%m-%d')
CURRENT_LOG="$LOG_DIR/monitor-$TODAY.log"

# Override the log function to use the daily file
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" >> "$CURRENT_LOG"
}

# Cleanup and Compress Logic
cleanup_and_compress() {
    # 1. Compress any .log files that are NOT today's log and NOT already compressed
    # find "$LOG_DIR" -name "monitor-*.log" ! -name "monitor-$TODAY.log" -exec gzip {} \;
    
    # Use a loop to be safe and avoid race conditions
    for f in "$LOG_DIR"/monitor-*.log; do
        [ -e "$f" ] || continue
        # Skip today's log
        if [ "$f" != "$CURRENT_LOG" ]; then
            gzip -f "$f"
        fi
    done

    # 2. Delete compressed logs older than 7 days
    find "$LOG_DIR" -name "monitor-*.log.gz" -mtime +$RETENTION_DAYS -delete
}

# Run cleanup before checks
cleanup_and_compress

# Check Health Endpoint
# ---------------------
# -s: Silent mode
# -o /dev/null: Discard body
# -w "%{http_code}": Print only HTTP status code
# --max-time 10: Timeout after 10 seconds
HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 "$API_URL")

if [ "$HTTP_STATUS" = "200" ]; then
    # Service is healthy
    # Enable verbose logging as requested
    log "HEALTH CHECK PASSED (HTTP 200)"
    exit 0
else
    log "HEALTH CHECK FAILED (HTTP $HTTP_STATUS). Attempting restart..."
    
    # Load PM2 environment
    export PATH=$PATH:/usr/local/bin:/usr/bin:/bin
    if [ -f "$HOME/.bashrc" ]; then
        . "$HOME/.bashrc"
    fi

    # Attempt Restart
    pm2 restart $PM2_APP_NAME >> "$CURRENT_LOG" 2>&1
    
    if [ $? -eq 0 ]; then
        log "Restart command issued successfully."
    else
        log "CRITICAL: Failed to issue restart command. Please check server manually."
    fi
fi
