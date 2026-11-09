#!/bin/zsh

set -e

SCRIPT_DIR="${0:A:h}"
PORT="4173"
URL="http://127.0.0.1:${PORT}/"
PHP_BIN="/Applications/XAMPP/xamppfiles/bin/php"
MYSQL_ADMIN="/Applications/XAMPP/xamppfiles/bin/mysqladmin"

cd "$SCRIPT_DIR"

echo ""
echo "You Glow Cebu local application"
echo "--------------------------------"
echo "Opening: $URL"
echo "Keep this window open while using the application."
echo "Press Control+C here when you are finished."
echo ""

if [[ ! -x "$PHP_BIN" ]]; then
  echo "XAMPP PHP was not found at:"
  echo "$PHP_BIN"
  echo "Please reinstall XAMPP or update PHP_BIN in this file."
  read -k 1
  exit 1
fi

if [[ ! -x "$MYSQL_ADMIN" ]] || ! "$MYSQL_ADMIN" --host=127.0.0.1 --port=3306 --user=root ping --silent 2>/dev/null; then
  echo "XAMPP MySQL is not running."
  echo "Open XAMPP Manager, start MySQL, then run this file again."
  read -k 1
  exit 1
fi

cd "$SCRIPT_DIR/backend"
"$PHP_BIN" -d upload_max_filesize=6M -d post_max_size=8M artisan serve --host=127.0.0.1 --port="$PORT" --no-reload &
SERVER_PID=$!
trap 'kill "$SERVER_PID" 2>/dev/null || true' EXIT INT TERM
sleep 1
open "$URL"
wait "$SERVER_PID"
