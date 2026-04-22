"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useSession } from "next-auth/react";
import { format } from "date-fns";
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  Loader2,
  Play,
  Plus,
  ShieldAlert,
  Wrench,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/Modal";
import { cn } from "@/lib/utils";

type MaintenanceType = "PREVENTIVE" | "INSPECTION" | "REPAIR" | "OTHER";
type MaintenanceStatus = "SCHEDULED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";
type MaintenancePriority = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

type AssetOption = {
  id: string;
  name: string;
  serialNumber: string;
  category: string;
  status: string;
};

type MaintenanceRecord = {
  id: string;
  title: string;
  type: MaintenanceType;
  status: MaintenanceStatus;
  priority: MaintenancePriority;
  description: string | null;
  scheduledAt: string;
  startedAt: string | null;
  completedAt: string | null;
  resolution: string | null;
  asset: AssetOption & {
    location?: { name: string; type: string } | null;
    rack?: { name: string } | null;
  };
};

type MaintenanceSummary = {
  total: number;
  open: number;
  due: number;
  completed: number;
  brokenAssets: number;
};

type FormState = {
  assetId: string;
  title: string;
  type: MaintenanceType;
  priority: MaintenancePriority;
  scheduledAt: string;
  description: string;
};

const emptyForm: FormState = {
  assetId: "",
  title: "",
  type: "PREVENTIVE",
  priority: "MEDIUM",
  scheduledAt: "",
  description: "",
};

const typeOptions: MaintenanceType[] = ["PREVENTIVE", "INSPECTION", "REPAIR", "OTHER"];
const priorityOptions: MaintenancePriority[] = ["LOW", "MEDIUM", "HIGH", "CRITICAL"];

const formatEnum = (value: string) => value.toLowerCase().replace(/_/g, " ");

const statusTone: Record<MaintenanceStatus, string> = {
  SCHEDULED: "border-blue-500/20 bg-blue-500/10 text-blue-200",
  IN_PROGRESS: "border-amber-500/20 bg-amber-500/10 text-amber-200",
  COMPLETED: "border-emerald-500/20 bg-emerald-500/10 text-emerald-200",
  CANCELLED: "border-slate-700 bg-slate-800/70 text-slate-300",
};

const priorityTone: Record<MaintenancePriority, string> = {
  LOW: "text-slate-300",
  MEDIUM: "text-blue-300",
  HIGH: "text-amber-300",
  CRITICAL: "text-red-300",
};

const toDateInputValue = (date = new Date()) => {
  const tzOffset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - tzOffset).toISOString().slice(0, 16);
};

export default function MaintenancePage() {
  const { data: session } = useSession();
  const [records, setRecords] = useState<MaintenanceRecord[]>([]);
  const [assets, setAssets] = useState<AssetOption[]>([]);
  const [brokenAssets, setBrokenAssets] = useState<AssetOption[]>([]);
  const [summary, setSummary] = useState<MaintenanceSummary>({
    total: 0,
    open: 0,
    due: 0,
    completed: 0,
    brokenAssets: 0,
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<"ALL" | MaintenanceStatus>("ALL");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [assetSearch, setAssetSearch] = useState("");
  const [assetDropdownOpen, setAssetDropdownOpen] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const canManage = session?.user?.role === "ADMIN" || session?.user?.role === "OPERATOR";

  const fetchMaintenance = async (background = false) => {
    try {
      setError(null);
      if (background) setRefreshing(true);
      else setLoading(true);

      const res = await fetch("/api/maintenance", { cache: "no-store" });
      const payload = await res.json().catch(() => ({} as any));
      if (!res.ok) throw new Error(payload?.error || "Failed to load maintenance data");

      setRecords(payload.records || []);
      setAssets(payload.assets || []);
      setBrokenAssets(payload.brokenAssets || []);
      setSummary(payload.summary || {
        total: 0,
        open: 0,
        due: 0,
        completed: 0,
        brokenAssets: 0,
      });
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : "Failed to load maintenance data");
    } finally {
      if (background) setRefreshing(false);
      else setLoading(false);
    }
  };

  useEffect(() => {
    void fetchMaintenance();
  }, []);

  const filteredRecords = useMemo(() => {
    if (statusFilter === "ALL") return records;
    return records.filter((record) => record.status === statusFilter);
  }, [records, statusFilter]);

  const filteredAssets = useMemo(() => {
    const query = assetSearch.trim().toLowerCase();
    if (!query) return assets;

    return assets.filter((asset) => {
      return [
        asset.name,
        asset.serialNumber,
        asset.category,
        asset.status,
      ]
        .join(" ")
        .toLowerCase()
        .includes(query);
    });
  }, [assetSearch, assets]);

  const selectedAsset = useMemo(() => {
    return assets.find((asset) => asset.id === form.assetId) || null;
  }, [assets, form.assetId]);

  const openCreateModal = (asset?: AssetOption) => {
    setForm({
      ...emptyForm,
      assetId: asset?.id || "",
      title: asset ? `Repair ${asset.name}` : "",
      type: asset?.status === "BROKEN" ? "REPAIR" : "PREVENTIVE",
      priority: asset?.status === "BROKEN" ? "HIGH" : "MEDIUM",
      scheduledAt: toDateInputValue(),
    });
    setAssetSearch(asset ? `${asset.name} ${asset.serialNumber}` : "");
    setAssetDropdownOpen(false);
    setFormError(null);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setForm(emptyForm);
    setAssetSearch("");
    setAssetDropdownOpen(false);
    setFormError(null);
  };

  const handleCreate = async (event: FormEvent) => {
    event.preventDefault();
    setFormError(null);

    if (!form.assetId || !form.title.trim() || !form.scheduledAt) {
      setFormError("Asset, title, and schedule are required.");
      return;
    }

    try {
      setSaving(true);
      const res = await fetch("/api/maintenance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          title: form.title.trim(),
          description: form.description.trim() || null,
          status: "SCHEDULED",
        }),
      });
      const payload = await res.json().catch(() => ({} as any));
      if (!res.ok) throw new Error(payload?.error || "Failed to create maintenance record");

      closeModal();
      await fetchMaintenance(true);
    } catch (createError) {
      setFormError(createError instanceof Error ? createError.message : "Failed to create maintenance record");
    } finally {
      setSaving(false);
    }
  };

  const updateStatus = async (record: MaintenanceRecord, status: MaintenanceStatus) => {
    try {
      setUpdatingId(record.id);
      const res = await fetch(`/api/maintenance/${record.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status,
          resolution: status === "COMPLETED" ? "Work completed and asset returned to service." : undefined,
        }),
      });
      const payload = await res.json().catch(() => ({} as any));
      if (!res.ok) throw new Error(payload?.error || "Failed to update maintenance record");
      await fetchMaintenance(true);
    } catch (updateError) {
      window.alert(updateError instanceof Error ? updateError.message : "Failed to update maintenance record");
    } finally {
      setUpdatingId(null);
    }
  };

  const stats = [
    { label: "Open Work", value: summary.open, icon: Wrench, tone: "text-blue-400 bg-blue-500/10" },
    { label: "Due / Overdue", value: summary.due, icon: Clock3, tone: "text-amber-400 bg-amber-500/10" },
    { label: "Broken Assets", value: summary.brokenAssets, icon: ShieldAlert, tone: "text-red-400 bg-red-500/10" },
    { label: "Completed", value: summary.completed, icon: CheckCircle2, tone: "text-emerald-400 bg-emerald-500/10" },
  ];

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-slate-800 bg-[radial-gradient(circle_at_top_left,_rgba(245,158,11,0.13),_transparent_28%),linear-gradient(180deg,_rgba(15,23,42,0.94),_rgba(8,11,18,0.96))] p-8 shadow-2xl">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-3xl space-y-3">
            <div className="inline-flex items-center gap-2 rounded-full border border-amber-500/20 bg-amber-500/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.2em] text-amber-300">
              <Wrench size={14} />
              Milestone 6
            </div>
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-white">Maintenance Operations</h1>
              <p className="mt-2 text-sm leading-6 text-slate-300">
                Schedule preventive work, track repair history, and move broken assets through an actionable repair workflow.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="outline" onClick={() => void fetchMaintenance(true)} disabled={refreshing || loading}>
              {refreshing ? <Loader2 size={16} className="mr-2 animate-spin" /> : null}
              Refresh
            </Button>
            {canManage && (
              <Button onClick={() => openCreateModal()}>
                <Plus size={16} className="mr-2" />
                Schedule Work
              </Button>
            )}
          </div>
        </div>
      </section>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <div key={stat.label} className="rounded-2xl border border-slate-800 bg-[#151921] p-5 shadow-xl">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-500">{stat.label}</p>
                  <p className="mt-3 text-3xl font-bold text-white">{stat.value}</p>
                </div>
                <div className={cn("rounded-2xl p-3", stat.tone)}>
                  <Icon size={18} />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {error ? (
        <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {error}
        </div>
      ) : null}

      <section className="grid gap-6 xl:grid-cols-[0.9fr_1.4fr]">
        <div className="rounded-3xl border border-slate-800 bg-[#111620] p-6 shadow-xl">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-white">Broken Repair Queue</h2>
              <p className="text-sm text-slate-500">Assets marked broken and ready for repair scheduling.</p>
            </div>
            <AlertTriangle className="text-red-300" size={20} />
          </div>
          <div className="space-y-3">
            {brokenAssets.length === 0 ? (
              <p className="rounded-2xl border border-slate-800 bg-slate-900/40 p-4 text-sm text-slate-500">
                No broken assets are waiting for repair.
              </p>
            ) : (
              brokenAssets.map((asset) => (
                <div key={asset.id} className="rounded-2xl border border-red-500/15 bg-red-500/5 p-4">
                  <div className="font-semibold text-white">{asset.name}</div>
                  <div className="mt-1 text-xs text-slate-500">
                    {asset.serialNumber} · {asset.category}
                  </div>
                  {canManage && (
                    <Button className="mt-4 w-full" size="sm" onClick={() => openCreateModal(asset)}>
                      <Wrench size={15} className="mr-2" />
                      Open Repair Job
                    </Button>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        <div className="rounded-3xl border border-slate-800 bg-[#111620] shadow-xl">
          <div className="flex flex-col gap-4 border-b border-slate-800 p-6 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-lg font-bold text-white">Maintenance Schedule & History</h2>
              <p className="text-sm text-slate-500">Current work and completed repair history.</p>
            </div>
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as "ALL" | MaintenanceStatus)}
              className="flex h-10 rounded-lg border border-slate-800 bg-slate-900/50 px-3 py-2 text-sm text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50 focus-visible:border-blue-500 transition-all"
            >
              <option value="ALL">All statuses</option>
              <option value="SCHEDULED">Scheduled</option>
              <option value="IN_PROGRESS">In progress</option>
              <option value="COMPLETED">Completed</option>
              <option value="CANCELLED">Cancelled</option>
            </select>
          </div>

          <div className="divide-y divide-slate-800">
            {loading ? (
              <div className="p-10 text-center text-sm text-slate-500">Loading maintenance records...</div>
            ) : filteredRecords.length === 0 ? (
              <div className="p-10 text-center text-sm text-slate-500">No maintenance records found.</div>
            ) : (
              filteredRecords.map((record) => (
                <article key={record.id} className="p-6">
                  <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                    <div className="space-y-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-lg font-bold text-white">{record.title}</h3>
                        <span className={cn("rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.18em]", statusTone[record.status])}>
                          {formatEnum(record.status)}
                        </span>
                        <span className={cn("text-xs font-bold uppercase tracking-[0.18em]", priorityTone[record.priority])}>
                          {formatEnum(record.priority)}
                        </span>
                      </div>
                      <p className="text-sm text-slate-400">
                        {record.description || "No maintenance notes provided."}
                      </p>
                      <div className="flex flex-wrap gap-2 text-xs text-slate-500">
                        <span>{record.asset.name} · {record.asset.serialNumber}</span>
                        <span>{formatEnum(record.type)}</span>
                        <span>Scheduled {format(new Date(record.scheduledAt), "MMM dd, yyyy HH:mm")}</span>
                      </div>
                    </div>

                    {canManage && record.status !== "COMPLETED" && record.status !== "CANCELLED" ? (
                      <div className="flex flex-wrap gap-2">
                        {record.status === "SCHEDULED" && (
                          <Button size="sm" variant="outline" onClick={() => void updateStatus(record, "IN_PROGRESS")} disabled={updatingId === record.id}>
                            <Play size={15} className="mr-2" />
                            Start
                          </Button>
                        )}
                        <Button size="sm" onClick={() => void updateStatus(record, "COMPLETED")} disabled={updatingId === record.id}>
                          <CheckCircle2 size={15} className="mr-2" />
                          Complete
                        </Button>
                        <Button size="sm" variant="danger" onClick={() => void updateStatus(record, "CANCELLED")} disabled={updatingId === record.id}>
                          <XCircle size={15} className="mr-2" />
                          Cancel
                        </Button>
                      </div>
                    ) : null}
                  </div>
                </article>
              ))
            )}
          </div>
        </div>
      </section>

      <Modal isOpen={isModalOpen} onClose={closeModal} title="Schedule Maintenance">
        <form onSubmit={handleCreate} className="space-y-5">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2 md:col-span-2">
              <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Asset</label>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => {
                    setAssetSearch("");
                    setAssetDropdownOpen((current) => !current);
                  }}
                  className="flex min-h-10 w-full items-center justify-between rounded-lg border border-slate-800 bg-slate-900/50 px-3 py-2 text-left text-sm text-white outline-none transition-all hover:border-slate-700 focus:border-blue-500"
                >
                  <span>
                    {selectedAsset
                      ? `${selectedAsset.name} (${selectedAsset.serialNumber})`
                      : "Select asset"}
                  </span>
                  <span className="text-slate-500">⌄</span>
                </button>

                {assetDropdownOpen ? (
                  <div className="absolute left-0 right-0 z-50 mt-2 rounded-xl border border-slate-800 bg-[#0f1218] p-2 shadow-2xl">
                    <Input
                      autoFocus
                      value={assetSearch}
                      onChange={(event) => setAssetSearch(event.target.value)}
                      placeholder="Search name, serial, category, or status"
                      className="mb-2"
                    />
                    <div className="max-h-52 overflow-y-auto rounded-lg border border-slate-800 bg-slate-950/40">
                      {filteredAssets.length > 0 ? (
                        filteredAssets.map((asset) => {
                          const isSelected = form.assetId === asset.id;
                          return (
                            <button
                              key={asset.id}
                              type="button"
                              onClick={() => {
                                setForm((current) => ({ ...current, assetId: asset.id }));
                                setAssetSearch("");
                                setAssetDropdownOpen(false);
                              }}
                              className={cn(
                                "flex w-full items-start justify-between gap-3 border-b border-slate-800 px-3 py-3 text-left text-sm transition-colors last:border-b-0",
                                isSelected
                                  ? "bg-blue-500/10 text-white"
                                  : "text-slate-300 hover:bg-slate-900"
                              )}
                            >
                              <span>
                                <span className="block font-medium">{asset.name}</span>
                                <span className="mt-1 block text-xs text-slate-500">
                                  {asset.serialNumber} · {asset.category} · {formatEnum(asset.status)}
                                </span>
                              </span>
                              {isSelected ? (
                                <span className="rounded-full bg-blue-500/20 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-blue-200">
                                  Selected
                                </span>
                              ) : null}
                            </button>
                          );
                        })
                      ) : (
                        <div className="px-3 py-4 text-sm text-slate-500">
                          No assets match this search.
                        </div>
                      )}
                    </div>
                  </div>
                ) : null}
              </div>
              <p className="text-xs text-slate-500">
                Search is available after opening the asset dropdown.
              </p>
            </div>

            <div className="space-y-2 md:col-span-2">
              <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Title</label>
              <Input
                value={form.title}
                onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
                placeholder="Quarterly inspection or repair task"
              />
            </div>

            <div className="space-y-2">
              <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Type</label>
              <select
                value={form.type}
                onChange={(event) => setForm((current) => ({ ...current, type: event.target.value as MaintenanceType }))}
                className="flex h-10 w-full rounded-lg border border-slate-800 bg-slate-900/50 px-3 py-2 text-sm text-white outline-none transition-all focus:border-blue-500"
              >
                {typeOptions.map((option) => (
                  <option key={option} value={option}>{formatEnum(option)}</option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Priority</label>
              <select
                value={form.priority}
                onChange={(event) => setForm((current) => ({ ...current, priority: event.target.value as MaintenancePriority }))}
                className="flex h-10 w-full rounded-lg border border-slate-800 bg-slate-900/50 px-3 py-2 text-sm text-white outline-none transition-all focus:border-blue-500"
              >
                {priorityOptions.map((option) => (
                  <option key={option} value={option}>{formatEnum(option)}</option>
                ))}
              </select>
            </div>

            <div className="space-y-2 md:col-span-2">
              <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Scheduled At</label>
              <Input
                type="datetime-local"
                value={form.scheduledAt}
                onChange={(event) => setForm((current) => ({ ...current, scheduledAt: event.target.value }))}
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Description</label>
              <textarea
                value={form.description}
                onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
                rows={4}
                className="flex w-full rounded-lg border border-slate-800 bg-slate-900/50 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50 focus-visible:border-blue-500 transition-all"
                placeholder="Scope, symptoms, spare parts, or operational notes"
              />
            </div>
          </div>

          {formError ? (
            <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
              {formError}
            </div>
          ) : null}

          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={closeModal} disabled={saving}>Cancel</Button>
            <Button type="submit" disabled={saving}>
              {saving ? <Loader2 size={16} className="mr-2 animate-spin" /> : null}
              Create Work Order
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
