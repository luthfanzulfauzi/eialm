"use client";

import { useState, useEffect } from "react";
import { Warehouse, Plus, MapPin, Package, Edit3, Trash2, Loader2, Server } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { useRole } from "@/hooks/useRole";

export default function WarehousesPage() {
  const { isAdmin, isOperator, isViewer } = useRole();
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Modal & Form States
  const [showModal, setShowModal] = useState(false);
  const [editTarget, setEditTarget] = useState<any | null>(null);
  const [formData, setFormData] = useState({ name: "", address: "" });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [expandedWarehouseId, setExpandedWarehouseId] = useState<string | null>(null);
  const [warehouseAssets, setWarehouseAssets] = useState<Record<string, any[]>>({});
  const [loadingAssetsId, setLoadingAssetsId] = useState<string | null>(null);

  const fetchWarehouses = async () => {
    setLoading(true);
    const res = await fetch("/api/locations?type=WAREHOUSE");
    const data = await res.json();
    setWarehouses(data);
    setLoading(false);
  };

  useEffect(() => {
    fetchWarehouses();
  }, []);

  const handleOpenAdd = () => {
    if (!isOperator) return;
    setEditTarget(null);
    setFormData({ name: "", address: "" });
    setShowModal(true);
  };

  const handleOpenEdit = (wh: any) => {
    if (!isOperator) return;
    setEditTarget(wh);
    setFormData({ name: wh.name, address: wh.address || "" });
    setShowModal(true);
  };

  const handleDelete = async (id: string, name: string) => {
    if (!isAdmin) return;
    if (!confirm(`Are you sure you want to delete ${name}? This will fail if there are active assets assigned to this warehouse.`)) {
      return;
    }

    try {
      const res = await fetch(`/api/locations/${id}`, { method: "DELETE" });
      if (res.ok) {
        fetchWarehouses();
      } else {
        const error = await res.json();
        alert(error.error || "Failed to delete warehouse.");
      }
    } catch (error) {
      console.error("Delete failed", error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isOperator) return;
    setIsSubmitting(true);
    const url = editTarget ? `/api/locations/${editTarget.id}` : "/api/locations";
    const method = editTarget ? "PATCH" : "POST";

    try {
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...formData, type: "WAREHOUSE" }),
      });

      if (res.ok) {
        setShowModal(false);
        fetchWarehouses();
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleInventory = async (warehouseId: string) => {
    if (expandedWarehouseId === warehouseId) {
      setExpandedWarehouseId(null);
      return;
    }

    setExpandedWarehouseId(warehouseId);
    if (warehouseAssets[warehouseId]) return;

    setLoadingAssetsId(warehouseId);
    try {
      const res = await fetch(`/api/locations/${warehouseId}?includeAssets=1`);
      const data = await res.json();
      setWarehouseAssets((prev) => ({ ...prev, [warehouseId]: data.assets || [] }));
    } finally {
      setLoadingAssetsId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <Warehouse className="text-emerald-400" /> Warehouse Inventory
          </h1>
          <p className="text-slate-500 text-sm">Hardware storage, logistics hubs, and spare parts</p>
        </div>
        <button 
          onClick={handleOpenAdd}
          disabled={isViewer}
          className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition-transform active:scale-95 shadow-lg shadow-emerald-900/20 disabled:opacity-40 disabled:pointer-events-none"
        >
          <Plus size={18} /> Add Warehouse
        </button>
      </div>

      {loading ? (
        <div className="py-20 flex justify-center"><Loader2 className="animate-spin text-emerald-500" /></div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {warehouses.map((wh) => (
            <div key={wh.id} className="bg-[#151921] border border-slate-800 rounded-2xl p-6 hover:border-emerald-500/50 transition-all group relative overflow-hidden">
              
              {/* ADMIN ACTIONS: Top right overlay aligned with datacenter design */}
              {(isOperator || isAdmin) && (
                <div className="absolute top-3 right-3 flex gap-1.5 opacity-0 group-hover:opacity-100 transition-all duration-200 z-20">
                  {isOperator && (
                    <button 
                      onClick={() => handleOpenEdit(wh)}
                      className="p-2 bg-slate-800/90 backdrop-blur-sm hover:bg-slate-700 rounded-lg text-slate-400 hover:text-white border border-slate-700 transition-colors"
                    >
                      <Edit3 size={15} />
                    </button>
                  )}
                  {isAdmin && (
                    <button 
                      onClick={() => handleDelete(wh.id, wh.name)}
                      className="p-2 bg-slate-800/90 backdrop-blur-sm hover:bg-red-950/30 rounded-lg text-slate-400 hover:text-red-400 border border-slate-700 hover:border-red-900/50 transition-colors"
                    >
                      <Trash2 size={15} />
                    </button>
                  )}
                </div>
              )}

              <div className="mb-6">
                <div className="p-3 bg-emerald-500/10 rounded-xl text-emerald-400 border border-emerald-500/20 w-fit">
                  <Warehouse size={24} />
                </div>
              </div>
              
              {/* ALIGNED HEADER: Name and Asset Count on same line */}
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-lg font-bold text-white truncate max-w-[70%] group-hover:text-emerald-400 transition-colors">
                  {wh.name}
                </h3>
                <span className="text-[10px] font-bold bg-slate-800/80 text-slate-400 px-2.5 py-1 rounded uppercase border border-slate-700 tracking-wider">
                  {wh._count?.assets || 0} Assets
                </span>
              </div>

              <div className="flex items-start gap-2 text-slate-500 text-sm mb-6 min-h-[40px]">
                <MapPin size={14} className="mt-0.5 shrink-0" /> 
                <span className="line-clamp-2">{wh.address || "Internal Storage"}</span>
              </div>

              <button
                type="button"
                onClick={() => toggleInventory(wh.id)}
                className="w-full flex items-center justify-center gap-2 bg-slate-800/50 hover:bg-emerald-600 text-white py-2.5 rounded-xl text-xs font-bold transition-all border border-slate-700 hover:border-emerald-500"
              >
                <Package size={14} /> {expandedWarehouseId === wh.id ? "Hide Storage Inventory" : "View Storage Inventory"}
              </button>

              {expandedWarehouseId === wh.id ? (
                <div className="mt-4 rounded-xl border border-slate-800 bg-[#0f1218] p-3">
                  {loadingAssetsId === wh.id ? (
                    <div className="py-5 flex items-center justify-center text-slate-500">
                      <Loader2 className="animate-spin" size={16} />
                    </div>
                  ) : warehouseAssets[wh.id]?.length ? (
                    <div className="space-y-2 max-h-72 overflow-auto pr-1">
                      {warehouseAssets[wh.id].map((asset) => (
                        <div key={asset.id} className="rounded-lg border border-slate-800 bg-slate-950/30 p-3">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 text-sm font-bold text-white">
                                <Server size={14} className="text-emerald-400 shrink-0" />
                                <span className="truncate">{asset.name}</span>
                              </div>
                              <div className="text-xs text-slate-500">{asset.serialNumber}</div>
                            </div>
                            <span className="rounded-md bg-slate-800 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                              {asset.status}
                            </span>
                          </div>
                          <div className="mt-2 text-xs text-slate-400">
                            {asset.category} {asset.ips?.length ? `• ${asset.ips.map((ip: any) => ip.address).join(", ")}` : ""}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="py-5 text-center text-sm text-slate-500">No assets stored in this warehouse.</div>
                  )}
                </div>
              ) : null}
            </div>
          ))}
        </div>
      )}

      <Modal 
        isOpen={showModal} 
        onClose={() => setShowModal(false)} 
        title={editTarget ? `Edit ${editTarget.name}` : "Register New Warehouse"}
      >
        <form onSubmit={handleSubmit} className="space-y-4 py-4">
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Warehouse Name</label>
            <input 
              required
              type="text"
              placeholder="e.g. HUB-WEST-01"
              value={formData.name}
              onChange={(e) => setFormData({...formData, name: e.target.value})}
              className="w-full bg-[#0f1218] border border-slate-800 rounded-lg px-4 py-2 text-sm text-white outline-none focus:border-emerald-500 transition-colors"
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Physical Location</label>
            <textarea 
              placeholder="Full storage facility address..."
              value={formData.address}
              onChange={(e) => setFormData({...formData, address: e.target.value})}
              className="w-full bg-[#0f1218] border border-slate-800 rounded-lg px-4 py-2 text-sm text-white outline-none focus:border-emerald-500 min-h-[100px] transition-colors"
            />
          </div>
          <button 
            disabled={isSubmitting}
            type="submit"
            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 rounded-xl text-sm transition-all disabled:opacity-50 disabled:pointer-events-none"
          >
            {isSubmitting ? <Loader2 className="animate-spin mx-auto" size={18} /> : (editTarget ? "Update Facility" : "Add Warehouse")}
          </button>
        </form>
      </Modal>
    </div>
  );
}
