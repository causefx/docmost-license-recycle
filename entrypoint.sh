#!/bin/sh
set -e

echo "Running initial check on startup..."
node /app/dist/index.js || true

SCHEDULE="${CRON_SCHEDULE:-0 2 * * *}"
echo "Starting cron schedule: ${SCHEDULE}"

printf '%s /usr/local/bin/node /app/dist/index.js\n' "${SCHEDULE}" > /tmp/crontab
exec supercronic /tmp/crontab
