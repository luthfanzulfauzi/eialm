# EIALM

Enterprise Infrastructure & Asset Lifecycle Manager (EIALM) is a modern web application for managing infrastructure assets, facilities, IP inventory, users, and operational lifecycle data.

The project is built with Next.js 14, TypeScript, Prisma, PostgreSQL, NextAuth.js, Tailwind CSS, and Docker.

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
- product relationships to assets, licenses, and user-backed technical owners
- asset CSV import/export, advanced asset filtering, pagination, and placement validation
- dashboard summary cards and recent activity
- system settings for password change and login timeout

Still in progress:

- product portfolio polish, migration validation, and end-to-end browser testing
- expired and expiring dashboard sections
- global search
- cross-module advanced filtering/pagination polish and unified toast notifications
- production ingress, backup, and deployment hardening

The working roadmap is tracked in [milestones.md](./milestones.md).

## Tech Stack

- Next.js 14 App Router
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
  product/application CRUD, configurable catalogs, ownership, and asset/license relationships
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
DATABASE_URL=postgresql://admin:password123@localhost:5432/eialm_db?schema=public
NEXTAUTH_SECRET=replace-with-a-long-random-secret
NEXTAUTH_URL=http://localhost:3000

POSTGRES_USER=admin
POSTGRES_PASSWORD=password123

ADMIN_EMAIL=admin@eialm.internal
ADMIN_PASSWORD=admin123
```

Notes:

- For Docker Compose, the app container uses `db` as the database host internally.
- For running outside Docker, `localhost` is the usual database host.

## Quick Start With Docker

1. Create `.env` using the example above.
2. Build and start the stack:

```bash
docker compose up --build
```

3. Open the app at [http://localhost:3000](http://localhost:3000)

The container startup runs Prisma migrations automatically.

## Default Admin Account

The Prisma seed script creates or verifies an admin user using these environment variables:

- `ADMIN_EMAIL`
- `ADMIN_PASSWORD`

Default fallback values in the current seed:

- email: `admin@eialm.internal`
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
- `/api/licenses`
- `/api/licenses/[id]`
- `/api/licenses/[id]/assign`
- `/api/settings/password`
- `/api/settings/login-timeout`
- `/api/activity`

The Asset Inventory page now includes query-persisted filtering by category, status, location type, and rack state, plus paginated large-table navigation. Asset create, update, and CSV import share service-level placement validation for warehouse, datacenter, and rack consistency.

The Products / Application page is now a persisted implementation slice. It includes product CRUD, summary metrics, local search, lifecycle filtering, asset/license relationship mapping, user-backed technical owners, and admin-managed dropdown catalogs. The newest technical-owner migration still needs deployed validation against existing product data.

## Build Notes

The Docker app image has been verified to build successfully in the containerized path.

There are still a few production-readiness concerns to address:

- some server-rendered paths currently assume database reachability during build optimization
- reverse proxy / Cloudflare Tunnel deployment is not implemented yet
- backup, observability, and security hardening are still pending

## Known Gaps

- Products / Application needs end-to-end validation after the technical-owner migration and further UX polish.
- Global search is still a placeholder.
- Cross-module pagination/filter consistency and toast notifications are still pending outside the completed Asset Inventory core.
- Dashboard expired/expiring sections are still incomplete.
- Production deployment needs ingress, backup, and operational hardening work.
- Residual tracked backup files exist under `src/` and should be removed once confirmed unnecessary:
  `src/app/(dashboard)/page.tsx.backup`, `src/lib/validations/auth.ts.backup`, and `src/types/index.d.ts.backup`.
- `src/hooks/useDebounce.ts` and `src/components/ui/index.ts` appear unused in the current source tree.
- The old `TECHNICAL_OWNER` product option path has a cleanup migration and was validated in local Docker.

## Roadmap

The next major priorities are:

1. validate the Products / Application technical-owner migration and CRUD flow in Docker
2. add expired and expiring operational widgets to the dashboard
3. implement global search
4. improve advanced filters, pagination, and feedback/toast UX
5. harden production deployment and operations

See [milestones.md](./milestones.md) for the milestone-plus-deliverables plan.

## License

No license file is included in the repository yet. Add a project license before publishing or distributing externally.
