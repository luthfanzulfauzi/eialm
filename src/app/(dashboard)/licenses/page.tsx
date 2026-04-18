"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useSession } from "next-auth/react";
import { format, formatDistanceToNowStrict } from "date-fns";
import {
  AlertCircle,
  CheckCircle2,
  Clock3,
  KeyRound,
  Loader2,
  Pencil,
  Plus,
  Trash2,
  Unplug,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/Modal";
import { cn } from "@/lib/utils";

type AssetOption = {
  id: string;
  name: string;
  serialNumber: string;
  status: string;
};

type LicenseRecord = {
  id: string;
  name: string;
  key: string | null;
  licenseFile: string | null;
  expiryDate: string | null;
  isExpired: boolean;
  assetId: string | null;
  asset?: AssetOption | null;
  createdAt: string;
  updatedAt: string;
};

type LicenseSummary = {
  total: number;
  active: number;
  expiringSoon: number;
  expired: number;
  unassigned: number;
};

type LicenseFormState = {
  name: string;
  key: string;
  licenseFile: string;
  expiryDate: string;
  assetId: string;
};

const emptyForm: LicenseFormState = {
  name: "",
  key: "",
  licenseFile: "",
  expiryDate: "",
  assetId: "",
};

const expiringSoonMs = 30 * 24 * 60 * 60 * 1000;

const maskLicenseKey = (value: string) => {
  if (value.length <= 8) return value;
  return `${value.slice(0, 4)}-${"*".repeat(Math.max(value.length - 8, 4))}-${value.slice(-4)}`;
};

const getLicenseState = (license: LicenseRecord) => {
  if (license.isExpired) return "expired" as const;
  if (!license.expiryDate) return "active" as const;
  const expiryDate = new Date(license.expiryDate);
  if (expiryDate.getTime() <= Date.now() + expiringSoonMs) {
    return "expiring" as const;
  }
  return "active" as const;
};

export default function LicensePage() {
  const { data: session } = useSession();
  const [licenses, setLicenses] = useState<LicenseRecord[]>([]);
  const [assets, setAssets] = useState<AssetOption[]>([]);
  const [summary, setSummary] = useState<LicenseSummary>({
    total: 0,
    active: 0,
    expiringSoon: 0,
    expired: 0,
    unassigned: 0,
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "active" | "expiring" | "expired" | "unassigned">("all");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingLicense, setEditingLicense] = useState<LicenseRecord | null>(null);
  const [form, setForm] = useState<LicenseFormState>(emptyForm);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [assigningId, setAssigningId] = useState<string | null>(null);

  const canManage = session?.user?.role === "ADMIN" || session?.user?.role === "OPERATOR";

  const fetchLicenses = async (background = false) => {
    try {
      setError(null);
      if (background) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      const res = await fetch("/api/licenses", { cache: "no-store" });
      const payload = await res.json().catch(() => ({} as any));
      if (!res.ok) {
        throw new Error(payload?.error || "Failed to load license manager");
      }

      setLicenses(payload.licenses || []);
      setAssets(payload.assets || []);
      setSummary(
        payload.summary || {
          total: 0,
          active: 0,
          expiringSoon: 0,
          expired: 0,
          unassigned: 0,
        }
      );
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : "Failed to load license manager");
    } finally {
      if (background) {
        setRefreshing(false);
      } else {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    void fetchLicenses();
  }, []);

  const filteredLicenses = useMemo(() => {
    return licenses.filter((license) => {
      const state = getLicenseState(license);
      if (filter === "active") return state === "active";
      if (filter === "expiring") return state === "expiring";
      if (filter === "expired") return state === "expired";
      if (filter === "unassigned") return !license.assetId;
      return true;
    });
  }, [filter, licenses]);

  const openCreateModal = () => {
    setEditingLicense(null);
    setForm(emptyForm);
    setFormError(null);
    setIsModalOpen(true);
  };

  const openEditModal = (license: LicenseRecord) => {
    setEditingLicense(license);
    setForm({
      name: license.name,
      key: license.key || "",
      licenseFile: license.licenseFile || "",
      expiryDate: license.expiryDate ? format(new Date(license.expiryDate), "yyyy-MM-dd") : "",
      assetId: license.assetId || "",
    });
    setFormError(null);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingLicense(null);
    setForm(emptyForm);
    setFormError(null);
  };

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!form.name.trim()) {
      setFormError("License name is required.");
      return;
    }

    try {
      setSaving(true);
      const endpoint = editingLicense ? `/api/licenses/${editingLicense.id}` : "/api/licenses";
      const method = editingLicense ? "PATCH" : "POST";
      const res = await fetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          key: form.key.trim() || null,
          licenseFile: form.licenseFile.trim() || null,
          expiryDate: form.expiryDate || null,
          assetId: form.assetId || null,
        }),
      });

      const payload = await res.json().catch(() => ({} as any));
      if (!res.ok) {
        throw new Error(payload?.error || "Failed to save license");
      }

      closeModal();
      await fetchLicenses(true);
    } catch (saveError) {
      setFormError(saveError instanceof Error ? saveError.message : "Failed to save license");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (license: LicenseRecord) => {
    const confirmed = window.confirm(`Delete license "${license.name}"?`);
    if (!confirmed) return;

    try {
      setDeletingId(license.id);
      const res = await fetch(`/api/licenses/${license.id}`, { method: "DELETE" });
      if (!res.ok) {
        const payload = await res.json().catch(() => ({} as any));
        throw new Error(payload?.error || "Failed to delete license");
      }
      await fetchLicenses(true);
    } catch (deleteError) {
      window.alert(deleteError instanceof Error ? deleteError.message : "Failed to delete license");
    } finally {
      setDeletingId(null);
    }
  };

  const handleQuickUnassign = async (license: LicenseRecord) => {
    try {
      setAssigningId(license.id);
      const res = await fetch(`/api/licenses/${license.id}/assign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assetId: null }),
      });
      const payload = await res.json().catch(() => ({} as any));
      if (!res.ok) {
        throw new Error(payload?.error || "Failed to unassign license");
      }
      await fetchLicenses(true);
    } catch (assignError) {
      window.alert(assignError instanceof Error ? assignError.message : "Failed to unassign license");
    } finally {
      setAssigningId(null);
    }
  };

  const stats = [
    {
      label: "Total Licenses",
      value: summary.total,
      icon: KeyRound,
      tone: "text-blue-400 bg-blue-500/10",
    },
    {
      label: "Active",
      value: summary.active,
      icon: CheckCircle2,
      tone: "text-emerald-400 bg-emerald-500/10",
    },
    {
      label: "Expiring Soon",
      value: summary.expiringSoon,
      icon: Clock3,
      tone: "text-amber-400 bg-amber-500/10",
    },
    {
      label: "Expired",
      value: summary.expired,
      icon: AlertCircle,
      tone: "text-red-400 bg-red-500/10",
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">License Manager</h1>
          <p className="text-sm text-slate-500">
            Manage software keys, assignment coverage, and expiration risk from one operational view.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={() => void fetchLicenses(true)} disabled={refreshing || loading}>
            {refreshing ? <Loader2 size={16} className="mr-2 animate-spin" /> : null}
            Refresh
          </Button>
          {canManage && (
            <Button onClick={openCreateModal}>
              <Plus size={16} className="mr-2" />
              Add License
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <div key={stat.label} className="rounded-2xl border border-slate-800 bg-[#151921] p-5 shadow-xl">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.2em] text-slate-500">{stat.label}</p>
                  <p className="mt-3 text-3xl font-bold text-white">{stat.value}</p>
                </div>
                <div className={cn("rounded-xl p-3", stat.tone)}>
                  <Icon size={20} />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="rounded-2xl border border-slate-800 bg-[#151921] shadow-xl">
        <div className="flex flex-col gap-4 border-b border-slate-800 p-6 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-lg font-bold text-white">Lifecycle View</h2>
            <p className="text-sm text-slate-500">
              Filter operational risk and manage assignment without leaving the dashboard.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {[
              { id: "all", label: "All" },
              { id: "active", label: "Active" },
              { id: "expiring", label: "Expiring Soon" },
              { id: "expired", label: "Expired" },
              { id: "unassigned", label: "Unassigned" },
            ].map((item) => (
              <button
                key={item.id}
                onClick={() => setFilter(item.id as typeof filter)}
                className={cn(
                  "rounded-full border px-3 py-1.5 text-xs font-bold uppercase tracking-wider transition-all",
                  filter === item.id
                    ? "border-blue-500 bg-blue-500/10 text-blue-300"
                    : "border-slate-700 text-slate-400 hover:border-slate-500 hover:text-white"
                )}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        {error ? (
          <div className="p-6">
            <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-300">
              {error}
            </div>
          </div>
        ) : null}

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-900/20 text-[11px] uppercase tracking-wider text-slate-500">
                <th className="px-6 py-4 font-semibold">License</th>
                <th className="px-6 py-4 font-semibold">Status</th>
                <th className="px-6 py-4 font-semibold">Expiry</th>
                <th className="px-6 py-4 font-semibold">Assigned Asset</th>
                <th className="px-6 py-4 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-sm text-slate-500">
                    Loading licenses...
                  </td>
                </tr>
              ) : null}

              {!loading && filteredLicenses.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-sm text-slate-500">
                    No licenses match this view yet.
                  </td>
                </tr>
              ) : null}

              {filteredLicenses.map((license) => {
                const state = getLicenseState(license);
                const expiryDate = license.expiryDate ? new Date(license.expiryDate) : null;
                const statusLabel =
                  state === "expired" ? "Expired" : state === "expiring" ? "Expiring Soon" : "Active";

                return (
                  <tr key={license.id} className="hover:bg-slate-900/20">
                    <td className="px-6 py-5">
                      <div className="flex items-start gap-3">
                        <div className="rounded-xl bg-blue-500/10 p-3 text-blue-400">
                          <KeyRound size={18} />
                        </div>
                        <div>
                          <div className="font-semibold text-white">{license.name}</div>
                          <div className="mt-1 text-xs text-slate-500">
                            {license.key ? maskLicenseKey(license.key) : "No key recorded"}
                          </div>
                          <div className="mt-1 text-xs text-slate-500">
                            {license.licenseFile || "No file attached"}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      <span
                        className={cn(
                          "inline-flex rounded-full border px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider",
                          state === "expired" && "border-red-500/20 bg-red-500/10 text-red-300",
                          state === "expiring" && "border-amber-500/20 bg-amber-500/10 text-amber-300",
                          state === "active" && "border-emerald-500/20 bg-emerald-500/10 text-emerald-300"
                        )}
                      >
                        {statusLabel}
                      </span>
                    </td>
                    <td className="px-6 py-5 text-sm text-slate-300">
                      {expiryDate ? (
                        <div>
                          <div>{format(expiryDate, "MMM dd, yyyy")}</div>
                          <div className="mt-1 text-xs text-slate-500">
                            {license.isExpired
                              ? `${formatDistanceToNowStrict(expiryDate)} ago`
                              : `in ${formatDistanceToNowStrict(expiryDate)}`}
                          </div>
                        </div>
                      ) : (
                        <span className="text-slate-500">Perpetual</span>
                      )}
                    </td>
                    <td className="px-6 py-5">
                      {license.asset ? (
                        <div>
                          <div className="font-medium text-slate-200">{license.asset.name}</div>
                          <div className="mt-1 text-xs text-slate-500">
                            {license.asset.serialNumber} • {license.asset.status}
                          </div>
                        </div>
                      ) : (
                        <span className="text-sm text-slate-500">Unassigned</span>
                      )}
                    </td>
                    <td className="px-6 py-5">
                      <div className="flex justify-end gap-2">
                        {canManage && (
                          <>
                            <Button variant="ghost" size="sm" onClick={() => openEditModal(license)}>
                              <Pencil size={15} className="mr-1.5" />
                              Edit
                            </Button>
                            {license.assetId ? (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => void handleQuickUnassign(license)}
                                disabled={assigningId === license.id}
                              >
                                {assigningId === license.id ? (
                                  <Loader2 size={15} className="mr-1.5 animate-spin" />
                                ) : (
                                  <Unplug size={15} className="mr-1.5" />
                                )}
                                Unassign
                              </Button>
                            ) : null}
                            <Button
                              variant="danger"
                              size="sm"
                              onClick={() => void handleDelete(license)}
                              disabled={deletingId === license.id}
                            >
                              {deletingId === license.id ? (
                                <Loader2 size={15} className="mr-1.5 animate-spin" />
                              ) : (
                                <Trash2 size={15} className="mr-1.5" />
                              )}
                              Delete
                            </Button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-800 bg-[#151921] p-6 shadow-xl">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-white">Coverage Snapshot</h2>
            <p className="text-sm text-slate-500">
              {summary.unassigned} unassigned license{summary.unassigned === 1 ? "" : "s"} still need placement.
            </p>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold text-white">{assets.length}</p>
            <p className="text-xs uppercase tracking-wider text-slate-500">Available Assets</p>
          </div>
        </div>
      </div>

      <Modal
        isOpen={isModalOpen}
        onClose={closeModal}
        title={editingLicense ? "Edit License" : "Add License"}
      >
        <form onSubmit={handleSave} className="space-y-5">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2 md:col-span-2">
              <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                License Name
              </label>
              <Input
                value={form.name}
                onChange={(e) => setForm((current) => ({ ...current, name: e.target.value }))}
                placeholder="Windows Server Datacenter"
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                License Key
              </label>
              <Input
                value={form.key}
                onChange={(e) => setForm((current) => ({ ...current, key: e.target.value }))}
                placeholder="Optional key or serial"
              />
              <p className="text-xs text-slate-500">Leave empty if this license is file-based or keyless.</p>
            </div>

            <div className="space-y-2 md:col-span-2">
              <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                License File
              </label>
              <Input
                value={form.licenseFile}
                onChange={(e) => setForm((current) => ({ ...current, licenseFile: e.target.value }))}
                placeholder="Optional file path, URL, or reference"
              />
            </div>

            <div className="space-y-2">
              <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Expiry Date
              </label>
              <Input
                type="date"
                value={form.expiryDate}
                onChange={(e) => setForm((current) => ({ ...current, expiryDate: e.target.value }))}
              />
              <p className="text-xs text-slate-500">Leave empty for perpetual licenses.</p>
            </div>

            <div className="space-y-2">
              <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Assigned Asset
              </label>
              <select
                value={form.assetId}
                onChange={(e) => setForm((current) => ({ ...current, assetId: e.target.value }))}
                className="flex h-10 w-full rounded-lg border border-slate-800 bg-slate-900/50 px-3 py-2 text-sm text-white outline-none transition-all focus:border-blue-500"
              >
                <option value="">Unassigned</option>
                {assets.map((asset) => (
                  <option key={asset.id} value={asset.id}>
                    {asset.name} ({asset.serialNumber})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {formError ? (
            <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-300">
              {formError}
            </div>
          ) : null}

          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={closeModal} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? <Loader2 size={16} className="mr-2 animate-spin" /> : null}
              {editingLicense ? "Save Changes" : "Create License"}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
