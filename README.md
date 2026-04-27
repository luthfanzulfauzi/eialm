# ElitGrid

ElitGrid is a modern web application for managing infrastructure assets, facilities, IP inventory, users, and operational lifecycle data.

The project is built with Next.js 15 LTS, React 19, TypeScript, Prisma, PostgreSQL, NextAuth.js, Tailwind CSS, and Docker.

## Current Status

The project is actively under development.

Implemented well today:

- authentication with role-based access control
- user management
- hardware asset CRUD
- datacenter, warehouse, and rack management with storage inventory views
- rack layout, cross-facility placement flows, utilization summaries, and conflict guardrails
- public IP range management
- private IP range and inventory management
- network audit trail coverage for IP range, status, assignment, and deletion changes
- persisted products / application portfolio CRUD
- product option catalogs for categories, domains, support teams, and business owners
- product relationships to assets, licenses, IP addresses, deployment locations, compliance metadata, and user-backed technical owners
- product portfolio search, lifecycle/environment/criticality/mapping filters, and pagination
- license CRUD, optional key/file metadata, product/asset linkage, expiry views, expiration notices, and maintenance repair workflows
- asset CSV import/export, advanced asset filtering, pagination, and placement validation
- dashboard summary cards, recent activity, expired/expiring license widgets, repair focus views, and operational notices
- authenticated global search across assets, licenses, IPs, products, locations, racks, and maintenance records
- unified toast feedback for core asset, license, and product workflows
- system settings for password change and login timeout

Still in progress:

- authenticated end-to-end browser testing for dashboard/search/toast flows
- cross-module filtering/pagination polish beyond the core inventory and portfolio flows
- production security review, TLS/certificate automation, and deployment validation

The working roadmap is tracked in [milestones.md](./milestones.md).

## Tech Stack

- Next.js 15 App Router
- React 19
- TypeScript
- Tailwind CSS
- Prisma ORM
- PostgreSQL
- NextAuth.js
- Zustand
- React Hook Form
- Zod
- Docker / Docker Compose

## Core Modules

- Authentication
  Admin, Operator, and Viewer roles
- Dashboard
  summary metrics and recent activity
- Asset Inventory
  hardware CRUD, lifecycle status, import/export, audit trail
- Facility Management
  datacenters, warehouses, racks, storage inventory, rack utilization, and rack layout designer
- Network Management
  public/private IP ranges, inventory, status transitions, assignment metadata, and audit trail coverage
- Products / Application Portfolio
  product/application CRUD, configurable catalogs, ownership, compliance metadata, and asset/license/IP/location relationships
- License & Maintenance
  license lifecycle tracking, asset/product relations, maintenance scheduling, broken-asset repair queue, and service history
- Global Search & UX
  Cmd/Ctrl+K cross-module search, risk-aware dashboard widgets, and shared toast notifications
- User Management
  admin-only CRUD and role updates
- Settings
  password change, login timeout policy, and product dropdown catalog management

## Repository Structure

```text
.
├── src/
│   ├── app/                # Next.js App Router pages and API routes
│   ├── components/         # UI, forms, dashboard, tables, layout
│   ├── hooks/              # client-side hooks
│   ├── lib/                # auth, prisma, validation, utilities
│   ├── services/           # domain/service layer
│   └── store/              # Zustand stores
├── prisma/
│   ├── migrations/         # database migrations
│   ├── schema.prisma       # Prisma schema
│   └── seed.ts             # admin seed script
├── public/
├── Dockerfile
├── docker-compose.yml
├── systemdesign.md
└── milestones.md
```

## Prerequisites

Choose one setup path:

- Docker Desktop with Docker Compose
- or Node.js 20+ and PostgreSQL if you want to run outside Docker

## Environment Variables

Create a local `.env` file from `.env.example`, or use the values below as a starting point.

```env
NEXTAUTH_SECRET=replace-with-a-long-random-secret
NEXTAUTH_URL=http://localhost:3000
CRON_SECRET=replace-with-a-long-random-secret
OBSERVABILITY_TOKEN=replace-with-a-long-random-secret

DATABASE_URL=postgresql://admin:password123@localhost:5432/elitgrid_db?schema=public
NODE_ENV=development

POSTGRES_USER=admin
POSTGRES_PASSWORD=password123
POSTGRES_DB=elitgrid_db

ADMIN_EMAIL=admin@elitgrid.internal
ADMIN_PASSWORD=change-this-admin-password
```

Notes:

- `DATABASE_URL` is for local development outside Docker, where `localhost` is usually the database host.
- Docker Compose builds the in-container `DATABASE_URL` from `POSTGRES_USER`, `POSTGRES_PASSWORD`, and `POSTGRES_DB`, using `db` as the database host internally.
- For running outside Docker, `localhost` is the usual database host.
- Production deployments should set real secrets directly in the deployment environment and point `DATABASE_URL` at the production PostgreSQL service. Do not commit real `.env` files.

## Quick Start With Docker

1. Create `.env` using the example above.
2. Build and start the stack:

```bash
docker compose up --build
```

3. Open the app at [http://localhost:3000](http://localhost:3000)

The container startup runs Prisma migrations and verifies the seed admin account automatically.
Compose stores PostgreSQL data in the named Docker volume `postgres-data`; it does not write runtime database files into the repository.

## Production Compose Path

The default Compose stack runs PostgreSQL and the Next.js app directly on port `3000`. For a direct DNS or reverse-proxy deployment path, start the optional Nginx profile:

```bash
docker compose --profile proxy up -d --build
```

Nginx listens on `HTTP_PORT` and `HTTPS_PORT` from `.env` and forwards traffic to the app container. The included default config serves HTTP, forwards `/health` and `/metrics`, and applies baseline security headers. Mount certificates through `TLS_CERTS_DIR` and update `deploy/nginx/conf.d/elitgrid.conf` when terminating TLS inside Nginx.

For Cloudflare Tunnel deployments, keep the app internal and point `cloudflared` at `http://app:3000`. A starter ingress file is available at `deploy/cloudflare-tunnel.example.yml`.

## Health Checks

The app exposes an unauthenticated health endpoint:

```bash
curl http://localhost:3000/api/health
```

The endpoint verifies database connectivity and returns `503` when PostgreSQL is unavailable. Docker Compose uses this endpoint for the app healthcheck, and the Nginx profile maps it to `/health` for load balancers or uptime checks.

The app also exposes token-protected Prometheus-style metrics:

```bash
curl -H "Authorization: Bearer $OBSERVABILITY_TOKEN" \
  http://localhost:3000/api/metrics
```

The metrics endpoint returns `404` unless `OBSERVABILITY_TOKEN` is configured and supplied.

## Backup And Restore

PostgreSQL runtime data is stored in the named Compose volume `postgres-data`.

Admin users can now manage local database backups directly from the app UI at:

- `System Settings` -> `Backup & Restore`

The UI supports:

- creating a backup
- listing available local backup files
- downloading a backup file
- restoring a selected backup back into the active database
- configuring scheduled backup retention and frequency

Backup policy settings in the UI now support:

- keeping the last `N` backup files
- frequency by `hour`, `day`, or `month`
- intervals such as every `1 day`
- scheduled run times such as `00:30`

Scheduled backup times are timezone-aware and are saved using the admin/browser timezone active when the policy is saved.

Restore from the UI is Admin-only and intentionally destructive to current database contents, so use it carefully.

The script-based workflow is still available. Create logical backups with:

```bash
./scripts/backup-postgres.sh
```

Backups are written to `./backups` by default and are ignored by Git. Restore a backup into the running database service with:

```bash
./scripts/restore-postgres.sh ./backups/elitgrid-elitgrid_db-YYYYMMDD-HHMMSS.dump
```

For production, copy backup files to storage outside the Docker host, protect them as sensitive data, and test restore into a non-production environment before relying on the procedure.

The app container now mounts `./backups` and can perform UI-driven backup and restore operations against the same local backup directory.

Run scheduled local backups with retention pruning through the optional backup profile:

```bash
docker compose --profile backup up -d
```

The application also has an Admin-only backup policy in `System Settings -> Backup & Restore`. When enabled, the app checks for due scheduled backups during healthcheck-driven runtime activity and creates the next due backup using the saved retention/frequency policy.

Validate that a backup can be restored without replacing production data:

```bash
./scripts/restore-drill-postgres.sh
```

Operational deployment, backup, restore, metrics, and incident steps are documented in [docs/operations/production-runbook.md](./docs/operations/production-runbook.md).

## Default Admin Account

The Prisma seed script creates or verifies an admin user using these environment variables:

- `ADMIN_EMAIL`
- `ADMIN_PASSWORD`

Default fallback values in the current seed:

- email: `admin@elitgrid.internal`
- password: `admin123`

Change these in `.env` before first use.

## Local Development Without Docker

1. Install dependencies.
2. Start PostgreSQL and create the target database.
3. Configure `.env`.
4. Run Prisma migration and seed.
5. Start the development server.

Typical commands:

```bash
npm install
npx prisma migrate dev
npx prisma db seed
npm run dev
```

## Available Scripts

```bash
npm run dev
npm run build
npm run start
npm run lint
```

## API Surface

Current API routes include:

- `/api/auth/[...nextauth]`
- `/api/users`
- `/api/users/[id]`
- `/api/assets`
- `/api/assets/[id]`
- `/api/assets/import`
- `/api/assets/export`
- `/api/locations`
- `/api/locations/[id]`
- `/api/racks`
- `/api/racks/[id]`
- `/api/network`
- `/api/private-ip/ranges`
- `/api/private-ip/ranges/[id]`
- `/api/public-ip/ranges`
- `/api/public-ip/ranges/[id]`
- `/api/public-ip/ranges/[id]/ips`
- `/api/public-ip/ips`
- `/api/public-ip/ips/[id]`
- `/api/public-ip/inventory`
- `/api/products`
- `/api/products/[id]`
- `/api/product-options`
- `/api/product-options/[id]`
- `/api/search`
- `/api/licenses`
- `/api/licenses/[id]`
- `/api/licenses/[id]/assign`
- `/api/licenses/expiration-refresh`
- `/api/maintenance`
- `/api/maintenance/[id]`
- `/api/settings/password`
- `/api/settings/login-timeout`
- `/api/activity`

The Asset Inventory page now includes query-persisted filtering by category, status, location type, and rack state, plus paginated large-table navigation. Asset create, update, and CSV import share service-level placement validation for warehouse, datacenter, and rack consistency.

The Products / Application page is now a completed portfolio implementation slice. It includes product CRUD, summary metrics, local search, lifecycle/environment/criticality/mapping filters, pagination, asset/license/IP/location relationship mapping, compliance metadata, user-backed technical owners, admin-managed dropdown catalogs, and toast feedback for core portfolio actions. The technical-owner migration and cleanup path have been validated in Docker with no pending migrations.

Global search is available from the dashboard header with Cmd/Ctrl+K. It searches hardware assets, licenses, public/private IP addresses, products/applications, locations, racks, and maintenance records through the authenticated `/api/search` endpoint, then routes users into the relevant module with query context where supported.

License expiration refresh runs opportunistically from the dashboard and can also be triggered by a scheduler:

```bash
curl -X POST http://localhost:3000/api/licenses/expiration-refresh \
  -H "Authorization: Bearer $CRON_SECRET"
```

## Build Notes

The Docker app image has been verified to build successfully in the containerized path, and the compose runtime starts with Prisma reporting no pending migrations.

Current production-readiness coverage includes:

- standalone Docker image build
- container startup migrations and seed verification
- app/database healthcheck endpoint
- token-protected metrics endpoint
- optional Nginx reverse proxy profile
- starter Cloudflare Tunnel ingress example
- PostgreSQL backup, scheduled backup, retention, and restore-drill scripts
- Docker log rotation defaults
- baseline security headers in Next.js and Nginx
- production validation runbook and script
- committed ESLint configuration for non-interactive lint validation
- Next.js upgraded to 15.5.15 LTS with React 19 for continued supported security coverage

There are still a few production-readiness concerns to address:

- final hostname-specific TLS certificate installation
- off-host backup replication and retention
- external log/metrics shipping to the chosen monitoring platform
- Auth.js / NextAuth major-version migration to clear the remaining moderate `uuid` advisory chain
- final deployment validation pass on the production hostname

## Known Gaps

- Cross-module pagination/filter consistency and toast notifications are still pending outside the completed Asset Inventory core.
- Richer dashboard repair widgets are still incomplete.
- Production deployment needs breaking-upgrade security review, off-host retention, external observability hookup, and real-host validation.
- `src/hooks/useDebounce.ts` and `src/components/ui/index.ts` appear unused in the current source tree.
- The old `TECHNICAL_OWNER` product option path has a cleanup migration and was validated in local Docker.

## Roadmap

The next major priorities are:

1. validate Products / Application CRUD in an authenticated browser flow
2. improve advanced filters, pagination, and feedback/toast UX
3. harden production deployment and operations

See [milestones.md](./milestones.md) for the milestone-plus-deliverables plan.

## License

No license file is included in the repository yet. Add a project license before publishing or distributing externally.
