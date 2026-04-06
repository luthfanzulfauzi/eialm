"use client";

import { useState, useEffect, useMemo } from "react";
import { Shield, Server, Unlink, ExternalLink, Search, Plus, Loader2 } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { useRouter } from "next/navigation";
import { useRole } from "@/hooks/useRole";

export default function PrivateIPPage() {
  // FIX: Explicitly type as any[] to prevent 'never[]' build error
  const [ips, setIps] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const router = useRouter();
  const { isViewer } = useRole();
  const canManage = !isViewer;

  useEffect(() => {
    const fetchPrivateIPs = async () => {
      try {
        const res = await fetch("/api/network?type=private");
        const data = await res.json();
        setIps(data);
      } catch (error) {
        console.error("Failed to fetch private IPs:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchPrivateIPs();
  }, []);

  const filteredIps = useMemo(() => {
    return ips.filter((ip: any) => 
      ip.address.includes(searchQuery) || 
      ip.asset?.name?.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [ips, searchQuery]);

  const handleDetach = async (ipId: string) => {
    if (!canManage) return;
    if (!confirm("Are you sure you want to unassign this private IP?")) return;
    
    try {
      const res = await fetch(`/api/network`, {
        method: "POST",
        body: JSON.stringify({ ipId, assetId: null }),
      });
      
      if (res.ok) {
        setIps(ips.map((ip: any) => ip.id === ipId ? { ...ip, asset: null } : ip));
        router.refresh();
      }
    } catch (err) {
      console.error("Detachment failed", err);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <Shield className="text-emerald-400" /> Private IP Management
          </h1>
          <p className="text-slate-500 text-sm">Inventory of internal local area network (LAN) addresses</p>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
            <input 
              type="text" 
              placeholder="Search IP or Asset..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-slate-900 border border-slate-800 rounded-lg pl-10 pr-4 py-2 text-sm outline-none focus:border-blue-500 w-64 text-white"
            />
          </div>
          <button 
            onClick={() => {
              if (!canManage) return;
              setShowAddModal(true);
            }}
            disabled={!canManage}
            className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition-all disabled:opacity-40 disabled:pointer-events-none"
          >
            <Plus size={18} /> Add Private IP
          </button>
        </div>
      </div>

      <div className="bg-[#111620] border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="p-4 border-b border-slate-800 bg-slate-900/30 flex justify-between text-xs font-bold text-slate-500 uppercase tracking-wider">
          <div className="w-48 pl-2">IP Address</div>
          <div className="flex-1">Assigned Infrastructure</div>
          <div className="w-24 text-right">Actions</div>
        </div>

        <div className="divide-y divide-slate-800">
          {loading ? (
            <div className="py-20 flex flex-col items-center justify-center text-slate-500 gap-2">
              <Loader2 className="animate-spin text-emerald-500" size={24} />
              <p className="text-sm">Scanning network inventory...</p>
            </div>
          ) : filteredIps.length > 0 ? (
            filteredIps.map((ip: any) => (
              <div key={ip.id} className="flex items-center justify-between p-4 hover:bg-slate-800/30 transition-colors group">
                <div className="w-48">
                  <span className="text-lg font-mono font-bold text-emerald-400">{ip.address}</span>
                </div>

                <div className="flex-1">
                  {ip.asset ? (
                    <div className="flex items-center gap-3">
                      <div className="p-1.5 bg-slate-800 rounded text-slate-400 border border-slate-700">
                        <Server size={14} />
                      </div>
                      <div>
                        <div className="text-sm font-medium text-slate-200">{ip.asset.name}</div>
                        <div className="text-[10px] text-slate-500 uppercase font-bold tracking-tighter">{ip.asset.category}</div>
                      </div>
                    </div>
                  ) : (
                    <span className="text-[10px] text-slate-500 uppercase font-bold px-2 py-1 rounded bg-slate-900 border border-slate-800 tracking-widest">
                      Available for Assignment
                    </span>
                  )}
                </div>

                <div className="w-24 flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  {canManage && ip.asset && (
                    <button 
                      onClick={() => handleDetach(ip.id)}
                      className="p-2 hover:bg-red-500/10 rounded-lg text-slate-400 hover:text-red-400 transition-colors" 
                      title="Unassign IP"
                    >
                      <Unlink size={16} />
                    </button>
                  )}
                  <button className="p-2 hover:bg-slate-700 rounded-lg text-slate-400 hover:text-white transition-colors">
                    <ExternalLink size={16} />
                  </button>
                </div>
              </div>
            ))
          ) : (
            <div className="py-20 text-center text-slate-500">
              <p className="font-medium">No private IP addresses found.</p>
            </div>
          )}
        </div>
      </div>

      <Modal isOpen={showAddModal} onClose={() => setShowAddModal(false)} title="Register Private IP Address">
        <div className="text-slate-400 text-sm py-4 italic text-center">
          IP Registration Form Logic
        </div>
      </Modal>
    </div>
  );
}
