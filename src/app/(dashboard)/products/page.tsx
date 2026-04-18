"use client";

import { Boxes, Database, Globe, Key, Link2, MapPin, Server, ShieldCheck, Users } from "lucide-react";

const plannedRelations = [
  {
    title: "Infrastructure Assets",
    description:
      "Link a product or application to servers, appliances, storage nodes, or other managed hardware that host or support it.",
    icon: Server,
    accent: "text-blue-400 border-blue-500/20 bg-blue-500/10",
    status: "Planned relation",
  },
  {
    title: "Licenses",
    description:
      "Associate product records with subscription, support, or license contracts for renewal and compliance visibility.",
    icon: Key,
    accent: "text-amber-400 border-amber-500/20 bg-amber-500/10",
    status: "Planned relation",
  },
  {
    title: "Network Footprint",
    description:
      "Connect applications to public or private IP usage, service endpoints, and networking dependencies.",
    icon: Globe,
    accent: "text-emerald-400 border-emerald-500/20 bg-emerald-500/10",
    status: "Planned relation",
  },
  {
    title: "Ownership & Access",
    description:
      "Define technical owners, business owners, operators, and support users responsible for each product or application.",
    icon: Users,
    accent: "text-fuchsia-400 border-fuchsia-500/20 bg-fuchsia-500/10",
    status: "Planned relation",
  },
  {
    title: "Deployment Locations",
    description:
      "Reference datacenters, warehouses, or future cloud zones where application-supporting infrastructure exists.",
    icon: MapPin,
    accent: "text-cyan-400 border-cyan-500/20 bg-cyan-500/10",
    status: "Planned relation",
  },
  {
    title: "Compliance & Controls",
    description:
      "Track security posture, criticality, data classification, and operational controls for each application portfolio item.",
    icon: ShieldCheck,
    accent: "text-rose-400 border-rose-500/20 bg-rose-500/10",
    status: "Planned relation",
  },
];

const plannedFields = [
  "Product / application name",
  "Short code or identifier",
  "Category and business domain",
  "Environment scope",
  "Criticality tier",
  "Business owner and technical owner",
  "Related assets and IPs",
  "Related licenses",
  "Status and lifecycle stage",
  "Notes, dependencies, and documentation links",
];

export default function ProductsPage() {
  return (
    <div className="space-y-8">
      <section className="rounded-3xl border border-slate-800 bg-[radial-gradient(circle_at_top_left,_rgba(59,130,246,0.16),_transparent_34%),linear-gradient(180deg,_rgba(15,23,42,0.94),_rgba(8,11,18,0.96))] p-8 shadow-2xl">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl space-y-4">
            <div className="inline-flex items-center gap-2 rounded-full border border-blue-500/20 bg-blue-500/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.2em] text-blue-300">
              <Boxes size={14} />
              New Main Feature
            </div>
            <div className="space-y-3">
              <h1 className="text-3xl font-bold tracking-tight text-white">Products / Application Portfolio</h1>
              <p className="max-w-2xl text-sm leading-6 text-slate-300">
                This is the first implementation pass for managing products and business applications inside EIALM.
                The page is intentionally a dummy planning surface for now, designed to show how this module will
                connect to infrastructure, licensing, ownership, and network data that already exist in the platform.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-2xl border border-slate-800 bg-slate-950/40 px-4 py-4">
              <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">Status</div>
              <div className="mt-2 text-lg font-bold text-white">Dummy</div>
            </div>
            <div className="rounded-2xl border border-slate-800 bg-slate-950/40 px-4 py-4">
              <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">Portfolio Items</div>
              <div className="mt-2 text-lg font-bold text-white">0</div>
            </div>
            <div className="rounded-2xl border border-slate-800 bg-slate-950/40 px-4 py-4">
              <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">Relations</div>
              <div className="mt-2 text-lg font-bold text-white">6</div>
            </div>
            <div className="rounded-2xl border border-slate-800 bg-slate-950/40 px-4 py-4">
              <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">Next Step</div>
              <div className="mt-2 text-lg font-bold text-white">Schema</div>
            </div>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-[1.45fr_0.95fr]">
        <div className="rounded-3xl border border-slate-800 bg-[#111620] p-6 shadow-xl">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-white">Planned Relationship Model</h2>
              <p className="text-sm text-slate-500">How the future product/application module should connect to existing EIALM data</p>
            </div>
            <div className="hidden rounded-full border border-slate-700 bg-slate-900/70 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400 sm:block">
              Planning Mode
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {plannedRelations.map((item) => (
              <article key={item.title} className="rounded-2xl border border-slate-800 bg-slate-900/40 p-5">
                <div className="mb-4 flex items-start justify-between gap-3">
                  <div className={`inline-flex rounded-xl border p-3 ${item.accent}`}>
                    <item.icon size={18} />
                  </div>
                  <span className="rounded-full border border-slate-700 bg-slate-950/70 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">
                    {item.status}
                  </span>
                </div>
                <h3 className="text-sm font-bold text-white">{item.title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-400">{item.description}</p>
              </article>
            ))}
          </div>
        </div>

        <div className="space-y-6">
          <section className="rounded-3xl border border-slate-800 bg-[#111620] p-6 shadow-xl">
            <div className="flex items-center gap-3">
              <div className="rounded-xl border border-slate-700 bg-slate-900/70 p-3 text-slate-300">
                <Database size={18} />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white">Suggested First Data Shape</h2>
                <p className="text-sm text-slate-500">Recommended attributes for the initial schema and forms</p>
              </div>
            </div>

            <div className="mt-5 space-y-2">
              {plannedFields.map((field) => (
                <div
                  key={field}
                  className="flex items-center gap-3 rounded-2xl border border-slate-800 bg-slate-900/40 px-4 py-3 text-sm text-slate-300"
                >
                  <Link2 size={14} className="text-slate-500" />
                  <span>{field}</span>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-3xl border border-dashed border-blue-500/25 bg-blue-500/5 p-6">
            <h2 className="text-lg font-bold text-white">Recommended Next Implementation Slice</h2>
            <div className="mt-4 space-y-3 text-sm leading-6 text-slate-300">
              <p>Start with a dedicated `Product` model and optional relation tables rather than embedding product data into assets or licenses.</p>
              <p>In the next real implementation pass, add product CRUD, ownership fields, lifecycle status, and many-to-many links to assets and licenses first.</p>
              <p>After that, extend the module with dependency mapping, IP linkage, compliance metadata, and dashboard visibility.</p>
            </div>
          </section>
        </div>
      </section>
    </div>
  );
}
