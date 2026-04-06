"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Loader2,
  Network,
  Plus,
  RefreshCw,
  Search,
  Server,
  Shield,
  Trash2,
  Unlink,
} from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { useRole } from "@/hooks/useRole";
import { cn } from "@/lib/utils";

type IPStatus = "AVAILABLE" | "RESERVED" | "ASSIGNED" | "BLOCKED";

type AssetOption = {
  id: string;
  name: string;
  serialNumber: string;
  category: string;
};

type PrivateIp = {
  id: string;
  address: string;
  status: IPStatus;
  asset: AssetOption | null;
};

type PrivateSubnetSummary = {
  cidr: string;
  counts: Record<IPStatus, number>;
  assignedAssets: number;
};

type InventoryResponse = {
  items: PrivateIp[];
  summary: {
    total: number;
    available: number;
    reserved: number;
    assigned: number;
    blocked: number;
    assignedAssets: number;
    unassigned: number;
    subnetCount: number;
  };
  subnets: PrivateSubnetSummary[];
  privateRanges: string[];
  assignableAssets: AssetOption[];
};

const DEFAULT_SUMMARY: InventoryResponse["summary"] = {
  total: 0,
  available: 0,
  reserved: 0,
  assigned: 0,
  blocked: 0,
  assignedAssets: 0,
  unassigned: 0,
  subnetCount: 0,
};

const STATUS_OPTIONS: IPStatus[] = ["AVAILABLE", "RESERVED", "BLOCKED"];

export default function PrivateIPPage() {
  const [ips, setIps] = useState<PrivateIp[]>([]);
  const [summary, setSummary] = useState(DEFAULT_SUMMARY);
  const [subnets, setSubnets] = useState<PrivateSubnetSummary[]>([]);
  const [privateRanges, setPrivateRanges] = useState<string[]>([]);
  const [assets, setAssets] = useState<AssetOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [mode, setMode] = useState<"single" | "cidr">("single");
  const [address, setAddress] = useState("");
  const [prefix, setPrefix] = useState("24");
  const [createStatus, setCreateStatus] = useState<Exclude<IPStatus, "ASSIGNED">>("AVAILABLE");
  const [selectedAssetId, setSelectedAssetId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [banner, setBanner] = useState<{ type: "error" | "success"; message: string } | null>(null);
  const router = useRouter();
  const { isViewer } = useRole();
  const canManage = !isViewer;

  const fetchInventory = async (background = false) => {
    if (background) setRefreshing(true);
    else setLoading(true);

    try {
      const res = await fetch("/api/network?type=private", { cache: "no-store" });
      const data = (await res.json()) as InventoryResponse;

      setIps(Array.isArray(data.items) ? data.items : []);
      setSummary(data.summary ?? DEFAULT_SUMMARY);
      setSubnets(Array.isArray(data.subnets) ? data.subnets : []);
      setPrivateRanges(Array.isArray(data.privateRanges) ? data.privateRanges : []);
      setAssets(Array.isArray(data.assignableAssets) ? data.assignableAssets : []);
    } catch (error) {
      console.error("Failed to fetch private IPs:", error);
      setBanner({ type: "error", message: "Failed to load private IP inventory." });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    void fetchInventory();
  }, []);

  const filteredIps = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return ips;

    return ips.filter((ip) =>
      [
        ip.address,
        ip.status,
        ip.asset?.name,
        ip.asset?.serialNumber,
        ip.asset?.category,
      ]
        .filter(Boolean)
        .some((value) => value!.toLowerCase().includes(query))
    );
  }, [ips, searchQuery]);

  const resetModal = () => {
    setMode("single");
    setAddress("");
    setPrefix("24");
    setCreateStatus("AVAILABLE");
    setSelectedAssetId("");
  };

  const handleCreate = async () => {
    if (!canManage) return;

    setSubmitting(true);
    setBanner(null);
    try {
      const res = await fetch("/api/network", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "createPrivate",
          mode,
          address: address.trim(),
          prefix: mode === "cidr" ? Number(prefix) : undefined,
          status: selectedAssetId ? undefined : createStatus,
          assetId: selectedAssetId || null,
        }),
      });

      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        const extra =
          Array.isArray(payload.addresses) && payload.addresses.length
            ? ` Existing: ${payload.addresses.slice(0, 3).join(", ")}${payload.addresses.length > 3 ? "..." : ""}`
            : "";
        setBanner({ type: "error", message: `${payload.error || "Failed to register IPs."}${extra}` });
        return;
      }

      setBanner({
        type: "success",
        message:
          mode === "cidr"
            ? `Registered ${payload.created?.length ?? 0} private IPs from ${address.trim()}/${prefix}.`
            : `Registered private IP ${address.trim()}.`,
      });
      setShowAddModal(false);
      resetModal();
      await fetchInventory(true);
      router.refresh();
    } catch (error) {
      console.error("Private IP registration failed", error);
      setBanner({ type: "error", message: "Private IP registration failed." });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDetach = async (ipId: string) => {
    if (!canManage) return;
    if (!confirm("Unassign this private IP from its asset?")) return;

    try {
      const res = await fetch("/api/network", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "assign", ipId, assetId: null }),
      });

      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        setBanner({ type: "error", message: payload.error || "Failed to unassign private IP." });
        return;
      }

      setBanner({ type: "success", message: "Private IP unassigned." });
      await fetchInventory(true);
      router.refresh();
    } catch (error) {
      console.error("Detachment failed", error);
      setBanner({ type: "error", message: "Failed to unassign private IP." });
    }
  };

  const handleAssign = async (ipId: string, assetId: string) => {
    if (!canManage) return;

    try {
      const res = await fetch("/api/network", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "assign",
          ipId,
          assetId: assetId || null,
        }),
      });

      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        setBanner({ type: "error", message: payload.error || "Failed to update assignment." });
        return;
      }

      setBanner({
        type: "success",
        message: assetId ? "Private IP assigned to asset." : "Private IP unassigned.",
      });
      await fetchInventory(true);
      router.refresh();
    } catch (error) {
      console.error("Assignment failed", error);
      setBanner({ type: "error", message: "Failed to update assignment." });
    }
  };

  const handleStatusChange = async (ipId: string, status: Exclude<IPStatus, "ASSIGNED">) => {
    if (!canManage) return;

    try {
      const res = await fetch("/api/network", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "updateStatus", ipId, status }),
      });

      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        setBanner({ type: "error", message: payload.error || "Failed to update IP status." });
        return;
      }

      setBanner({ type: "success", message: `Private IP status changed to ${status}.` });
      await fetchInventory(true);
    } catch (error) {
      console.error("Status update failed", error);
      setBanner({ type: "error", message: "Failed to update IP status." });
    }
  };

  const handleDelete = async (ipId: string) => {
    if (!canManage) return;
    if (!confirm("Delete this private IP from inventory?")) return;

    try {
      const res = await fetch("/api/network", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "deletePrivate", ipId }),
      });

      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        setBanner({ type: "error", message: payload.error || "Failed to delete private IP." });
        return;
      }

      setBanner({ type: "success", message: "Private IP deleted from inventory." });
      await fetchInventory(true);
    } catch (error) {
      console.error("Delete failed", error);
      setBanner({ type: "error", message: "Failed to delete private IP." });
    }
  };

  const statusBadge = (status: IPStatus) =>
    cn(
      "inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-bold tracking-[0.2em]",
      status === "AVAILABLE" && "border-blue-500/20 bg-blue-500/10 text-blue-300",
      status === "RESERVED" && "border-orange-500/20 bg-orange-500/10 text-orange-300",
      status === "ASSIGNED" && "border-emerald-500/20 bg-emerald-500/10 text-emerald-300",
      status === "BLOCKED" && "border-slate-700 bg-slate-800/80 text-slate-300"
    );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="flex items-center gap-3 text-2xl font-bold text-white">
            <Shield className="text-emerald-400" /> Private IP Management
          </h1>
          <p className="text-sm text-slate-500">
            Manage RFC1918 address inventory, subnet coverage, reservation state, and asset assignment.
          </p>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
            <input
              type="text"
              placeholder="Search IP, status, or asset..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-lg border border-slate-800 bg-slate-900 pl-10 pr-4 py-2 text-sm text-white outline-none transition-all focus:border-emerald-500 sm:w-72"
            />
          </div>
          <Button variant="outline" onClick={() => fetchInventory(true)} disabled={loading || refreshing}>
            <RefreshCw size={16} className={cn("mr-2", refreshing && "animate-spin")} /> Refresh
          </Button>
          <Button
            onClick={() => {
              if (!canManage) return;
              setShowAddModal(true);
            }}
            disabled={!canManage}
            className="bg-emerald-600 shadow-emerald-500/20 hover:bg-emerald-700"
          >
            <Plus size={18} className="mr-2" /> Add Private IPs
          </Button>
        </div>
      </div>

      {banner && (
        <div
          className={cn(
            "rounded-2xl border px-4 py-3 text-sm",
            banner.type === "success"
              ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-200"
              : "border-red-500/20 bg-red-500/10 text-red-200"
          )}
        >
          {banner.message}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border border-slate-800 bg-[#111620] p-5">
          <div className="text-xs font-bold uppercase tracking-[0.25em] text-slate-500">Inventory</div>
          <div className="mt-3 text-3xl font-bold text-white">{summary.total}</div>
          <div className="mt-2 text-sm text-slate-400">{summary.unassigned} ready for new assignment</div>
        </div>
        <div className="rounded-2xl border border-slate-800 bg-[#111620] p-5">
          <div className="text-xs font-bold uppercase tracking-[0.25em] text-slate-500">Assignment</div>
          <div className="mt-3 text-3xl font-bold text-white">{summary.assigned}</div>
          <div className="mt-2 text-sm text-slate-400">{summary.available} available, {summary.reserved} reserved</div>
        </div>
        <div className="rounded-2xl border border-slate-800 bg-[#111620] p-5">
          <div className="text-xs font-bold uppercase tracking-[0.25em] text-slate-500">Subnet Buckets</div>
          <div className="mt-3 text-3xl font-bold text-white">{summary.subnetCount}</div>
          <div className="mt-2 text-sm text-slate-400">
            {privateRanges.length > 0 ? privateRanges.join(" • ") : "No private space registered yet"}
          </div>
        </div>
        <div className="rounded-2xl border border-slate-800 bg-[#111620] p-5">
          <div className="text-xs font-bold uppercase tracking-[0.25em] text-slate-500">Exceptions</div>
          <div className="mt-3 text-3xl font-bold text-white">{summary.blocked + summary.reserved}</div>
          <div className="mt-2 text-sm text-slate-400">{summary.blocked} blocked and {summary.reserved} reserved</div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.5fr,1fr]">
        <div className="rounded-2xl border border-slate-800 bg-[#111620] shadow-xl">
          <div className="flex items-center justify-between border-b border-slate-800 bg-slate-900/30 px-4 py-4">
            <div>
              <div className="text-sm font-bold text-white">Private Address Inventory</div>
              <div className="text-xs text-slate-500">{filteredIps.length} visible addresses</div>
            </div>
            <div className="text-xs text-slate-500">Assigned IPs stay locked to `ASSIGNED` until released.</div>
          </div>

          <div className="divide-y divide-slate-800">
            {loading ? (
              <div className="flex min-h-80 flex-col items-center justify-center gap-3 text-slate-500">
                <Loader2 className="animate-spin text-emerald-500" size={26} />
                <p className="text-sm">Scanning private IP inventory...</p>
              </div>
            ) : filteredIps.length > 0 ? (
              filteredIps.map((ip) => (
                <div
                  key={ip.id}
                  className="grid gap-4 px-4 py-4 transition-colors hover:bg-slate-800/20 lg:grid-cols-[180px,140px,1fr,180px,80px]"
                >
                  <div>
                    <div className="text-lg font-bold text-emerald-400">{ip.address}</div>
                    <div className="text-xs text-slate-500">{ip.address.split(".").slice(0, 3).join(".")}.0/24</div>
                  </div>

                  <div className="flex items-center">
                    <span className={statusBadge(ip.asset ? "ASSIGNED" : ip.status)}>{ip.asset ? "ASSIGNED" : ip.status}</span>
                  </div>

                  <div className="space-y-2">
                    {ip.asset ? (
                      <div className="flex items-center gap-3">
                        <div className="rounded-lg border border-slate-700 bg-slate-800 p-2 text-slate-400">
                          <Server size={14} />
                        </div>
                        <div>
                          <div className="text-sm font-medium text-slate-100">{ip.asset.name}</div>
                          <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">
                            {ip.asset.category} • {ip.asset.serialNumber}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="text-sm text-slate-500">Unassigned inventory slot</div>
                    )}

                    {canManage && !ip.asset && (
                      <select
                        className="h-10 w-full rounded-lg border border-slate-800 bg-slate-900/70 px-3 text-sm text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50"
                        value=""
                        onChange={(e) => {
                          if (!e.target.value) return;
                          void handleAssign(ip.id, e.target.value);
                        }}
                      >
                        <option value="">Assign to asset...</option>
                        {assets.map((asset) => (
                          <option key={asset.id} value={asset.id}>
                            {asset.name} ({asset.serialNumber})
                          </option>
                        ))}
                      </select>
                    )}
                  </div>

                  <div className="space-y-2">
                    <div className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">Manage</div>
                    <select
                      className="h-10 w-full rounded-lg border border-slate-800 bg-slate-900/70 px-3 text-sm text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50 disabled:opacity-50"
                      value={ip.asset ? "ASSIGNED" : ip.status}
                      disabled={!canManage || !!ip.asset}
                      onChange={(e) => void handleStatusChange(ip.id, e.target.value as Exclude<IPStatus, "ASSIGNED">)}
                    >
                      {ip.asset && <option value="ASSIGNED">ASSIGNED</option>}
                      {!ip.asset &&
                        STATUS_OPTIONS.map((status) => (
                          <option key={status} value={status}>
                            {status}
                          </option>
                        ))}
                    </select>
                  </div>

                  <div className="flex items-start justify-end gap-2">
                    {canManage && ip.asset && (
                      <button
                        onClick={() => void handleDetach(ip.id)}
                        className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-red-500/10 hover:text-red-400"
                        title="Unassign IP"
                      >
                        <Unlink size={16} />
                      </button>
                    )}
                    {canManage && !ip.asset && (
                      <button
                        onClick={() => void handleDelete(ip.id)}
                        className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-red-500/10 hover:text-red-400"
                        title="Delete private IP"
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <div className="py-20 text-center text-slate-500">
                <p className="font-medium">No private IP addresses found.</p>
              </div>
            )}
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-2xl border border-slate-800 bg-[#111620] p-5">
            <div className="flex items-center gap-3">
              <div className="rounded-xl border border-slate-700 bg-slate-900/60 p-3 text-emerald-300">
                <Network size={18} />
              </div>
              <div>
                <div className="text-sm font-bold text-white">Subnet Coverage</div>
                <div className="text-xs text-slate-500">Grouped by /24 buckets for quick operational review</div>
              </div>
            </div>

            <div className="mt-4 space-y-3">
              {subnets.length > 0 ? (
                subnets.slice(0, 8).map((subnet) => (
                  <div key={subnet.cidr} className="rounded-xl border border-slate-800 bg-slate-900/40 p-3">
                    <div className="flex items-center justify-between">
                      <div className="text-sm font-bold text-white">{subnet.cidr}</div>
                      <div className="text-xs text-slate-500">{subnet.assignedAssets} assigned</div>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-slate-400">
                      <span>A {subnet.counts.AVAILABLE}</span>
                      <span>R {subnet.counts.RESERVED}</span>
                      <span>S {subnet.counts.ASSIGNED}</span>
                      <span>B {subnet.counts.BLOCKED}</span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="rounded-xl border border-dashed border-slate-800 px-4 py-8 text-center text-sm text-slate-500">
                  Register a private host or subnet to start tracking coverage.
                </div>
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-[#111620] p-5">
            <div className="text-sm font-bold text-white">Registration Rules</div>
            <div className="mt-3 space-y-2 text-sm text-slate-400">
              <p>Single IPs must be in RFC1918 space: `10/8`, `172.16/12`, or `192.168/16`.</p>
              <p>CIDR imports require a real network boundary and register usable hosts only.</p>
              <p>Bulk subnet registration is capped at 1024 hosts to keep operator actions safe.</p>
            </div>
          </div>
        </div>
      </div>

      <Modal
        isOpen={showAddModal}
        onClose={() => {
          setShowAddModal(false);
          resetModal();
        }}
        title="Register Private IP Inventory"
      >
        <div className="space-y-5">
          <div className="grid gap-2">
            <div className="text-sm font-medium text-slate-300">Registration Mode</div>
            <div className="grid grid-cols-2 gap-2">
              <Button variant={mode === "single" ? "primary" : "outline"} onClick={() => setMode("single")}>
                Single Host
              </Button>
              <Button variant={mode === "cidr" ? "primary" : "outline"} onClick={() => setMode("cidr")}>
                CIDR Subnet
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <div className="text-sm font-medium text-slate-300">{mode === "single" ? "IP Address" : "Network Address"}</div>
              <Input
                placeholder={mode === "single" ? "10.10.20.15" : "10.10.20.0"}
                value={address}
                onChange={(e) => setAddress(e.target.value)}
              />
            </div>

            {mode === "cidr" ? (
              <div className="space-y-2">
                <div className="text-sm font-medium text-slate-300">Prefix</div>
                <Input placeholder="24" value={prefix} onChange={(e) => setPrefix(e.target.value)} />
              </div>
            ) : (
              <div className="space-y-2">
                <div className="text-sm font-medium text-slate-300">Initial Status</div>
                <select
                  className="h-10 w-full rounded-lg border border-slate-800 bg-slate-900/50 px-3 text-sm text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50"
                  value={createStatus}
                  onChange={(e) => setCreateStatus(e.target.value as Exclude<IPStatus, "ASSIGNED">)}
                  disabled={!!selectedAssetId}
                >
                  {STATUS_OPTIONS.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <div className="text-sm font-medium text-slate-300">Assign Asset {mode === "cidr" ? "(single host only, leave empty for subnet imports)" : "(optional)"}</div>
            <select
              className="h-10 w-full rounded-lg border border-slate-800 bg-slate-900/50 px-3 text-sm text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50"
              value={selectedAssetId}
              onChange={(e) => setSelectedAssetId(e.target.value)}
            >
              <option value="">No asset assignment</option>
              {assets.map((asset) => (
                <option key={asset.id} value={asset.id}>
                  {asset.name} ({asset.serialNumber})
                </option>
              ))}
            </select>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4 text-sm text-slate-400">
            {mode === "single" ? (
              <p>Single-host registration is best for isolated addresses, VIPs, or device-specific LAN assignments.</p>
            ) : (
              <p>
                CIDR registration adds usable hosts only. Example: `10.10.20.0/24` creates `10.10.20.1` through
                `10.10.20.254`.
              </p>
            )}
          </div>

          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setShowAddModal(false);
                resetModal();
              }}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button
              onClick={() => void handleCreate()}
              disabled={
                submitting ||
                !address.trim() ||
                (mode === "cidr" && !prefix.trim()) ||
                (mode === "cidr" && !!selectedAssetId)
              }
              className="bg-emerald-600 shadow-emerald-500/20 hover:bg-emerald-700"
            >
              {submitting ? "Registering..." : "Register Inventory"}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
