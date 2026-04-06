"use client";

import { ChevronDown, MoreHorizontal, Server } from "lucide-react";
import { Fragment, type ReactNode, useEffect, useState } from "react";

type ExtendedAsset = {
  id: string;
  name: string;
  serialNumber: string;
  category: string;
  status: string;
  createdAt?: string | Date | null;
  updatedAt?: string | Date | null;

  serverType?: string | null;
  cpuType?: string | null;
  cpuSocketNumber?: number | null;
  cpuCore?: number | null;
  memoryType?: string | null;
  memorySize?: number | null;
  memorySlotUsed?: number | null;
  memorySpeed?: number | null;
  diskOsType?: string | null;
  diskOsNumber?: number | null;
  diskOsSize?: number | null;
  diskDataType?: string | null;
  diskDataNumber?: number | null;
  diskDataSize?: number | null;

  location: { name?: string | null; type?: string | null } | null;
  rack: { name?: string | null } | null;
  ips: Array<{ address: string }>;

  rackUnitStart?: number | null;
  rackUnitSize?: number | null;
  rackFace?: "FRONT" | "BACK" | "BOTH" | null;
};

export const AssetTable = ({
  assets,
  canManage = true,
  onEdit,
  onDelete,
}: {
  assets: ExtendedAsset[];
  canManage?: boolean;
  onEdit?: (asset: ExtendedAsset) => void;
  onDelete?: (asset: ExtendedAsset) => void;
}) => {
  const [openRowId, setOpenRowId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    const handleWindowClick = () => setOpenRowId(null);
    window.addEventListener("click", handleWindowClick);
    return () => window.removeEventListener("click", handleWindowClick);
  }, []);

  const fmt = (v: unknown) => {
    if (v === null || v === undefined) return "—";
    if (typeof v === "string") return v.trim().length ? v : "—";
    if (typeof v === "number") return Number.isFinite(v) ? String(v) : "—";
    return String(v);
  };

  const title = (label: string) => (
    <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{label}</div>
  );

  const item = (label: string, value: ReactNode) => (
    <div className="space-y-1">
      <div className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">{label}</div>
      <div className="text-sm text-slate-200">{value}</div>
    </div>
  );

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left border-separate border-spacing-y-2">
        <thead>
          <tr className="text-slate-500 text-xs uppercase tracking-wider">
            <th className="px-4 py-2">Asset Name / SN</th>
            <th className="px-4 py-2">Category</th>
            <th className="px-4 py-2">Status</th>
            <th className="px-4 py-2">Location</th>
            <th className="px-4 py-2 text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          {assets.map((asset) => {
            const isExpanded = expandedId === asset.id;
            const isServer = (asset.category || "").toLowerCase() === "server";
            const ips = asset.ips?.map((ip) => ip.address).filter(Boolean) || [];
            const rackFace = asset.rackFace;
            const rackUnitStart = asset.rackUnitStart;
            const rackUnitSize = asset.rackUnitSize;
            const rackUnitEnd =
              rackUnitStart && rackUnitSize ? rackUnitStart + rackUnitSize - 1 : null;
            const rackUText = asset.rack
              ? rackUnitStart && rackUnitSize
                ? `U${rackUnitStart}-U${rackUnitEnd}`
                : "Unplaced"
              : "—";
            const rackFaceText = asset.rack ? (rackFace || "FRONT") : "—";

            return (
              <Fragment key={asset.id}>
                <tr
                  className="bg-[#1a1f2e] hover:bg-[#22293d] transition-colors group cursor-pointer"
                  onClick={() => setExpandedId((prev) => (prev === asset.id ? null : asset.id))}
                >
                  <td className="px-4 py-4 rounded-l-xl border-y border-l border-slate-800">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-blue-500/10 rounded-lg text-blue-400">
                        <Server size={18} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-3">
                          <div className="font-medium text-white truncate">{asset.name}</div>
                          <button
                            type="button"
                            className="p-1 rounded-md hover:bg-slate-800 text-slate-500"
                            aria-label={isExpanded ? "Collapse details" : "Expand details"}
                            aria-expanded={isExpanded}
                            onClick={(e) => {
                              e.stopPropagation();
                              setExpandedId((prev) => (prev === asset.id ? null : asset.id));
                            }}
                          >
                            <ChevronDown
                              size={16}
                              className={`transition-transform ${isExpanded ? "rotate-180" : ""}`}
                            />
                          </button>
                        </div>
                        <div className="text-xs text-slate-500">{asset.serialNumber}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-4 border-y border-slate-800">
                    <span className="text-sm text-slate-400">{asset.category}</span>
                  </td>
                  <td className="px-4 py-4 border-y border-slate-800">
                    <span className={`px-2 py-1 rounded-md text-[10px] font-bold uppercase ${
                      asset.status === 'ACTIVE' ? 'bg-emerald-500/10 text-emerald-500' :
                      asset.status === 'MAINTENANCE' ? 'bg-amber-500/10 text-amber-500' : 'bg-slate-800 text-slate-400'
                    }`}>
                      {asset.status}
                    </span>
                  </td>
                  <td className="px-4 py-4 border-y border-slate-800">
                    <div className="text-sm text-slate-300">{asset.location?.name || 'Unassigned'}</div>
                    <div className="text-xs text-slate-500">{asset.rack?.name}</div>
                  </td>
                  <td className="px-4 py-4 rounded-r-xl border-y border-r border-slate-800 text-right">
                    <div className="relative inline-block">
                      <button
                        className="p-2 hover:bg-slate-700 rounded-lg text-slate-400 disabled:opacity-40"
                        disabled={!canManage}
                        onClick={(e) => {
                          e.stopPropagation();
                          setOpenRowId((prev) => (prev === asset.id ? null : asset.id));
                        }}
                      >
                        <MoreHorizontal size={18} />
                      </button>

                      {openRowId === asset.id ? (
                        <div
                          className="absolute right-0 mt-2 w-36 rounded-xl border border-slate-800 bg-[#151921] shadow-2xl overflow-hidden z-20"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            className="w-full text-left px-3 py-2 text-sm text-slate-200 hover:bg-slate-800"
                            onClick={() => {
                              setOpenRowId(null);
                              onEdit?.(asset);
                            }}
                          >
                            Edit / Update
                          </button>
                          <button
                            className="w-full text-left px-3 py-2 text-sm text-red-400 hover:bg-slate-800"
                            onClick={() => {
                              setOpenRowId(null);
                              onDelete?.(asset);
                            }}
                          >
                            Delete
                          </button>
                        </div>
                      ) : null}
                    </div>
                  </td>
                </tr>

                {isExpanded ? (
                  <tr className="bg-transparent">
                    <td colSpan={5} className="px-4 pb-3">
                      <div
                        className="rounded-xl border border-slate-800 bg-[#151921] p-4"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div className="space-y-3">
                            {title("Asset Details")}
                            <div className="grid grid-cols-1 gap-3">
                              {item("Name", <span className="text-slate-100">{fmt(asset.name)}</span>)}
                              {item("Serial Number", <span className="text-slate-100">{fmt(asset.serialNumber)}</span>)}
                              {item("Category", fmt(asset.category))}
                              {item("Status", fmt(asset.status))}
                            </div>
                          </div>

                          <div className="space-y-3">
                            {title("Placement")}
                            <div className="grid grid-cols-1 gap-3">
                              {item("Location Type", fmt(asset.location?.type))}
                              {item("Site", fmt(asset.location?.name))}
                              {item("Rack", fmt(asset.rack?.name))}
                              {item("Rack Face", fmt(rackFaceText))}
                              {item("Rack U", fmt(rackUText))}
                              {item("Updated", fmt(asset.updatedAt ? new Date(asset.updatedAt).toLocaleString() : null))}
                            </div>
                          </div>

                          <div className="space-y-3">
                            {title("Network")}
                            <div className="grid grid-cols-1 gap-3">
                              {item(
                                "IP Addresses",
                                ips.length ? (
                                  <div className="flex flex-wrap gap-2">
                                    {ips.map((v) => (
                                      <span
                                        key={v}
                                        className="px-2 py-1 rounded-md text-[11px] bg-slate-800 text-slate-200 border border-slate-700"
                                      >
                                        {v}
                                      </span>
                                    ))}
                                  </div>
                                ) : (
                                  <span className="text-slate-400">—</span>
                                )
                              )}
                              {item("Created", fmt(asset.createdAt ? new Date(asset.createdAt).toLocaleString() : null))}
                            </div>
                          </div>
                        </div>

                        {isServer ? (
                          <div className="mt-5 border-t border-slate-800 pt-5 space-y-4">
                            {title("Server Specs")}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                              <div className="space-y-3">
                                <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">CPU</div>
                                <div className="grid grid-cols-1 gap-3">
                                  {item("Server Type", fmt(asset.serverType))}
                                  {item("CPU Type", fmt(asset.cpuType))}
                                  {item("CPU Socket Number", fmt(asset.cpuSocketNumber))}
                                  {item("CPU Core", fmt(asset.cpuCore))}
                                </div>
                              </div>

                              <div className="space-y-3">
                                <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Memory</div>
                                <div className="grid grid-cols-1 gap-3">
                                  {item("Memory Type", fmt(asset.memoryType))}
                                  {item("Memory Size (GB)", fmt(asset.memorySize))}
                                  {item("Memory Slot Used", fmt(asset.memorySlotUsed))}
                                  {item("Memory Speed (MHz)", fmt(asset.memorySpeed))}
                                </div>
                              </div>

                              <div className="space-y-3">
                                <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Disk</div>
                                <div className="grid grid-cols-1 gap-3">
                                  {item("Disk OS Type", fmt(asset.diskOsType))}
                                  {item("Disk OS Number", fmt(asset.diskOsNumber))}
                                  {item("Disk OS Size (GB)", fmt(asset.diskOsSize))}
                                  {item("Disk Data Type", fmt(asset.diskDataType))}
                                  {item("Disk Data Number", fmt(asset.diskDataNumber))}
                                  {item("Disk Data Size (GB)", fmt(asset.diskDataSize))}
                                </div>
                              </div>
                            </div>
                          </div>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ) : null}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};
