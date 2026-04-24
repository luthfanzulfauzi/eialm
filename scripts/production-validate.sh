#!/bin/sh
set -eu

APP_URL="${APP_URL:-http://localhost:3000}"

docker compose config >/dev/null
docker compose ps

curl -fsS "$APP_URL/api/health" >/dev/null
echo "Health check passed: $APP_URL/api/health"

if [ -n "${OBSERVABILITY_TOKEN:-}" ]; then
  curl -fsS -H "Authorization: Bearer $OBSERVABILITY_TOKEN" "$APP_URL/api/metrics" >/dev/null
  echo "Metrics check passed: $APP_URL/api/metrics"
else
  echo "Skipping metrics check because OBSERVABILITY_TOKEN is not set."
fi

if [ "${RUN_RESTORE_DRILL:-0}" = "1" ]; then
  ./scripts/restore-drill-postgres.sh
else
  echo "Skipping restore drill. Set RUN_RESTORE_DRILL=1 to verify the latest backup."
fi
