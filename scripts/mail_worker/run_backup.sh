#!/bin/bash

# 获取脚本所在目录的绝对路径
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR" || exit 1

# 检查 node_modules 是否存在，或者 package.json 是否比 node_modules 新
if [ ! -d "node_modules" ] || [ "package.json" -nt "node_modules" ]; then
  echo "[-] Detected dependency changes or missing modules. Installing..."
  npm install
fi

# 运行备份脚本
echo "[-] Starting backup sender..."
node backup_sender.cjs

