"use client";

import { useState, useEffect } from "react";
import { Box, Plus, LayoutGrid, Edit3, Trash2 } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/input";
import { useRole } from "@/hooks/useRole";

export default function DatacenterRacksPage() {
  const { id } = useParams(); // Datacenter ID from URL
  const { isViewer } = useRole();
  const canManage = !isViewer;
  const [racks, setRacks] = useState<any[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editRack, setEditRack] = useState<any | null>(null);
  const [rackName, setRackName] = useState("");
  const [rackUnits, setRackUnits] = useState(42);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const rackUtilization = (rack: any) => {
    const used = new Set<number>();
    const totalUnits = rack.totalUnits ?? 42;
    for (const asset of rack.assets || []) {
      if (!asset.rackUnitStart || !asset.rackUnitSize) continue;
      const end = asset.rackUnitStart + asset.rackUnitSize - 1;
      for (let u = asset.rackUnitStart; u <= end && u <= totalUnits; u++) {
        if (u >= 1) used.add(u);
      }
    }
    return {
      used: used.size,
      total: totalUnits,
      percent: totalUnits > 0 ? Math.round((used.size / totalUnits) * 100) : 0,
    };
  };

  const fetchRacks = async () => {
    const res = await fetch(`/api/locations/${id}`);
    const data = await res.json();
    setRacks(data.racks || []);
  };

  useEffect(() => { fetchRacks(); }, [id]);

  const openCreateModal = () => {
    if (!canManage) return;
    setEditRack(null);
    setRackName("");
    setRackUnits(42);
    setFormError(null);
    setShowModal(true);
  };

  const openEditModal = (rack: any) => {
    if (!canManage) return;
    setEditRack(rack);
    setRackName(rack.name || "");
    setRackUnits(rack.totalUnits || 42);
    setFormError(null);
    setShowModal(true);
  };

  const handleSubmitRack = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canManage) return;
    setIsSubmitting(true);
    setFormError(null);
    try {
      const res = await fetch(editRack ? `/api/racks/${editRack.id}` : "/api/racks", {
        method: editRack ? "PATCH" : "POST",
        body: JSON.stringify(
          editRack
            ? { name: rackName, totalUnits: rackUnits }
            : { name: rackName, locationId: id, totalUnits: rackUnits }
        ),
      });
      if (!res.ok) {
        const payload = await res.json().catch(() => ({} as any));
        throw new Error(payload?.error || `Failed to ${editRack ? "update" : "create"} rack`);
      }
      setRackName("");
      setRackUnits(42);
      setEditRack(null);
      setShowModal(false);
      fetchRacks();
    } catch (error) {
      setFormError(error instanceof Error ? error.message : `Failed to ${editRack ? "update" : "create"} rack`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteRack = async (rack: any) => {
    if (!canManage) return;
    const ok = window.confirm(`Delete rack "${rack.name}"? This only works when no assets are assigned to it.`);
    if (!ok) return;

    const res = await fetch(`/api/racks/${rack.id}`, { method: "DELETE" });
    if (!res.ok) {
      const payload = await res.json().catch(() => ({} as any));
      window.alert(payload?.error || "Failed to delete rack");
      return;
    }

    fetchRacks();
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-white flex items-center gap-3">
          <Box className="text-blue-400" /> Rack Management
        </h1>
        <button 
          onClick={openCreateModal}
          disabled={!canManage}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 disabled:opacity-40 disabled:pointer-events-none"
        >
          <Plus size={18} /> Add New Rack
        </button>
      </div>

      {racks.length === 0 ? (
        <div className="py-24 text-center border-2 border-dashed border-slate-800 rounded-3xl">
          <p className="text-slate-500 mb-4">No racks found in this datacenter.</p>
          <button
            onClick={openCreateModal}
            disabled={!canManage}
            className="text-blue-400 font-bold hover:underline disabled:opacity-40 disabled:pointer-events-none"
          >
            Register first rack unit
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {racks.map(rack => {
            const utilization = rackUtilization(rack);
            return (
              <div
                key={rack.id}
                className="relative bg-[#111620] border border-slate-800 p-5 rounded-2xl hover:border-blue-500/40 hover:bg-slate-900/20 transition-all group"
              >
                {canManage ? (
                  <div className="absolute top-3 right-3 flex gap-1.5 opacity-0 group-hover:opacity-100 transition-all duration-200 z-20">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        openEditModal(rack);
                      }}
                      className="p-2 bg-slate-800/90 backdrop-blur-sm hover:bg-slate-700 rounded-lg text-slate-400 hover:text-white border border-slate-700 transition-colors"
                    >
                      <Edit3 size={15} />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        handleDeleteRack(rack);
                      }}
                      className="p-2 bg-slate-800/90 backdrop-blur-sm hover:bg-red-950/30 rounded-lg text-slate-400 hover:text-red-400 border border-slate-700 hover:border-red-900/50 transition-colors"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                ) : null}

                <Link
                  href={`/assets/locations/datacenters/${id}/racks/${rack.id}`}
                  className="block"
                >
                  <div className="flex items-center gap-3 text-white font-bold">
                    <LayoutGrid className="text-blue-400" size={18} /> {rack.name}
                  </div>
                  <div className="mt-2 text-slate-400 text-sm">
                    {rack._count?.assets ?? 0} assets • {utilization.used}U used / {utilization.total}U
                  </div>
                  <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-800">
                    <div
                      className="h-full bg-blue-600"
                      style={{ width: `${Math.min(100, Math.max(0, utilization.percent))}%` }}
                    />
                  </div>
                  <div className="mt-2 text-xs text-slate-500">{utilization.percent}% occupied</div>
                </Link>
              </div>
            );
          })}
        </div>
      )}

      <Modal
        isOpen={showModal}
        onClose={() => {
          setShowModal(false);
          setEditRack(null);
          setFormError(null);
        }}
        title={editRack ? `Edit ${editRack.name}` : "Add Rack Unit"}
      >
        <form onSubmit={handleSubmitRack} className="space-y-4 py-4">
          <Input
            placeholder="Rack Name (e.g. Rack-A1)"
            value={rackName}
            onChange={(e) => setRackName(e.target.value)}
            required
          />
          <Input
            type="number"
            min={1}
            placeholder="Total Units (default 42)"
            value={rackUnits}
            onChange={(e) => setRackUnits(Number(e.target.value))}
            required
          />
          {formError ? (
            <div className="rounded-lg border border-red-900/50 bg-red-950/20 p-3 text-sm text-red-300">
              {formError}
            </div>
          ) : null}
          <button disabled={!canManage || isSubmitting} className="w-full bg-blue-600 py-3 rounded-xl font-bold text-white disabled:opacity-50 disabled:pointer-events-none">
            {isSubmitting ? "Saving..." : editRack ? "Update Rack" : "Create Rack"}
          </button>
        </form>
      </Modal>
    </div>
  );
}
