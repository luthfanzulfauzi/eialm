"use client";

import { useCallback, useEffect, useState } from "react";
import { Clock, Download, HardDriveDownload, Loader2, Lock, Pencil, Plus, RefreshCw, RotateCcw, ShieldAlert, Trash2 } from "lucide-react";
import { useSession } from "next-auth/react";
import { useRole } from "@/hooks/useRole";

type ProductOptionType =
  | "CATEGORY"
  | "BUSINESS_DOMAIN"
  | "SUPPORT_TEAM"
  | "BUSINESS_OWNER";

type ProductOption = {
  id: string;
  type: ProductOptionType;
  value: string;
  sortOrder: number;
};

type ProductOptionsByType = Record<ProductOptionType, ProductOption[]>;
type BackupEntry = {
  filename: string;
  size: number;
  modifiedAt: string;
};
type BackupPolicy = {
  enabled: boolean;
  retentionCount: number;
  frequencyUnit: "HOURLY" | "DAILY" | "MONTHLY";
  frequencyInterval: number;
  timeZone: string;
  runHour: number;
  runMinute: number;
  dayOfMonth: number;
  lastRunAt: string | null;
  nextRunAt: string | null;
};

const defaultBackupPolicy: BackupPolicy = {
  enabled: true,
  retentionCount: 14,
  frequencyUnit: "DAILY",
  frequencyInterval: 1,
  timeZone: "Asia/Jakarta",
  runHour: 0,
  runMinute: 30,
  dayOfMonth: 1,
  lastRunAt: null,
  nextRunAt: null,
};

const emptyProductOptions: ProductOptionsByType = {
  CATEGORY: [],
  BUSINESS_DOMAIN: [],
  SUPPORT_TEAM: [],
  BUSINESS_OWNER: [],
};

const optionSections: { type: ProductOptionType; title: string; helper: string }[] = [
  { type: "CATEGORY", title: "Category", helper: "Managed product or application classifications." },
  { type: "BUSINESS_DOMAIN", title: "Business Domain", helper: "Business areas such as Finance or Operations." },
  { type: "SUPPORT_TEAM", title: "Support Team", helper: "Operational teams responsible for support coverage." },
  { type: "BUSINESS_OWNER", title: "Business Owner", helper: "Approved list of business-side ownership contacts." },
];

export default function SettingsPage() {
  const { data: session } = useSession();
  const { isAdmin } = useRole();

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState<string | null>(null);

  const [timeoutMinutes, setTimeoutMinutes] = useState<number>(30);
  const [timeoutLoading, setTimeoutLoading] = useState(false);
  const [timeoutMessage, setTimeoutMessage] = useState<string | null>(null);

  const [productOptions, setProductOptions] = useState<ProductOptionsByType>(emptyProductOptions);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [catalogMessage, setCatalogMessage] = useState<string | null>(null);
  const [newOptionDrafts, setNewOptionDrafts] = useState<Record<ProductOptionType, string>>({
    CATEGORY: "",
    BUSINESS_DOMAIN: "",
    SUPPORT_TEAM: "",
    BUSINESS_OWNER: "",
  });
  const [editingOptionId, setEditingOptionId] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState("");
  const [busyOptionId, setBusyOptionId] = useState<string | null>(null);
  const [backups, setBackups] = useState<BackupEntry[]>([]);
  const [backupLoading, setBackupLoading] = useState(false);
  const [backupMessage, setBackupMessage] = useState<string | null>(null);
  const [backupBusyAction, setBackupBusyAction] = useState<"create" | "refresh" | null>(null);
  const [restoringBackup, setRestoringBackup] = useState<string | null>(null);
  const [backupPolicy, setBackupPolicy] = useState<BackupPolicy>(defaultBackupPolicy);
  const [backupPolicySaving, setBackupPolicySaving] = useState(false);

  const fetchProductOptions = async () => {
    try {
      setCatalogLoading(true);
      const res = await fetch("/api/product-options", { cache: "no-store" });
      const payload = await res.json().catch(() => ({} as any));
      if (!res.ok) {
        throw new Error(payload?.error || "Failed to load product dropdown settings");
      }
      setProductOptions(payload.byType || emptyProductOptions);
    } catch (error) {
      setCatalogMessage(error instanceof Error ? error.message : "Failed to load product dropdown settings");
    } finally {
      setCatalogLoading(false);
    }
  };

  const fetchBackups = useCallback(async () => {
    if (!isAdmin) return;

    try {
      setBackupLoading(true);
      const res = await fetch("/api/settings/backups", { cache: "no-store" });
      const payload = await res.json().catch(() => ({} as any));
      if (!res.ok) {
        throw new Error(payload?.error || "Failed to load backups");
      }
      setBackups(payload.backups || []);
      setBackupPolicy(payload.policy || defaultBackupPolicy);
    } catch (error) {
      setBackupMessage(error instanceof Error ? error.message : "Failed to load backups");
    } finally {
      setBackupLoading(false);
    }
  }, [isAdmin]);

  useEffect(() => {
    const fromSession = (session?.user as any)?.loginTimeout;
    if (typeof fromSession === "number" && fromSession > 0) {
      setTimeoutMinutes(fromSession);
      return;
    }

    fetch("/api/settings/login-timeout")
      .then((r) => r.json())
      .then((d) => {
        if (typeof d?.loginTimeout === "number") setTimeoutMinutes(d.loginTimeout);
      })
      .catch(() => {});
  }, [session?.user]);

  useEffect(() => {
    void fetchProductOptions();
  }, [isAdmin]);

  useEffect(() => {
    void fetchBackups();
  }, [fetchBackups]);

  const handleUpdatePassword = async () => {
    setPasswordMessage(null);
    setPasswordLoading(true);
    try {
      const res = await fetch("/api/settings/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setPasswordMessage(data?.error || "Failed to update password");
        return;
      }

      setCurrentPassword("");
      setNewPassword("");
      setPasswordMessage("Password updated successfully");
    } catch {
      setPasswordMessage("Failed to update password");
    } finally {
      setPasswordLoading(false);
    }
  };

  const handleSaveTimeout = async () => {
    setTimeoutMessage(null);
    setTimeoutLoading(true);
    try {
      const res = await fetch("/api/settings/login-timeout", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ minutes: timeoutMinutes }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setTimeoutMessage(data?.error || "Failed to save policy");
        return;
      }

      setTimeoutMessage("Policy saved");
    } catch {
      setTimeoutMessage("Failed to save policy");
    } finally {
      setTimeoutLoading(false);
    }
  };

  const handleAddOption = async (type: ProductOptionType) => {
    const value = newOptionDrafts[type].trim();
    if (!value) return;

    setCatalogMessage(null);
    setBusyOptionId(type);
    try {
      const res = await fetch("/api/product-options", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, value }),
      });
      const payload = await res.json().catch(() => ({} as any));
      if (!res.ok) {
        throw new Error(payload?.error || "Failed to add dropdown value");
      }

      setNewOptionDrafts((current) => ({ ...current, [type]: "" }));
      setCatalogMessage(`${optionSections.find((section) => section.type === type)?.title} option added.`);
      await fetchProductOptions();
    } catch (error) {
      setCatalogMessage(error instanceof Error ? error.message : "Failed to add dropdown value");
    } finally {
      setBusyOptionId(null);
    }
  };

  const handleSaveOptionEdit = async (option: ProductOption) => {
    const value = editingValue.trim();
    if (!value) return;

    setCatalogMessage(null);
    setBusyOptionId(option.id);
    try {
      const res = await fetch(`/api/product-options/${option.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ value }),
      });
      const payload = await res.json().catch(() => ({} as any));
      if (!res.ok) {
        throw new Error(payload?.error || "Failed to update dropdown value");
      }

      setEditingOptionId(null);
      setEditingValue("");
      setCatalogMessage("Dropdown value updated.");
      await fetchProductOptions();
    } catch (error) {
      setCatalogMessage(error instanceof Error ? error.message : "Failed to update dropdown value");
    } finally {
      setBusyOptionId(null);
    }
  };

  const handleDeleteOption = async (option: ProductOption) => {
    const confirmed = window.confirm(`Delete dropdown value "${option.value}"?`);
    if (!confirmed) return;

    setCatalogMessage(null);
    setBusyOptionId(option.id);
    try {
      const res = await fetch(`/api/product-options/${option.id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const payload = await res.json().catch(() => ({} as any));
        throw new Error(payload?.error || "Failed to delete dropdown value");
      }

      setCatalogMessage("Dropdown value deleted.");
      await fetchProductOptions();
    } catch (error) {
      setCatalogMessage(error instanceof Error ? error.message : "Failed to delete dropdown value");
    } finally {
      setBusyOptionId(null);
    }
  };

  const handleCreateBackup = async () => {
    setBackupMessage(null);
    setBackupBusyAction("create");
    try {
      const res = await fetch("/api/settings/backups", { method: "POST" });
      const payload = await res.json().catch(() => ({} as any));
      if (!res.ok) {
        throw new Error(payload?.error || "Failed to create backup");
      }

      setBackupMessage(`Backup created: ${payload.backup?.filename}`);
      await fetchBackups();
    } catch (error) {
      setBackupMessage(error instanceof Error ? error.message : "Failed to create backup");
    } finally {
      setBackupBusyAction(null);
    }
  };

  const handleRefreshBackups = async () => {
    setBackupMessage(null);
    setBackupBusyAction("refresh");
    await fetchBackups();
    setBackupBusyAction(null);
  };

  const handleRestoreBackup = async (filename: string) => {
    const confirmed = window.confirm(
      `Restore backup "${filename}"?\n\nThis will replace the current database content.`
    );
    if (!confirmed) return;

    setBackupMessage(null);
    setRestoringBackup(filename);
    try {
      const res = await fetch("/api/settings/backups/restore", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename }),
      });
      const payload = await res.json().catch(() => ({} as any));
      if (!res.ok) {
        throw new Error(payload?.error || "Failed to restore backup");
      }

      setBackupMessage(`Backup restored: ${filename}`);
      await fetchBackups();
    } catch (error) {
      setBackupMessage(error instanceof Error ? error.message : "Failed to restore backup");
    } finally {
      setRestoringBackup(null);
    }
  };

  const formatBackupSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  };

  const getBrowserTimeZone = () => {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Jakarta";
    } catch {
      return "Asia/Jakarta";
    }
  };

  const handleSaveBackupPolicy = async () => {
    setBackupMessage(null);
    setBackupPolicySaving(true);
    try {
      const res = await fetch("/api/settings/backups", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...backupPolicy,
          timeZone: getBrowserTimeZone(),
        }),
      });
      const payload = await res.json().catch(() => ({} as any));
      if (!res.ok) {
        throw new Error(payload?.error || "Failed to save backup policy");
      }

      setBackupPolicy(payload.policy || defaultBackupPolicy);
      setBackupMessage("Backup policy saved.");
    } catch (error) {
      setBackupMessage(error instanceof Error ? error.message : "Failed to save backup policy");
    } finally {
      setBackupPolicySaving(false);
    }
  };

  const formatTimeInput = (hour: number, minute: number) =>
    `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;

  return (
    <div className="max-w-6xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white">System Settings</h1>
        <p className="text-slate-500">Manage your profile and organization-wide configurations</p>
      </div>

      <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
        <div className="bg-[#151921] border border-slate-800 rounded-2xl p-6">
          <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
            <Lock size={20} className="text-blue-400" /> Change Password
          </h3>
          <div className="space-y-4">
            <input
              type="password"
              placeholder="Current Password"
              title="current-password"
              value={currentPassword}
              onChange={(e: any) => setCurrentPassword(e.target.value)}
              className="w-full bg-slate-900 border border-slate-800 rounded-lg p-3 text-sm outline-none focus:border-blue-500 text-white"
            />
            <input
              type="password"
              placeholder="New Password (min 8 chars)"
              title="new-password"
              value={newPassword}
              onChange={(e: any) => setNewPassword(e.target.value)}
              className="w-full bg-slate-900 border border-slate-800 rounded-lg p-3 text-sm outline-none focus:border-blue-500 text-white"
            />
            {passwordMessage ? (
              <div className="flex items-center gap-2 text-xs text-slate-300">
                <ShieldAlert size={14} className="text-slate-400" />
                <span>{passwordMessage}</span>
              </div>
            ) : null}
            <button
              onClick={handleUpdatePassword}
              disabled={passwordLoading}
              className="w-full bg-blue-600 text-white py-2 rounded-lg font-bold text-sm disabled:opacity-60"
            >
              {passwordLoading ? "Updating..." : "Update Password"}
            </button>
          </div>
        </div>

        <div className="bg-[#151921] border border-slate-800 rounded-2xl p-6">
          <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
            <Clock size={20} className="text-amber-400" /> Session Configuration
          </h3>
          <div className="space-y-4">
            <label className="text-xs text-slate-500 uppercase font-bold">Inactivity Timeout (Minutes)</label>
            <input
              type="number"
              value={timeoutMinutes}
              title="session-timeout"
              onChange={(e: any) => setTimeoutMinutes(Number(e.target.value))}
              className="w-full bg-slate-900 border border-slate-800 rounded-lg p-3 text-sm outline-none focus:border-amber-500 text-white disabled:opacity-60"
              disabled={!isAdmin}
            />
            <p className="text-[10px] text-slate-500 italic">
              {isAdmin
                ? "This policy is managed by Admins and affects all users."
                : "Only Admins can change this policy."}
            </p>
            {timeoutMessage ? (
              <div className="flex items-center gap-2 text-xs text-slate-300">
                <ShieldAlert size={14} className="text-slate-400" />
                <span>{timeoutMessage}</span>
              </div>
            ) : null}
            <button
              onClick={handleSaveTimeout}
              disabled={!isAdmin || timeoutLoading}
              className="w-full bg-slate-800 text-white py-2 rounded-lg font-bold text-sm border border-slate-700 disabled:opacity-60"
            >
              {timeoutLoading ? "Saving..." : "Save Policy"}
            </button>
          </div>
        </div>
      </div>

      {isAdmin ? (
        <div className="bg-[#151921] border border-slate-800 rounded-2xl p-6 space-y-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <HardDriveDownload size={20} className="text-blue-400" /> Backup & Restore
              </h3>
              <p className="mt-2 text-sm text-slate-500">
                Create, download, and restore database backups from the admin UI. Restoring replaces the current database content.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                onClick={() => void handleRefreshBackups()}
                disabled={backupLoading || backupBusyAction !== null}
                className="inline-flex items-center gap-2 rounded-lg bg-slate-800 px-4 py-2 text-sm font-bold text-white border border-slate-700 disabled:opacity-60"
              >
                {backupBusyAction === "refresh" ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                Refresh
              </button>

              <button
                onClick={() => void handleCreateBackup()}
                disabled={backupBusyAction !== null || restoringBackup !== null}
                className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-60"
              >
                {backupBusyAction === "create" ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                Create Backup
              </button>
            </div>
          </div>

          {backupMessage ? (
            <div className="flex items-center gap-2 text-xs text-slate-300">
              <ShieldAlert size={14} className="text-slate-400" />
              <span>{backupMessage}</span>
            </div>
          ) : null}

          <div className="grid grid-cols-1 gap-4 rounded-2xl border border-slate-800 bg-slate-900/20 p-5 md:grid-cols-2 xl:grid-cols-5">
            <label className="space-y-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Keep Last</span>
              <input
                type="number"
                min={1}
                max={365}
                value={backupPolicy.retentionCount}
                onChange={(e: any) =>
                  setBackupPolicy((current) => ({ ...current, retentionCount: Number(e.target.value) }))
                }
                className="w-full rounded-lg border border-slate-800 bg-slate-900 p-3 text-sm text-white outline-none focus:border-blue-500"
              />
            </label>

            <label className="space-y-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Frequency Unit</span>
              <select
                value={backupPolicy.frequencyUnit}
                onChange={(e: any) =>
                  setBackupPolicy((current) => ({
                    ...current,
                    frequencyUnit: e.target.value,
                  }))
                }
                className="w-full rounded-lg border border-slate-800 bg-slate-900 p-3 text-sm text-white outline-none focus:border-blue-500"
              >
                <option value="HOURLY">Hour</option>
                <option value="DAILY">Day</option>
                <option value="MONTHLY">Month</option>
              </select>
            </label>

            <label className="space-y-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Every</span>
              <input
                type="number"
                min={1}
                max={365}
                value={backupPolicy.frequencyInterval}
                onChange={(e: any) =>
                  setBackupPolicy((current) => ({ ...current, frequencyInterval: Number(e.target.value) }))
                }
                className="w-full rounded-lg border border-slate-800 bg-slate-900 p-3 text-sm text-white outline-none focus:border-blue-500"
              />
            </label>

            <label className="space-y-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                {backupPolicy.frequencyUnit === "MONTHLY"
                  ? "Day Of Month"
                  : backupPolicy.frequencyUnit === "HOURLY"
                    ? "Run Minute"
                    : "Run Time"}
              </span>
              {backupPolicy.frequencyUnit === "MONTHLY" ? (
                <input
                  type="number"
                  min={1}
                  max={31}
                  value={backupPolicy.dayOfMonth}
                  onChange={(e: any) =>
                    setBackupPolicy((current) => ({ ...current, dayOfMonth: Number(e.target.value) }))
                  }
                  className="w-full rounded-lg border border-slate-800 bg-slate-900 p-3 text-sm text-white outline-none focus:border-blue-500"
                />
              ) : backupPolicy.frequencyUnit === "HOURLY" ? (
                <input
                  type="number"
                  min={0}
                  max={59}
                  value={backupPolicy.runMinute}
                  onChange={(e: any) =>
                    setBackupPolicy((current) => ({ ...current, runMinute: Number(e.target.value) }))
                  }
                  className="w-full rounded-lg border border-slate-800 bg-slate-900 p-3 text-sm text-white outline-none focus:border-blue-500"
                />
              ) : (
                <input
                  type="time"
                  value={formatTimeInput(backupPolicy.runHour, backupPolicy.runMinute)}
                  onChange={(e: any) => {
                    const [hour, minute] = String(e.target.value || "00:00").split(":").map((part) => Number(part));
                    setBackupPolicy((current) => ({
                      ...current,
                      runHour: Number.isFinite(hour) ? hour : 0,
                      runMinute: Number.isFinite(minute) ? minute : 0,
                    }));
                  }}
                  className="w-full rounded-lg border border-slate-800 bg-slate-900 p-3 text-sm text-white outline-none focus:border-blue-500"
                />
              )}
            </label>

            <div className="space-y-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Status</span>
              <label className="flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-900 p-3 text-sm text-white">
                <input
                  type="checkbox"
                  checked={backupPolicy.enabled}
                  onChange={(e: any) =>
                    setBackupPolicy((current) => ({ ...current, enabled: Boolean(e.target.checked) }))
                  }
                />
                Enable scheduled backups
              </label>
            </div>
          </div>

          {backupPolicy.frequencyUnit === "MONTHLY" ? (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-[1fr,220px]">
              <div className="text-xs text-slate-500">
                Monthly schedule runs every {backupPolicy.frequencyInterval} month(s) on day {backupPolicy.dayOfMonth}.
              </div>
              <input
                type="time"
                value={formatTimeInput(backupPolicy.runHour, backupPolicy.runMinute)}
                onChange={(e: any) => {
                  const [hour, minute] = String(e.target.value || "00:00").split(":").map((part) => Number(part));
                  setBackupPolicy((current) => ({
                    ...current,
                    runHour: Number.isFinite(hour) ? hour : 0,
                    runMinute: Number.isFinite(minute) ? minute : 0,
                  }));
                }}
                className="w-full rounded-lg border border-slate-800 bg-slate-900 p-3 text-sm text-white outline-none focus:border-blue-500"
              />
            </div>
          ) : null}

          <div className="flex flex-col gap-2 text-xs text-slate-500">
            <span>Time zone: {backupPolicy.timeZone || getBrowserTimeZone()}</span>
            <span>
              Last run: {backupPolicy.lastRunAt
                ? new Date(backupPolicy.lastRunAt).toLocaleString(undefined, {
                    timeZone: backupPolicy.timeZone || getBrowserTimeZone(),
                  })
                : "Never"}
            </span>
            <span>
              Next run: {backupPolicy.nextRunAt
                ? new Date(backupPolicy.nextRunAt).toLocaleString(undefined, {
                    timeZone: backupPolicy.timeZone || getBrowserTimeZone(),
                  })
                : "Not scheduled"}
            </span>
          </div>

          <div className="flex justify-end">
            <button
              onClick={() => void handleSaveBackupPolicy()}
              disabled={backupPolicySaving}
              className="inline-flex items-center gap-2 rounded-lg bg-slate-800 px-4 py-2 text-sm font-bold text-white border border-slate-700 disabled:opacity-60"
            >
              {backupPolicySaving ? <Loader2 size={14} className="animate-spin" /> : null}
              {backupPolicySaving ? "Saving..." : "Save Backup Policy"}
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-slate-800 text-[11px] uppercase tracking-wider text-slate-500">
                  <th className="py-3 font-semibold">Backup File</th>
                  <th className="px-4 py-3 font-semibold">Modified</th>
                  <th className="px-4 py-3 font-semibold">Size</th>
                  <th className="py-3 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {backupLoading ? (
                  <tr>
                    <td colSpan={4} className="py-6 text-sm text-slate-500">
                      Loading backups...
                    </td>
                  </tr>
                ) : backups.length > 0 ? (
                  backups.map((backup) => (
                    <tr key={backup.filename}>
                      <td className="py-4">
                        <div className="font-medium text-white">{backup.filename}</div>
                      </td>
                      <td className="px-4 py-4 text-sm text-slate-400">{new Date(backup.modifiedAt).toLocaleString()}</td>
                      <td className="px-4 py-4 text-sm text-slate-400">{formatBackupSize(backup.size)}</td>
                      <td className="py-4">
                        <div className="flex justify-end gap-2">
                          <a
                            href={`/api/settings/backups/${encodeURIComponent(backup.filename)}`}
                            className="inline-flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white hover:bg-slate-700"
                          >
                            <Download size={14} />
                            Download
                          </a>
                          <button
                            onClick={() => void handleRestoreBackup(backup.filename)}
                            disabled={backupBusyAction !== null || restoringBackup !== null}
                            className="inline-flex items-center gap-2 rounded-lg border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-sm text-amber-200 hover:bg-amber-500/20 disabled:opacity-60"
                          >
                            {restoringBackup === backup.filename ? <Loader2 size={14} className="animate-spin" /> : <RotateCcw size={14} />}
                            Restore
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4} className="py-6 text-sm text-slate-500">
                      No backups found yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      <div className="bg-[#151921] border border-slate-800 rounded-2xl p-6 space-y-6">
        <div className="flex flex-col gap-2">
          <h3 className="text-lg font-bold text-white">Product Dropdown Catalogs</h3>
          <p className="text-sm text-slate-500">
            Manage the dropdown values used by the Products / Application form for category, business domain, support team, and business owner. Technical owners come from User Management usernames.
          </p>
          <p className="text-[11px] text-slate-500 uppercase tracking-wider font-bold">
            {isAdmin ? "Admin access: create, edit, and delete enabled" : "Read-only: only Admin can manage these lists"}
          </p>
        </div>

        {catalogMessage ? (
          <div className="flex items-center gap-2 text-xs text-slate-300">
            <ShieldAlert size={14} className="text-slate-400" />
            <span>{catalogMessage}</span>
          </div>
        ) : null}

        <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
          {optionSections.map((section) => (
            <section key={section.type} className="rounded-2xl border border-slate-800 bg-slate-900/20 p-5 space-y-4">
              <div>
                <h4 className="text-base font-bold text-white">{section.title}</h4>
                <p className="text-xs text-slate-500 mt-1">{section.helper}</p>
              </div>

              {isAdmin ? (
                <div className="flex gap-2">
                  <input
                    value={newOptionDrafts[section.type]}
                    onChange={(e) =>
                      setNewOptionDrafts((current) => ({ ...current, [section.type]: e.target.value }))
                    }
                    placeholder={`Add ${section.title}`}
                    className="flex-1 bg-slate-900 border border-slate-800 rounded-lg p-3 text-sm outline-none focus:border-blue-500 text-white"
                  />
                  <button
                    onClick={() => void handleAddOption(section.type)}
                    disabled={busyOptionId === section.type}
                    className="inline-flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg font-bold text-sm disabled:opacity-60"
                  >
                    {busyOptionId === section.type ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                    Add
                  </button>
                </div>
              ) : null}

              <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                {catalogLoading ? (
                  <div className="text-sm text-slate-500">Loading dropdown values...</div>
                ) : productOptions[section.type].length === 0 ? (
                  <div className="text-sm text-slate-500">No values configured yet.</div>
                ) : (
                  productOptions[section.type].map((option) => (
                    <div key={option.id} className="flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-950/30 px-3 py-3">
                      {editingOptionId === option.id ? (
                        <input
                          value={editingValue}
                          onChange={(e) => setEditingValue(e.target.value)}
                          className="flex-1 bg-slate-900 border border-slate-800 rounded-lg p-2 text-sm outline-none focus:border-blue-500 text-white"
                        />
                      ) : (
                        <div className="flex-1 text-sm text-white">{option.value}</div>
                      )}

                      {isAdmin ? (
                        editingOptionId === option.id ? (
                          <>
                            <button
                              onClick={() => void handleSaveOptionEdit(option)}
                              disabled={busyOptionId === option.id}
                              className="px-3 py-1.5 text-xs font-bold rounded-lg bg-blue-600 text-white disabled:opacity-60"
                            >
                              Save
                            </button>
                            <button
                              onClick={() => {
                                setEditingOptionId(null);
                                setEditingValue("");
                              }}
                              disabled={busyOptionId === option.id}
                              className="px-3 py-1.5 text-xs font-bold rounded-lg bg-slate-800 text-white border border-slate-700 disabled:opacity-60"
                            >
                              Cancel
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              onClick={() => {
                                setEditingOptionId(option.id);
                                setEditingValue(option.value);
                              }}
                              className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
                              title={`Edit ${option.value}`}
                            >
                              <Pencil size={14} />
                            </button>
                            <button
                              onClick={() => void handleDeleteOption(option)}
                              disabled={busyOptionId === option.id}
                              className="p-2 rounded-lg text-slate-400 hover:text-red-400 hover:bg-slate-800 disabled:opacity-60"
                              title={`Delete ${option.value}`}
                            >
                              {busyOptionId === option.id ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                            </button>
                          </>
                        )
                      ) : null}
                    </div>
                  ))
                )}
              </div>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
