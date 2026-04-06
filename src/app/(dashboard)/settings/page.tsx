"use client";

import { useEffect, useState } from "react";
import { Lock, Clock, ShieldAlert } from "lucide-react";
import { useSession } from "next-auth/react";
import { useRole } from "@/hooks/useRole";

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

  return (
    <div className="max-w-4xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white">System Settings</h1>
        <p className="text-slate-500">Manage your profile and organization-wide configurations</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Security Section */}
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

        {/* Admin Config Section */}
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
    </div>
  );
}
