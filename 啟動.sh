#!/bin/bash

echo ""
echo " 正在啟動 HLS Loop Player..."
echo ""

# 檢查 Node.js
if ! command -v node &> /dev/null; then
  echo " [錯誤] 找不到 Node.js"
  echo ""
  echo " 請先安裝 Node.js：https://nodejs.org"
  echo ""
  exit 1
fi

# 自動開啟瀏覽器（Mac）
if [[ "$OSTYPE" == "darwin"* ]]; then
  sleep 1 && open "http://localhost:3000" &
fi

# 啟動 server
node server.js
