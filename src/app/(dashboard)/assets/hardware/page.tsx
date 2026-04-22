"use client";

import { useState, useEffect, Suspense } from "react";
import { AssetTable } from "@/components/tables/AssetTable";
import { Modal } from "@/components/ui/Modal";
import { AssetForm } from "@/components/forms/AssetForm";
import { ChevronLeft, ChevronRight, Download, Plus, Search, Upload } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { AssetFormValues } from "@/lib/validations/asset";
import { useRole } from "@/hooks/useRole";
import { useToast } from "@/providers/toast-provider";

/**
 * Inner component that uses dynamic hooks like useSearchParams.
 * This must be wrapped in a Suspense boundary for production builds.
 */
function HardwareContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isViewer } = useRole();
  const toast = useToast();
  
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [editAsset, setEditAsset] = useState<any>(null);
  const [assets, setAssets] = useState([]);
  const [locations, setLocations] = useState([]);
  const [racks, setRacks] = useState([]);
  const [meta, setMeta] = useState({ total: 0, page: 1, pages: 1, pageSize: 10 });
  const [loading, setLoading] = useState(true);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<any>(null);

  const buildAssetQuery = () => {
    const params = new URLSearchParams();
    ["q", "cat", "status", "type", "rackState", "page"].forEach((key) => {
      const value = searchParams.get(key);
      if (value) params.set(key, value);
    });
    return params.toString();
  };

  const setQueryParam = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value) {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    if (key !== "page") params.set("page", "1");
    router.push(`?${params.toString()}`);
  };

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      
      const res = await fetch(`/api/assets?${buildAssetQuery()}`);
      const data = await res.json();
      
      setAssets(data.items || []);
      setLocations(data.locations || []);
      setRacks(data.racks || []);
      setMeta({
        total: data.total || 0,
        page: data.page || 1,
        pages: data.pages || 1,
        pageSize: data.pageSize || 10,
      });
      setLoading(false);
    };
    fetchData();
  }, [searchParams]);

  const refreshTable = async () => {
    setLoading(true);

    const res = await fetch(`/api/assets?${buildAssetQuery()}`);
    const data = await res.json();

    setAssets(data.items || []);
    setLocations(data.locations || []);
    setRacks(data.racks || []);
    setMeta({
      total: data.total || 0,
      page: data.page || 1,
      pages: data.pages || 1,
      pageSize: data.pageSize || 10,
    });
    setLoading(false);
  };

  const handleCreate = async (data: AssetFormValues) => {
    try {
      const response = await fetch("/api/assets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (response.ok) {
        setShowCreateModal(false);
        await refreshTable();
        router.refresh();
        toast.success("Asset created successfully.");
        return;
      }
      const payload = await response.json().catch(() => ({} as any));
      throw new Error(payload?.error || "Failed to create asset");
    } catch (error) {
      console.error("Failed to create asset:", error);
      toast.error(error instanceof Error ? error.message : "Failed to create asset");
    }
  };

  const handleUpdate = async (data: AssetFormValues) => {
    if (!editAsset?.id) return;
    try {
      const response = await fetch(`/api/assets/${editAsset.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (response.ok) {
        setShowEditModal(false);
        setEditAsset(null);
        await refreshTable();
        router.refresh();
        toast.success("Asset updated successfully.");
        return;
      }
      const payload = await response.json().catch(() => ({} as any));
      throw new Error(payload?.error || "Failed to update asset");
    } catch (error) {
      console.error("Failed to update asset:", error);
      toast.error(error instanceof Error ? error.message : "Failed to update asset");
    }
  };

  const handleDelete = async (asset: any) => {
    if (!asset?.id) return;
    const ok = window.confirm(`Delete asset "${asset.name}" (${asset.serialNumber})?`);
    if (!ok) return;

    try {
      const response = await fetch(`/api/assets/${asset.id}`, {
        method: "DELETE",
      });

      if (response.ok) {
        await refreshTable();
        router.refresh();
        toast.success("Asset deleted successfully.");
      } else {
        const payload = await response.json().catch(() => ({} as any));
        throw new Error(payload?.error || "Failed to delete asset");
      }
    } catch (error) {
      console.error("Failed to delete asset:", error);
      toast.error(error instanceof Error ? error.message : "Failed to delete asset");
    }
  };

  const handleExport = async () => {
    const exportParams = new URLSearchParams(buildAssetQuery());
    exportParams.delete("page");
    const res = await fetch(`/api/assets/export?${exportParams.toString()}`);
    if (!res.ok) {
      const payload = await res.text().catch(() => "");
      toast.error(payload || "Failed to export assets");
      return;
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const filename = res.headers.get("Content-Disposition")?.match(/filename="([^"]+)"/)?.[1];
    a.download = filename || "assets.csv";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    toast.success("Asset export started.");
  };

  const handleImport = async () => {
    if (!importFile) {
      toast.info("Please select a CSV file to import.");
      return;
    }
    try {
      setImporting(true);
      setImportResult(null);
      const form = new FormData();
      form.append("file", importFile);
      const res = await fetch("/api/assets/import", {
        method: "POST",
        body: form,
      });
      const payload = await res.json().catch(() => ({} as any));
      if (!res.ok) throw new Error(payload?.error || "Failed to import assets");
      setImportResult(payload);
      await refreshTable();
      router.refresh();
      toast.success(`Imported ${payload.created + payload.updated} asset rows.`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to import assets");
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Hardware Inventory</h1>
          <p className="text-slate-500 text-sm">Manage physical infrastructure and equipment</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
            <input 
              type="text" 
              placeholder="Search SN or Name..." 
              defaultValue={searchParams.get("q") || ""}
              onChange={(e) => setQueryParam("q", e.target.value)}
              className="bg-slate-900 border border-slate-800 rounded-lg pl-10 pr-4 py-2 text-sm outline-none focus:border-blue-500 w-64 text-white"
            />
          </div>
          
          <select
            value={searchParams.get("cat") || ""}
            onChange={(e) => setQueryParam("cat", e.target.value)}
            className="bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-500 text-white"
            aria-label="Filter by category"
          >
            <option value="">All categories</option>
            <option value="Server">Server</option>
            <option value="Network Device">Network Device</option>
            <option value="Cable">Cable</option>
            <option value="Other">Other</option>
          </select>

          <select
            value={searchParams.get("status") || ""}
            onChange={(e) => setQueryParam("status", e.target.value)}
            className="bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-500 text-white"
            aria-label="Filter by status"
          >
            <option value="">All statuses</option>
            {['PLAN', 'PURCHASED', 'INSTALLING', 'ACTIVE', 'MAINTENANCE', 'BROKEN', 'DECOMMISSIONED'].map((status) => (
              <option key={status} value={status}>{status}</option>
            ))}
          </select>

          <select
            value={searchParams.get("type") || ""}
            onChange={(e) => setQueryParam("type", e.target.value)}
            className="bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-500 text-white"
            aria-label="Filter by location type"
          >
            <option value="">All locations</option>
            <option value="DATACENTER">Datacenter</option>
            <option value="WAREHOUSE">Warehouse</option>
          </select>

          <select
            value={searchParams.get("rackState") || ""}
            onChange={(e) => setQueryParam("rackState", e.target.value)}
            className="bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-500 text-white"
            aria-label="Filter by rack state"
          >
            <option value="">All rack states</option>
            <option value="RACKED">Racked</option>
            <option value="UNRACKED">Stored / unracked</option>
            <option value="UNASSIGNED">Unassigned</option>
          </select>

          <button
            onClick={handleExport}
            className="flex items-center gap-2 px-4 py-2 bg-slate-800 rounded-lg text-sm border border-slate-700 hover:bg-slate-700 transition-colors"
          >
            <Download size={16} />
            Export
          </button>

          <button
            onClick={() => {
              setImportResult(null);
              setImportFile(null);
              setShowImportModal(true);
            }}
            disabled={isViewer}
            className="flex items-center gap-2 px-4 py-2 bg-slate-800 rounded-lg text-sm border border-slate-700 hover:bg-slate-700 transition-colors disabled:opacity-40"
          >
            <Upload size={16} />
            Import
          </button>

          <button 
            onClick={() => {
              if (isViewer) return;
              setShowCreateModal(true);
            }}
            disabled={isViewer}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-bold transition-all shadow-lg shadow-blue-500/20 disabled:opacity-40 disabled:pointer-events-none"
          >
            <Plus size={18} />
            Add Asset
          </button>
        </div>
      </div>

      {loading ? (
        <div className="py-20 text-center text-slate-500 animate-pulse">Scanning inventory...</div>
      ) : (
        <>
          <AssetTable
            assets={assets as any}
            canManage={!isViewer}
            onEdit={(asset) => {
              setEditAsset(asset);
              setShowEditModal(true);
            }}
            onDelete={(asset) => handleDelete(asset)}
          />

          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 text-sm text-slate-400">
            <div>
              Showing {assets.length ? (meta.page - 1) * meta.pageSize + 1 : 0}
              {"-"}
              {Math.min(meta.page * meta.pageSize, meta.total)} of {meta.total} assets
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={meta.page <= 1}
                onClick={() => setQueryParam("page", String(meta.page - 1))}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-800 bg-slate-900 text-slate-200 disabled:opacity-40"
              >
                <ChevronLeft size={16} />
                Previous
              </button>
              <span className="px-3 py-2 text-slate-500">
                Page {meta.page} of {meta.pages}
              </span>
              <button
                type="button"
                disabled={meta.page >= meta.pages}
                onClick={() => setQueryParam("page", String(meta.page + 1))}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-800 bg-slate-900 text-slate-200 disabled:opacity-40"
              >
                Next
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        </>
      )}

      <Modal 
        isOpen={showCreateModal} 
        onClose={() => setShowCreateModal(false)} 
        title="Register New Infrastructure Asset"
      >
        <AssetForm 
          locations={locations} 
          racks={racks} 
          onSubmit={handleCreate} 
        />
      </Modal>

      <Modal
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
        title="Import Assets (CSV)"
      >
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <a
              href="/samples/assets-import-sample.csv"
              download
              className="text-sm text-blue-400 hover:text-blue-300"
            >
              Download sample CSV
            </a>
          </div>

          <input
            type="file"
            accept=".csv,text/csv"
            onChange={(e) => setImportFile(e.target.files?.[0] || null)}
            className="w-full bg-[#0f1218] border border-slate-800 rounded-lg p-2.5 text-sm text-white focus:border-blue-500 outline-none transition-all"
          />

          {importResult ? (
            <div className="rounded-lg border border-slate-800 bg-slate-950/20 p-3 text-sm text-slate-200 space-y-2">
              <div>
                Imported: {importResult.created + importResult.updated} (created {importResult.created}, updated {importResult.updated})
              </div>
              {importResult.warningsCount ? (
                <div className="text-amber-400">
                  Warnings: {importResult.warningsCount}
                </div>
              ) : null}
              {importResult.failed ? (
                <div className="text-red-400">
                  Failed: {importResult.failed}
                </div>
              ) : null}
              {Array.isArray(importResult.errors) && importResult.errors.length ? (
                <div className="text-xs text-slate-400 space-y-1">
                  {importResult.errors.slice(0, 5).map((err: any, idx: number) => (
                    <div key={idx}>
                      Row {err.row}: {err.error}
                    </div>
                  ))}
                </div>
              ) : null}
              {Array.isArray(importResult.warnings) && importResult.warnings.length ? (
                <div className="text-xs text-slate-400 space-y-1">
                  {importResult.warnings.slice(0, 5).map((w: any, idx: number) => (
                    <div key={idx}>
                      Row {w.row}: {w.warning}
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}

          <button
            type="button"
            disabled={importing}
            onClick={handleImport}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-xl font-bold transition-all disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {importing ? "Importing..." : "Import CSV"}
          </button>
        </div>
      </Modal>

      <Modal
        isOpen={showEditModal}
        onClose={() => {
          setShowEditModal(false);
          setEditAsset(null);
        }}
        title="Edit Infrastructure Asset"
      >
        <AssetForm
          locations={locations}
          racks={racks}
          initialData={{
            name: editAsset?.name,
            serialNumber: editAsset?.serialNumber,
            category: editAsset?.category,
            status: editAsset?.status,
            locationId: editAsset?.locationId || editAsset?.rack?.locationId,
            rackId: editAsset?.rackId,
            locationType: editAsset?.location?.type || (editAsset?.rackId ? "DATACENTER" : undefined),
            serverType: editAsset?.serverType ?? "",
            cpuType: editAsset?.cpuType ?? "",
            cpuSocketNumber: editAsset?.cpuSocketNumber ?? undefined,
            cpuCore: editAsset?.cpuCore ?? undefined,
            memoryType: editAsset?.memoryType ?? "",
            memorySize: editAsset?.memorySize ?? undefined,
            memorySlotUsed: editAsset?.memorySlotUsed ?? undefined,
            memorySpeed: editAsset?.memorySpeed ?? undefined,
            diskOsType: editAsset?.diskOsType ?? "",
            diskOsNumber: editAsset?.diskOsNumber ?? undefined,
            diskOsSize: editAsset?.diskOsSize ?? undefined,
            diskDataType: editAsset?.diskDataType ?? "",
            diskDataNumber: editAsset?.diskDataNumber ?? undefined,
            diskDataSize: editAsset?.diskDataSize ?? undefined,
          } as any}
          onSubmit={handleUpdate}
        />
      </Modal>
    </div>
  );
}

/**
 * Main Page Component.
 * Wraps the content in a Suspense boundary to prevent build-time prerendering errors.
 */
export default function HardwarePage() {
  return (
    <Suspense fallback={
      <div className="flex h-[60vh] items-center justify-center text-slate-500 text-sm">
        Initializing Hardware Module...
      </div>
    }>
      <HardwareContent />
    </Suspense>
  );
}
