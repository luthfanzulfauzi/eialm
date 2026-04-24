#!/bin/sh
set -eu

BACKUP_DIR="${BACKUP_DIR:-./backups}"
BACKUP_RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-14}"

if [ ! -d "$BACKUP_DIR" ]; then
  echo "Backup directory does not exist: $BACKUP_DIR" >&2
  exit 1
fi

find "$BACKUP_DIR" -type f -name 'eialm-*.dump' -mtime +"$BACKUP_RETENTION_DAYS" -print -delete
