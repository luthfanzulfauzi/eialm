#!/bin/sh
set -eu

if [ "$#" -ne 1 ]; then
  echo "Usage: $0 path/to/eialm.dump" >&2
  exit 1
fi

BACKUP_FILE="$1"
COMPOSE_SERVICE="${COMPOSE_SERVICE:-db}"
POSTGRES_USER="${POSTGRES_USER:-admin}"
POSTGRES_DB="${POSTGRES_DB:-eialm_db}"

if [ ! -f "$BACKUP_FILE" ]; then
  echo "Backup file not found: $BACKUP_FILE" >&2
  exit 1
fi

docker compose exec -T "$COMPOSE_SERVICE" pg_restore \
  -U "$POSTGRES_USER" \
  -d "$POSTGRES_DB" \
  --clean \
  --if-exists \
  --no-owner \
  --no-acl < "$BACKUP_FILE"
