# ElitGrid System Design

ElitGrid is an internal web application for infrastructure inventory, facility placement, IP address management, licensing, product/application portfolio ownership, and lifecycle visibility.

## Current Implementation Status

Last reviewed against the repository on April 23, 2026.

- Next.js 15 App Router, React 19, TypeScript, Tailwind CSS, Prisma, PostgreSQL, NextAuth.js, Zustand, React Hook Form, Zod, Docker, and Docker Compose are in use.
- Authentication, RBAC, user management, password change, login timeout, and protected API/page access are implemented.
- Dashboard summary cards, recent activity, expired/expiring license sections, repair-focused widgets, and operational notices are implemented.
- Asset hardware CRUD, audit trail, CSV import/export, advanced asset filtering, pagination, placement validation, datacenter/warehouse CRUD, rack CRUD, warehouse storage views, rack utilization summaries, and cross-facility rack layout placement flows are implemented.
- Public and private IP inventory management are implemented, including ranges, generated IP inventory, status transitions, assignment target metadata, and audit logging for network mutations.
- License CRUD, assignment, expiry views, scheduled expiration refresh/notifications, maintenance scheduling, maintenance history, and broken-asset repair workflows are implemented.
- Products / Application is now a persisted module with product CRUD, configurable option catalogs, asset/license/IP/location relationships, compliance metadata, business owners, user-backed technical owners, advanced local filtering, pagination, dependency views, and toast feedback. The latest portfolio migrations have been validated in Docker.
- Global search is implemented from the dashboard header with an authenticated cross-module API covering assets, licenses, IP addresses, products/applications, locations, racks, and maintenance records.
- Settings includes password change, login timeout, and product dropdown catalog management.
- Docker development/build support exists, uses a named PostgreSQL volume for runtime data, and no longer depends on external font fetching. Production readiness now includes an app/database health endpoint, token-protected metrics, Compose healthchecks, Docker log rotation defaults, an optional Nginx reverse proxy profile, a Cloudflare Tunnel starter config, PostgreSQL backup/restore/retention/restore-drill scripts, a scheduled backup Compose profile, committed ESLint configuration, baseline security headers, and a Next.js 15.5.15 LTS / React 19 runtime. Final hostname TLS installation, off-host backup replication, external observability hookup, and an Auth.js major-version migration remain pending.

## Product Goal

Goals:
create web application that use clean code, modern, user friendly, scalable, modular not monolithic, ready for production.

Scope:
application should be deployed and tested in docker environment, and should acomodate direct DNS (A Record) or Cloudflare Tunnel (maybe using Nginx as gateway).
Docker image should be efficient and lightweight

You can use this tech stacks or you can suggest other stacks that more suitable
•⁠  ⁠Next.js 15 (App Router)
•⁠  ⁠React 19
•⁠  ⁠TypeScript
•⁠  ⁠Tailwind CSS
•⁠  ⁠Prisma ORM
•⁠  ⁠PostgreSQL
•⁠  ⁠Zustand for state management
•⁠  ⁠React Hook Form + Zod for validation

Main feature:
Authentication
Login using email and password
Role access: Admin, Operator, Viewer

2. Dashboard
You can use the image attached as refference.
In dashboard need to show
general section:

total assets managed/added
total license managed
total location (datacenters/warehouse)
total IP Public managed
Maintenance or notice section:

total broken/need repair assets
total license will be expired or already expired
recent update (activity on the platform / update information / update asset etc)
expired section (list of expired items, asset, license, etc)
Asset Manager
Function: can List, create, update, delete
Asset Manager menu will have submenus:
3.A. Location
3.A.1. Datacenter
3.A.1.A. Rack Location
3.A.2. Warehouse
3.B. Hardware
3.C. IP Management
3.C.1 IP Public
3.C.2 IP Private
License Manager
Function: can List, create, update, delete
System Settings
Have “Change Password” function
Have “Login timeout” configuration (only for admin)
User Management
Function: can List, create, update, delete
Search and filters
should have search capability for each menu (IP, name, Serial Number, License Number, etc)
should have filter by category (e.g. hardware asset “server”, “cable”, etc)
UI :
Modern and clean 
responsive
sidebar navigation with expand and collapse function
card layout
modal form
toast notification
Database
create prisma schema that proper , stable, scalable and low latency
directory structure
create clean directory structure
Generate:
Complete project structure
Prisma schema
API Route
UI Pages

## Current Architecture

```text
src/
  app/          Next.js App Router pages and API routes
  components/   shared UI, layout, forms, tables, and dashboard components
  hooks/        client-side hooks
  lib/          auth, prisma client, validation, IP/CSV helpers, utilities
  providers/    app-level providers
  services/     domain service layer used by API routes
  store/        Zustand UI state
prisma/
  migrations/   database migration history
  schema.prisma Prisma schema
  seed.ts/js    admin seed scripts
```

## Domain Model Snapshot

- `User`: credentials, role, login timeout, activity metadata, audit logs, and technical product ownership.
- `Asset`: hardware inventory, lifecycle state, server specifications, rack placement, IPs, licenses, products, maintenance records, and audit logs.
- `Location` and `Rack`: datacenter/warehouse placement structure and rack unit layout.
- `PublicIPRange`, `PrivateIPRange`, and `IPAddress`: public/private address inventory with assignment status and target metadata.
- `License`: optional key/file, expiry state, asset assignment, and product relationships.
- `MaintenanceRecord`: scheduled maintenance and repair history for assets with status, priority, lifecycle timestamps, and resolution notes.
- `SystemJobRun` and `OperationalNotification`: lightweight operational job state and in-app risk notices for scheduled lifecycle checks.
- `Product`: portfolio record with environment, lifecycle, criticality, documentation, compliance metadata, notes, option-backed category/domain/team/business owner, user-backed technical owner, assets, licenses, IP addresses, and deployment locations.
- `ProductOption`: configurable dropdown catalog for product categories, business domains, support teams, and business owners.
- `AuditLog`: asset, network, and platform activity records.

## Deployment And Operations

- The default Compose stack runs PostgreSQL and the standalone Next.js app container.
- `GET /api/health` is unauthenticated for container, proxy, and uptime probes; it verifies PostgreSQL reachability and returns `503` on database failure.
- The optional `proxy` Compose profile runs Nginx in front of the app for direct DNS or upstream reverse-proxy deployments.
- The app and Nginx apply baseline security headers for content type sniffing, framing, referrer policy, and browser permissions.
- Cloudflare Tunnel can target the app service directly over `http://app:3000`; `deploy/cloudflare-tunnel.example.yml` documents the expected ingress shape.
- `GET /api/metrics` emits Prometheus text format when called with `OBSERVABILITY_TOKEN`.
- PostgreSQL data persists in the `postgres-data` named volume. Logical backup, scheduled backup, pruning, restore, and restore-drill helpers live in `scripts/`, and Admin-only browser operations for create/download/restore now exist under `System Settings`.
- Dashboard server rendering is explicitly dynamic so authenticated database-backed pages are not treated as static build artifacts.
- `npm run lint` is now non-interactive through `.eslintrc.json`, and Docker validation runs against the Next.js lint/type/build pipeline.
- Next.js is upgraded to the supported 15.5 LTS line with React 19. Remaining npm audit findings are the moderate `next-auth` / `uuid` chain and require an Auth.js major-version migration.

## Remaining Design Gaps

- Charts for asset distribution and health remain deferred until the dashboard metric layer is broader.
- Unified toast notifications exist for core workflows and should continue replacing legacy inline banners or browser alerts as modules are revisited.
- Production design still needs final hostname TLS installation, off-host backup replication, external log/metric shipping, and the Auth.js major-version migration needed to clear the remaining moderate advisory chain.
- Runtime data is kept out of source control through Git ignores, Docker ignores, and named Compose volumes.
