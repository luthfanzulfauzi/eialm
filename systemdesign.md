You are an experienced senior full-stack engineer
I wanna build Web Application for Inventory manager called "Enterprise Infrastructure & Asset Lifecycle Manager (EIALM)" with modern looks and tech stacks.

Goals:
create web application that use clean code, modern, user friendly, scalable, modular not monolithic, ready for production.

Scope:
application should be deployed and tested in docker environment, and should acomodate direct DNS (A Record) or Cloudflare Tunnel (maybe using Nginx as gateway).
Docker image should be efficient and lightweight

You can use this tech stacks or you can suggest other stacks that more suitable
•⁠  ⁠Next.js 14 (App Router)
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