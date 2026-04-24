#!/bin/sh
set -eu

BACKUP_FILE="${1:-}"
BACKUP_DIR="${BACKUP_DIR:-./backups}"
COMPOSE_SERVICE="${COMPOSE_SERVICE:-db}"
POSTGRES_USER="${POSTGRES_USER:-admin}"
DRILL_DB="elitgrid_restore_drill_$(date +%Y%m%d%H%M%S)"

if [ -z "$BACKUP_FILE" ]; then
  BACKUP_FILE="$(find "$BACKUP_DIR" -type f -name 'elitgrid-*.dump' | sort | tail -1)"
fi

if [ -z "$BACKUP_FILE" ] || [ ! -f "$BACKUP_FILE" ]; then
  echo "Backup file not found. Pass a dump file path or create one with scripts/backup-postgres.sh." >&2
  exit 1
fi

cleanup() {
  docker compose exec -T "$COMPOSE_SERVICE" dropdb -U "$POSTGRES_USER" --if-exists "$DRILL_DB" >/dev/null 2>&1 || true
}
trap cleanup EXIT

docker compose exec -T "$COMPOSE_SERVICE" createdb -U "$POSTGRES_USER" "$DRILL_DB"
docker compose exec -T "$COMPOSE_SERVICE" pg_restore -U "$POSTGRES_USER" -d "$DRILL_DB" --no-owner --no-acl < "$BACKUP_FILE"
docker compose exec -T "$COMPOSE_SERVICE" psql -U "$POSTGRES_USER" -d "$DRILL_DB" -v ON_ERROR_STOP=1 -c "select count(*) as tables_restored from information_schema.tables where table_schema = 'public';"

echo "Restore drill passed for $BACKUP_FILE using temporary database $DRILL_DB"
