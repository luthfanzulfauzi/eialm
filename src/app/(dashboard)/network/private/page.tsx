"use client";

import { useEffect, useMemo, useState, type Dispatch, type SetStateAction } from "react";
import { Download, Edit3, Loader2, Network, Plus, RefreshCw, Search, Server, Shield, Trash2, Unlink, Upload } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { useRole } from "@/hooks/useRole";
import { cn } from "@/lib/utils";

type IPStatus = "AVAILABLE" | "RESERVED" | "ASSIGNED" | "BLOCKED";
type TargetType = "HARDWARE" | "VM" | "OTHER";

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
  privateRangeId?: string | null;
  assignmentTargetType: TargetType | null;
  assignmentTargetLabel: string | null;
  asset: AssetOption | null;
};

type PrivateSubnetSummary = {
  cidr: string;
  counts: Record<IPStatus, number>;
  assignedAssets: number;
};

type PrivateRange = {
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
  ranges: PrivateRange[];
  privateRanges: string[];
  assignableAssets: AssetOption[];
};

type StatusFormState = {
  status: IPStatus;
  targetType: TargetType | "";
  assetId: string;
  targetLabel: string;
};

type ImportResult = {
  created: number;
  updated: number;
  failed: number;
  errors?: Array<{ row: number; error: string }>;
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

const STATUS_OPTIONS: IPStatus[] = ["AVAILABLE", "RESERVED", "ASSIGNED", "BLOCKED"];

function getTargetSummary(ip: PrivateIp) {
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

function getInitialFormState(ip?: PrivateIp | null): StatusFormState {
  return {
    status: ip?.status ?? "AVAILABLE",
    targetType: ip?.assignmentTargetType ?? "",
    assetId: ip?.asset?.id ?? "",
    targetLabel: ip?.assignmentTargetType === "HARDWARE" ? "" : ip?.assignmentTargetLabel ?? "",
  };
}

export default function PrivateIPPage() {
  const [rangeFormMode, setRangeFormMode] = useState<"create" | "edit">("create");
  const [ips, setIps] = useState<PrivateIp[]>([]);
  const [summary, setSummary] = useState(DEFAULT_SUMMARY);
  const [subnets, setSubnets] = useState<PrivateSubnetSummary[]>([]);
  const [ranges, setRanges] = useState<PrivateRange[]>([]);
  const [privateRanges, setPrivateRanges] = useState<string[]>([]);
  const [assets, setAssets] = useState<AssetOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showManageModal, setShowManageModal] = useState(false);
  const [showRangeModal, setShowRangeModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeRange, setActiveRange] = useState<PrivateRange | null>(null);
  const [rangeNetwork, setRangeNetwork] = useState("");
  const [rangePrefix, setRangePrefix] = useState("24");
  const [activeIp, setActiveIp] = useState<PrivateIp | null>(null);
  const [selectedRangeId, setSelectedRangeId] = useState<string | null>(null);
  const [manageForm, setManageForm] = useState<StatusFormState>(getInitialFormState());
  const [submitting, setSubmitting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [banner, setBanner] = useState<{ type: "error" | "success"; message: string } | null>(null);
  const [rangeModalError, setRangeModalError] = useState<string | null>(null);
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
      setRanges(Array.isArray(data.ranges) ? data.ranges : []);
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
    const initialSearch = new URLSearchParams(window.location.search).get("q");
    if (initialSearch) setSearchQuery(initialSearch);
    void fetchInventory();
  }, []);

  const filteredIps = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return ips.filter((ip) => {
      if (selectedRangeId && ip.privateRangeId !== selectedRangeId) return false;
      if (!query) return true;
      return [
        ip.address,
        ip.status,
        ip.assignmentTargetType,
        ip.assignmentTargetLabel,
        ip.asset?.name,
        ip.asset?.serialNumber,
        ip.asset?.category,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query));
    });
  }, [ips, searchQuery, selectedRangeId]);

  const selectedRange = useMemo(
    () => ranges.find((range) => range.id === selectedRangeId) || null,
    [ranges, selectedRangeId]
  );

  useEffect(() => {
    if (selectedRangeId && !ranges.some((range) => range.id === selectedRangeId)) {
      setSelectedRangeId(null);
    }
  }, [ranges, selectedRangeId]);

  const resetRangeForm = () => {
    setRangeFormMode("create");
    setActiveRange(null);
    setRangeNetwork("");
    setRangePrefix("24");
    setRangeModalError(null);
  };

  const openManageModal = (ip: PrivateIp) => {
    setActiveIp(ip);
    setManageForm(getInitialFormState(ip));
    setShowManageModal(true);
  };

  const openCreateRangeModal = () => {
    resetRangeForm();
    setRangeFormMode("create");
    setShowRangeModal(true);
  };

  const openImportModal = () => {
    setImportFile(null);
    setImportResult(null);
    setShowImportModal(true);
  };

  const openEditRangeModal = (range: PrivateRange) => {
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

  const validateForm = (form: StatusFormState) => {
    if (!allowsTarget(form.status)) return null;
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

  const handleUpdateState = async () => {
    if (!canManage || !activeIp) return;

    const validation = validateForm(manageForm);
    if (validation) {
      setBanner({ type: "error", message: validation });
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/network", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "updateStatus",
          ipId: activeIp.id,
          ...buildPayload(manageForm),
        }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        setBanner({ type: "error", message: payload.error || "Failed to update IP state." });
        return;
      }

      setBanner({ type: "success", message: `Private IP ${activeIp.address} updated.` });
      setShowManageModal(false);
      setActiveIp(null);
      await fetchInventory(true);
      router.refresh();
    } catch (error) {
      console.error("Status update failed", error);
      setBanner({ type: "error", message: "Failed to update IP state." });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDetach = async (ipId: string) => {
    if (!canManage) return;
    if (!confirm("Release this private IP assignment?")) return;

    try {
      const res = await fetch("/api/network", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "assign", ipId, assetId: null }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        setBanner({ type: "error", message: payload.error || "Failed to release private IP." });
        return;
      }

      setBanner({ type: "success", message: "Private IP released." });
      await fetchInventory(true);
      router.refresh();
    } catch (error) {
      console.error("Detachment failed", error);
      setBanner({ type: "error", message: "Failed to release private IP." });
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

  const handleSaveRange = async () => {
    if (!canManage) return;
    setSubmitting(true);
    setRangeModalError(null);
    try {
      const isEditing = rangeFormMode === "edit" && activeRange;
      const endpoint = isEditing ? `/api/private-ip/ranges/${activeRange.id}` : "/api/private-ip/ranges";
      const res = await fetch(endpoint, {
        method: isEditing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ network: rangeNetwork.trim(), prefix: Number(rangePrefix) }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        setRangeModalError(payload.error || `Failed to ${isEditing ? "update" : "create"} private range.`);
        return;
      }

      setBanner({
        type: "success",
        message: isEditing
          ? `Updated private range ${payload.cidr || `${rangeNetwork.trim()}/${rangePrefix}`}.`
          : `Registered private range ${payload.cidr || `${rangeNetwork.trim()}/${rangePrefix}`}.`,
      });
      setShowRangeModal(false);
      resetRangeForm();
      await fetchInventory(true);
      router.refresh();
    } catch (error) {
      console.error("Range save failed", error);
      setRangeModalError(`Failed to ${rangeFormMode === "edit" ? "update" : "create"} private range.`);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteRange = async (range: PrivateRange) => {
    if (!canManage) return;
    if (!confirm(`Delete private range ${range.cidr}? This only works when every IP in the range is AVAILABLE.`)) {
      return;
    }

    setBanner(null);
    try {
      const res = await fetch(`/api/private-ip/ranges/${range.id}`, {
        method: "DELETE",
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        setBanner({ type: "error", message: payload.error || "Failed to delete private range." });
        return;
      }

      setBanner({ type: "success", message: `Deleted private range ${range.cidr}.` });
      await fetchInventory(true);
      router.refresh();
    } catch (error) {
      console.error("Range delete failed", error);
      setBanner({ type: "error", message: "Failed to delete private range." });
    }
  };

  const handleExport = async () => {
    try {
      const res = await fetch("/api/network/transfer?type=private", { cache: "no-store" });
      if (!res.ok) {
        const message = await res.text();
        setBanner({ type: "error", message: message || "Failed to export private IP inventory." });
        return;
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      const disposition = res.headers.get("Content-Disposition");
      const filenameMatch = disposition?.match(/filename="(.+)"/);
      link.href = url;
      link.download = filenameMatch?.[1] || "private-ip-inventory.csv";
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Private IP export failed", error);
      setBanner({ type: "error", message: "Failed to export private IP inventory." });
    }
  };

  const handleImport = async () => {
    if (!canManage || !importFile) return;

    setImporting(true);
    setImportResult(null);
    try {
      const formData = new FormData();
      formData.append("file", importFile);

      const res = await fetch("/api/network/transfer?type=private", {
        method: "POST",
        body: formData,
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        setBanner({ type: "error", message: payload.error || "Failed to import private IP inventory." });
        return;
      }

      setImportResult(payload as ImportResult);
      setBanner({
        type: payload.failed > 0 ? "error" : "success",
        message:
          payload.failed > 0
            ? `Imported private IP CSV with ${payload.failed} failed row(s).`
            : `Imported private IP CSV. ${payload.created} created, ${payload.updated} updated.`,
      });
      await fetchInventory(true);
      router.refresh();
    } catch (error) {
      console.error("Private IP import failed", error);
      setBanner({ type: "error", message: "Failed to import private IP inventory." });
    } finally {
      setImporting(false);
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
            className="h-10 w-full rounded-lg border border-slate-800 bg-slate-900/50 px-3 text-sm text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50"
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
              className="h-10 w-full rounded-lg border border-slate-800 bg-slate-900/50 px-3 text-sm text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50"
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
              placeholder={form.targetType === "VM" ? "vm-app-01 / production cluster" : "Reason or destination"}
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
      <section className="rounded-3xl border border-slate-800 bg-[radial-gradient(circle_at_top_left,_rgba(245,158,11,0.13),_transparent_28%),linear-gradient(180deg,_rgba(15,23,42,0.94),_rgba(8,11,18,0.96))] p-8 shadow-2xl">
        <div className="space-y-5">
          <div className="max-w-3xl space-y-3">
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-white">Private IP Management</h1>
              <p className="mt-2 text-sm leading-6 text-slate-300">
                Manage RFC1918 address inventory, subnet coverage, and assignments for hardware, VMs, or other consumers.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
              <input
                type="text"
                placeholder="Search IP, status, VM, hardware..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-64 rounded-lg border border-slate-800 bg-slate-900 pl-10 pr-4 py-2 text-sm text-white outline-none transition-all focus:border-emerald-500"
              />
            </div>

            <Button variant="outline" onClick={() => void handleExport()} disabled={loading} className="shrink-0">
              <Download size={16} className="mr-2" /> Export
            </Button>

            <Button variant="outline" onClick={() => canManage && openImportModal()} disabled={!canManage} className="shrink-0">
              <Upload size={16} className="mr-2" /> Import
            </Button>

            <Button variant="outline" onClick={() => fetchInventory(true)} disabled={loading || refreshing} className="shrink-0">
              <RefreshCw size={16} className={cn("mr-2", refreshing && "animate-spin")} /> Refresh
            </Button>

            <Button
              onClick={() => canManage && openCreateRangeModal()}
              disabled={!canManage}
              className="shrink-0 bg-emerald-600 shadow-emerald-500/20 hover:bg-emerald-700"
            >
              <Plus size={18} className="mr-2" /> Add Private IP Range
            </Button>
          </div>
        </div>
      </section>

      {banner && (
        <div
          className={cn(
            "rounded-2xl border px-4 py-3 text-sm",
            banner.type === "success" ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-200" : "border-red-500/20 bg-red-500/10 text-red-200"
          )}
        >
          {banner.message}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border border-slate-800 bg-[#111620] p-5">
          <div className="text-xs font-bold uppercase tracking-[0.25em] text-slate-500">Inventory</div>
          <div className="mt-3 text-3xl font-bold text-white">{summary.total}</div>
          <div className="mt-2 text-sm text-slate-400">{summary.unassigned} available</div>
        </div>
        <div className="rounded-2xl border border-slate-800 bg-[#111620] p-5">
          <div className="text-xs font-bold uppercase tracking-[0.25em] text-slate-500">Assigned</div>
          <div className="mt-3 text-3xl font-bold text-white">{summary.assigned}</div>
          <div className="mt-2 text-sm text-slate-400">{summary.reserved} reserved, {summary.blocked} blocked</div>
        </div>
        <div className="rounded-2xl border border-slate-800 bg-[#111620] p-5">
          <div className="text-xs font-bold uppercase tracking-[0.25em] text-slate-500">Subnet Buckets</div>
          <div className="mt-3 text-3xl font-bold text-white">{summary.subnetCount}</div>
          <div className="mt-2 text-sm text-slate-400">{privateRanges.length > 0 ? privateRanges.join(" • ") : "No private space registered yet"}</div>
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
              <div className="text-sm font-bold text-white">Private Address Inventory</div>
              <div className="text-xs text-slate-500">
                {filteredIps.length} visible addresses
                {selectedRange ? ` • Filtered by ${selectedRange.cidr}` : ""}
              </div>
            </div>
            <div className="text-xs text-slate-500">
              {selectedRange ? "Showing the selected managed range only." : "Assigned and reserved IPs require a destination target."}
            </div>
          </div>

          <div className="divide-y divide-slate-800">
            {loading ? (
              <div className="flex min-h-80 flex-col items-center justify-center gap-3 text-slate-500">
                <Loader2 className="animate-spin text-emerald-500" size={26} />
                <p className="text-sm">Scanning private IP inventory...</p>
              </div>
            ) : filteredIps.length > 0 ? (
              filteredIps.map((ip) => {
                const target = getTargetSummary(ip);
                return (
                  <div key={ip.id} className="grid gap-4 px-4 py-4 transition-colors hover:bg-slate-800/20 lg:grid-cols-[180px,140px,1fr,180px,100px]">
                    <div>
                      <div className="text-lg font-bold text-emerald-400">{ip.address}</div>
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
                        <button onClick={() => void handleDetach(ip.id)} className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-red-500/10 hover:text-red-400" title="Release IP">
                          <Unlink size={16} />
                        </button>
                      )}
                      {canManage && ip.status !== "ASSIGNED" && (
                        <button onClick={() => void handleDelete(ip.id)} className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-red-500/10 hover:text-red-400" title="Delete private IP">
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="py-20 text-center text-slate-500">
                <p className="font-medium">No private IP addresses found.</p>
              </div>
            )}
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-2xl border border-slate-800 bg-[#111620] p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-bold text-white">Managed Private Ranges</div>
                <div className="text-xs text-slate-500">Create in CIDR mode, then edit or delete ranges here.</div>
              </div>
              <div className="text-xs text-slate-500">{ranges.length} ranges</div>
            </div>

            <div className="mt-4 space-y-3">
              <button
                type="button"
                onClick={() => setSelectedRangeId(null)}
                className={cn(
                  "w-full rounded-xl border px-3 py-3 text-left transition-colors",
                  selectedRangeId === null
                    ? "border-emerald-500 bg-emerald-500/10"
                    : "border-slate-800 bg-slate-900/30 hover:bg-slate-900/50"
                )}
              >
                <div className="text-sm font-bold text-white">All inventory</div>
                <div className="mt-1 text-xs text-slate-500">Show every private IP, including unmanaged single addresses.</div>
              </button>
              {ranges.length > 0 ? (
                ranges.map((range) => (
                  <button
                    key={range.id}
                    type="button"
                    onClick={() => setSelectedRangeId((current) => (current === range.id ? null : range.id))}
                    className={cn(
                      "w-full rounded-xl border bg-slate-900/40 p-3 text-left transition-colors",
                      selectedRangeId === range.id
                        ? "border-emerald-500 bg-emerald-500/10"
                        : "border-slate-800 hover:bg-slate-900/60"
                    )}
                  >
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
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              openEditRangeModal(range);
                            }}
                            className="rounded-lg border border-slate-700 p-2 text-slate-400 transition-colors hover:bg-slate-800 hover:text-white"
                            title="Edit private range"
                          >
                            <Edit3 size={15} />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              void handleDeleteRange(range);
                            }}
                            className="rounded-lg border border-red-500/20 p-2 text-red-300 transition-colors hover:bg-red-500/10 hover:text-red-200"
                            title="Delete private range"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      )}
                    </div>
                  </button>
                ))
              ) : (
                <div className="rounded-xl border border-dashed border-slate-800 px-4 py-8 text-center text-sm text-slate-500">
                  No managed private ranges yet. Use CIDR subnet mode to create one.
                </div>
              )}
            </div>
          </div>

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
        isOpen={showImportModal}
        onClose={() => {
          setShowImportModal(false);
          setImportFile(null);
          setImportResult(null);
        }}
        title="Import Private IP Inventory"
      >
        <div className="space-y-5">
          <div className="flex items-center justify-between">
            <a
              href="/samples/network-ip-import-sample.csv"
              download
              className="text-sm text-blue-400 hover:text-blue-300"
            >
              Download sample CSV
            </a>
          </div>

          <div className="space-y-2">
            <div className="text-sm font-medium text-slate-300">CSV File</div>
            <Input
              type="file"
              accept=".csv,text/csv"
              onChange={(e) => setImportFile(e.target.files?.[0] ?? null)}
            />
          </div>

          {importResult && (
            <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4 text-sm text-slate-300">
              <p>{importResult.created} created</p>
              <p>{importResult.updated} updated</p>
              <p>{importResult.failed} failed</p>
              {importResult.errors && importResult.errors.length > 0 && (
                <div className="mt-3 max-h-40 space-y-1 overflow-y-auto text-xs text-red-200">
                  {importResult.errors.slice(0, 10).map((entry) => (
                    <p key={`${entry.row}-${entry.error}`}>Row {entry.row}: {entry.error}</p>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setShowImportModal(false);
                setImportFile(null);
                setImportResult(null);
              }}
              disabled={importing}
            >
              Close
            </Button>
            <Button
              onClick={() => void handleImport()}
              disabled={importing || !importFile}
              className="bg-emerald-600 shadow-emerald-500/20 hover:bg-emerald-700"
            >
              {importing ? "Importing..." : "Import CSV"}
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
        title={rangeFormMode === "edit" ? `Edit ${activeRange?.cidr || "Private IP Range"}` : "Add Private IP Range"}
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
              <Input placeholder="10.10.20.0" value={rangeNetwork} onChange={(e) => setRangeNetwork(e.target.value)} />
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
                : "Register a valid private CIDR block to generate IP inventory for target-aware status management."}
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
            <Button
              onClick={() => void handleSaveRange()}
              disabled={submitting || !rangeNetwork.trim() || !rangePrefix.trim()}
              className="bg-emerald-600 shadow-emerald-500/20 hover:bg-emerald-700"
            >
              {submitting ? (rangeFormMode === "edit" ? "Saving..." : "Creating...") : rangeFormMode === "edit" ? "Save Changes" : "Create Range"}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={showManageModal} onClose={() => setShowManageModal(false)} title={`Update ${activeIp?.address || "Private IP"}`}>
        <div className="space-y-5">
          <div className="space-y-2">
            <div className="text-sm font-medium text-slate-300">Status</div>
            <select
              className="h-10 w-full rounded-lg border border-slate-800 bg-slate-900/50 px-3 text-sm text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50"
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
            <Button onClick={() => void handleUpdateState()} disabled={submitting} className="bg-emerald-600 shadow-emerald-500/20 hover:bg-emerald-700">
              {submitting ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
