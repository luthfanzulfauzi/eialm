"use client";

import { useState, useEffect } from "react";
import { Globe, Shield, Unlink, Loader2 } from "lucide-react";
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
  const [selectedRangeId, setSelectedRangeId] = useState<string>("");
  const [ips, setIps] = useState<PublicIp[]>([]);
  const [loadingRanges, setLoadingRanges] = useState(true);
  const [loadingIps, setLoadingIps] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [network, setNetwork] = useState("");
  const [prefix, setPrefix] = useState("24");
  const [creating, setCreating] = useState(false);
  const router = useRouter();
  const { isViewer } = useRole();
  const canManage = !isViewer;

  const fetchRanges = async () => {
    try {
      const res = await fetch("/api/public-ip/ranges");
      const data = await res.json();
      if (Array.isArray(data)) {
        setRanges(data);
        if (data.length) {
          setSelectedRangeId((current) => current || data[0].id);
        }
      } else {
        setRanges([]);
        setSelectedRangeId("");
      }
    } catch (error) {
      console.error("Failed to load public IP ranges:", error);
      setRanges([]);
      setSelectedRangeId("");
    } finally {
      setLoadingRanges(false);
    }
  };

  useEffect(() => {
    fetchRanges();
  }, []);

  useEffect(() => {
    const fetchIps = async () => {
      if (!selectedRangeId) return;
      setLoadingIps(true);
      try {
        const res = await fetch(`/api/public-ip/ranges/${selectedRangeId}/ips`);
        const data = await res.json();
        setIps(Array.isArray(data) ? data : []);
      } catch (error) {
        console.error("Failed to load public IPs:", error);
        setIps([]);
      } finally {
        setLoadingIps(false);
      }
    };
    fetchIps();
  }, [selectedRangeId]);

  const selectedRange = ranges.find((r) => r.id === selectedRangeId) || null;

  const handleDetach = async (ipId: string) => {
    if (!canManage) return;
    if (!confirm("Are you sure you want to release this public IP?")) return;
    
    try {
      const res = await fetch(`/api/network`, {
        method: "POST",
        body: JSON.stringify({ ipId, assetId: null }),
      });
      
      if (res.ok) {
        setIps((prev) =>
          prev.map((ip) =>
            ip.id === ipId ? { ...ip, asset: null, status: "AVAILABLE" } : ip
          )
        );
        router.refresh();
      }
    } catch (err) {
      console.error("Detachment failed", err);
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
      if (!res.ok) return;
      setIps((prev) => prev.map((ip) => (ip.id === ipId ? { ...ip, status } : ip)));
      await fetchRanges();
    } catch (e) {
      console.error("Failed to update IP status", e);
    }
  };

  const cycleStatus = (status: PublicIp["status"]) => {
    if (status === "AVAILABLE") return "RESERVED";
    if (status === "RESERVED") return "BLOCKED";
    if (status === "BLOCKED") return "AVAILABLE";
    return "ASSIGNED";
  };

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
    try {
      const res = await fetch("/api/public-ip/ranges", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ network: network.trim(), prefix: Number(prefix) }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(data?.error || "Failed to create range");
        return;
      }
      const rangesRes = await fetch("/api/public-ip/ranges");
      if (rangesRes.ok) {
        const next = await rangesRes.json();
        setRanges(next);
        setSelectedRangeId(data.id);
      }
      setIsCreateOpen(false);
      setNetwork("");
      setPrefix("24");
    } finally {
      setCreating(false);
    }
  };

  const gridColumns = selectedRange?.size === 256 ? 16 : 16;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <Globe className="text-blue-400" /> Public IP Management
          </h1>
          <p className="text-slate-500 text-sm">Inventory of externally routable address space</p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            disabled={loadingRanges || ranges.length === 0}
            onClick={() => fetchRanges()}
          >
            Refresh
          </Button>
          <Button disabled={!canManage} onClick={() => setIsCreateOpen(true)}>
            + Add Public IP Range
          </Button>
        </div>
      </div>

      <div className="bg-[#151921] border border-slate-800 rounded-2xl p-4 flex flex-col gap-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="text-sm text-slate-400 font-medium">Range</div>
            <select
              className="h-10 rounded-lg border border-slate-800 bg-slate-900/50 px-3 text-sm text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50 focus-visible:border-blue-500 transition-all"
              value={selectedRangeId}
              onChange={(e) => setSelectedRangeId(e.target.value)}
              disabled={loadingRanges || ranges.length === 0}
            >
              {ranges.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.cidr} ({r.startAddress} → {r.endAddress})
                </option>
              ))}
            </select>
          </div>

          {selectedRange && (
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="text-slate-400">AVAILABLE</span>
              <span className="text-white font-bold">{selectedRange.counts.AVAILABLE}</span>
              <span className="text-slate-400">RESERVED</span>
              <span className="text-white font-bold">{selectedRange.counts.RESERVED}</span>
              <span className="text-slate-400">ASSIGNED</span>
              <span className="text-white font-bold">{selectedRange.counts.ASSIGNED}</span>
              <span className="text-slate-400">BLOCKED</span>
              <span className="text-white font-bold">{selectedRange.counts.BLOCKED}</span>
            </div>
          )}
        </div>

        {!selectedRangeId ? (
          <div className="py-10 text-center text-slate-500 border-2 border-dashed border-slate-800 rounded-2xl">
            No public IP ranges registered.
          </div>
        ) : loadingIps ? (
          <div className="py-10 flex flex-col items-center justify-center text-slate-500 gap-3">
            <Loader2 className="animate-spin" size={24} />
            <p className="text-sm font-medium">Loading IP grid...</p>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
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
                      if (!canManage) return;
                      if (isAssigned) return;
                      updateIpStatus(ip.id, cycleStatus(ip.status));
                    }}
                    disabled={!canManage}
                    className={cn(
                      "rounded-md text-[11px] font-bold text-white aspect-square flex items-center justify-center transition-colors",
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
              {canManage && <div className="text-slate-500">Click a square to cycle status (except ASSIGNED).</div>}
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4">
        {loadingRanges ? (
          <div className="py-20 flex flex-col items-center justify-center text-slate-500 gap-3">
            <Loader2 className="animate-spin" size={24} />
            <p className="text-sm font-medium">Loading public IP ranges...</p>
          </div>
        ) : selectedRangeId && ips.length > 0 ? (
          ips.map((ip) => (
            <div key={ip.id} className="bg-[#151921] border border-slate-800 rounded-xl p-4 flex items-center justify-between group hover:border-blue-500/50 transition-all">
              <div className="flex items-center gap-6">
                <div className="text-lg font-mono font-bold text-white w-40">
                  {ip.address}
                </div>
                <div className="h-8 w-px bg-slate-800" />
                <div className="min-w-52">
                  <span className="text-xs text-slate-500 block mb-1">Status</span>
                  <div className="flex items-center gap-2">
                    <select
                      className="h-9 rounded-lg border border-slate-800 bg-slate-900/50 px-3 text-xs text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50 focus-visible:border-blue-500 transition-all disabled:opacity-50 disabled:pointer-events-none"
                      value={ip.status}
                      disabled={!canManage || ip.status === "ASSIGNED" || !!ip.asset}
                      onChange={(e) => updateIpStatus(ip.id, e.target.value as PublicIp["status"])}
                    >
                      <option value="AVAILABLE">AVAILABLE</option>
                      <option value="RESERVED">RESERVED</option>
                      <option value="BLOCKED">BLOCKED</option>
                      <option value="ASSIGNED" disabled>
                        ASSIGNED
                      </option>
                    </select>
                    <span
                      className={cn(
                        "text-[10px] px-2 py-1 rounded font-bold border",
                        ip.status === "AVAILABLE" && "text-blue-400 border-blue-500/20 bg-blue-500/10",
                        ip.status === "RESERVED" && "text-orange-400 border-orange-500/20 bg-orange-500/10",
                        ip.status === "BLOCKED" && "text-slate-300 border-slate-700 bg-slate-800/40",
                        ip.status === "ASSIGNED" && "text-emerald-400 border-emerald-500/20 bg-emerald-500/10"
                      )}
                    >
                      {ip.status}
                    </span>
                  </div>
                </div>
                <div>
                  <span className="text-xs text-slate-500 block mb-1">Assigned Asset</span>
                  {ip.asset ? (
                    <div className="flex items-center gap-2 text-sm text-blue-400">
                      <Shield size={14} /> 
                      <span className="font-medium">{ip.asset.name}</span>
                      <span className="text-[10px] bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded uppercase font-bold tracking-tighter">
                        {ip.asset.category}
                      </span>
                    </div>
                  ) : (
                    <span className="text-sm text-slate-600 italic px-2 py-0.5 rounded bg-slate-900/50 border border-slate-800">
                      Available / Unassigned
                    </span>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                {canManage && ip.asset && (
                  <button 
                    onClick={() => handleDetach(ip.id)}
                    className="p-2 hover:bg-red-500/10 rounded-lg text-slate-400 hover:text-red-400 transition-colors"
                  >
                    <Unlink size={16} />
                  </button>
                )}
              </div>
            </div>
          ))
        ) : (
          <div className="py-20 text-center border-2 border-dashed border-slate-800 rounded-2xl text-slate-500">
            No public IP addresses registered.
          </div>
        )}
      </div>

      <Modal isOpen={isCreateOpen} onClose={() => setIsCreateOpen(false)} title="Add Public IP Range">
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <div className="text-sm font-medium text-slate-300">Network</div>
              <Input
                placeholder="203.0.113.0"
                value={network}
                onChange={(e) => setNetwork(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <div className="text-sm font-medium text-slate-300">Prefix</div>
              <Input
                placeholder="24"
                value={prefix}
                onChange={(e) => setPrefix(e.target.value)}
              />
            </div>
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
