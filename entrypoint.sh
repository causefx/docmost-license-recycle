#!/bin/sh
set -e

echo "Running initial check on startup..."
node /app/dist/index.js || true

SCHEDULE="${CRON_SCHEDULE:-0 2 * * *}"
echo "Starting cron schedule: ${SCHEDULE}"

printf '%s /app/run.sh\n' "${SCHEDULE}" > /tmp/crontab
exec supercronic /tmp/crontab
