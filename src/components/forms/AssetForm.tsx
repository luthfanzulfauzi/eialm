"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { assetSchema, AssetFormValues } from "@/lib/validations/asset";
import { AssetStatus, LocationType } from "@prisma/client";
import { Loader2 } from "lucide-react";
import { useState, useMemo } from "react";

interface AssetFormProps {
  onSubmit: (data: AssetFormValues) => void;
  initialData?: Partial<AssetFormValues>;
  locations: { id: string, name: string, type: LocationType }[];
  racks: { id: string, name: string, locationId: string }[];
}

export const AssetForm = ({ onSubmit, initialData, locations, racks }: AssetFormProps) => {
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<AssetFormValues>({
    resolver: zodResolver(assetSchema),
    defaultValues: initialData || { status: 'PLAN' as AssetStatus },
  });

  const clearServerSpecs = () => {
    setValue("serverType", "");
    setValue("cpuType", "");
    setValue("cpuSocketNumber" as any, undefined);
    setValue("cpuCore" as any, undefined);
    setValue("memoryType", "");
    setValue("memorySize" as any, undefined);
    setValue("memorySlotUsed" as any, undefined);
    setValue("memorySpeed" as any, undefined);
    setValue("diskOsType", "");
    setValue("diskOsNumber" as any, undefined);
    setValue("diskOsSize" as any, undefined);
    setValue("diskDataType", "");
    setValue("diskDataNumber" as any, undefined);
    setValue("diskDataSize" as any, undefined);
  };

  // Watch fields for dependent logic
  const selectedType = watch("locationType" as any);
  const selectedLocationId = watch("locationId" as any);
  const selectedCategory = watch("category")?.toLowerCase();

  const normalizeLocationType = (v: unknown) =>
    typeof v === "string" ? v.trim().toUpperCase() : "";

  // Filter locations based on Type (Datacenter vs Warehouse)
  const availableLocations = useMemo(() => 
    locations.filter(loc => normalizeLocationType(loc.type) === normalizeLocationType(selectedType)),
    [locations, selectedType]
  );

  // Filter racks based on the selected Datacenter
  const availableRacks = useMemo(() => 
    racks.filter(rack => rack.locationId === selectedLocationId),
    [racks, selectedLocationId]
  );

  const isRackRequired =
    selectedType === "DATACENTER" &&
    ['server', 'network device', 'switch', 'router'].includes(selectedCategory || "");
  const isServer = selectedCategory === "server";
  const categoryReg = register("category");

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {/* 1. Basic Info Row */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-400 uppercase tracking-wider text-[10px]">Asset Name</label>
          <input 
            {...register("name")}
            className="w-full bg-[#0f1218] border border-slate-800 rounded-lg p-2.5 text-sm text-white focus:border-blue-500 outline-none transition-all"
            placeholder="e.g. GHOIB-Server"
          />
          {errors.name && <p className="text-[10px] text-red-500">{errors.name.message}</p>}
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-400 uppercase tracking-wider text-[10px]">Serial Number</label>
          <input 
            {...register("serialNumber")}
            className="w-full bg-[#0f1218] border border-slate-800 rounded-lg p-2.5 text-sm text-white focus:border-blue-500 outline-none transition-all"
            placeholder="GH0188XX"
          />
          {errors.serialNumber && <p className="text-[10px] text-red-500">{errors.serialNumber.message}</p>}
        </div>
      </div>

      {/* 2. Category & Status Row */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-400 uppercase tracking-wider text-[10px]">Category</label>
          <select 
            {...categoryReg}
            onChange={(e) => {
              categoryReg.onChange(e);
              if (e.target.value.toLowerCase() !== "server") clearServerSpecs();
            }}
            className="w-full bg-[#0f1218] border border-slate-800 rounded-lg p-2.5 text-sm text-white focus:border-blue-500 outline-none"
          >
            <option value="">Select Category</option>
            <option value="Server">Server</option>
            <option value="Network Device">Network Device</option>
            <option value="Cable">Cable</option>
            <option value="Other">Other</option>
          </select>
          {errors.category && <p className="text-[10px] text-red-500">{errors.category.message}</p>}
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-400 uppercase tracking-wider text-[10px]">Status</label>
          <select 
            {...register("status")}
            className="w-full bg-[#0f1218] border border-slate-800 rounded-lg p-2.5 text-sm text-white focus:border-blue-500 outline-none"
          >
            {['PLAN', 'PURCHASED', 'INSTALLING', 'ACTIVE', 'MAINTENANCE', 'BROKEN'].map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
      </div>

      {isServer && (
        <div className="border-t border-slate-800 pt-6 space-y-4">
          <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Server Specs</h4>

          <div className="space-y-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2 col-span-2">
                <label className="text-sm font-medium text-slate-400 uppercase tracking-wider text-[10px]">Server Type</label>
                <input
                  {...register("serverType")}
                  className="w-full bg-[#0f1218] border border-slate-800 rounded-lg p-2.5 text-sm text-white focus:border-blue-500 outline-none transition-all"
                  placeholder="e.g. Rackmount 1U"
                />
                {errors.serverType && <p className="text-[10px] text-red-500">{errors.serverType.message}</p>}
              </div>

              <div className="space-y-2 col-span-2">
                <label className="text-sm font-medium text-slate-400 uppercase tracking-wider text-[10px]">CPU Type</label>
                <input
                  {...register("cpuType")}
                  className="w-full bg-[#0f1218] border border-slate-800 rounded-lg p-2.5 text-sm text-white focus:border-blue-500 outline-none transition-all"
                  placeholder="e.g. Intel Xeon Silver 4314"
                />
                {errors.cpuType && <p className="text-[10px] text-red-500">{errors.cpuType.message}</p>}
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-400 uppercase tracking-wider text-[10px]">CPU Socket Number</label>
                <input
                  type="number"
                  inputMode="numeric"
                  {...register("cpuSocketNumber" as any)}
                  className="w-full bg-[#0f1218] border border-slate-800 rounded-lg p-2.5 text-sm text-white focus:border-blue-500 outline-none transition-all"
                  placeholder="e.g. 2"
                />
                {errors.cpuSocketNumber && <p className="text-[10px] text-red-500">{errors.cpuSocketNumber.message as any}</p>}
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-400 uppercase tracking-wider text-[10px]">CPU Core</label>
                <input
                  type="number"
                  inputMode="numeric"
                  {...register("cpuCore" as any)}
                  className="w-full bg-[#0f1218] border border-slate-800 rounded-lg p-2.5 text-sm text-white focus:border-blue-500 outline-none transition-all"
                  placeholder="e.g. 32"
                />
                {errors.cpuCore && <p className="text-[10px] text-red-500">{errors.cpuCore.message as any}</p>}
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-400 uppercase tracking-wider text-[10px]">Memory Type</label>
                <input
                  {...register("memoryType")}
                  className="w-full bg-[#0f1218] border border-slate-800 rounded-lg p-2.5 text-sm text-white focus:border-blue-500 outline-none transition-all"
                  placeholder="e.g. DDR4"
                />
                {errors.memoryType && <p className="text-[10px] text-red-500">{errors.memoryType.message}</p>}
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-400 uppercase tracking-wider text-[10px]">Memory Size (GB)</label>
                <input
                  type="number"
                  inputMode="numeric"
                  {...register("memorySize" as any)}
                  className="w-full bg-[#0f1218] border border-slate-800 rounded-lg p-2.5 text-sm text-white focus:border-blue-500 outline-none transition-all"
                  placeholder="e.g. 256"
                />
                {errors.memorySize && <p className="text-[10px] text-red-500">{errors.memorySize.message as any}</p>}
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-400 uppercase tracking-wider text-[10px]">Memory Slot Used</label>
                <input
                  type="number"
                  inputMode="numeric"
                  {...register("memorySlotUsed" as any)}
                  className="w-full bg-[#0f1218] border border-slate-800 rounded-lg p-2.5 text-sm text-white focus:border-blue-500 outline-none transition-all"
                  placeholder="e.g. 8"
                />
                {errors.memorySlotUsed && <p className="text-[10px] text-red-500">{errors.memorySlotUsed.message as any}</p>}
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-400 uppercase tracking-wider text-[10px]">Memory Speed (MHz)</label>
                <input
                  type="number"
                  inputMode="numeric"
                  {...register("memorySpeed" as any)}
                  className="w-full bg-[#0f1218] border border-slate-800 rounded-lg p-2.5 text-sm text-white focus:border-blue-500 outline-none transition-all"
                  placeholder="e.g. 3200"
                />
                {errors.memorySpeed && <p className="text-[10px] text-red-500">{errors.memorySpeed.message as any}</p>}
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-400 uppercase tracking-wider text-[10px]">Disk OS Type</label>
                <input
                  {...register("diskOsType")}
                  className="w-full bg-[#0f1218] border border-slate-800 rounded-lg p-2.5 text-sm text-white focus:border-blue-500 outline-none transition-all"
                  placeholder="e.g. SSD"
                />
                {errors.diskOsType && <p className="text-[10px] text-red-500">{errors.diskOsType.message}</p>}
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-400 uppercase tracking-wider text-[10px]">Disk OS Number</label>
                <input
                  type="number"
                  inputMode="numeric"
                  {...register("diskOsNumber" as any)}
                  className="w-full bg-[#0f1218] border border-slate-800 rounded-lg p-2.5 text-sm text-white focus:border-blue-500 outline-none transition-all"
                  placeholder="e.g. 2"
                />
                {errors.diskOsNumber && <p className="text-[10px] text-red-500">{errors.diskOsNumber.message as any}</p>}
              </div>

              <div className="space-y-2 col-span-2">
                <label className="text-sm font-medium text-slate-400 uppercase tracking-wider text-[10px]">Disk OS Size (GB)</label>
                <input
                  type="number"
                  inputMode="numeric"
                  {...register("diskOsSize" as any)}
                  className="w-full bg-[#0f1218] border border-slate-800 rounded-lg p-2.5 text-sm text-white focus:border-blue-500 outline-none transition-all"
                  placeholder="e.g. 960"
                />
                {errors.diskOsSize && <p className="text-[10px] text-red-500">{errors.diskOsSize.message as any}</p>}
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-400 uppercase tracking-wider text-[10px]">Disk Data Type</label>
                <input
                  {...register("diskDataType")}
                  className="w-full bg-[#0f1218] border border-slate-800 rounded-lg p-2.5 text-sm text-white focus:border-blue-500 outline-none transition-all"
                  placeholder="e.g. HDD"
                />
                {errors.diskDataType && <p className="text-[10px] text-red-500">{errors.diskDataType.message}</p>}
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-400 uppercase tracking-wider text-[10px]">Disk Data Number</label>
                <input
                  type="number"
                  inputMode="numeric"
                  {...register("diskDataNumber" as any)}
                  className="w-full bg-[#0f1218] border border-slate-800 rounded-lg p-2.5 text-sm text-white focus:border-blue-500 outline-none transition-all"
                  placeholder="e.g. 4"
                />
                {errors.diskDataNumber && <p className="text-[10px] text-red-500">{errors.diskDataNumber.message as any}</p>}
              </div>

              <div className="space-y-2 col-span-2">
                <label className="text-sm font-medium text-slate-400 uppercase tracking-wider text-[10px]">Disk Data Size (GB)</label>
                <input
                  type="number"
                  inputMode="numeric"
                  {...register("diskDataSize" as any)}
                  className="w-full bg-[#0f1218] border border-slate-800 rounded-lg p-2.5 text-sm text-white focus:border-blue-500 outline-none transition-all"
                  placeholder="e.g. 4000"
                />
                {errors.diskDataSize && <p className="text-[10px] text-red-500">{errors.diskDataSize.message as any}</p>}
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="border-t border-slate-800 pt-6 space-y-4">
        <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Physical Placement</h4>
        
        {/* 3. Location Type & Specific Site Row */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-400 text-[10px]">Placement Type</label>
            <select 
              {...register("locationType" as any)}
              onChange={(e) => {
                setValue("locationType" as any, e.target.value);
                setValue("locationId" as any, ""); // Reset site
                setValue("rackId", ""); // Reset rack
              }}
              className="w-full bg-[#0f1218] border border-slate-800 rounded-lg p-2.5 text-sm text-white focus:border-blue-500 outline-none"
            >
              <option value="">Select Type</option>
              <option value="DATACENTER">Datacenter</option>
              <option value="WAREHOUSE">Warehouse</option>
            </select>
            {errors.locationType && <p className="text-[10px] text-red-500">{errors.locationType.message}</p>}
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-400 text-[10px]">Site Selection</label>
            <select 
              {...register("locationId" as any)}
              disabled={!selectedType}
              onChange={(e) => {
                setValue("locationId" as any, e.target.value);
                setValue("rackId", ""); // Reset rack selection when site changes
              }}
              className="w-full bg-[#0f1218] border border-slate-800 rounded-lg p-2.5 text-sm text-white focus:border-blue-500 outline-none disabled:opacity-50"
            >
              <option value="">Select Site</option>
              {availableLocations.map(loc => (
                <option key={loc.id} value={loc.id}>{loc.name}</option>
              ))}
            </select>
            {errors.locationId && <p className="text-[10px] text-red-500">{errors.locationId.message}</p>}
          </div>
        </div>

        {/* 4. Conditional Rack Selection (Only for Datacenters) */}
        {selectedType === 'DATACENTER' && (
          <div className="space-y-2 animate-in fade-in slide-in-from-top-2 duration-200">
            <label className="text-sm font-medium text-slate-400 text-[10px]">
              Rack Location {isRackRequired && <span className="text-red-500">*</span>}
            </label>
            <select 
              {...register("rackId")}
              disabled={!selectedLocationId}
              className="w-full bg-[#0f1218] border border-slate-800 rounded-lg p-2.5 text-sm text-white focus:border-blue-500 outline-none disabled:opacity-50"
            >
              <option value="">Select Rack Unit</option>
              {availableRacks.map(r => (
                <option key={r.id} value={r.id}>{r.name}</option>
              ))}
            </select>
            {errors.rackId && <p className="text-[10px] text-red-500">{errors.rackId.message}</p>}
          </div>
        )}
      </div>

      <div className="pt-4 space-y-3">
        {Object.keys(errors).length > 0 && (
          <div className="w-full rounded-lg border border-red-900/50 bg-red-950/20 p-3 text-[11px] text-red-400">
            Please fix the highlighted fields before saving.
          </div>
        )}
        <button 
          type="submit" 
          disabled={isSubmitting}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-xl font-bold transition-all disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {isSubmitting ? <Loader2 className="animate-spin" size={18} /> : "Save Infrastructure Asset"}
        </button>
      </div>
    </form>
  );
};
