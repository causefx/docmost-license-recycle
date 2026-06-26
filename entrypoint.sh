#!/bin/sh
set -e

echo "Running initial check on startup..."
node /app/dist/index.js || true

SCHEDULE="${CRON_SCHEDULE:-0 2 * * *}"
echo "Starting cron schedule: ${SCHEDULE}"

# Write crontab for root
echo "${SCHEDULE} /app/run.sh" | crontab -

# Run crond in foreground (-f) with logging to stderr (-d 8)
exec crond -f -d 8
