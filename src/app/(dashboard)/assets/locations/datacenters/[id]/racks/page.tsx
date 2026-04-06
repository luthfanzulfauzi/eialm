"use client";

import { useState, useEffect } from "react";
import { Box, Plus, LayoutGrid } from "lucide-react";
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
  const [rackName, setRackName] = useState("");
  const [rackUnits, setRackUnits] = useState(42);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchRacks = async () => {
    const res = await fetch(`/api/locations/${id}`);
    const data = await res.json();
    setRacks(data.racks || []);
  };

  useEffect(() => { fetchRacks(); }, [id]);

  const handleAddRack = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canManage) return;
    setIsSubmitting(true);
    await fetch("/api/racks", {
      method: "POST",
      body: JSON.stringify({ name: rackName, locationId: id, totalUnits: rackUnits }),
    });
    setRackName("");
    setRackUnits(42);
    setShowModal(false);
    fetchRacks();
    setIsSubmitting(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-white flex items-center gap-3">
          <Box className="text-blue-400" /> Rack Management
        </h1>
        <button 
          onClick={() => {
            if (!canManage) return;
            setShowModal(true);
          }}
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
            onClick={() => {
              if (!canManage) return;
              setShowModal(true);
            }}
            disabled={!canManage}
            className="text-blue-400 font-bold hover:underline disabled:opacity-40 disabled:pointer-events-none"
          >
            Register first rack unit
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {racks.map(rack => (
            <Link
              key={rack.id}
              href={`/assets/locations/datacenters/${id}/racks/${rack.id}`}
              className="bg-[#111620] border border-slate-800 p-5 rounded-2xl hover:border-blue-500/40 hover:bg-slate-900/20 transition-all"
            >
              <div className="flex items-center gap-3 text-white font-bold">
                <LayoutGrid className="text-blue-400" size={18} /> {rack.name}
              </div>
              <div className="mt-2 text-slate-400 text-sm">
                {rack._count?.assets ?? 0} assets • {rack.totalUnits ?? 42}U
              </div>
            </Link>
          ))}
        </div>
      )}

      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title="Add Rack Unit">
        <form onSubmit={handleAddRack} className="space-y-4 py-4">
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
          <button disabled={!canManage || isSubmitting} className="w-full bg-blue-600 py-3 rounded-xl font-bold text-white disabled:opacity-50 disabled:pointer-events-none">
            {isSubmitting ? "Saving..." : "Create Rack"}
          </button>
        </form>
      </Modal>
    </div>
  );
}
