#!/bin/bash
BASE_DIR="/data/smartquote"

# 1. 确保没有残留进程
pkill -f "node server.js"
pm2 delete smartquote-api 2>/dev/null
pm2 delete smartquote-web 2>/dev/null

# 2. 启动后端 (API)
echo "Starting Backend..."
cd "$BASE_DIR" || exit 1
pm2 start server.js --name smartquote-api

# 3. 启动前端 (Web - 开发模式)
# 注意：生产环境建议 build 后用 Nginx 托管，但如果您想保持现状，也可以用 PM2 跑 npm run dev
echo "Starting Frontend..."
pm2 start "npm run dev" --name smartquote-web

# 4. 保存状态，确保开机自启
pm2 save

echo "Done! PM2 is now managing both services."
