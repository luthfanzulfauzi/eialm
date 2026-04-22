export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type SearchScope = "all" | "assets" | "licenses" | "ips" | "products" | "locations" | "maintenance";

const scopes: SearchScope[] = ["all", "assets", "licenses", "ips", "products", "locations", "maintenance"];

const formatEnum = (value?: string | null) => {
  if (!value) return "";
  return value
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0) + part.slice(1).toLowerCase())
    .join(" ");
};

const maskKey = (value?: string | null) => {
  if (!value) return null;
  if (value.length <= 8) return value;
  return `${value.slice(0, 4)}...${value.slice(-4)}`;
};

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const q = (searchParams.get("q") || "").trim();
  const requestedScope = searchParams.get("scope") as SearchScope | null;
  const scope = requestedScope && scopes.includes(requestedScope) ? requestedScope : "all";

  if (q.length < 2) {
    return NextResponse.json({ query: q, results: [] });
  }

  const contains = { contains: q, mode: "insensitive" as const };
  const enabled = (target: SearchScope) => scope === "all" || scope === target;

  const [assets, licenses, ips, products, locations, racks, maintenance] = await Promise.all([
    enabled("assets")
      ? prisma.asset.findMany({
          where: {
            OR: [
              { name: contains },
              { serialNumber: contains },
              { category: contains },
              { serverType: contains },
            ],
          },
          select: {
            id: true,
            name: true,
            serialNumber: true,
            category: true,
            status: true,
            location: { select: { name: true, type: true } },
            rack: { select: { name: true } },
          },
          take: 8,
          orderBy: { updatedAt: "desc" },
        })
      : Promise.resolve([]),
    enabled("licenses")
      ? prisma.license.findMany({
          where: {
            OR: [
              { name: contains },
              { key: contains },
              { licenseFile: contains },
              { asset: { name: contains } },
              { asset: { serialNumber: contains } },
              { products: { some: { name: contains } } },
              { products: { some: { code: contains } } },
            ],
          },
          select: {
            id: true,
            name: true,
            key: true,
            expiryDate: true,
            isExpired: true,
            asset: { select: { name: true, serialNumber: true } },
          },
          take: 8,
          orderBy: [{ isExpired: "desc" }, { expiryDate: "asc" }],
        })
      : Promise.resolve([]),
    enabled("ips")
      ? prisma.iPAddress.findMany({
          where: {
            OR: [
              { address: contains },
              { assignmentTargetLabel: contains },
              { asset: { name: contains } },
              { asset: { serialNumber: contains } },
            ],
          },
          select: {
            id: true,
            address: true,
            isPublic: true,
            status: true,
            assignmentTargetType: true,
            assignmentTargetLabel: true,
            asset: { select: { name: true, serialNumber: true } },
          },
          take: 8,
          orderBy: [{ isPublic: "desc" }, { address: "asc" }],
        })
      : Promise.resolve([]),
    enabled("products")
      ? prisma.product.findMany({
          where: {
            OR: [
              { name: contains },
              { code: contains },
              { description: contains },
              { documentationUrl: contains },
              { categoryOption: { value: contains } },
              { businessOwnerOption: { value: contains } },
              { technicalOwnerUser: { name: contains } },
            ],
          },
          select: {
            id: true,
            name: true,
            code: true,
            environment: true,
            lifecycle: true,
            criticality: true,
            categoryOption: { select: { value: true } },
          },
          take: 8,
          orderBy: { updatedAt: "desc" },
        })
      : Promise.resolve([]),
    enabled("locations")
      ? prisma.location.findMany({
          where: {
            OR: [
              { name: contains },
              { address: contains },
            ],
          },
          select: {
            id: true,
            name: true,
            type: true,
            address: true,
            _count: { select: { assets: true, racks: true } },
          },
          take: 6,
          orderBy: { name: "asc" },
        })
      : Promise.resolve([]),
    enabled("locations")
      ? prisma.rack.findMany({
          where: {
            OR: [
              { name: contains },
              { location: { name: contains } },
            ],
          },
          select: {
            id: true,
            name: true,
            totalUnits: true,
            location: { select: { id: true, name: true, type: true } },
            _count: { select: { assets: true } },
          },
          take: 6,
          orderBy: { name: "asc" },
        })
      : Promise.resolve([]),
    enabled("maintenance")
      ? prisma.maintenanceRecord.findMany({
          where: {
            OR: [
              { title: contains },
              { description: contains },
              { resolution: contains },
              { asset: { name: contains } },
              { asset: { serialNumber: contains } },
            ],
          },
          select: {
            id: true,
            title: true,
            status: true,
            priority: true,
            scheduledAt: true,
            asset: { select: { name: true, serialNumber: true, status: true } },
          },
          take: 8,
          orderBy: [{ status: "asc" }, { scheduledAt: "asc" }],
        })
      : Promise.resolve([]),
  ]);

  const results = [
    ...assets.map((asset) => ({
      id: asset.id,
      type: "assets",
      title: `${asset.name} (${asset.serialNumber})`,
      subtitle: [
        asset.category,
        formatEnum(asset.status),
        asset.location?.name,
        asset.rack?.name,
      ].filter(Boolean).join(" · "),
      href: `/assets/hardware?q=${encodeURIComponent(asset.serialNumber)}`,
      badge: formatEnum(asset.status),
    })),
    ...licenses.map((license) => ({
      id: license.id,
      type: "licenses",
      title: license.name,
      subtitle: [
        license.key ? `Key ${maskKey(license.key)}` : null,
        license.asset ? `${license.asset.name} (${license.asset.serialNumber})` : null,
        license.expiryDate ? `Expires ${license.expiryDate.toISOString().slice(0, 10)}` : null,
      ].filter(Boolean).join(" · "),
      href: license.isExpired ? "/licenses?filter=expired" : "/licenses",
      badge: license.isExpired ? "Expired" : "License",
    })),
    ...ips.map((ip) => ({
      id: ip.id,
      type: "ips",
      title: ip.address,
      subtitle: [
        ip.isPublic ? "Public IP" : "Private IP",
        formatEnum(ip.status),
        ip.asset ? `${ip.asset.name} (${ip.asset.serialNumber})` : ip.assignmentTargetLabel,
      ].filter(Boolean).join(" · "),
      href: ip.isPublic ? `/network/public?q=${encodeURIComponent(ip.address)}` : `/network/private?q=${encodeURIComponent(ip.address)}`,
      badge: formatEnum(ip.status),
    })),
    ...products.map((product) => ({
      id: product.id,
      type: "products",
      title: `${product.name} (${product.code})`,
      subtitle: [
        product.categoryOption.value,
        formatEnum(product.environment),
        formatEnum(product.lifecycle),
        formatEnum(product.criticality),
      ].filter(Boolean).join(" · "),
      href: `/products?q=${encodeURIComponent(product.name)}`,
      badge: formatEnum(product.criticality),
    })),
    ...locations.map((location) => ({
      id: location.id,
      type: "locations",
      title: location.name,
      subtitle: [
        formatEnum(location.type),
        location.address,
        `${location._count.assets} direct assets`,
        `${location._count.racks} racks`,
      ].filter(Boolean).join(" · "),
      href: location.type === "DATACENTER" ? "/assets/locations/datacenters" : "/assets/locations/warehouses",
      badge: formatEnum(location.type),
    })),
    ...racks.map((rack) => ({
      id: rack.id,
      type: "locations",
      title: `${rack.location.name} / ${rack.name}`,
      subtitle: `${rack._count.assets} assets · ${rack.totalUnits}U`,
      href: `/assets/locations/datacenters/${rack.location.id}/racks/${rack.id}`,
      badge: "Rack",
    })),
    ...maintenance.map((record) => ({
      id: record.id,
      type: "maintenance",
      title: record.title,
      subtitle: [
        `${record.asset.name} (${record.asset.serialNumber})`,
        formatEnum(record.priority),
        `Scheduled ${record.scheduledAt.toISOString().slice(0, 10)}`,
      ].filter(Boolean).join(" · "),
      href: "/maintenance",
      badge: formatEnum(record.status),
    })),
  ];

  return NextResponse.json({ query: q, results: results.slice(0, 30) });
}
