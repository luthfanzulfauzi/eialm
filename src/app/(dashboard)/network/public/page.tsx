"use client";

import { useEffect, useMemo, useState, type Dispatch, type SetStateAction } from "react";
import { Edit3, Globe, Loader2, Network, Plus, RefreshCw, Search, Server, Trash2, Unlink } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRole } from "@/hooks/useRole";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type IPStatus = "AVAILABLE" | "RESERVED" | "ASSIGNED" | "BLOCKED";
type TargetType = "HARDWARE" | "VM" | "OTHER";

type AssetOption = {
  id: string;
  name: string;
  serialNumber: string;
  category: string;
};

type PublicIp = {
  id: string;
  address: string;
  status: IPStatus;
  publicRangeId?: string | null;
  assignmentTargetType: TargetType | null;
  assignmentTargetLabel: string | null;
  asset: AssetOption | null;
};

type PublicSubnetSummary = {
  cidr: string;
  counts: Record<IPStatus, number>;
  assignedAssets: number;
};

type PublicRange = {
  id: string;
  network: string;
  prefix: number;
  cidr: string;
  startAddress: string;
  endAddress: string;
  size: number;
  counts: Record<IPStatus, number>;
};

type InventoryResponse = {
  items: PublicIp[];
  summary: {
    total: number;
    available: number;
    reserved: number;
    assigned: number;
    blocked: number;
    assignedAssets: number;
    unassigned: number;
    rangeCount: number;
  };
  subnets: PublicSubnetSummary[];
  ranges: PublicRange[];
  assignableAssets: AssetOption[];
};

type StatusFormState = {
  status: IPStatus;
  targetType: TargetType | "";
  assetId: string;
  targetLabel: string;
};

type RangeFormMode = "create" | "edit";

const DEFAULT_SUMMARY: InventoryResponse["summary"] = {
  total: 0,
  available: 0,
  reserved: 0,
  assigned: 0,
  blocked: 0,
  assignedAssets: 0,
  unassigned: 0,
  rangeCount: 0,
};

const STATUS_OPTIONS: IPStatus[] = ["AVAILABLE", "RESERVED", "ASSIGNED", "BLOCKED"];

function getTargetSummary(ip: PublicIp) {
  if (ip.assignmentTargetType === "HARDWARE" && ip.asset) {
    return {
      title: ip.asset.name,
      detail: `${ip.asset.category} • ${ip.asset.serialNumber}`,
    };
  }

  if (ip.assignmentTargetType && ip.assignmentTargetLabel) {
    return {
      title: ip.assignmentTargetLabel,
      detail: ip.assignmentTargetType,
    };
  }

  return null;
}

function getInitialFormState(ip?: PublicIp | null): StatusFormState {
  return {
    status: ip?.status ?? "AVAILABLE",
    targetType: ip?.assignmentTargetType ?? "",
    assetId: ip?.asset?.id ?? "",
    targetLabel: ip?.assignmentTargetType === "HARDWARE" ? "" : ip?.assignmentTargetLabel ?? "",
  };
}

export default function PublicIPPage() {
  const [ips, setIps] = useState<PublicIp[]>([]);
  const [summary, setSummary] = useState(DEFAULT_SUMMARY);
  const [subnets, setSubnets] = useState<PublicSubnetSummary[]>([]);
  const [ranges, setRanges] = useState<PublicRange[]>([]);
  const [assets, setAssets] = useState<AssetOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showRangeModal, setShowRangeModal] = useState(false);
  const [showManageModal, setShowManageModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [mode, setMode] = useState<"single" | "cidr">("single");
  const [address, setAddress] = useState("");
  const [prefix, setPrefix] = useState("24");
  const [createForm, setCreateForm] = useState<StatusFormState>(getInitialFormState());
  const [rangeFormMode, setRangeFormMode] = useState<RangeFormMode>("create");
  const [activeRange, setActiveRange] = useState<PublicRange | null>(null);
  const [rangeNetwork, setRangeNetwork] = useState("");
  const [rangePrefix, setRangePrefix] = useState("24");
  const [activeIp, setActiveIp] = useState<PublicIp | null>(null);
  const [manageForm, setManageForm] = useState<StatusFormState>(getInitialFormState());
  const [submitting, setSubmitting] = useState(false);
  const [banner, setBanner] = useState<{ type: "error" | "success"; message: string } | null>(null);
  const [createModalError, setCreateModalError] = useState<string | null>(null);
  const [rangeModalError, setRangeModalError] = useState<string | null>(null);
  const router = useRouter();
  const { isViewer } = useRole();
  const canManage = !isViewer;

  const fetchInventory = async (background = false) => {
    if (background) setRefreshing(true);
    else setLoading(true);

    try {
      const res = await fetch("/api/public-ip/inventory", { cache: "no-store" });
      const data = (await res.json()) as InventoryResponse;
      setIps(Array.isArray(data.items) ? data.items : []);
      setSummary(data.summary ?? DEFAULT_SUMMARY);
      setSubnets(Array.isArray(data.subnets) ? data.subnets : []);
      setRanges(Array.isArray(data.ranges) ? data.ranges : []);
      setAssets(Array.isArray(data.assignableAssets) ? data.assignableAssets : []);
    } catch (error) {
      console.error("Failed to fetch public IPs:", error);
      setBanner({ type: "error", message: "Failed to load public IP inventory." });
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
        ip.assignmentTargetType,
        ip.assignmentTargetLabel,
        ip.asset?.name,
        ip.asset?.serialNumber,
        ip.asset?.category,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query))
    );
  }, [ips, searchQuery]);

  const resetRangeForm = () => {
    setRangeFormMode("create");
    setActiveRange(null);
    setRangeNetwork("");
    setRangePrefix("24");
    setRangeModalError(null);
  };

  const resetCreateModal = () => {
    setMode("single");
    setAddress("");
    setPrefix("24");
    setCreateForm(getInitialFormState());
    setCreateModalError(null);
  };

  const openManageModal = (ip: PublicIp) => {
    setActiveIp(ip);
    setManageForm(getInitialFormState(ip));
    setShowManageModal(true);
  };

  const openCreateRangeModal = () => {
    resetRangeForm();
    setShowRangeModal(true);
  };

  const openCreateModal = () => {
    resetCreateModal();
    setShowAddModal(true);
  };

  const openEditRangeModal = (range: PublicRange) => {
    setRangeFormMode("edit");
    setActiveRange(range);
    setRangeNetwork(range.network);
    setRangePrefix(String(range.prefix));
    setRangeModalError(null);
    setShowRangeModal(true);
  };

  const requiresTarget = (status: IPStatus) => status === "ASSIGNED" || status === "RESERVED";
  const allowsTarget = (status: IPStatus) => status !== "AVAILABLE";
  const isHardwareTarget = (targetType: string) => targetType === "HARDWARE";

  const buildPayload = (form: StatusFormState) => ({
    status: form.status,
    assignmentTargetType: allowsTarget(form.status) && form.targetType ? form.targetType : null,
    assetId: allowsTarget(form.status) && isHardwareTarget(form.targetType) ? form.assetId || null : null,
    assignmentTargetLabel:
      allowsTarget(form.status) && !isHardwareTarget(form.targetType) ? form.targetLabel.trim() || null : null,
  });

  const validateForm = (form: StatusFormState, isBulk = false) => {
    if (!allowsTarget(form.status)) return null;
    if (isBulk && form.status === "ASSIGNED") return "Bulk subnet registration cannot start in ASSIGNED state.";
    if (isBulk && form.targetType === "HARDWARE") return "Bulk subnet registration cannot target a single hardware asset.";
    if (requiresTarget(form.status) && !form.targetType) return "Assigned and reserved IPs require a target type.";
    if (isHardwareTarget(form.targetType) && !form.assetId) return "Hardware targets require a selected hardware asset.";
    if (
      form.targetType &&
      !isHardwareTarget(form.targetType) &&
      requiresTarget(form.status) &&
      !form.targetLabel.trim()
    ) {
      return "Assigned and reserved VM/other targets require details.";
    }
    return null;
  };

  const handleCreate = async () => {
    if (!canManage) return;

    const validation = validateForm(createForm, mode === "cidr");
    if (validation) {
      if (mode === "cidr") setCreateModalError(validation);
      else setBanner({ type: "error", message: validation });
      return;
    }

    setSubmitting(true);
    if (mode === "cidr") setCreateModalError(null);
    else setBanner(null);
    try {
      if (mode === "single") {
        const res = await fetch("/api/public-ip/ips", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            address: address.trim(),
            ...buildPayload(createForm),
          }),
        });
        const payload = await res.json().catch(() => ({}));
        if (!res.ok) {
          setBanner({ type: "error", message: payload.error || "Failed to register public IP." });
          return;
        }

        setBanner({ type: "success", message: `Registered public IP ${address.trim()}.` });
        setShowAddModal(false);
        resetCreateModal();
        await fetchInventory(true);
        router.refresh();
        return;
      }

      const createRangeRes = await fetch("/api/public-ip/ranges", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ network: address.trim(), prefix: Number(prefix) }),
      });
      const rangePayload = await createRangeRes.json().catch(() => ({}));
      if (!createRangeRes.ok) {
        setCreateModalError(rangePayload.error || "Failed to register public range.");
        return;
      }

      if (createForm.status !== "AVAILABLE") {
        const ipsRes = await fetch(`/api/public-ip/ranges/${rangePayload.id}/ips`, { cache: "no-store" });
        const createdIps = await ipsRes.json().catch(() => []);
        if (Array.isArray(createdIps)) {
          const payload = buildPayload(createForm);
          for (const ip of createdIps) {
            await fetch(`/api/public-ip/ips/${ip.id}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(payload),
            });
          }
        }
      }

      setBanner({
        type: "success",
        message: `Registered ${rangePayload.size ?? 0} public IPs from ${address.trim()}/${prefix}.`,
      });
      setShowAddModal(false);
      resetCreateModal();
      await fetchInventory(true);
      router.refresh();
    } catch (error) {
      console.error("Public IP registration failed", error);
      if (mode === "cidr") setCreateModalError("Public IP registration failed.");
      else setBanner({ type: "error", message: "Public IP registration failed." });
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateState = async () => {
    if (!canManage || !activeIp) return;

    const validation = validateForm(manageForm);
    if (validation) {
      setBanner({ type: "error", message: validation });
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`/api/public-ip/ips/${activeIp.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildPayload(manageForm)),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        setBanner({ type: "error", message: payload.error || "Failed to update public IP." });
        return;
      }

      setBanner({ type: "success", message: `Public IP ${activeIp.address} updated.` });
      setShowManageModal(false);
      setActiveIp(null);
      await fetchInventory(true);
      router.refresh();
    } catch (error) {
      console.error("Failed to update public IP", error);
      setBanner({ type: "error", message: "Failed to update public IP." });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDetach = async (ipId: string) => {
    if (!canManage) return;
    if (!confirm("Release this public IP assignment?")) return;

    try {
      const res = await fetch(`/api/public-ip/ips/${ipId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "AVAILABLE",
          assignmentTargetType: null,
          assignmentTargetLabel: null,
          assetId: null,
        }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        setBanner({ type: "error", message: payload.error || "Failed to release public IP." });
        return;
      }

      setBanner({ type: "success", message: "Public IP released." });
      await fetchInventory(true);
      router.refresh();
    } catch (error) {
      console.error("Detachment failed", error);
      setBanner({ type: "error", message: "Failed to release public IP." });
    }
  };

  const handleDelete = async (ipId: string) => {
    if (!canManage) return;
    if (!confirm("Delete this public IP from inventory?")) return;

    try {
      const res = await fetch(`/api/public-ip/ips/${ipId}`, { method: "DELETE" });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        setBanner({ type: "error", message: payload.error || "Failed to delete public IP." });
        return;
      }

      setBanner({ type: "success", message: "Public IP deleted from inventory." });
      await fetchInventory(true);
    } catch (error) {
      console.error("Delete failed", error);
      setBanner({ type: "error", message: "Failed to delete public IP." });
    }
  };

  const handleSaveRange = async () => {
    if (!canManage) return;

    setSubmitting(true);
    setRangeModalError(null);
    try {
      const isEditing = rangeFormMode === "edit" && activeRange;
      const endpoint = isEditing ? `/api/public-ip/ranges/${activeRange.id}` : "/api/public-ip/ranges";
      const res = await fetch(endpoint, {
        method: isEditing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ network: rangeNetwork.trim(), prefix: Number(rangePrefix) }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        setRangeModalError(payload.error || `Failed to ${isEditing ? "update" : "create"} public range.`);
        return;
      }

      setBanner({
        type: "success",
        message: isEditing
          ? `Updated public range ${payload.cidr || `${rangeNetwork.trim()}/${rangePrefix}`}.`
          : `Registered public range ${payload.cidr || `${rangeNetwork.trim()}/${rangePrefix}`}.`,
      });
      setShowRangeModal(false);
      resetRangeForm();
      await fetchInventory(true);
      router.refresh();
    } catch (error) {
      console.error("Range save failed", error);
      setRangeModalError(`Failed to ${rangeFormMode === "edit" ? "update" : "create"} public range.`);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteRange = async (range: PublicRange) => {
    if (!canManage) return;
    if (!confirm(`Delete public range ${range.cidr}? This only works when every IP in the range is AVAILABLE.`)) {
      return;
    }

    setBanner(null);
    try {
      const res = await fetch(`/api/public-ip/ranges/${range.id}`, {
        method: "DELETE",
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        setBanner({ type: "error", message: payload.error || "Failed to delete public range." });
        return;
      }

      setBanner({ type: "success", message: `Deleted public range ${range.cidr}.` });
      await fetchInventory(true);
      router.refresh();
    } catch (error) {
      console.error("Range delete failed", error);
      setBanner({ type: "error", message: "Failed to delete public range." });
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

  const renderTargetFields = (
    form: StatusFormState,
    setForm: Dispatch<SetStateAction<StatusFormState>>,
    isBulk: boolean
  ) => {
    if (!allowsTarget(form.status)) return null;

    return (
      <div className="space-y-4">
        <div className="space-y-2">
          <div className="text-sm font-medium text-slate-300">
            Target Type {requiresTarget(form.status) ? "(required)" : "(optional)"}
          </div>
          <select
            className="h-10 w-full rounded-lg border border-slate-800 bg-slate-900/50 px-3 text-sm text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50"
            value={form.targetType}
            onChange={(e) =>
              setForm((current) => ({
                ...current,
                targetType: e.target.value as TargetType | "",
                assetId: "",
                targetLabel: "",
              }))
            }
          >
            <option value="">No target</option>
            {!isBulk && <option value="HARDWARE">Hardware Asset</option>}
            <option value="VM">VM</option>
            <option value="OTHER">Other</option>
          </select>
        </div>

        {isHardwareTarget(form.targetType) ? (
          <div className="space-y-2">
            <div className="text-sm font-medium text-slate-300">
              Hardware Asset {requiresTarget(form.status) ? "(required)" : "(optional)"}
            </div>
            <select
              className="h-10 w-full rounded-lg border border-slate-800 bg-slate-900/50 px-3 text-sm text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50"
              value={form.assetId}
              onChange={(e) => setForm((current) => ({ ...current, assetId: e.target.value }))}
            >
              <option value="">Select hardware asset</option>
              {assets.map((asset) => (
                <option key={asset.id} value={asset.id}>
                  {asset.name} ({asset.serialNumber})
                </option>
              ))}
            </select>
          </div>
        ) : form.targetType ? (
          <div className="space-y-2">
            <div className="text-sm font-medium text-slate-300">
              Target Detail {requiresTarget(form.status) ? "(required)" : "(optional)"}
            </div>
            <Input
              placeholder={form.targetType === "VM" ? "vm-edge-01 / gateway pool" : "Reason or destination"}
              value={form.targetLabel}
              onChange={(e) => setForm((current) => ({ ...current, targetLabel: e.target.value }))}
            />
          </div>
        ) : null}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="flex items-center gap-3 text-2xl font-bold text-white">
            <Globe className="text-blue-400" /> Public IP Management
          </h1>
          <p className="text-sm text-slate-500">
            Manage externally routable address inventory, managed ranges, and assignments for hardware, VMs, or other consumers.
          </p>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
            <input
              type="text"
              placeholder="Search IP, status, VM, hardware..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-lg border border-slate-800 bg-slate-900 pl-10 pr-4 py-2 text-sm text-white outline-none transition-all focus:border-blue-500 sm:w-72"
            />
          </div>
          <Button variant="outline" onClick={() => fetchInventory(true)} disabled={loading || refreshing}>
            <RefreshCw size={16} className={cn("mr-2", refreshing && "animate-spin")} /> Refresh
          </Button>
          <Button onClick={() => canManage && openCreateRangeModal()} disabled={!canManage} variant="outline">
            <Plus size={18} className="mr-2" /> Add Public IP Range
          </Button>
          <Button onClick={() => canManage && openCreateModal()} disabled={!canManage}>
            <Plus size={18} className="mr-2" /> Add Public IPs
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
          <div className="mt-2 text-sm text-slate-400">{summary.available} available</div>
        </div>
        <div className="rounded-2xl border border-slate-800 bg-[#111620] p-5">
          <div className="text-xs font-bold uppercase tracking-[0.25em] text-slate-500">Assigned</div>
          <div className="mt-3 text-3xl font-bold text-white">{summary.assigned}</div>
          <div className="mt-2 text-sm text-slate-400">{summary.reserved} reserved, {summary.blocked} blocked</div>
        </div>
        <div className="rounded-2xl border border-slate-800 bg-[#111620] p-5">
          <div className="text-xs font-bold uppercase tracking-[0.25em] text-slate-500">Managed Ranges</div>
          <div className="mt-3 text-3xl font-bold text-white">{summary.rangeCount}</div>
          <div className="mt-2 text-sm text-slate-400">{summary.assignedAssets} actively consumed</div>
        </div>
        <div className="rounded-2xl border border-slate-800 bg-[#111620] p-5">
          <div className="text-xs font-bold uppercase tracking-[0.25em] text-slate-500">Exceptions</div>
          <div className="mt-3 text-3xl font-bold text-white">{summary.blocked + summary.reserved}</div>
          <div className="mt-2 text-sm text-slate-400">Supports Hardware, VM, and Other targets</div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.5fr,1fr]">
        <div className="rounded-2xl border border-slate-800 bg-[#111620] shadow-xl">
          <div className="flex items-center justify-between border-b border-slate-800 bg-slate-900/30 px-4 py-4">
            <div>
              <div className="text-sm font-bold text-white">Public Address Inventory</div>
              <div className="text-xs text-slate-500">{filteredIps.length} visible addresses</div>
            </div>
            <div className="text-xs text-slate-500">Assigned and reserved IPs require a destination target.</div>
          </div>

          <div className="divide-y divide-slate-800">
            {loading ? (
              <div className="flex min-h-80 flex-col items-center justify-center gap-3 text-slate-500">
                <Loader2 className="animate-spin text-blue-500" size={26} />
                <p className="text-sm">Scanning public IP inventory...</p>
              </div>
            ) : filteredIps.length > 0 ? (
              filteredIps.map((ip) => {
                const target = getTargetSummary(ip);
                return (
                  <div key={ip.id} className="grid gap-4 px-4 py-4 transition-colors hover:bg-slate-800/20 lg:grid-cols-[180px,140px,1fr,180px,100px]">
                    <div>
                      <div className="text-lg font-bold text-blue-300">{ip.address}</div>
                      <div className="text-xs text-slate-500">{ip.address.split(".").slice(0, 3).join(".")}.0/24</div>
                    </div>

                    <div className="flex items-center">
                      <span className={statusBadge(ip.status)}>{ip.status}</span>
                    </div>

                    <div className="space-y-2">
                      {target ? (
                        <div className="flex items-center gap-3">
                          <div className="rounded-lg border border-slate-700 bg-slate-800 p-2 text-slate-400">
                            <Server size={14} />
                          </div>
                          <div>
                            <div className="text-sm font-medium text-slate-100">{target.title}</div>
                            <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">{target.detail}</div>
                          </div>
                        </div>
                      ) : (
                        <div className="text-sm text-slate-500">No target metadata</div>
                      )}
                    </div>

                    <div className="space-y-2">
                      <div className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">Manage</div>
                      <Button variant="outline" size="sm" disabled={!canManage} onClick={() => openManageModal(ip)}>
                        Update State
                      </Button>
                    </div>

                    <div className="flex items-start justify-end gap-2">
                      {canManage && ip.status === "ASSIGNED" && (
                        <button
                          onClick={() => void handleDetach(ip.id)}
                          className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-red-500/10 hover:text-red-400"
                          title="Release public IP"
                        >
                          <Unlink size={16} />
                        </button>
                      )}
                      {canManage && ip.status !== "ASSIGNED" && !ip.publicRangeId && (
                        <button
                          onClick={() => void handleDelete(ip.id)}
                          className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-red-500/10 hover:text-red-400"
                          title="Delete public IP"
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="py-20 text-center text-slate-500">
                <p className="font-medium">No public IP addresses found.</p>
              </div>
            )}
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-2xl border border-slate-800 bg-[#111620] p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-bold text-white">Managed Public Ranges</div>
                <div className="text-xs text-slate-500">Create ranges here, then edit or delete them when fully available.</div>
              </div>
              <div className="text-xs text-slate-500">{ranges.length} ranges</div>
            </div>

            <div className="mt-4 space-y-3">
              {ranges.length > 0 ? (
                ranges.map((range) => (
                  <div key={range.id} className="rounded-xl border border-slate-800 bg-slate-900/40 p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-sm font-bold text-white">{range.cidr}</div>
                        <div className="mt-1 text-xs text-slate-500">
                          {range.startAddress} to {range.endAddress} • {range.size} IPs
                        </div>
                        <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-slate-400">
                          <span>A {range.counts.AVAILABLE}</span>
                          <span>R {range.counts.RESERVED}</span>
                          <span>S {range.counts.ASSIGNED}</span>
                          <span>B {range.counts.BLOCKED}</span>
                        </div>
                      </div>
                      {canManage && (
                        <div className="flex gap-2">
                          <button
                            onClick={() => openEditRangeModal(range)}
                            className="rounded-lg border border-slate-700 p-2 text-slate-400 transition-colors hover:bg-slate-800 hover:text-white"
                            title="Edit public range"
                          >
                            <Edit3 size={15} />
                          </button>
                          <button
                            onClick={() => void handleDeleteRange(range)}
                            className="rounded-lg border border-red-500/20 p-2 text-red-300 transition-colors hover:bg-red-500/10 hover:text-red-200"
                            title="Delete public range"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))
              ) : (
                <div className="rounded-xl border border-dashed border-slate-800 px-4 py-8 text-center text-sm text-slate-500">
                  No managed public ranges yet. Add a public block to begin.
                </div>
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-[#111620] p-5">
            <div className="flex items-center gap-3">
              <div className="rounded-xl border border-slate-700 bg-slate-900/60 p-3 text-blue-300">
                <Network size={18} />
              </div>
              <div>
                <div className="text-sm font-bold text-white">Range Coverage</div>
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
                  Register a public range to start tracking coverage.
                </div>
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-[#111620] p-5">
            <div className="text-sm font-bold text-white">Target Rules</div>
            <div className="mt-3 space-y-2 text-sm text-slate-400">
              <p>`ASSIGNED`: requires Hardware, VM, or Other target details.</p>
              <p>`RESERVED`: requires the same destination metadata to explain the reservation.</p>
              <p>`BLOCKED`: can optionally carry target details, but does not require them.</p>
            </div>
          </div>
        </div>
      </div>

      <Modal
        isOpen={showAddModal}
        onClose={() => {
          setShowAddModal(false);
          resetCreateModal();
        }}
        title="Register Public IP Inventory"
      >
        <div className="space-y-5">
          {createModalError && (
            <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
              {createModalError}
            </div>
          )}

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
                placeholder={mode === "single" ? "203.0.113.15" : "203.0.113.0"}
                value={address}
                onChange={(e) => setAddress(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <div className="text-sm font-medium text-slate-300">{mode === "single" ? "Initial Status" : "Prefix / Initial Status"}</div>
              {mode === "cidr" ? (
                <div className="grid grid-cols-[120px,1fr] gap-3">
                  <Input placeholder="24" value={prefix} onChange={(e) => setPrefix(e.target.value)} />
                  <select
                    className="h-10 w-full rounded-lg border border-slate-800 bg-slate-900/50 px-3 text-sm text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50"
                    value={createForm.status}
                    onChange={(e) => setCreateForm((current) => ({ ...current, status: e.target.value as IPStatus }))}
                  >
                    <option value="AVAILABLE">AVAILABLE</option>
                    <option value="RESERVED">RESERVED</option>
                    <option value="BLOCKED">BLOCKED</option>
                  </select>
                </div>
              ) : (
                <select
                  className="h-10 w-full rounded-lg border border-slate-800 bg-slate-900/50 px-3 text-sm text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50"
                  value={createForm.status}
                  onChange={(e) => setCreateForm((current) => ({ ...current, status: e.target.value as IPStatus }))}
                >
                  {STATUS_OPTIONS.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
              )}
            </div>
          </div>

          {renderTargetFields(createForm, setCreateForm, mode === "cidr")}

          <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4 text-sm text-slate-400">
            {mode === "single" ? (
              <p>Single-host registration can start as available, reserved, assigned, or blocked with the required destination metadata.</p>
            ) : (
              <p>CIDR registration creates a managed public range. Bulk imports can start as available, reserved, or blocked.</p>
            )}
          </div>

          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setShowAddModal(false);
                resetCreateModal();
              }}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button onClick={() => void handleCreate()} disabled={submitting || !address.trim() || (mode === "cidr" && !prefix.trim())}>
              {submitting ? "Registering..." : "Register Inventory"}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={showRangeModal}
        onClose={() => {
          setShowRangeModal(false);
          resetRangeForm();
        }}
        title={rangeFormMode === "edit" ? `Edit ${activeRange?.cidr || "Public IP Range"}` : "Add Public IP Range"}
      >
        <div className="space-y-5">
          {rangeModalError && (
            <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
              {rangeModalError}
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <div className="text-sm font-medium text-slate-300">Network</div>
              <Input placeholder="203.0.113.0" value={rangeNetwork} onChange={(e) => setRangeNetwork(e.target.value)} />
            </div>
            <div className="space-y-2">
              <div className="text-sm font-medium text-slate-300">Prefix</div>
              <Input placeholder="24" value={rangePrefix} onChange={(e) => setRangePrefix(e.target.value)} />
            </div>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4 text-sm text-slate-400">
            <p>
              {rangeFormMode === "edit"
                ? "Editing a range rebuilds the block and is only allowed when every IP in that range is AVAILABLE."
                : "Register a valid public CIDR block to generate IP inventory for target-aware status management."}
            </p>
          </div>

          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setShowRangeModal(false);
                resetRangeForm();
              }}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button onClick={() => void handleSaveRange()} disabled={submitting || !rangeNetwork.trim() || !rangePrefix.trim()}>
              {submitting ? (rangeFormMode === "edit" ? "Saving..." : "Creating...") : rangeFormMode === "edit" ? "Save Changes" : "Create Range"}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={showManageModal} onClose={() => setShowManageModal(false)} title={`Update ${activeIp?.address || "Public IP"}`}>
        <div className="space-y-5">
          <div className="space-y-2">
            <div className="text-sm font-medium text-slate-300">Status</div>
            <select
              className="h-10 w-full rounded-lg border border-slate-800 bg-slate-900/50 px-3 text-sm text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50"
              value={manageForm.status}
              onChange={(e) => setManageForm((current) => ({ ...current, status: e.target.value as IPStatus }))}
            >
              {STATUS_OPTIONS.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </div>

          {renderTargetFields(manageForm, setManageForm, false)}

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setShowManageModal(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button onClick={() => void handleUpdateState()} disabled={submitting}>
              {submitting ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
