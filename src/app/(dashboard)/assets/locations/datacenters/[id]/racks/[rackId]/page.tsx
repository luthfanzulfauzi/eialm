"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, Box, Layers, Loader2, Plus, Save, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/Modal";
import { ASSET_SERIAL_NUMBER_NOT_AVAILABLE, formatAssetSerialNumber } from "@/lib/utils";
import { useRole } from "@/hooks/useRole";

type RackFace = "FRONT" | "BACK" | "BOTH";

type RackAsset = {
  id: string;
  name: string;
  serialNumber: string;
  category: string;
  status: string;
  rackId: string | null;
  rackUnitStart: number | null;
  rackUnitSize: number | null;
  rackFace: RackFace | null;
  rack?: { id: string; name: string } | null;
  location?: { id: string; name: string; type: "DATACENTER" | "WAREHOUSE" } | null;
  ips?: Array<{ id: string; address: string; isPublic: boolean }>;
};

type RackDetailsResponse = {
  rack: {
    id: string;
    name: string;
    locationId: string;
    totalUnits: number;
    assets: RackAsset[];
  };
  assetsAtLocation: RackAsset[];
  utilization: {
    totalUnits: number;
    frontUsedUnits: number;
    frontFreeUnits: number;
    frontPercentUsed: number;
    backUsedUnits: number;
    backFreeUnits: number;
    backPercentUsed: number;
    combinedUsedUnits: number;
    combinedFreeUnits: number;
    combinedPercentUsed: number;
    issues: Array<{ type: "OVERLAP" | "OUT_OF_BOUNDS"; assetId: string; message: string }>;
  };
};

const unitPx = 20;
const hiddenRackIssueStorageKey = (rackId: string) => `rack-layout-hidden-issues:${rackId}`;

const clampU = (u: number, totalUnits: number) => Math.max(1, Math.min(u, totalUnits));

const faceLabel = (f: RackFace) => {
  if (f === "FRONT") return "Front";
  if (f === "BACK") return "Back";
  return "Both";
};

const rackAssetSecondaryLabel = (serialNumber: string, ip?: string | null) =>
  ip ? `IP: ${ip}` : formatAssetSerialNumber(serialNumber);

const rackGridBackground =
  "repeating-linear-gradient(to bottom, rgba(255,255,255,0.24) 0px, rgba(255,255,255,0.24) 2px, transparent 2px, transparent 20px)";

const getRackAssetCardLayout = (rawHeight: number) => {
  const cardHeight = Math.max(rawHeight - 2, unitPx - 2);
  const compact = cardHeight <= 24;

  return {
    cardHeight,
    compact,
    padding: compact
      ? "0 10px"
      : `${Math.max(3, Math.min(8, Math.floor(cardHeight * 0.14)))}px 12px`,
    contentClassName: compact ? "flex h-full items-center gap-2" : "flex h-full flex-col justify-center",
    contentStyle: compact
      ? undefined
      : { gap: `${Math.max(1, Math.min(4, Math.floor(cardHeight * 0.06)))}px` },
    titleStyle: {
      fontSize: `${compact ? 14 : Math.max(12, Math.min(16, Math.floor(cardHeight * 0.32)))}px`,
      lineHeight: compact ? "1" : "1.1",
    },
    secondaryStyle: {
      fontSize: `${compact ? 11 : Math.max(10, Math.min(12, Math.floor(cardHeight * 0.24)))}px`,
      lineHeight: compact ? "1" : "1.1",
    },
  };
};

const isAssetInFace = (asset: RackAsset, face: "FRONT" | "BACK") => {
  const f = asset.rackFace ?? "FRONT";
  if (face === "FRONT") return f === "FRONT" || f === "BOTH";
  return f === "BACK" || f === "BOTH";
};

export default function RackLayoutDesignerPage() {
  const params = useParams<{ id: string; rackId: string }>();
  const datacenterId = params.id;
  const rackId = params.rackId;
  const { isViewer } = useRole();
  const canManage = !isViewer;

  const [data, setData] = useState<RackDetailsResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const [viewMode, setViewMode] = useState<"FRONT" | "BACK" | "BOTH">("BOTH");
  const [assetSearch, setAssetSearch] = useState("");
  const [assetScope, setAssetScope] = useState<"THIS_RACK" | "OTHER_RACKS" | "ALL">("THIS_RACK");
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);
  const [placementStart, setPlacementStart] = useState<number>(1);
  const [placementSize, setPlacementSize] = useState<number>(1);
  const [placementFace, setPlacementFace] = useState<RackFace>("FRONT");

  const [rackUnitsDraft, setRackUnitsDraft] = useState<number>(42);
  const [savingRackUnits, setSavingRackUnits] = useState(false);

  const [showConfirmRemove, setShowConfirmRemove] = useState(false);
  const [showQuickPlace, setShowQuickPlace] = useState(false);
  const [quickPlaceSearch, setQuickPlaceSearch] = useState("");
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [quickAddSubmitting, setQuickAddSubmitting] = useState(false);
  const [quickAddError, setQuickAddError] = useState<string | null>(null);
  const [quickAddName, setQuickAddName] = useState("");
  const [quickAddSerialNumber, setQuickAddSerialNumber] = useState("");
  const [quickAddSerialNotAvailable, setQuickAddSerialNotAvailable] = useState(false);
  const [quickAddCategory, setQuickAddCategory] = useState("Network Device");
  const [quickAddStatus, setQuickAddStatus] = useState("ACTIVE");
  const [dragHover, setDragHover] = useState<{ face: "FRONT" | "BACK"; u: number } | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [hiddenIssueMessages, setHiddenIssueMessages] = useState<string[]>([]);

  const selectedAsset = useMemo(() => {
    if (!data || !selectedAssetId) return null;
    return data.assetsAtLocation.find((a) => a.id === selectedAssetId) || null;
  }, [data, selectedAssetId]);

  const placedAssets = useMemo(() => {
    const items =
      (data?.rack.assets || [])
        .filter((a) => a.rackUnitStart && a.rackUnitSize)
        .map((a) => {
          const start = a.rackUnitStart as number;
          const size = a.rackUnitSize as number;
          return { ...a, start, size, end: start + size - 1 };
        }) || [];

    return items;
  }, [data]);

  const visibleIssues = useMemo(() => {
    const issues = data?.utilization.issues || [];
    if (hiddenIssueMessages.length === 0) return issues;
    return issues.filter((issue) => !hiddenIssueMessages.includes(issue.message));
  }, [data, hiddenIssueMessages]);

  const hiddenIssueCount = Math.max((data?.utilization.issues.length || 0) - visibleIssues.length, 0);

  const fetchRack = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/racks/${rackId}`);
    const json = (await res.json()) as RackDetailsResponse;
    setData(json);
    setRackUnitsDraft(json?.rack?.totalUnits ?? 42);
    setLoading(false);
  }, [rackId]);

  useEffect(() => {
    fetchRack();
  }, [fetchRack]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(hiddenRackIssueStorageKey(rackId));
      if (!raw) {
        setHiddenIssueMessages([]);
        return;
      }
      const parsed = JSON.parse(raw);
      setHiddenIssueMessages(Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === "string") : []);
    } catch {
      setHiddenIssueMessages([]);
    }
  }, [rackId]);

  useEffect(() => {
    if (!data || !selectedAssetId) return;
    const a = data.assetsAtLocation.find((x) => x.id === selectedAssetId);
    if (!a) return;
    setPlacementStart(a.rackUnitStart ?? 1);
    setPlacementSize(a.rackUnitSize ?? 1);
    setPlacementFace((a.rackFace ?? "FRONT") as RackFace);
  }, [data, selectedAssetId]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(
      hiddenRackIssueStorageKey(rackId),
      JSON.stringify(hiddenIssueMessages)
    );
  }, [hiddenIssueMessages, rackId]);

  const filteredAssets = useMemo(() => {
    if (!data) return [];
    const q = assetSearch.trim().toLowerCase();
    return data.assetsAtLocation.filter((a) => {
      if (assetScope === "THIS_RACK" && a.rackId !== rackId) return false;
      if (assetScope === "OTHER_RACKS" && (!a.rackId || a.rackId === rackId)) return false;
      if (!q) return true;
      return (
        a.name.toLowerCase().includes(q) ||
        a.serialNumber.toLowerCase().includes(q) ||
        a.category.toLowerCase().includes(q) ||
        (a.location?.name || "").toLowerCase().includes(q) ||
        (a.rack?.name || "").toLowerCase().includes(q)
      );
    });
  }, [data, assetSearch, assetScope, rackId]);

  const quickFilteredAssets = useMemo(() => {
    if (!data) return [];
    const q = quickPlaceSearch.trim().toLowerCase();
    return data.assetsAtLocation.filter((a) => {
      if (a.rackId && a.rackId !== rackId) return false;
      if (!q) return true;
      return (
        a.name.toLowerCase().includes(q) ||
        a.serialNumber.toLowerCase().includes(q) ||
        a.category.toLowerCase().includes(q) ||
        (a.location?.name || "").toLowerCase().includes(q)
      );
    });
  }, [data, quickPlaceSearch, rackId]);

  const placementLabel = (asset: RackAsset) => {
    if (asset.rackId === rackId) return "Installed in this rack";
    if (asset.rack?.name) return `Installed in ${asset.rack.name}`;
    if (asset.location?.type === "WAREHOUSE") return `Stored in ${asset.location.name}`;
    if (asset.location?.type === "DATACENTER") return `Staged at ${asset.location.name}`;
    return "Unassigned";
  };

  const hideIssue = (message: string) => {
    setHiddenIssueMessages((current) => (current.includes(message) ? current : [...current, message]));
  };

  const restoreHiddenIssues = () => {
    setHiddenIssueMessages([]);
  };

  const hideAllVisibleIssues = () => {
    if (visibleIssues.length === 0) return;
    setHiddenIssueMessages((current) => {
      const next = new Set(current);
      visibleIssues.forEach((issue) => next.add(issue.message));
      return Array.from(next);
    });
  };

  const resetQuickAddForm = () => {
    setShowQuickAdd(false);
    setQuickAddSubmitting(false);
    setQuickAddError(null);
    setQuickAddName("");
    setQuickAddSerialNumber("");
    setQuickAddSerialNotAvailable(false);
    setQuickAddCategory("Network Device");
    setQuickAddStatus("ACTIVE");
  };

  const assignAsset = async (params: { assetId: string; startU: number; sizeU: number; face: RackFace }) => {
    if (!canManage) return;
    setActionError(null);
    const res = await fetch(`/api/racks/${rackId}/assign`, {
      method: "POST",
      body: JSON.stringify({
        assetId: params.assetId,
        rackUnitStart: params.startU,
        rackUnitSize: params.sizeU,
        rackFace: params.face,
      }),
    });
    if (!res.ok) {
      const payload = await res.json().catch(() => ({} as any));
      const message = payload?.error || "Failed to assign asset to rack";
      setActionError(message);
      throw new Error(message);
    }
  };

  const handleAssign = async () => {
    if (!selectedAssetId) return;
    if (!canManage) return;
    try {
      await assignAsset({
        assetId: selectedAssetId,
        startU: placementStart,
        sizeU: placementSize,
        face: placementFace,
      });
      await fetchRack();
    } catch {}
  };

  const handleRemove = async () => {
    if (!selectedAssetId) return;
    if (!canManage) return;
    setActionError(null);
    const res = await fetch(`/api/racks/${rackId}/assign`, {
      method: "POST",
      body: JSON.stringify({
        assetId: selectedAssetId,
        removeFromRack: true,
      }),
    });
    if (!res.ok) {
      const payload = await res.json().catch(() => ({} as any));
      setActionError(payload?.error || "Failed to remove asset from rack");
      return;
    }
    setShowConfirmRemove(false);
    await fetchRack();
  };

  const handleSaveRackUnits = async () => {
    if (!canManage) return;
    setSavingRackUnits(true);
    setActionError(null);
    const res = await fetch(`/api/racks/${rackId}`, {
      method: "PATCH",
      body: JSON.stringify({ totalUnits: rackUnitsDraft }),
    });
    if (!res.ok) {
      const payload = await res.json().catch(() => ({} as any));
      setActionError(payload?.error || "Failed to update rack height");
    } else {
      await fetchRack();
    }
    setSavingRackUnits(false);
  };

  const computeUFromEvent = (e: { clientY: number }, rectTop: number, totalUnits: number) => {
    const y = e.clientY - rectTop;
    const clickedU = totalUnits - Math.floor(y / unitPx);
    return clampU(clickedU, totalUnits);
  };

  const handleRackClick = (face: "FRONT" | "BACK", e: React.MouseEvent<HTMLDivElement>) => {
    if (!data) return;
    if (!canManage) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const clickedU = computeUFromEvent(e, rect.top, data.rack.totalUnits);
    setPlacementStart(clickedU);
    setPlacementFace(face);
    setQuickPlaceSearch("");
    setShowQuickPlace(true);
  };

  const handleDragStart = (asset: RackAsset) => {
    setSelectedAssetId(asset.id);
    setPlacementSize(asset.rackUnitSize ?? 1);
    setPlacementFace((asset.rackFace ?? placementFace) as RackFace);
  };

  const handleDragOver = (face: "FRONT" | "BACK", e: React.DragEvent<HTMLDivElement>) => {
    if (!data) return;
    if (!canManage) return;
    e.preventDefault();
    const rect = e.currentTarget.getBoundingClientRect();
    const u = computeUFromEvent(e, rect.top, data.rack.totalUnits);
    setDragHover({ face, u });
  };

  const handleDrop = async (face: "FRONT" | "BACK", e: React.DragEvent<HTMLDivElement>) => {
    if (!data) return;
    if (!canManage) return;
    e.preventDefault();
    const assetId = e.dataTransfer.getData("text/plain");
    if (!assetId) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const startU = computeUFromEvent(e, rect.top, data.rack.totalUnits);
    const asset = data.assetsAtLocation.find((a) => a.id === assetId);
    const sizeU = asset?.rackUnitSize ?? placementSize ?? 1;

    setSelectedAssetId(assetId);
    setPlacementStart(startU);
    setPlacementSize(sizeU);
    setPlacementFace(face);

    try {
      await assignAsset({
        assetId,
        startU,
        sizeU,
        face,
      });
      setDragHover(null);
      await fetchRack();
    } catch {
      setDragHover(null);
    }
  };

  const handleDragLeave = () => {
    setDragHover(null);
  };

  const header = (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-3">
        <Link
          href={`/assets/locations/datacenters/${datacenterId}/racks`}
          className="text-slate-400 hover:text-white inline-flex items-center gap-2"
        >
          <ArrowLeft size={16} /> Back
        </Link>
        <h1 className="text-2xl font-bold text-white flex items-center gap-3">
          <Layers className="text-blue-400" /> Rack Layout Designer
        </h1>
      </div>
    </div>
  );

  if (loading || !data) {
    return (
      <div className="space-y-6">
        {header}
        <div className="flex items-center gap-2 text-slate-400">
          <Loader2 className="animate-spin" size={18} /> Loading rack...
        </div>
      </div>
    );
  }

  const utilization = data.utilization;

  return (
    <div className="space-y-6">
      {header}

      <div className="bg-[#111620] border border-slate-800 rounded-2xl p-5">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="space-y-1">
            <div className="text-white font-bold flex items-center gap-2">
              <Box className="text-blue-400" size={18} /> {data.rack.name}
            </div>
            <div className="text-slate-400 text-sm">
              Space Utilization: {utilization.combinedUsedUnits}U used / {utilization.totalUnits}U total ({utilization.combinedPercentUsed}%)
            </div>
            <div className="text-slate-500 text-xs">
              Front: {utilization.frontUsedUnits}U • Back: {utilization.backUsedUnits}U
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="w-56 h-2 rounded-full bg-slate-800 overflow-hidden">
              <div
                className="h-2 bg-blue-600"
                style={{ width: `${Math.min(100, Math.max(0, utilization.combinedPercentUsed))}%` }}
              />
            </div>
            <div className="text-slate-400 text-sm">{utilization.combinedFreeUnits}U free</div>
          </div>
        </div>

        {visibleIssues.length > 0 && (
          <div className="mt-4 rounded-xl border border-amber-900/50 bg-amber-950/20 p-3 text-sm text-amber-300">
            <div className="mb-2 flex items-center justify-between gap-3">
              <div className="text-xs font-semibold uppercase tracking-[0.16em] text-amber-200/80">
                Placement warnings
              </div>
              <button
                type="button"
                onClick={hideAllVisibleIssues}
                className="text-xs font-medium text-amber-200 transition hover:text-white"
              >
                Hide all
              </button>
            </div>
            <div className="space-y-2">
              {visibleIssues.map((i, idx) => (
                <div key={`${i.assetId}-${idx}`} className="flex items-start justify-between gap-3">
                  <div>{i.message}</div>
                  <button
                    type="button"
                    onClick={() => hideIssue(i.message)}
                    className="mt-0.5 inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-amber-200 transition hover:bg-amber-400/10 hover:text-white"
                    aria-label={`Hide warning: ${i.message}`}
                  >
                    <X size={12} />
                    Hide
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {hiddenIssueCount > 0 && (
          <div className="mt-3 flex items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-900/40 px-3 py-2 text-xs text-slate-400">
            <div>
              {hiddenIssueCount} placement warning{hiddenIssueCount === 1 ? "" : "s"} hidden for this rack.
            </div>
            <button
              type="button"
              onClick={restoreHiddenIssues}
              className="font-medium text-slate-300 transition hover:text-white"
            >
              Show hidden warnings
            </button>
          </div>
        )}

        {actionError && (
          <div className="mt-4 rounded-xl border border-red-900/50 bg-red-950/20 p-3 text-sm text-red-300">
            {actionError}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(280px,0.8fr)_minmax(0,1.9fr)]">
        <div className="space-y-4">
          <div className="bg-[#111620] border border-slate-800 rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="text-white font-bold">Asset Inventory</div>
              <div className="text-slate-400 text-sm">{filteredAssets.length} items</div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {[
                ["THIS_RACK", "This Rack"],
                ["OTHER_RACKS", "Other Rack"],
                ["ALL", "All"],
              ].map(([scope, label]) => (
                <Button
                  key={scope}
                  type="button"
                  size="sm"
                  variant={assetScope === scope ? "primary" : "outline"}
                  onClick={() => setAssetScope(scope as typeof assetScope)}
                >
                  {label}
                </Button>
              ))}
            </div>

            <Input
              value={assetSearch}
              onChange={(e) => setAssetSearch(e.target.value)}
              placeholder="Search assets..."
            />

            <div className="max-h-[520px] overflow-auto space-y-2 pr-1">
              {filteredAssets.map((a) => {
                const isSelected = a.id === selectedAssetId;
                const isInThisRack = a.rackId === rackId;
                const placement =
                  a.rackUnitStart && a.rackUnitSize
                    ? `U${a.rackUnitStart}-U${a.rackUnitStart + a.rackUnitSize - 1}`
                    : "Unplaced";
                const face = a.rackFace ?? "FRONT";

                return (
                  <button
                    key={a.id}
                    onClick={() => setSelectedAssetId(a.id)}
                    draggable={canManage}
                    onDragStart={(e) => {
                      if (!canManage) return;
                      e.dataTransfer.setData("text/plain", a.id);
                      e.dataTransfer.effectAllowed = "move";
                      handleDragStart(a);
                    }}
                    className={[
                      "w-full text-left rounded-xl border p-3 transition-all",
                      isSelected ? "border-blue-500 bg-blue-500/10" : "border-slate-800 bg-[#0f1218] hover:bg-slate-900/40",
                    ].join(" ")}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-white font-bold text-sm">{a.name}</div>
                        <div className="text-slate-500 text-xs">{formatAssetSerialNumber(a.serialNumber)}</div>
                        <div className="text-slate-400 text-xs mt-1">
                          {a.category} •{" "}
                          {isInThisRack
                            ? `In this rack • ${placement} • ${faceLabel(face as RackFace)}`
                            : a.rack?.name
                              ? `In ${a.rack.name}`
                              : placementLabel(a)}
                        </div>
                        {!a.rackId && a.location?.id !== data.rack.locationId ? (
                          <div className="mt-2 text-[11px] text-amber-300">
                            Will move from {a.location?.name || "unassigned"} into this datacenter when placed.
                          </div>
                        ) : null}
                      </div>
                      {isSelected && (
                        <div className="text-blue-400 text-xs font-bold">Selected</div>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="bg-[#111620] border border-slate-800 rounded-2xl p-5 space-y-4">
            <div className="text-white font-bold">Placement</div>

            <div className="grid grid-cols-3 gap-2">
              {(["FRONT", "BACK", "BOTH"] as RackFace[]).map((f) => (
                <Button
                  key={f}
                  type="button"
                  variant={placementFace === f ? "primary" : "outline"}
                  onClick={() => setPlacementFace(f)}
                >
                  {faceLabel(f)}
                </Button>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <div className="text-slate-400 text-xs">Start U (bottom)</div>
                <Input
                  type="number"
                  min={1}
                  max={data.rack.totalUnits}
                  value={placementStart}
                  onChange={(e) => setPlacementStart(Number(e.target.value))}
                />
              </div>
              <div className="space-y-1">
                <div className="text-slate-400 text-xs">Height (U)</div>
                <Input
                  type="number"
                  min={1}
                  max={data.rack.totalUnits}
                  value={placementSize}
                  onChange={(e) => setPlacementSize(Number(e.target.value))}
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button
                onClick={handleAssign}
                disabled={!canManage || !selectedAssetId}
                className="flex-1"
              >
                <Save size={16} className="mr-2" /> Assign to Rack
              </Button>
              <Button
                variant="danger"
                onClick={() => setShowConfirmRemove(true)}
                disabled={!canManage || !selectedAssetId}
              >
                <Trash2 size={16} />
              </Button>
            </div>

            <div className="text-slate-500 text-xs">
              Tip: drag an asset into the rack, or click a U to start placing.
            </div>
          </div>

          <div className="bg-[#111620] border border-slate-800 rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="text-white font-bold">Rack Height</div>
              <div className="text-slate-400 text-sm">{data.rack.totalUnits}U</div>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                onClick={() => setRackUnitsDraft((v) => Math.max(1, v - 1))}
              >
                -
              </Button>
              <Input
                type="number"
                min={1}
                value={rackUnitsDraft}
                onChange={(e) => setRackUnitsDraft(Number(e.target.value))}
              />
              <Button
                variant="outline"
                onClick={() => setRackUnitsDraft((v) => v + 1)}
              >
                +
              </Button>
            </div>

            <div className="flex items-center gap-2">
              <Button
                onClick={handleSaveRackUnits}
                disabled={!canManage || savingRackUnits}
                className="flex-1"
              >
                {savingRackUnits ? (
                  <>
                    <Loader2 className="animate-spin mr-2" size={16} /> Saving...
                  </>
                ) : (
                  <>
                    <Plus className="mr-2" size={16} /> Update Rack U
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>

        <div className="min-w-0">
          <div className="bg-[#111620] border border-slate-800 rounded-2xl p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="text-white font-bold">Rack Elevation</div>
              <div className="flex items-center gap-2">
                {(["FRONT", "BACK", "BOTH"] as const).map((m) => (
                  <Button
                    key={m}
                    type="button"
                    variant={viewMode === m ? "primary" : "outline"}
                    size="sm"
                    onClick={() => setViewMode(m)}
                  >
                    {m === "FRONT" ? "Front" : m === "BACK" ? "Back" : "Both"}
                  </Button>
                ))}
              </div>
            </div>

            <div className="flex gap-4">
              <div className={["w-12 text-slate-400 text-sm font-semibold select-none", viewMode === "BOTH" ? "pt-6" : ""].join(" ")}>
                <div style={{ height: data.rack.totalUnits * unitPx }} className="relative">
                  {Array.from({ length: data.rack.totalUnits }).map((_, idx) => {
                    const u = data.rack.totalUnits - idx;
                    return (
                      <button
                        key={u}
                        type="button"
                        className="w-full flex items-center justify-end pr-2 text-slate-400 transition-colors hover:text-white"
                        style={{ height: unitPx }}
                        onClick={() => {
                          setPlacementStart(u);
                          setQuickPlaceSearch("");
                          setShowQuickPlace(true);
                        }}
                      >
                        {u.toString().padStart(2, "0")}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="flex-1 overflow-auto">
                {viewMode !== "BOTH" ? (
                  <div
                    className="relative rounded-2xl border border-slate-700 bg-[#0f1218] shadow-[inset_0_1px_0_rgba(148,163,184,0.06)]"
                    style={{
                      height: data.rack.totalUnits * unitPx,
                      backgroundImage: rackGridBackground,
                    }}
                    onClick={(e) => handleRackClick(viewMode, e)}
                    onDragOver={(e) => handleDragOver(viewMode, e)}
                    onDragLeave={handleDragLeave}
                    onDrop={(e) => handleDrop(viewMode, e)}
                  >
                    {dragHover && dragHover.face === viewMode && (
                      <div
                        className="absolute left-0 right-0 h-[2px] bg-blue-500"
                        style={{ top: (data.rack.totalUnits - dragHover.u) * unitPx }}
                      />
                    )}

                    {placedAssets
                      .filter((a) => isAssetInFace(a as any, viewMode))
                      .map((a) => {
                        const top = (data.rack.totalUnits - (a as any).end) * unitPx;
                        const height = (a as any).size * unitPx;
                        const ip = ((a as any).ips || []).find((x: any) => !x.isPublic)?.address;
                        const aFace = ((a as any).rackFace ?? "FRONT") as RackFace;
                        const layout = getRackAssetCardLayout(height);

                        return (
                          <button
                            key={(a as any).id}
                            draggable
                            onDragStart={(e) => {
                              e.dataTransfer.setData("text/plain", (a as any).id);
                              e.dataTransfer.effectAllowed = "move";
                              setSelectedAssetId((a as any).id);
                              setPlacementSize((a as any).rackUnitSize ?? 1);
                              setPlacementFace(aFace);
                            }}
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedAssetId((a as any).id);
                              setPlacementFace(aFace);
                            }}
                            className={[
                              "absolute left-2 right-2 overflow-hidden rounded-xl border text-left",
                              selectedAssetId === (a as any).id
                                ? "border-emerald-300 shadow-[0_0_0_1px_rgba(110,231,183,0.28)]"
                                : "border-emerald-400/45",
                            ].join(" ")}
                            style={{
                              top: top + 1,
                              height: layout.cardHeight,
                              padding: layout.padding,
                              backgroundColor:
                                selectedAssetId === (a as any).id
                                  ? "rgba(74, 222, 128, 0.26)"
                                  : "rgba(74, 222, 128, 0.18)",
                            }}
                          >
                            <div className={layout.contentClassName} style={layout.contentStyle}>
                              <div className="truncate font-bold text-white" style={layout.titleStyle}>
                                {(a as any).name}
                              </div>
                              {layout.compact ? (
                                  <div className="truncate text-emerald-100/80" style={layout.secondaryStyle}>
                                    U{(a as any).start}
                                  </div>
                                ) : (
                                  <div className="truncate text-emerald-100/80" style={layout.secondaryStyle}>
                                    {rackAssetSecondaryLabel((a as any).serialNumber, ip)} • U{(a as any).start}-U{(a as any).end} • {faceLabel(aFace)}
                                  </div>
                                )}
                            </div>
                          </button>
                        );
                      })}
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-4">
                    {(["FRONT", "BACK"] as const).map((face) => (
                      <div key={face} className="space-y-2 pt-6">
                        <div
                          className="relative rounded-2xl border border-slate-700 bg-[#0f1218] shadow-[inset_0_1px_0_rgba(148,163,184,0.06)]"
                          style={{
                            height: data.rack.totalUnits * unitPx,
                            backgroundImage: rackGridBackground,
                          }}
                          onClick={(e) => handleRackClick(face, e)}
                          onDragOver={(e) => handleDragOver(face, e)}
                          onDragLeave={handleDragLeave}
                          onDrop={(e) => handleDrop(face, e)}
                        >
                          <div className="pointer-events-none absolute left-4 top-[-22px] text-slate-300 text-sm font-bold tracking-wide">
                            {faceLabel(face)}
                          </div>
                          {dragHover && dragHover.face === face && (
                            <div
                              className="absolute left-0 right-0 h-[2px] bg-blue-500"
                              style={{ top: (data.rack.totalUnits - dragHover.u) * unitPx }}
                            />
                          )}

                          {placedAssets
                            .filter((a) => isAssetInFace(a as any, face))
                            .map((a) => {
                              const top = (data.rack.totalUnits - (a as any).end) * unitPx;
                              const height = (a as any).size * unitPx;
                              const ip = ((a as any).ips || []).find((x: any) => !x.isPublic)?.address;
                              const aFace = ((a as any).rackFace ?? "FRONT") as RackFace;
                              const layout = getRackAssetCardLayout(height);

                              return (
                                <button
                                  key={(a as any).id}
                                  draggable
                                  onDragStart={(e) => {
                                    e.dataTransfer.setData("text/plain", (a as any).id);
                                    e.dataTransfer.effectAllowed = "move";
                                    setSelectedAssetId((a as any).id);
                                    setPlacementSize((a as any).rackUnitSize ?? 1);
                                    setPlacementFace(aFace);
                                  }}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedAssetId((a as any).id);
                                    setPlacementFace(aFace);
                                  }}
                                  className={[
                                    "absolute left-2 right-2 overflow-hidden rounded-xl border text-left",
                                    selectedAssetId === (a as any).id
                                      ? "border-emerald-300 shadow-[0_0_0_1px_rgba(110,231,183,0.28)]"
                                      : "border-emerald-400/45",
                                  ].join(" ")}
                                  style={{
                                    top: top + 1,
                                    height: layout.cardHeight,
                                    padding: layout.padding,
                                    backgroundColor:
                                      selectedAssetId === (a as any).id
                                        ? "rgba(74, 222, 128, 0.26)"
                                        : "rgba(74, 222, 128, 0.18)",
                                  }}
                                >
                                  <div className={layout.contentClassName} style={layout.contentStyle}>
                                    <div className="truncate font-bold text-white" style={layout.titleStyle}>
                                      {(a as any).name}
                                    </div>
                                    {layout.compact ? (
                                      <div className="truncate text-emerald-100/80" style={layout.secondaryStyle}>
                                        U{(a as any).start}
                                      </div>
                                    ) : (
                                      <div className="truncate text-emerald-100/80" style={layout.secondaryStyle}>
                                        {rackAssetSecondaryLabel((a as any).serialNumber, ip)} • U{(a as any).start}-U{(a as any).end} • {faceLabel(aFace)}
                                      </div>
                                    )}
                                  </div>
                                </button>
                              );
                            })}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="mt-4 text-slate-500 text-xs">
              U numbering uses the standard convention: U1 is at the bottom.
            </div>
          </div>
        </div>
      </div>

      <Modal
        isOpen={showConfirmRemove}
        onClose={() => setShowConfirmRemove(false)}
        title="Remove Asset From Rack"
      >
        <div className="py-4 space-y-4">
          <div className="text-slate-300 text-sm">
            Remove <span className="text-white font-bold">{selectedAsset?.name || "this asset"}</span> from the rack?
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => setShowConfirmRemove(false)} className="flex-1">
              Cancel
            </Button>
            <Button variant="danger" onClick={handleRemove} className="flex-1">
              Remove
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={showQuickPlace}
        onClose={() => {
          setShowQuickPlace(false);
          resetQuickAddForm();
        }}
        title={`Place Asset at U${placementStart}`}
      >
        <div className="py-4 space-y-4">
          <div className="grid grid-cols-3 gap-2">
            {(["FRONT", "BACK", "BOTH"] as RackFace[]).map((f) => (
              <Button
                key={f}
                type="button"
                variant={placementFace === f ? "primary" : "outline"}
                onClick={() => setPlacementFace(f)}
              >
                {faceLabel(f)}
              </Button>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <div className="text-slate-400 text-xs">Start U (bottom)</div>
              <Input
                type="number"
                min={1}
                max={data.rack.totalUnits}
                value={placementStart}
                onChange={(e) => setPlacementStart(clampU(Number(e.target.value), data.rack.totalUnits))}
              />
            </div>
            <div className="space-y-1">
              <div className="text-slate-400 text-xs">Height (U)</div>
              <Input
                type="number"
                min={1}
                max={data.rack.totalUnits}
                value={placementSize}
                onChange={(e) => setPlacementSize(Number(e.target.value))}
              />
            </div>
          </div>

          <Input
            value={quickPlaceSearch}
            onChange={(e) => setQuickPlaceSearch(e.target.value)}
            placeholder="Search assets..."
          />

          <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-3 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-white">Quick Add Asset</div>
                <div className="text-xs text-slate-400">Create and place a new asset directly into this rack slot.</div>
              </div>
              <Button
                type="button"
                variant={showQuickAdd ? "outline" : "primary"}
                size="sm"
                onClick={() => {
                  setShowQuickAdd((current) => !current);
                  setQuickAddError(null);
                }}
              >
                {showQuickAdd ? "Hide Quick Add" : "Quick Add"}
              </Button>
            </div>

            {showQuickAdd && (
              <div className="space-y-3">
                {quickAddError && (
                  <div className="rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-200">
                    {quickAddError}
                  </div>
                )}

                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <div className="space-y-1">
                    <div className="text-xs text-slate-400">Asset Name</div>
                    <Input
                      value={quickAddName}
                      onChange={(e) => setQuickAddName(e.target.value)}
                      placeholder="e.g. Nexus 3064 (DCI-NSST-P02)"
                    />
                  </div>
                  <div className="space-y-1">
                    <div className="text-xs text-slate-400">Serial Number</div>
                    <Input
                      value={quickAddSerialNotAvailable ? ASSET_SERIAL_NUMBER_NOT_AVAILABLE : quickAddSerialNumber}
                      onChange={(e) => setQuickAddSerialNumber(e.target.value)}
                      placeholder="Serial Number"
                      disabled={quickAddSerialNotAvailable}
                    />
                    <label className="flex items-center gap-2 text-[11px] text-slate-400">
                      <input
                        type="checkbox"
                        checked={quickAddSerialNotAvailable}
                        onChange={(e) => {
                          const checked = e.target.checked;
                          setQuickAddSerialNotAvailable(checked);
                          if (!checked) setQuickAddSerialNumber("");
                        }}
                        className="h-3.5 w-3.5 rounded border border-slate-700 bg-slate-900 text-blue-500 focus:ring-blue-500"
                      />
                      Serial number unavailable
                    </label>
                  </div>
                  <div className="space-y-1">
                    <div className="text-xs text-slate-400">Category</div>
                    <select
                      value={quickAddCategory}
                      onChange={(e) => setQuickAddCategory(e.target.value)}
                      className="h-10 w-full rounded-lg border border-slate-800 bg-slate-900/50 px-3 text-sm text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50"
                    >
                      <option value="Server">Server</option>
                      <option value="Network Device">Network Device</option>
                      <option value="Cable">Cable</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <div className="text-xs text-slate-400">Status</div>
                    <select
                      value={quickAddStatus}
                      onChange={(e) => setQuickAddStatus(e.target.value)}
                      className="h-10 w-full rounded-lg border border-slate-800 bg-slate-900/50 px-3 text-sm text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50"
                    >
                      {["PLAN", "PURCHASED", "INSTALLING", "ACTIVE", "MAINTENANCE", "BROKEN"].map((status) => (
                        <option key={status} value={status}>
                          {status}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="flex justify-end">
                  <Button
                    type="button"
                    disabled={quickAddSubmitting}
                    onClick={async () => {
                      if (!quickAddName.trim()) {
                        setQuickAddError("Asset name is required.");
                        return;
                      }

                      const serialNumber = quickAddSerialNotAvailable
                        ? ASSET_SERIAL_NUMBER_NOT_AVAILABLE
                        : quickAddSerialNumber.trim();

                      if (!serialNumber) {
                        setQuickAddError("Serial number is required, or mark it as unavailable.");
                        return;
                      }

                      setQuickAddSubmitting(true);
                      setQuickAddError(null);
                      try {
                        const response = await fetch("/api/assets", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({
                            name: quickAddName.trim(),
                            serialNumber,
                            category: quickAddCategory,
                            status: quickAddStatus,
                            locationId: data.rack.locationId,
                            rackId: data.rack.id,
                            rackFace: placementFace,
                            rackUnitStart: placementStart,
                            rackUnitSize: placementSize,
                          }),
                        });

                        const payload = await response.json().catch(() => ({} as any));
                        if (!response.ok) {
                          setQuickAddError(payload?.error || "Failed to create asset.");
                          return;
                        }

                        setSelectedAssetId(payload.id ?? null);
                        setShowQuickPlace(false);
                        resetQuickAddForm();
                        await fetchRack();
                      } catch {
                        setQuickAddError("Failed to create asset.");
                      } finally {
                        setQuickAddSubmitting(false);
                      }
                    }}
                  >
                    {quickAddSubmitting ? (
                      <>
                        <Loader2 className="animate-spin mr-2" size={16} /> Creating...
                      </>
                    ) : (
                      <>
                        <Plus className="mr-2" size={16} /> Create and Place
                      </>
                    )}
                  </Button>
                </div>
              </div>
            )}
          </div>

          <div className="max-h-[420px] overflow-auto space-y-2 pr-1">
            {quickFilteredAssets.map((a) => {
              const isSelected = a.id === selectedAssetId;
              return (
                <button
                  key={a.id}
                  onClick={() => setSelectedAssetId(a.id)}
                  className={[
                    "w-full text-left rounded-xl border p-3 transition-all",
                    isSelected ? "border-blue-500 bg-blue-500/10" : "border-slate-800 bg-[#0f1218] hover:bg-slate-900/40",
                  ].join(" ")}
                >
                  <div className="text-white font-bold text-sm">{a.name}</div>
                  <div className="text-slate-500 text-xs">{formatAssetSerialNumber(a.serialNumber)}</div>
                  <div className="text-slate-400 text-xs mt-1">{a.category} • {placementLabel(a)}</div>
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setShowQuickPlace(false);
                resetQuickAddForm();
              }}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              onClick={async () => {
                if (!selectedAssetId) return;
                try {
                  await assignAsset({
                    assetId: selectedAssetId,
                    startU: placementStart,
                    sizeU: placementSize,
                    face: placementFace,
                  });
                  setShowQuickPlace(false);
                  await fetchRack();
                } catch {}
              }}
              disabled={!selectedAssetId}
              className="flex-1"
            >
              <Save size={16} className="mr-2" /> Place
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
