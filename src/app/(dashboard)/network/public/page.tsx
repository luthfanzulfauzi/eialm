"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Globe,
  Loader2,
  Network,
  Plus,
  RefreshCw,
  Shield,
  Unlink,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useRole } from "@/hooks/useRole";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type PublicIpRange = {
  id: string;
  network: string;
  prefix: number;
  cidr: string;
  startAddress: string;
  endAddress: string;
  size: number;
  counts: Record<"AVAILABLE" | "RESERVED" | "ASSIGNED" | "BLOCKED", number>;
};

type PublicIp = {
  id: string;
  address: string;
  status: "AVAILABLE" | "RESERVED" | "ASSIGNED" | "BLOCKED";
  asset: null | {
    id: string;
    name: string;
    serialNumber: string;
    category: string;
  };
};

export default function PublicIPPage() {
  const [ranges, setRanges] = useState<PublicIpRange[]>([]);
  const [selectedRangeId, setSelectedRangeId] = useState("");
  const [ips, setIps] = useState<PublicIp[]>([]);
  const [loadingRanges, setLoadingRanges] = useState(true);
  const [loadingIps, setLoadingIps] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [network, setNetwork] = useState("");
  const [prefix, setPrefix] = useState("24");
  const [creating, setCreating] = useState(false);
  const [banner, setBanner] = useState<{ type: "error" | "success"; message: string } | null>(null);
  const router = useRouter();
  const { isViewer } = useRole();
  const canManage = !isViewer;

  const fetchRanges = async (background = false) => {
    if (background) setRefreshing(true);
    else setLoadingRanges(true);

    try {
      const res = await fetch("/api/public-ip/ranges", { cache: "no-store" });
      const data = await res.json();
      if (Array.isArray(data)) {
        setRanges(data);
        setSelectedRangeId((current) => {
          if (current && data.some((range) => range.id === current)) return current;
          return data[0]?.id ?? "";
        });
      } else {
        setRanges([]);
        setSelectedRangeId("");
      }
    } catch (error) {
      console.error("Failed to load public IP ranges:", error);
      setRanges([]);
      setSelectedRangeId("");
      setBanner({ type: "error", message: "Failed to load public IP ranges." });
    } finally {
      setLoadingRanges(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    void fetchRanges();
  }, []);

  useEffect(() => {
    const fetchIps = async () => {
      if (!selectedRangeId) {
        setIps([]);
        return;
      }

      setLoadingIps(true);
      try {
        const res = await fetch(`/api/public-ip/ranges/${selectedRangeId}/ips`, { cache: "no-store" });
        const data = await res.json();
        setIps(Array.isArray(data) ? data : []);
      } catch (error) {
        console.error("Failed to load public IPs:", error);
        setIps([]);
        setBanner({ type: "error", message: "Failed to load public IP inventory." });
      } finally {
        setLoadingIps(false);
      }
    };

    void fetchIps();
  }, [selectedRangeId]);

  const selectedRange = ranges.find((range) => range.id === selectedRangeId) || null;

  const summary = useMemo(() => {
    if (!selectedRange) {
      return {
        total: 0,
        available: 0,
        reserved: 0,
        assigned: 0,
        blocked: 0,
      };
    }

    return {
      total: selectedRange.size,
      available: selectedRange.counts.AVAILABLE,
      reserved: selectedRange.counts.RESERVED,
      assigned: selectedRange.counts.ASSIGNED,
      blocked: selectedRange.counts.BLOCKED,
    };
  }, [selectedRange]);

  const utilization = summary.total > 0 ? Math.round((summary.assigned / summary.total) * 100) : 0;
  const gridColumns = 16;

  const handleDetach = async (ipId: string) => {
    if (!canManage) return;
    if (!confirm("Release this public IP from its assigned asset?")) return;

    try {
      const res = await fetch("/api/network", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ipId, assetId: null }),
      });

      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        setBanner({ type: "error", message: payload.error || "Failed to release public IP." });
        return;
      }

      setBanner({ type: "success", message: "Public IP released." });
      setIps((prev) =>
        prev.map((ip) =>
          ip.id === ipId ? { ...ip, asset: null, status: "AVAILABLE" } : ip
        )
      );
      await fetchRanges(true);
      router.refresh();
    } catch (error) {
      console.error("Detachment failed", error);
      setBanner({ type: "error", message: "Failed to release public IP." });
    }
  };

  const updateIpStatus = async (ipId: string, status: PublicIp["status"]) => {
    if (!canManage) return;

    try {
      const res = await fetch(`/api/public-ip/ips/${ipId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });

      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        setBanner({ type: "error", message: payload.error || "Failed to update public IP status." });
        return;
      }

      setBanner({ type: "success", message: `Public IP status changed to ${status}.` });
      setIps((prev) => prev.map((ip) => (ip.id === ipId ? { ...ip, status } : ip)));
      await fetchRanges(true);
    } catch (error) {
      console.error("Failed to update IP status", error);
      setBanner({ type: "error", message: "Failed to update public IP status." });
    }
  };

  const cycleStatus = (status: PublicIp["status"]) => {
    if (status === "AVAILABLE") return "RESERVED";
    if (status === "RESERVED") return "BLOCKED";
    if (status === "BLOCKED") return "AVAILABLE";
    return "ASSIGNED";
  };

  const statusBadge = (status: PublicIp["status"]) =>
    cn(
      "inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-bold tracking-[0.2em]",
      status === "AVAILABLE" && "border-blue-500/20 bg-blue-500/10 text-blue-300",
      status === "RESERVED" && "border-orange-500/20 bg-orange-500/10 text-orange-300",
      status === "ASSIGNED" && "border-emerald-500/20 bg-emerald-500/10 text-emerald-300",
      status === "BLOCKED" && "border-slate-700 bg-slate-800/80 text-slate-300"
    );

  const statusColor = (status: PublicIp["status"]) => {
    switch (status) {
      case "AVAILABLE":
        return "bg-blue-600/90 hover:bg-blue-600";
      case "RESERVED":
        return "bg-orange-500/90 hover:bg-orange-500";
      case "BLOCKED":
        return "bg-slate-700/90 hover:bg-slate-700";
      case "ASSIGNED":
        return "bg-emerald-600/90 hover:bg-emerald-600";
    }
  };

  const createRange = async () => {
    if (!canManage) return;

    setCreating(true);
    setBanner(null);
    try {
      const res = await fetch("/api/public-ip/ranges", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ network: network.trim(), prefix: Number(prefix) }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setBanner({ type: "error", message: data?.error || "Failed to create range." });
        return;
      }

      setBanner({ type: "success", message: `Registered public range ${data.cidr || `${network.trim()}/${prefix}`}.` });
      await fetchRanges(true);
      setSelectedRangeId(data.id);
      setIsCreateOpen(false);
      setNetwork("");
      setPrefix("24");
    } catch (error) {
      console.error("Failed to create public range", error);
      setBanner({ type: "error", message: "Failed to create range." });
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="flex items-center gap-3 text-2xl font-bold text-white">
            <Globe className="text-blue-400" /> Public IP Management
          </h1>
          <p className="text-sm text-slate-500">
            Manage externally routable ranges, address-state transitions, and asset-facing public assignments.
          </p>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <Button variant="outline" onClick={() => fetchRanges(true)} disabled={loadingRanges || refreshing}>
            <RefreshCw size={16} className={cn("mr-2", refreshing && "animate-spin")} /> Refresh
          </Button>
          <Button disabled={!canManage} onClick={() => setIsCreateOpen(true)}>
            <Plus size={18} className="mr-2" /> Add Public IP Range
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
          <div className="text-xs font-bold uppercase tracking-[0.25em] text-slate-500">Selected Range</div>
          <div className="mt-3 text-2xl font-bold text-white">{selectedRange?.cidr || "No range"}</div>
          <div className="mt-2 text-sm text-slate-400">
            {selectedRange ? `${selectedRange.startAddress} to ${selectedRange.endAddress}` : "Register a public block to begin"}
          </div>
        </div>
        <div className="rounded-2xl border border-slate-800 bg-[#111620] p-5">
          <div className="text-xs font-bold uppercase tracking-[0.25em] text-slate-500">Inventory</div>
          <div className="mt-3 text-3xl font-bold text-white">{summary.total}</div>
          <div className="mt-2 text-sm text-slate-400">{summary.available} ready for assignment</div>
        </div>
        <div className="rounded-2xl border border-slate-800 bg-[#111620] p-5">
          <div className="text-xs font-bold uppercase tracking-[0.25em] text-slate-500">Utilization</div>
          <div className="mt-3 text-3xl font-bold text-white">{utilization}%</div>
          <div className="mt-2 text-sm text-slate-400">{summary.assigned} assigned public IPs</div>
        </div>
        <div className="rounded-2xl border border-slate-800 bg-[#111620] p-5">
          <div className="text-xs font-bold uppercase tracking-[0.25em] text-slate-500">Exceptions</div>
          <div className="mt-3 text-3xl font-bold text-white">{summary.blocked + summary.reserved}</div>
          <div className="mt-2 text-sm text-slate-400">{summary.blocked} blocked and {summary.reserved} reserved</div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.5fr,1fr]">
        <div className="rounded-2xl border border-slate-800 bg-[#111620] shadow-xl">
          <div className="flex flex-col gap-4 border-b border-slate-800 bg-slate-900/30 px-4 py-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="text-sm font-bold text-white">Public Address Inventory</div>
              <div className="text-xs text-slate-500">
                {selectedRange ? `${ips.length} addresses in the selected block` : "Select a public block to inspect"}
              </div>
            </div>
            <select
              className="h-10 rounded-lg border border-slate-800 bg-slate-900/70 px-3 text-sm text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50"
              value={selectedRangeId}
              onChange={(e) => setSelectedRangeId(e.target.value)}
              disabled={loadingRanges || ranges.length === 0}
            >
              {ranges.length === 0 ? (
                <option value="">No ranges registered</option>
              ) : (
                ranges.map((range) => (
                  <option key={range.id} value={range.id}>
                    {range.cidr} ({range.startAddress} → {range.endAddress})
                  </option>
                ))
              )}
            </select>
          </div>

          {!selectedRangeId ? (
            <div className="py-20 text-center text-slate-500">
              <p className="font-medium">No public IP ranges registered.</p>
            </div>
          ) : loadingIps ? (
            <div className="flex min-h-80 flex-col items-center justify-center gap-3 text-slate-500">
              <Loader2 className="animate-spin text-blue-500" size={26} />
              <p className="text-sm">Loading public IP inventory...</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-800">
              {ips.map((ip) => (
                <div
                  key={ip.id}
                  className="grid gap-4 px-4 py-4 transition-colors hover:bg-slate-800/20 lg:grid-cols-[180px,140px,1fr,180px,80px]"
                >
                  <div>
                    <div className="text-lg font-bold text-blue-300">{ip.address}</div>
                    <div className="text-xs text-slate-500">{selectedRange?.cidr || "Public range"}</div>
                  </div>

                  <div className="flex items-center">
                    <span className={statusBadge(ip.asset ? "ASSIGNED" : ip.status)}>{ip.asset ? "ASSIGNED" : ip.status}</span>
                  </div>

                  <div className="space-y-2">
                    {ip.asset ? (
                      <div className="flex items-center gap-3">
                        <div className="rounded-lg border border-slate-700 bg-slate-800 p-2 text-slate-400">
                          <Shield size={14} />
                        </div>
                        <div>
                          <div className="text-sm font-medium text-slate-100">{ip.asset.name}</div>
                          <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">
                            {ip.asset.category} • {ip.asset.serialNumber}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="text-sm text-slate-500">Unassigned public IP slot</div>
                    )}
                  </div>

                  <div className="space-y-2">
                    <div className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">Manage</div>
                    <select
                      className="h-10 w-full rounded-lg border border-slate-800 bg-slate-900/70 px-3 text-sm text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50 disabled:opacity-50"
                      value={ip.asset ? "ASSIGNED" : ip.status}
                      disabled={!canManage || !!ip.asset}
                      onChange={(e) => updateIpStatus(ip.id, e.target.value as PublicIp["status"])}
                    >
                      {ip.asset && <option value="ASSIGNED">ASSIGNED</option>}
                      {!ip.asset && <option value="AVAILABLE">AVAILABLE</option>}
                      {!ip.asset && <option value="RESERVED">RESERVED</option>}
                      {!ip.asset && <option value="BLOCKED">BLOCKED</option>}
                    </select>
                  </div>

                  <div className="flex items-start justify-end gap-2">
                    {canManage && ip.asset && (
                      <button
                        onClick={() => void handleDetach(ip.id)}
                        className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-red-500/10 hover:text-red-400"
                        title="Release public IP"
                      >
                        <Unlink size={16} />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-4">
          <div className="rounded-2xl border border-slate-800 bg-[#111620] p-5">
            <div className="flex items-center gap-3">
              <div className="rounded-xl border border-slate-700 bg-slate-900/60 p-3 text-blue-300">
                <Network size={18} />
              </div>
              <div>
                <div className="text-sm font-bold text-white">Range Grid</div>
                <div className="text-xs text-slate-500">Clickable status grid for the selected public block</div>
              </div>
            </div>

            {!selectedRangeId ? (
              <div className="mt-4 rounded-xl border border-dashed border-slate-800 px-4 py-8 text-center text-sm text-slate-500">
                Add a public IP range to visualize the block.
              </div>
            ) : loadingIps ? (
              <div className="mt-4 flex items-center justify-center py-10 text-slate-500">
                <Loader2 className="animate-spin" size={20} />
              </div>
            ) : (
              <div className="mt-4 space-y-4">
                <div
                  className="grid gap-1"
                  style={{ gridTemplateColumns: `repeat(${gridColumns}, minmax(0, 1fr))` }}
                >
                  {ips.map((ip, idx) => {
                    const label =
                      (selectedRange?.prefix ?? 0) >= 24
                        ? ip.address.split(".").pop() || `${idx}`
                        : `${idx}`;

                    const isAssigned = ip.status === "ASSIGNED" || !!ip.asset;
                    return (
                      <button
                        key={ip.id}
                        onClick={() => {
                          if (!canManage || isAssigned) return;
                          updateIpStatus(ip.id, cycleStatus(ip.status));
                        }}
                        disabled={!canManage}
                        className={cn(
                          "aspect-square rounded-md text-[11px] font-bold text-white transition-colors",
                          statusColor(ip.status),
                          isAssigned ? "cursor-not-allowed" : "cursor-pointer"
                        )}
                        title={`${ip.address} • ${ip.status}${ip.asset ? ` • ${ip.asset.name}` : ""}`}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>

                <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400">
                  <div className="flex items-center gap-2">
                    <span className="h-3 w-3 rounded bg-blue-600" />
                    AVAILABLE
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="h-3 w-3 rounded bg-orange-500" />
                    RESERVED
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="h-3 w-3 rounded bg-emerald-600" />
                    ASSIGNED
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="h-3 w-3 rounded bg-slate-700" />
                    BLOCKED
                  </div>
                  {canManage && <div className="text-slate-500">Click a square to cycle status, except assigned IPs.</div>}
                </div>
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-slate-800 bg-[#111620] p-5">
            <div className="text-sm font-bold text-white">Operational Notes</div>
            <div className="mt-3 space-y-2 text-sm text-slate-400">
              <p>Public ranges generate inventory automatically when a block is registered.</p>
              <p>Assigned public IPs stay locked in `ASSIGNED` until released from the asset.</p>
              <p>Reserved and blocked states help operators protect addresses before external use.</p>
            </div>
          </div>
        </div>
      </div>

      <Modal isOpen={isCreateOpen} onClose={() => setIsCreateOpen(false)} title="Add Public IP Range">
        <div className="space-y-5">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <div className="text-sm font-medium text-slate-300">Network</div>
              <Input placeholder="203.0.113.0" value={network} onChange={(e) => setNetwork(e.target.value)} />
            </div>
            <div className="space-y-2">
              <div className="text-sm font-medium text-slate-300">Prefix</div>
              <Input placeholder="24" value={prefix} onChange={(e) => setPrefix(e.target.value)} />
            </div>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4 text-sm text-slate-400">
            <p>Register a valid public CIDR block to generate IP inventory for status tracking and assignment workflows.</p>
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setIsCreateOpen(false)} disabled={creating}>
              Cancel
            </Button>
            <Button onClick={createRange} disabled={creating || !network.trim() || !prefix.trim()}>
              {creating ? "Creating..." : "Create Range"}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
