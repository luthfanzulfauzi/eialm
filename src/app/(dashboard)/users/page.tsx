"use client";

import { useState, useEffect, type FormEvent } from "react";
import { Mail, MoreVertical, UserPlus, Download } from "lucide-react";
import { formatDistanceToNow, differenceInMinutes } from "date-fns";
import { cn } from "@/lib/utils";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function UserManagementPage() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(() => Date.now());
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [showActionModal, setShowActionModal] = useState(false);
  const [actionUser, setActionUser] = useState<any | null>(null);
  const [roleUpdating, setRoleUpdating] = useState(false);
  const [roleDraft, setRoleDraft] = useState("VIEWER");
  const [actionDeleting, setActionDeleting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [createForm, setCreateForm] = useState({
    name: "",
    email: "",
    password: "",
    role: "VIEWER",
  });

  const fetchUsers = async (background = false) => {
    try {
      if (!background) {
        setLoading(true);
      }

      const res = await fetch("/api/users", { cache: "no-store" });
      if (!res.ok) {
        const payload = await res.text().catch(() => "");
        throw new Error(payload || "Failed to load users");
      }
      const data = await res.json();
      setUsers(data);
    } catch (error) {
      console.error("Failed to load users:", error);
      if (!background) {
        window.alert(error instanceof Error ? error.message : "Failed to load users");
      }
    } finally {
      if (!background) {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    void fetchUsers();

    const refreshInterval = window.setInterval(() => {
      void fetchUsers(true);
    }, 60_000);

    const clockInterval = window.setInterval(() => {
      setNow(Date.now());
    }, 30_000);

    return () => {
      window.clearInterval(refreshInterval);
      window.clearInterval(clockInterval);
    };
  }, []);

  const refreshUsers = async () => {
    await fetchUsers();
  };

  const handleCreateUser = async (e: FormEvent) => {
    e.preventDefault();
    setCreateError(null);

    const name = createForm.name.trim();
    const email = createForm.email.trim();
    const password = createForm.password;
    const role = createForm.role;

    if (!name || !email || !password) {
      setCreateError("Name, email, and password are required.");
      return;
    }

    try {
      setCreating(true);
      const response = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password, role }),
      });

      if (response.ok) {
        setShowCreateModal(false);
        setCreateForm({ name: "", email: "", password: "", role: "VIEWER" });
        await refreshUsers();
        return;
      }

      const payload = await response.json().catch(() => ({} as any));
      throw new Error(payload?.error || "Failed to create user");
    } catch (error) {
      setCreateError(error instanceof Error ? error.message : "Failed to create user");
    } finally {
      setCreating(false);
    }
  };

  const openActions = (user: any) => {
    setActionError(null);
    setActionUser(user);
    setRoleDraft(user?.role || "VIEWER");
    setShowActionModal(true);
  };

  const handleUpdateRole = async () => {
    if (!actionUser?.id) return;
    setActionError(null);
    try {
      setRoleUpdating(true);
      const res = await fetch(`/api/users/${actionUser.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: roleDraft }),
      });
      const payload = await res.json().catch(() => ({} as any));
      if (!res.ok) throw new Error(payload?.error || "Failed to update role");
      setActionUser(payload);
      await refreshUsers();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Failed to update role");
    } finally {
      setRoleUpdating(false);
    }
  };

  const handleDeleteUser = async () => {
    if (!actionUser?.id) return;
    setActionError(null);
    const ok = window.confirm(`Delete user "${actionUser.name}" (${actionUser.email})?`);
    if (!ok) return;

    try {
      setActionDeleting(true);
      const res = await fetch(`/api/users/${actionUser.id}`, { method: "DELETE" });
      const payload = await res.json().catch(() => ({} as any));
      if (!res.ok) throw new Error(payload?.error || "Failed to delete user");
      setShowActionModal(false);
      setActionUser(null);
      await refreshUsers();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Failed to delete user");
    } finally {
      setActionDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold text-white">User Management Center</h1>
          <p className="text-slate-500">Manage administrative roles and technical access tiers</p>
        </div>
        <div className="flex gap-3">
          <button className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-sm font-medium transition-colors border border-slate-700">
            <Download size={16} /> Export Audit Log
          </button>
          <button
            onClick={() => {
              setCreateError(null);
              setShowCreateModal(true);
            }}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm font-bold transition-all shadow-lg shadow-blue-500/20"
          >
            <UserPlus size={16} /> Create User
          </button>
        </div>
      </div>

      <div className="bg-[#151921] border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="p-6 border-b border-slate-800 flex justify-between items-center bg-slate-900/20">
          <h3 className="font-bold flex items-center gap-2 text-slate-200">
            Active Directory Overview 
            <span className="text-[10px] bg-slate-800 px-2 py-0.5 rounded text-slate-500 uppercase tracking-widest">
              Total: {users.length}
            </span>
          </h3>
        </div>

        <table className="w-full text-left">
          <thead>
            <tr className="text-slate-500 text-[11px] uppercase tracking-wider border-b border-slate-800 bg-slate-900/10">
              <th className="px-6 py-4 font-semibold">User Name</th>
              <th className="px-6 py-4 font-semibold">Role</th>
              <th className="px-6 py-4 font-semibold">Last Active</th>
              <th className="px-6 py-4 font-semibold">Status</th>
              <th className="px-6 py-4 font-semibold text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {loading && (
              <tr>
                <td colSpan={5} className="px-6 py-10 text-center text-sm text-slate-500">
                  Loading users...
                </td>
              </tr>
            )}
            {users.map((user: any) => {
              const lastActivityValue = user.lastActivityAt || user.lastLogin;
              const lastActive = lastActivityValue ? new Date(lastActivityValue) : null;
              const minutesSinceActive = lastActive ? differenceInMinutes(now, lastActive) : Infinity;
              const timeoutMinutes =
                typeof user.loginTimeout === "number" && user.loginTimeout > 0 ? user.loginTimeout : 30;
              
              let statusLabel = "Offline";
              let statusColor = "bg-slate-500 shadow-none";
              let textColor = "text-slate-500";

              if (minutesSinceActive <= 5) {
                statusLabel = "Online";
                statusColor = "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]";
                textColor = "text-emerald-500";
              } else if (minutesSinceActive < timeoutMinutes) {
                statusLabel = "Away";
                statusColor = "bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]";
                textColor = "text-amber-500";
              }

              return (
                <tr key={user.id} className="hover:bg-blue-500/[0.02] transition-colors group">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-slate-700 to-slate-800 border border-slate-600 flex items-center justify-center font-bold text-slate-300">
                        {user.name.charAt(0)}
                      </div>
                      <div>
                        <div className="text-sm font-bold text-white">{user.name}</div>
                        <div className="text-xs text-slate-500 flex items-center gap-1">
                          <Mail size={12} /> {user.email}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-2.5 py-1 rounded-md text-[10px] font-bold border ${
                      user.role === 'ADMIN' ? 'bg-blue-500/10 border-blue-500/20 text-blue-400' :
                      user.role === 'OPERATOR' ? 'bg-purple-500/10 border-purple-500/20 text-purple-400' :
                      'bg-slate-800 border-slate-700 text-slate-400'
                    }`}>
                      {user.role}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-xs text-slate-300">
                      {lastActive ? formatDistanceToNow(lastActive) + " ago" : "Never"}
                    </div>
                    <div className="text-[10px] text-slate-500 font-mono">
                      Timeout: {timeoutMinutes}m
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <div className={cn("w-1.5 h-1.5 rounded-full transition-all", statusColor)} />
                      <span className={cn("text-xs font-medium uppercase tracking-wider", textColor)}>
                        {statusLabel}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button
                      onClick={() => openActions(user)}
                      className="p-2 hover:bg-slate-800 rounded-lg text-slate-500 hover:text-white"
                    >
                      <MoreVertical size={18} />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <Modal
        isOpen={showCreateModal}
        onClose={() => {
          if (creating) return;
          setShowCreateModal(false);
        }}
        title="Create User"
      >
        <form onSubmit={handleCreateUser} className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Name</div>
              <Input
                value={createForm.name}
                onChange={(e) => setCreateForm((p) => ({ ...p, name: e.target.value }))}
                placeholder="Full name"
                autoFocus
              />
            </div>

            <div className="space-y-2">
              <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Role</div>
              <select
                value={createForm.role}
                onChange={(e) => setCreateForm((p) => ({ ...p, role: e.target.value }))}
                className="flex h-10 w-full rounded-lg border border-slate-800 bg-slate-900/50 px-3 py-2 text-sm text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50 focus-visible:border-blue-500 transition-all"
              >
                <option value="ADMIN">ADMIN</option>
                <option value="OPERATOR">OPERATOR</option>
                <option value="VIEWER">VIEWER</option>
              </select>
            </div>

            <div className="space-y-2 md:col-span-2">
              <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Email</div>
              <Input
                type="email"
                value={createForm.email}
                onChange={(e) => setCreateForm((p) => ({ ...p, email: e.target.value }))}
                placeholder="name@company.com"
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Password</div>
              <Input
                type="password"
                value={createForm.password}
                onChange={(e) => setCreateForm((p) => ({ ...p, password: e.target.value }))}
                placeholder="Set a temporary password"
              />
            </div>
          </div>

          {createError && (
            <div className="text-sm text-red-400 border border-red-500/20 bg-red-500/10 rounded-lg px-3 py-2">
              {createError}
            </div>
          )}

          <div className="flex items-center justify-end gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowCreateModal(false)}
              disabled={creating}
            >
              Cancel
            </Button>
            <Button type="submit" variant="primary" disabled={creating}>
              {creating ? "Creating..." : "Create User"}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={showActionModal}
        onClose={() => {
          if (roleUpdating || actionDeleting) return;
          setShowActionModal(false);
          setActionUser(null);
        }}
        title="User Actions"
      >
        <div className="space-y-5">
          <div className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Name</div>
                <Input value={actionUser?.name || ""} disabled />
              </div>
              <div className="space-y-2">
                <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Role</div>
                <select
                  value={roleDraft}
                  onChange={(e) => setRoleDraft(e.target.value)}
                  disabled={roleUpdating || actionDeleting}
                  className="flex h-10 w-full rounded-lg border border-slate-800 bg-slate-900/50 px-3 py-2 text-sm text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50 focus-visible:border-blue-500 transition-all disabled:opacity-50 disabled:pointer-events-none"
                >
                  <option value="ADMIN">ADMIN</option>
                  <option value="OPERATOR">OPERATOR</option>
                  <option value="VIEWER">VIEWER</option>
                </select>
              </div>
              <div className="space-y-2 md:col-span-2">
                <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Email</div>
                <Input value={actionUser?.email || ""} disabled />
              </div>
            </div>
          </div>

          {actionError && (
            <div className="text-sm text-red-400 border border-red-500/20 bg-red-500/10 rounded-lg px-3 py-2">
              {actionError}
            </div>
          )}

          <div className="flex items-center justify-between gap-3 pt-2">
            <Button
              type="button"
              variant="danger"
              onClick={handleDeleteUser}
              disabled={roleUpdating || actionDeleting || !actionUser?.id}
            >
              {actionDeleting ? "Deleting..." : "Delete User"}
            </Button>
            <div className="flex items-center gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setShowActionModal(false);
                  setActionUser(null);
                }}
                disabled={roleUpdating || actionDeleting}
              >
                Close
              </Button>
              <Button
                type="button"
                variant="primary"
                onClick={handleUpdateRole}
                disabled={roleUpdating || actionDeleting || !actionUser?.id}
              >
                {roleUpdating ? "Saving..." : "Save Role"}
              </Button>
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}
