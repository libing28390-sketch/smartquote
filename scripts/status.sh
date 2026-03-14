#!/bin/bash
# ==========================================
# SmartQuote Status Script
# ==========================================

echo "=== PM2 Process Status ==="
pm2 list

echo ""
echo "=== API Health Check ==="
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 http://127.0.0.1:5000/api/health)

if [ "$HTTP_CODE" = "200" ]; then
    echo "✅ API is Healthy (HTTP 200)"
else
    echo "❌ API is Unhealthy or Down (HTTP $HTTP_CODE)"
fi

echo ""
echo "=== Recent Logs (Last 10 lines) ==="
pm2 logs smartquote-api --lines 10 --nostream
