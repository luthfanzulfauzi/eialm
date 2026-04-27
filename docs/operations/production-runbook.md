# ElitGrid Production Runbook

## Deployment Modes

Default app and database:

```bash
docker compose up -d --build
```

Direct DNS or upstream reverse proxy with Nginx:

```bash
docker compose --profile proxy up -d --build
```

Scheduled local backups:

```bash
docker compose --profile backup up -d
```

For Cloudflare Tunnel, use `deploy/cloudflare-tunnel.example.yml` and point the tunnel service at `http://app:3000`.

## Required Secrets

- `NEXTAUTH_SECRET`
- `NEXTAUTH_URL`
- `CRON_SECRET`
- `OBSERVABILITY_TOKEN`
- `POSTGRES_PASSWORD`
- `ADMIN_PASSWORD`

Generate long random values for all secrets before production use. Do not reuse the example values.

## Health And Metrics

Health endpoint:

```bash
curl -fsS http://localhost:3000/api/health
```

Metrics endpoint:

```bash
curl -fsS -H "Authorization: Bearer $OBSERVABILITY_TOKEN" \
  http://localhost:3000/api/metrics
```

The metrics endpoint emits Prometheus text format and returns `404` unless `OBSERVABILITY_TOKEN` is set and supplied as a bearer token.

## Backups

Admin UI path:

- open `System Settings`
- use the `Backup & Restore` section
- Admins can create, download, refresh, and restore local database backups from the browser
- Admins can also configure backup retention and backup frequency from the same panel

Backup policy fields:

- `Keep Last`: number of backup files to retain
- `Frequency Unit`: `Hour`, `Day`, or `Month`
- `Every`: interval count
- `Run Time`: the scheduled local wall-clock time

Timezone behavior:

- scheduled times are timezone-aware
- the saved schedule uses the admin/browser timezone at the moment the policy is saved
- for example, `00:30` saved in `Asia/Jakarta` is scheduled as `00:30 WIB`, not `00:30 UTC`

Important:

- UI restore replaces the current live database contents
- use restore only with explicit operator confirmation
- prefer testing a backup first with the restore drill before restoring into the active database

One-off logical backup:

```bash
./scripts/backup-postgres.sh
```

Prune local backups older than `BACKUP_RETENTION_DAYS`:

```bash
BACKUP_RETENTION_DAYS=14 ./scripts/prune-backups.sh
```

Scheduled Compose backups write to `./backups` and prune files after `BACKUP_RETENTION_DAYS`.

The app container also mounts `./backups`, so UI-created backups and script-created backups are operating on the same local backup directory.

When the Admin backup policy is enabled, app-driven scheduled backups use count-based retention from the UI policy, while the optional Compose backup profile still uses its own environment-based interval/retention loop.

Production operators should copy backup files to off-host storage and protect them as sensitive data.

## Restore Drill

Validate the latest backup without replacing production data:

```bash
./scripts/restore-drill-postgres.sh
```

Validate a specific backup:

```bash
./scripts/restore-drill-postgres.sh ./backups/elitgrid-elitgrid_db-YYYYMMDD-HHMMSS.dump
```

The drill creates a temporary PostgreSQL database, restores the dump, runs a schema check, and drops the temporary database.

Recommended restore order:

1. Create or identify the target backup.
2. Run the restore drill.
3. Perform UI restore or script restore only after validation.

## Production Validation

Basic validation:

```bash
./scripts/production-validate.sh
```

Include metrics and restore drill:

```bash
OBSERVABILITY_TOKEN=replace-me RUN_RESTORE_DRILL=1 ./scripts/production-validate.sh
```

## Incident Checks

- If `/api/health` returns `503`, inspect database health and app logs.
- If login fails after deployment, verify `NEXTAUTH_URL`, `NEXTAUTH_SECRET`, and browser-accessible hostname.
- If migrations fail on startup, stop the app container, inspect the failed migration, and restore from the latest verified backup before manual repair.
- If disk usage grows, inspect Docker logs, backup retention, and the PostgreSQL volume.
