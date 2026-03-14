#!/bin/bash

# ==========================================
# 邮件备份定时任务设置脚本
# ==========================================

SCRIPT_PATH="/data/smartquote/scripts/mail_worker/run_backup.sh"
LOG_PATH="/data/smartquote/logs/backup.log"

echo ">>> 设置每周邮件备份任务..."

# 1. 确保脚本有执行权限
if [ -f "$SCRIPT_PATH" ]; then
    chmod +x "$SCRIPT_PATH"
else
    echo "!!! 错误: 未找到备份脚本: $SCRIPT_PATH"
    echo "请确保项目部署在 /data/smartquote 目录"
    exit 1
fi

# 2. 确保日志目录存在
mkdir -p "$(dirname "$LOG_PATH")"

# 3. 更新 Crontab 任务
# 目标任务: 每周一凌晨 3:00 运行
CRON_JOB="0 3 * * 1 $SCRIPT_PATH >> $LOG_PATH 2>&1"

echo "[-] 正在清理旧的 SmartQuote 备份任务..."
# 备份当前 crontab (可选)
# crontab -l > /tmp/crontab.bak 2>/dev/null

# 过滤掉所有包含 'smartquote/scripts/mail_worker' 的旧任务 (无论是旧的 .cjs 还是旧的 .sh)
crontab -l 2>/dev/null | grep -v "smartquote/scripts/mail_worker" | crontab -

echo "[-] 添加新任务: 每周一凌晨 03:00 执行"
(crontab -l 2>/dev/null; echo "$CRON_JOB") | crontab -

echo "[+] Crontab 更新成功！"
echo ""
echo "当前 Crontab 列表:"
crontab -l
echo ""
echo ">>> 设置完成！备份将在每周一凌晨 03:00 自动执行。"

