#!/bin/sh
set -eu

BACKUP_DIR="${BACKUP_DIR:-./backups}"
COMPOSE_SERVICE="${COMPOSE_SERVICE:-db}"
POSTGRES_USER="${POSTGRES_USER:-admin}"
POSTGRES_DB="${POSTGRES_DB:-eialm_db}"
TIMESTAMP="$(date +%Y%m%d-%H%M%S)"
OUTPUT_FILE="${BACKUP_DIR}/eialm-${POSTGRES_DB}-${TIMESTAMP}.dump"

mkdir -p "$BACKUP_DIR"

docker compose exec -T "$COMPOSE_SERVICE" pg_dump \
  -U "$POSTGRES_USER" \
  -d "$POSTGRES_DB" \
  -Fc \
  --no-owner \
  --no-acl > "$OUTPUT_FILE"

echo "$OUTPUT_FILE"
