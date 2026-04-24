# ElitGrid Codebase Reference

Last reviewed: 2026-04-25
Reviewer context: generated after reading `README.md`, `milestones.md`, `systemdesign.md`, and the current repository source/ops files.

## Purpose

This file is the single reusable reference for future runs so the codebase does not need to be re-read from scratch each time. It summarizes the actual implementation, not just the intended design.

## Project Snapshot

- App type: internal infrastructure operations platform
- Framework: Next.js 15 App Router + React 19 + TypeScript
- Styling: Tailwind CSS
- Auth: `next-auth` credentials provider with JWT session strategy
- Data layer: Prisma + PostgreSQL
- State/helpers: Zustand, React Hook Form, Zod
- Deployment: Docker multi-stage build, Docker Compose, optional Nginx proxy, Cloudflare Tunnel example
- Current maturity: core modules are implemented for assets, locations/racks, public/private IPs, products, licenses, maintenance, users, settings, dashboard, and global search

## High-Level Architecture

- `src/app`
  App Router pages and API endpoints
- `src/services`
  Main business logic layer used by API routes
- `src/lib`
  Auth, Prisma client, validations, CSV/IP utilities, audit helper
- `src/components`
  Shared UI pieces, forms, dashboard widgets, search, sidebar, table views
- `src/hooks`
  Small client hooks for debouncing and role helpers
- `src/providers`
  Session and toast providers
- `src/store`
  Sidebar UI state via Zustand
- `prisma`
  Schema, migrations, seed scripts
- `deploy`
  Nginx and Cloudflare tunnel deployment helpers
- `scripts`
  Backup, restore, restore drill, and production validation helpers
- `docs/operations`
  Production runbook

## Runtime Flow

1. Requests enter Next.js App Router.
2. `src/middleware.ts` enforces auth, role restrictions, and idle timeout via `elitgrid_last_activity` cookie.
3. API routes use `getServerSession(authOptions)` to authorize requests.
4. Route handlers call service-layer methods in `src/services`.
5. Services read/write via Prisma and persist audit/operational records where needed.
6. Client dashboard pages fetch from `/api/*` endpoints and render with modal-driven CRUD flows.

## Authentication And Access Control

Key files:

- `src/lib/auth.ts`
- `src/middleware.ts`
- `src/components/auth/ActivityPinger.tsx`
- `src/providers/auth-provider.tsx`
- `src/types/next-auth.d.ts`

Behavior:

- Credentials login uses email/password against Prisma user records with bcrypt hash verification.
- JWT token stores `id`, `role`, and `loginTimeout`.
- JWT callback refreshes current role and timeout from DB on later requests.
- Successful sign-in updates `lastLogin` and `lastActivityAt`.
- Middleware blocks:
  - `/users` for non-admins
  - `/settings` for viewers
  - selected mutation-oriented paths for viewers
- Session timeout is cookie-based and enforced in middleware for both pages and APIs.
- `ActivityPinger` updates `/api/activity` to keep active sessions alive without refreshing idle tabs.

Roles:

- `ADMIN`
- `OPERATOR`
- `VIEWER`

## Domain Model

Primary Prisma models in `prisma/schema.prisma`:

- `User`
  login identity, role, timeout, activity metadata, technical product ownership
- `Location`
  datacenter or warehouse
- `Rack`
  belongs to datacenter location, stores rack units and assigned assets
- `Asset`
  hardware inventory, server specs, facility/rack placement, IP/license/product relations, maintenance history
- `PublicIPRange`
  managed public CIDR blocks
- `PrivateIPRange`
  managed private CIDR blocks
- `IPAddress`
  individual IP inventory with status and assignment target metadata
- `License`
  optional key/file/PO-SI-SO number, expiry state, asset/product links
- `Product`
  application portfolio record with ownership, compliance, infra relationships
- `ProductOption`
  configurable dropdown values for category/domain/team/business owner
- `MaintenanceRecord`
  preventive/inspection/repair workflows tied to assets
- `SystemJobRun`
  lightweight job throttling state
- `OperationalNotification`
  in-app notices for license expiry risk
- `AuditLog`
  actor/action/details trail, mostly asset-linked

Important enums:

- `Role`
- `AssetStatus`
- `LocationType`
- `RackFace`
- `IPStatus`
- `IPAssignmentTargetType`
- `ProductEnvironment`
- `ProductLifecycle`
- `ProductCriticality`
- `ProductOptionType`
- `MaintenanceType`
- `MaintenanceStatus`
- `MaintenancePriority`

## Migrations History

The migration sequence shows the real growth path of the app:

- rack units and rack face support
- public IP management
- IP assignment targets
- private IP range management
- user last activity tracking
- optional license file/key support
- product portfolio base
- product option catalogs
- user-backed technical owners for products
- cleanup of old technical owner option approach
- maintenance management
- operational notifications
- product dependency mapping
- license `poSiSoNumber`

## Services Layer

### `src/services/assetService.ts`

- asset list with filters: search, category, status, location type, rack state, pagination
- create/update/delete asset
- placement validation for warehouse vs datacenter vs rack consistency
- category-based rule: rack required for server/network hardware in datacenters
- audit logging on create/update/delete/move-related operations

### `src/services/publicIpService.ts`

- public range CRUD
- generate inventory from range
- public IP inventory view with subnet summaries
- assignment validation for `HARDWARE`, `VM`, `OTHER`
- overlap prevention and status handling

### `src/services/networkService.ts`

- private range CRUD
- private inventory listing and summaries
- RFC1918 validation
- CIDR host expansion with safety bounds
- assignment/status mutation logic
- numeric IPv4 sort helpers

### `src/services/productService.ts`

- product CRUD
- relation mapping to assets, licenses, IPs, locations
- validation that linked records/options/users exist
- grouped product-option catalog loading
- technical owner is a required user-backed relation in current validation flow

### `src/services/licenseService.ts`

- license CRUD
- asset assignment
- product linkage
- expiry refresh job
- operational notifications for expired/expiring-soon licenses
- manager data with summary counts

### `src/services/maintenanceService.ts`

- maintenance list/summary loading
- create/update maintenance records
- automatic asset status transitions for repair/in-progress/completed workflows
- audit logging for maintenance actions

### `src/services/userService.ts`

- admin-only user listing, creation, deletion

### `src/services/settingsService.ts`

- password change
- global login-timeout update

## Validation Layer

Zod schemas live in `src/lib/validations`.

- `asset.ts`
  placement rules, optional numeric coercion, rack/category constraints
- `license.ts`
  optional date parsing and deduped relation arrays
- `maintenance.ts`
  required schedule date and enumerated status/priority/type
- `product.ts`
  normalized product code, optional URL validation, relation arrays, option schemas
- `user.ts`
  basic create-user schema

## Utility Layer

Key helpers in `src/lib`:

- `prisma.ts`
  shared singleton Prisma client
- `auth.ts`
  NextAuth configuration
- `audit.ts`
  best-effort audit writer
- `ip.ts`
  IPv4 parsing, formatting, sorting, CIDR calculations, RFC1918 checks
- `csv.ts`
  lightweight CSV parse/export utility
- `utils.ts`
  Tailwind class merge helper and a few UI formatting helpers

## UI And Page Structure

Top-level pages:

- `/login`
- `/`
- `/assets/hardware`
- `/assets/locations/datacenters`
- `/assets/locations/datacenters/[id]/racks`
- `/assets/locations/datacenters/[id]/racks/[rackId]`
- `/assets/locations/warehouses`
- `/licenses`
- `/maintenance`
- `/network/public`
- `/network/private`
- `/products`
- `/settings`
- `/users`

Notable UI building blocks:

- `src/components/layout/Sidebar.tsx`
  main nav with collapse state from Zustand
- `src/components/layout/GlobalSearch.tsx`
  authenticated cross-module command-search UI
- `src/components/forms/AssetForm.tsx`
  asset modal form with server/rack/location fields
- `src/components/tables/AssetTable.tsx`
  expandable asset table with detail view and action menu
- `src/components/dashboard/StatsCard.tsx`
- `src/components/dashboard/AuditTrail.tsx`
- `src/components/ui/Modal.tsx`
- `src/components/ui/button.tsx`
- `src/components/ui/input.tsx`
- `src/providers/toast-provider.tsx`
  unified toast feedback used across core workflows

UX patterns currently used:

- modal-driven CRUD
- client-side fetches from API routes
- dark theme styling in root layout
- toast notifications for success/error/info
- some remaining `window.confirm` and `window.alert` patterns still exist

## API Surface

### Auth / session

- `POST/GET /api/auth/[...nextauth]`
- `POST /api/activity`
- `DELETE /api/activity`

### Dashboard / platform

- `GET /api/dashboard/stats`
- `GET /api/search`
- `GET /api/health`
- `GET /api/metrics`

### Assets / locations / racks

- `GET/POST /api/assets`
- `PATCH/DELETE /api/assets/[id]`
- `GET /api/assets/export`
- `POST /api/assets/import`
- `GET/POST /api/locations`
- `GET/PATCH/DELETE /api/locations/[id]`
- `GET/POST /api/racks`
- `GET/PATCH/DELETE /api/racks/[id]`
- `POST /api/racks/[id]/assign`

### Network

- `GET /api/network`
- `GET/POST /api/public-ip/ranges`
- `PATCH/DELETE /api/public-ip/ranges/[id]`
- `POST /api/public-ip/ranges/[id]/ips`
- `GET/POST /api/public-ip/ips`
- `PATCH /api/public-ip/ips/[id]`
- `GET /api/public-ip/inventory`
- `GET/POST /api/private-ip/ranges`
- `PATCH/DELETE /api/private-ip/ranges/[id]`

### Licenses / maintenance / products

- `GET/POST /api/licenses`
- `PATCH/DELETE /api/licenses/[id]`
- `POST /api/licenses/[id]/assign`
- `POST /api/licenses/expiration-refresh`
- `GET/POST /api/maintenance`
- `PATCH /api/maintenance/[id]`
- `GET/POST /api/products`
- `PATCH/DELETE /api/products/[id]`
- `GET/POST /api/product-options`
- `PATCH/DELETE /api/product-options/[id]`

### Users / settings

- `GET/POST /api/users`
- `PATCH/DELETE /api/users/[id]`
- `POST /api/settings/password`
- `POST /api/settings/login-timeout`

## Search Coverage

`/api/search` is intended to search across:

- assets
- licenses
- public/private IPs
- products
- locations
- racks
- maintenance records

The corresponding UI entry point is `src/components/layout/GlobalSearch.tsx`.

## Deployment And Operations

Key files:

- `Dockerfile`
- `docker-compose.yml`
- `deploy/nginx/nginx.conf`
- `deploy/nginx/conf.d/elitgrid.conf`
- `deploy/cloudflare-tunnel.example.yml`
- `docs/operations/production-runbook.md`

Current deployment model:

- multi-stage Node 20 Alpine Docker build
- standalone Next.js output
- Prisma generate during build
- app container runs `prisma migrate deploy`, `prisma db seed`, then `node server.js`
- default Compose stack includes:
  - `db`
  - `app`
- optional Compose profiles:
  - `proxy` for Nginx
  - `backup` for scheduled logical dumps

Health and observability:

- health endpoint: `/api/health`
- metrics endpoint: `/api/metrics` with bearer token
- Compose and Nginx both use health checks
- basic security headers are set both in Next.js and Nginx

Backup and restore scripts:

- `scripts/backup-postgres.sh`
- `scripts/prune-backups.sh`
- `scripts/restore-postgres.sh`
- `scripts/restore-drill-postgres.sh`
- `scripts/production-validate.sh`

## Seed / Environment Notes

Seed behavior:

- `prisma/seed.js` is the active seed entry from `package.json`
- verifies or creates admin user from env vars
- fallback admin:
  - email: `admin@elitgrid.internal`
  - password: `admin123`

Core env vars:

- `DATABASE_URL`
- `NEXTAUTH_SECRET`
- `NEXTAUTH_URL`
- `CRON_SECRET`
- `OBSERVABILITY_TOKEN`
- `POSTGRES_USER`
- `POSTGRES_PASSWORD`
- `POSTGRES_DB`
- `ADMIN_EMAIL`
- `ADMIN_PASSWORD`

## Code Quality / Design Observations

Current strengths:

- business logic is separated into services instead of being embedded entirely in route handlers
- Prisma schema covers current modules well
- auth and RBAC are consistently applied across most routes/pages
- deployment and operational tooling are present in-repo
- app has meaningful auditability and operational notification support

Current caveats:

- many dashboard pages are large client components with embedded fetch/mutation logic
- some UI actions still use browser-native confirm/alert instead of shared modal/toast patterns
- there is some duplication and broad typing (`any`) in route/page code
- audit log schema is still centered on `assetId`, so non-asset events are stored with less structured linkage
- metrics/production hardening exist, but external observability, final TLS installation, and Auth.js major-version migration are still pending per docs

## Where To Look First During Future Work

For auth/session bugs:

- `src/lib/auth.ts`
- `src/middleware.ts`
- `src/components/auth/ActivityPinger.tsx`

For asset or rack placement bugs:

- `src/services/assetService.ts`
- `src/app/api/racks/[id]/assign/route.ts`
- `src/app/(dashboard)/assets/locations/datacenters/[id]/racks/[rackId]/page.tsx`

For IP management bugs:

- `src/services/publicIpService.ts`
- `src/services/networkService.ts`
- `src/lib/ip.ts`

For product/licensing/maintenance bugs:

- `src/services/productService.ts`
- `src/services/licenseService.ts`
- `src/services/maintenanceService.ts`

For deployment issues:

- `Dockerfile`
- `docker-compose.yml`
- `docs/operations/production-runbook.md`
- `scripts/production-validate.sh`
- `deploy/nginx/conf.d/elitgrid.conf`

## File Inventory Reference

Core source groups currently present:

- 38 API route files under `src/app/api`
- 16 dashboard/auth page/layout files under `src/app/(dashboard)` and `src/app/(auth)`
- 8 service files under `src/services`
- 11 component files under `src/components`
- 11 utility/lib files under `src/lib`
- 2 providers
- 2 hooks
- 1 Zustand store
- 19 Prisma files including schema, seeds, and migrations
- 5 shell scripts
- 3 deployment config files

Total tracked files scanned for this reference across source/ops/docs/public areas: about 123 files.

## Update Rule

When the codebase changes materially, update this file along with the relevant feature work. Treat it as the first-stop project memory for future deployment, debugging, and onboarding runs.
