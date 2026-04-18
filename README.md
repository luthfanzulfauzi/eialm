# EIALM

Enterprise Infrastructure & Asset Lifecycle Manager (EIALM) is a modern web application for managing infrastructure assets, facilities, IP inventory, users, and operational lifecycle data.

The project is built with Next.js 14, TypeScript, Prisma, PostgreSQL, NextAuth.js, Tailwind CSS, and Docker.

## Current Status

The project is actively under development.

Implemented well today:

- authentication with role-based access control
- user management
- hardware asset CRUD
- datacenter, warehouse, and rack management
- rack layout and placement flows
- public IP range management
- private IP inventory listing
- products / application portfolio dummy module
- asset CSV import/export
- dashboard summary cards and recent activity
- system settings for password change and login timeout

Still in progress:

- full license CRUD and license API routes
- persisted product / application portfolio schema and CRUD
- private IP create/manage flows
- expired and expiring dashboard sections
- global search
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
  datacenters, warehouses, racks, rack layout designer
- Network Management
  public IP ranges, IP assignment, private IP inventory
- Products / Application Portfolio
  planned portfolio layer for business applications and their infrastructure relationships
- User Management
  admin-only CRUD and role updates
- Settings
  password change and login timeout policy

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
- `/api/public-ip/ranges`
- `/api/settings/password`
- `/api/settings/login-timeout`
- `/api/activity`

Some UI areas are ahead of backend completion, especially around licenses.

The new Products / Application page is intentionally a dummy planning surface in the current iteration. It exists to establish navigation, UX direction, and relationship planning before schema and CRUD implementation.

## Build Notes

The Docker app image has been verified to build successfully in the containerized path.

There are still a few production-readiness concerns to address:

- some build steps depend on external font fetching
- some server-rendered paths currently assume database reachability during build optimization
- reverse proxy / Cloudflare Tunnel deployment is not implemented yet
- backup, observability, and security hardening are still pending

## Known Gaps

- License Manager is not complete yet.
- Products / Application is currently a dummy page only and does not persist records yet.
- Global search is still a placeholder.
- Advanced filtering and toast notifications are still pending.
- Production deployment needs ingress, backup, and operational hardening work.

## Roadmap

The next major priorities are:

1. move Products / Application from dummy page to real schema and CRUD
2. finish license CRUD and related APIs
3. complete private IP management flows
4. add expired and expiring operational widgets to the dashboard
5. implement global search
6. harden production deployment and operations

See [milestones.md](./milestones.md) for the milestone-plus-deliverables plan.

## License

No license file is included in the repository yet. Add a project license before publishing or distributing externally.
