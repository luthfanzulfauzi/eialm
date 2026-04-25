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
  Search,
  Trash2,
  Unplug,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/Modal";
import { cn } from "@/lib/utils";
import { useToast } from "@/providers/toast-provider";

type AssetOption = {
  id: string;
  name: string;
  serialNumber: string;
  status: string;
};

type ProductOption = {
  id: string;
  name: string;
  code: string;
  lifecycle: string;
  criticality: string;
};

type LicenseRecord = {
  id: string;
  name: string;
  key: string | null;
  licenseFile: string | null;
  poSiSoNumber: string | null;
  expiryDate: string | null;
  isExpired: boolean;
  assetId: string | null;
  asset?: AssetOption | null;
  products: ProductOption[];
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
  poSiSoNumber: string;
  expiryDate: string;
  assetId: string;
  productIds: string[];
};

const emptyForm: LicenseFormState = {
  name: "",
  key: "",
  licenseFile: "",
  poSiSoNumber: "",
  expiryDate: "",
  assetId: "",
  productIds: [],
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
  const toast = useToast();
  const [licenses, setLicenses] = useState<LicenseRecord[]>([]);
  const [assets, setAssets] = useState<AssetOption[]>([]);
  const [products, setProducts] = useState<ProductOption[]>([]);
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
  const [search, setSearch] = useState("");
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
      setProducts(payload.products || []);
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

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const nextFilter = params.get("filter");
    const nextSearch = params.get("q");
    if (nextFilter && ["all", "active", "expiring", "expired", "unassigned"].includes(nextFilter)) {
      setFilter(nextFilter as typeof filter);
    }
    if (nextSearch) {
      setSearch(nextSearch);
    }
  }, []);

  const filteredLicenses = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    return licenses.filter((license) => {
      const state = getLicenseState(license);
      const matchesFilter =
        filter === "all" ||
        (filter === "active" && state === "active") ||
        (filter === "expiring" && state === "expiring") ||
        (filter === "expired" && state === "expired") ||
        (filter === "unassigned" && !license.assetId && license.products.length === 0);

      if (!matchesFilter) return false;
      if (!normalizedSearch) return true;

      return [
        license.name,
        license.key,
        license.licenseFile,
        license.poSiSoNumber,
        license.asset?.name,
        license.asset?.serialNumber,
        ...license.products.flatMap((product) => [product.name, product.code]),
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(normalizedSearch));
    });
  }, [filter, licenses, search]);

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
      poSiSoNumber: license.poSiSoNumber || "",
      expiryDate: license.expiryDate ? format(new Date(license.expiryDate), "yyyy-MM-dd") : "",
      assetId: license.assetId || "",
      productIds: license.products.map((product) => product.id),
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
          poSiSoNumber: form.poSiSoNumber.trim() || null,
          expiryDate: form.expiryDate || null,
          assetId: form.assetId || null,
          productIds: form.productIds,
        }),
      });

      const payload = await res.json().catch(() => ({} as any));
      if (!res.ok) {
        throw new Error(payload?.error || "Failed to save license");
      }

      closeModal();
      await fetchLicenses(true);
      toast.success(editingLicense ? "License updated successfully." : "License created successfully.");
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
      toast.success("License deleted successfully.");
    } catch (deleteError) {
      toast.error(deleteError instanceof Error ? deleteError.message : "Failed to delete license");
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
      toast.success("License assignment cleared.");
    } catch (assignError) {
      toast.error(assignError instanceof Error ? assignError.message : "Failed to unassign license");
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
      <section className="rounded-3xl border border-slate-800 bg-[radial-gradient(circle_at_top_left,_rgba(245,158,11,0.13),_transparent_28%),linear-gradient(180deg,_rgba(15,23,42,0.94),_rgba(8,11,18,0.96))] p-8 shadow-2xl">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-3xl space-y-3">
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-white">License Manager</h1>
              <p className="mt-2 text-sm leading-6 text-slate-300">
                Manage software keys, assignment coverage, and expiration risk from one operational view.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
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
      </section>

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
            <div className="relative min-w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
              <input
                type="text"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search licenses, keys, assets..."
                className="h-9 w-full rounded-lg border border-slate-800 bg-slate-900 pl-9 pr-3 text-sm text-white outline-none transition-colors focus:border-blue-500"
              />
            </div>
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
                <th className="px-6 py-4 font-semibold">Related Products</th>
                <th className="px-6 py-4 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-sm text-slate-500">
                    Loading licenses...
                  </td>
                </tr>
              ) : null}

              {!loading && filteredLicenses.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-sm text-slate-500">
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
                          <div className="mt-1 text-xs text-slate-500">
                            {license.poSiSoNumber || "No PO/SI/SO number"}
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
                      {license.products.length > 0 ? (
                        <div className="flex flex-wrap gap-2">
                          {license.products.map((product) => (
                            <span
                              key={product.id}
                              className="rounded-full border border-cyan-500/20 bg-cyan-500/10 px-3 py-1 text-xs text-cyan-100"
                            >
                              {product.name} · {product.code}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-sm text-slate-500">No product links</span>
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
              {summary.unassigned} unassigned license{summary.unassigned === 1 ? "" : "s"} still need asset or product linkage.
            </p>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold text-white">{assets.length + products.length}</p>
            <p className="text-xs uppercase tracking-wider text-slate-500">Linkable Records</p>
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

            <div className="space-y-2 md:col-span-2">
              <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                License PO/SI/SO Number
              </label>
              <Input
                value={form.poSiSoNumber}
                onChange={(e) => setForm((current) => ({ ...current, poSiSoNumber: e.target.value }))}
                placeholder="Optional PO, SI, or SO reference"
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

          <div className="rounded-2xl border border-slate-800 bg-slate-900/30 p-4">
            <div className="mb-3 flex items-center justify-between">
              <h4 className="text-sm font-bold text-white">Related Products</h4>
              <span className="text-xs text-slate-500">{form.productIds.length} selected</span>
            </div>
            <div className="max-h-56 space-y-2 overflow-y-auto pr-1">
              {products.length > 0 ? (
                products.map((product) => (
                  <label
                    key={product.id}
                    className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-800 bg-slate-950/40 px-3 py-3 text-sm text-slate-300"
                  >
                    <input
                      type="checkbox"
                      checked={form.productIds.includes(product.id)}
                      onChange={() =>
                        setForm((current) => ({
                          ...current,
                          productIds: current.productIds.includes(product.id)
                            ? current.productIds.filter((value) => value !== product.id)
                            : [...current.productIds, product.id],
                        }))
                      }
                      className="mt-1"
                    />
                    <div>
                      <div className="font-medium text-white">{product.name}</div>
                      <div className="text-xs text-slate-500">
                        {product.code} · {product.lifecycle.toLowerCase()} · {product.criticality.toLowerCase()}
                      </div>
                    </div>
                  </label>
                ))
              ) : (
                <p className="text-sm text-slate-500">No products available for linking yet.</p>
              )}
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
