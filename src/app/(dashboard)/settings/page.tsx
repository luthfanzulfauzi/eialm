"use client";

import { useEffect, useState } from "react";
import { Clock, Loader2, Lock, Pencil, Plus, ShieldAlert, Trash2 } from "lucide-react";
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
