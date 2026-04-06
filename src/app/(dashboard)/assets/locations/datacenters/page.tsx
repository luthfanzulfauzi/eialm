"use client";

import { useState, useEffect } from "react";
import { Database, Plus, MapPin, Box, Edit3, Trash2, Loader2 } from "lucide-react";
import Link from "next/link";
import { Modal } from "@/components/ui/Modal";
import { useRole } from "@/hooks/useRole";

export default function DatacentersPage() {
  const { isAdmin, isOperator, isViewer } = useRole();
  const [datacenters, setDatacenters] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [showModal, setShowModal] = useState(false);
  const [editTarget, setEditTarget] = useState<any | null>(null);
  const [formData, setFormData] = useState({ name: "", address: "" });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchDCs = async () => {
    setLoading(true);
    const res = await fetch("/api/locations?type=DATACENTER");
    const data = await res.json();
    setDatacenters(data);
    setLoading(false);
  };

  useEffect(() => {
    fetchDCs();
  }, []);

  const handleOpenAdd = () => {
    if (!isOperator) return;
    setEditTarget(null);
    setFormData({ name: "", address: "" });
    setShowModal(true);
  };

  const handleOpenEdit = (dc: any) => {
    if (!isOperator) return;
    setEditTarget(dc);
    setFormData({ name: dc.name, address: dc.address || "" });
    setShowModal(true);
  };

  const handleDelete = async (id: string, name: string) => {
    if (!isAdmin) return;
    if (!confirm(`Are you sure you want to delete ${name}?`)) return;

    try {
      const res = await fetch(`/api/locations/${id}`, { method: "DELETE" });
      if (res.ok) fetchDCs();
      else alert("Failed to delete datacenter.");
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
        body: JSON.stringify({ ...formData, type: "DATACENTER" }),
      });
      if (res.ok) {
        setShowModal(false);
        fetchDCs();
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <Database className="text-blue-400" /> Datacenter Management
          </h1>
          <p className="text-slate-500 text-sm">Critical facility nodes and physical site tracking</p>
        </div>
        <button 
          onClick={handleOpenAdd}
          disabled={isViewer}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition-transform active:scale-95 shadow-lg shadow-blue-900/20 disabled:opacity-40 disabled:pointer-events-none"
        >
          <Plus size={18} /> New Datacenter
        </button>
      </div>

      {loading ? (
        <div className="py-20 flex justify-center"><Loader2 className="animate-spin text-blue-500" /></div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {datacenters.map((dc) => (
            <div key={dc.id} className="bg-[#151921] border border-slate-800 rounded-2xl p-6 hover:border-blue-500/50 transition-all group relative overflow-hidden">
              
              {/* TOP ACTION BAR: Now purely for admin tools */}
              {(isOperator || isAdmin) && (
                <div className="absolute top-3 right-3 flex gap-1.5 opacity-0 group-hover:opacity-100 transition-all duration-200 z-20">
                  {isOperator && (
                    <button 
                      onClick={() => handleOpenEdit(dc)}
                      className="p-2 bg-slate-800/90 backdrop-blur-sm hover:bg-slate-700 rounded-lg text-slate-400 hover:text-white border border-slate-700 transition-colors"
                    >
                      <Edit3 size={15} />
                    </button>
                  )}
                  {isAdmin && (
                    <button 
                      onClick={() => handleDelete(dc.id, dc.name)}
                      className="p-2 bg-slate-800/90 backdrop-blur-sm hover:bg-red-950/30 rounded-lg text-slate-400 hover:text-red-400 border border-slate-700 hover:border-red-900/50 transition-colors"
                    >
                      <Trash2 size={15} />
                    </button>
                  )}
                </div>
              )}

              <div className="mb-6">
                <div className="p-3 bg-blue-500/10 rounded-xl text-blue-400 border border-blue-500/20 w-fit">
                  <Database size={24} />
                </div>
              </div>
              
              {/* FIXED: Asset Count on the same line as DC Name */}
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-lg font-bold text-white truncate max-w-[70%] group-hover:text-blue-400 transition-colors">
                  {dc.name}
                </h3>
                <span className="text-[10px] font-bold bg-slate-800/80 text-slate-400 px-2.5 py-1 rounded uppercase border border-slate-700 tracking-wider whitespace-nowrap">
                  {dc._count?.assets || 0} Assets
                </span>
              </div>

              <div className="flex items-start gap-2 text-slate-500 text-sm mb-6 min-h-[40px]">
                <MapPin size={14} className="mt-0.5 shrink-0" /> 
                <span className="line-clamp-2">{dc.address || "Main Facility"}</span>
              </div>

              <Link 
                href={`/assets/locations/datacenters/${dc.id}/racks`}
                className="w-full flex items-center justify-center gap-2 bg-slate-800/50 hover:bg-blue-600 text-white py-2.5 rounded-xl text-xs font-bold transition-all border border-slate-700 hover:border-blue-500"
              >
                <Box size={14} /> Manage Rack Locations
              </Link>
            </div>
          ))}
        </div>
      )}

      {/* Modal remains the same */}
      <Modal 
        isOpen={showModal} 
        onClose={() => setShowModal(false)} 
        title={editTarget ? `Edit ${editTarget.name}` : "Register New Datacenter"}
      >
        <form onSubmit={handleSubmit} className="space-y-4 py-4">
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Site Name</label>
            <input 
              required
              type="text"
              placeholder="e.g. DC-NORTH-01"
              value={formData.name}
              onChange={(e) => setFormData({...formData, name: e.target.value})}
              className="w-full bg-[#0f1218] border border-slate-800 rounded-lg px-4 py-2 text-sm text-white outline-none focus:border-blue-500"
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Physical Address</label>
            <textarea 
              placeholder="Full facility address..."
              value={formData.address}
              onChange={(e) => setFormData({...formData, address: e.target.value})}
              className="w-full bg-[#0f1218] border border-slate-800 rounded-lg px-4 py-2 text-sm text-white outline-none focus:border-blue-500 min-h-[100px]"
            />
          </div>
          <button 
            disabled={isSubmitting}
            type="submit"
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl text-sm transition-all disabled:opacity-50 disabled:pointer-events-none"
          >
            {isSubmitting ? <Loader2 className="animate-spin mx-auto" size={18} /> : (editTarget ? "Update Datacenter" : "Provision Facility")}
          </button>
        </form>
      </Modal>
    </div>
  );
}
