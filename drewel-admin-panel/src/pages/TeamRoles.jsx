import { useCallback, useEffect, useMemo, useState } from "react";
import { ShieldCheck, UserPlus, Mail, Check, X } from "lucide-react";
import {
  getRolesCatalog, createAdmin, updateAdminRole, updateAdminStatus, resetAdminPassword, rolesErrorMessage,
} from "../api/domains/roles";
import { useAuth } from "../context/AuthContext";
import {
  Card, Button, SectionHeader, Th, Td, Tr, Avatar, Badge,
  Modal, Toast, StatRow, LoadingState, ErrorState, EmptyState, Select
} from "../components/ui";

const ROLE_CONFIG = {
  owner:         { label: "Owner",         color: "text-violet-700", bg: "bg-violet-50",  border: "border-violet-200" },
  finance_admin: { label: "Finance Admin", color: "text-sky-700",    bg: "bg-sky-50",     border: "border-sky-200" },
  admin:         { label: "Admin",         color: "text-violet-700", bg: "bg-violet-50",  border: "border-violet-200" },
  support:       { label: "Support",       color: "text-amber-700",  bg: "bg-amber-50",   border: "border-amber-200" },
  analyst:       { label: "Analyst",       color: "text-slate-600",  bg: "bg-slate-100",  border: "border-slate-200" },
};

// Roles that can actually be assigned through this page. "support"/"analyst"
// exist in the database schema but are not enforced by any backend
// authorization check, so granting them would silently hand out full admin
// access under a misleading label — they are shown read-only if a legacy
// record has one, but never offered as a creatable/editable target.
const MANAGEABLE_ROLES = ["finance_admin", "admin"];

const FALLBACK_PERMISSIONS = [
  { label: "View Dashboard & KPIs",         owner: true,  finance_admin: true,  admin: true  },
  { label: "View Live Rides",               owner: true,  finance_admin: true,  admin: true  },
  { label: "Cancel or Intervene in Rides",  owner: true,  finance_admin: false, admin: true  },
  { label: "Resolve Disputes",              owner: true,  finance_admin: false, admin: true  },
  { label: "View Driver Profiles",          owner: true,  finance_admin: true,  admin: true  },
  { label: "Restrict / Unrestrict Drivers", owner: true,  finance_admin: true,  admin: false },
  { label: "Approve Verification Requests", owner: true,  finance_admin: false, admin: true  },
  { label: "View Point Balances",           owner: true,  finance_admin: true,  admin: true  },
  { label: "Add Purchased Points",          owner: true,  finance_admin: false, admin: false },
  { label: "Approve Point Requests",        owner: true,  finance_admin: true,  admin: false },
  { label: "Read Chat / Calls",             owner: true,  finance_admin: true,  admin: true  },
  { label: "Manage Sponsor Banners",        owner: true,  finance_admin: false, admin: true  },
  { label: "View Audit Logs",               owner: true,  finance_admin: true,  admin: true  },
  { label: "Manage Team & Roles",           owner: true,  finance_admin: false, admin: false },
  { label: "Edit Operational Settings",     owner: true,  finance_admin: false, admin: false },
];

function relTime(iso) {
  if (!iso) return "—";
  const diff = Date.now() - new Date(iso).getTime();
  const h = Math.floor(diff / 3600000);
  if (h < 1) return "< 1h ago";
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function formatDate(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

const roleConfigFor = (role) => ROLE_CONFIG[String(role || "").toLowerCase()] || ROLE_CONFIG.admin;

const TeamRoles = () => {
  const { role: myRole } = useAuth();
  const isOwner = myRole === "owner";
  const [team, setTeam] = useState([]);
  const [permissions, setPermissions] = useState(FALLBACK_PERMISSIONS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState("members");
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteForm, setInviteForm] = useState({ fullName: "", email: "", password: "", role: "admin" });
  const [inviteError, setInviteError] = useState("");
  const [inviteLoading, setInviteLoading] = useState(false);
  const [roleTarget, setRoleTarget] = useState(null);
  const [roleValue, setRoleValue] = useState("admin");
  const [roleBusy, setRoleBusy] = useState(false);
  const [roleError, setRoleError] = useState("");
  const [statusTarget, setStatusTarget] = useState(null);
  const [statusBusy, setStatusBusy] = useState(false);
  const [statusError, setStatusError] = useState("");
  const [passwordTarget, setPasswordTarget] = useState(null);
  const [newPassword, setNewPassword] = useState("");
  const [passwordBusy, setPasswordBusy] = useState(false);
  const [passwordError, setPasswordError] = useState("");
  const [toast, setToast] = useState(null);

  const load = useCallback(async (signal) => {
    try {
      setLoading(true);
      setError("");
      const rolesResult = await getRolesCatalog(signal);
      setTeam(rolesResult.team || []);
      if (rolesResult.permissions && Object.keys(rolesResult.permissions).length > 0) {
        const perms = [];
        Object.entries(rolesResult.permissions).forEach(([permLabel, roles]) => {
          perms.push({
            label: permLabel,
            owner: !!roles.owner,
            finance_admin: !!roles.finance_admin,
            admin: !!roles.admin,
          });
        });
        setPermissions(perms);
      }
    } catch (err) {
      if (err?.name === "CanceledError" || err?.code === "ERR_CANCELED") return;
      setError(rolesErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    load(controller.signal);
    return () => controller.abort();
  }, [load]);

  const roleCounts = useMemo(() => {
    const counts = { owner: 0, finance_admin: 0, admin: 0, other: 0 };
    team.forEach((m) => {
      const role = String(m.role || "").toLowerCase();
      if (counts[role] !== undefined) counts[role]++;
      else counts.other++;
    });
    return counts;
  }, [team]);

  const handleInvite = async () => {
    if (!inviteForm.fullName.trim() || !inviteForm.email.trim() || inviteForm.password.length < 8) return;
    setInviteLoading(true);
    setInviteError("");
    try {
      const result = await createAdmin(inviteForm);
      if (!result.success) {
        setInviteError(result.message || "Could not create this admin account.");
        return;
      }
      setInviteOpen(false);
      setInviteForm({ fullName: "", email: "", password: "", role: "admin" });
      setToast(`${inviteForm.email} was added as ${roleConfigFor(inviteForm.role).label}.`);
      await load();
    } catch (err) {
      setInviteError(rolesErrorMessage(err, "Could not create this admin account."));
    } finally {
      setInviteLoading(false);
    }
  };

  const openRoleModal = (member) => {
    setRoleTarget(member);
    setRoleValue(MANAGEABLE_ROLES.includes(member.role) ? member.role : "admin");
    setRoleError("");
  };

  const submitRoleChange = async () => {
    if (!roleTarget) return;
    setRoleBusy(true);
    setRoleError("");
    try {
      await updateAdminRole(roleTarget._id || roleTarget.id, roleValue);
      setRoleTarget(null);
      setToast(`${roleTarget.email}'s role is now ${roleConfigFor(roleValue).label}.`);
      await load();
    } catch (err) {
      setRoleError(rolesErrorMessage(err, "Could not update this admin's role."));
    } finally {
      setRoleBusy(false);
    }
  };

  const submitStatusChange = async () => {
    if (!statusTarget) return;
    setStatusBusy(true);
    setStatusError("");
    try {
      const nextActive = statusTarget.isActive === false;
      await updateAdminStatus(statusTarget._id || statusTarget.id, nextActive);
      setToast(`${statusTarget.email} was ${nextActive ? "reactivated" : "deactivated"}.`);
      setStatusTarget(null);
      await load();
    } catch (err) {
      setStatusError(rolesErrorMessage(err, "Could not update this admin's status."));
    } finally {
      setStatusBusy(false);
    }
  };

  const openPasswordModal = (member) => {
    setPasswordTarget(member);
    setNewPassword("");
    setPasswordError("");
  };

  const submitPasswordReset = async () => {
    if (!passwordTarget || newPassword.length < 8) return;
    setPasswordBusy(true);
    setPasswordError("");
    try {
      const result = await resetAdminPassword(passwordTarget._id || passwordTarget.id, newPassword);
      if (!result.success) {
        setPasswordError(result.message || "Could not reset this admin's password.");
        return;
      }
      setToast(`${passwordTarget.email}'s password was reset.`);
      setPasswordTarget(null);
      setNewPassword("");
    } catch (err) {
      setPasswordError(rolesErrorMessage(err, "Could not reset this admin's password."));
    } finally {
      setPasswordBusy(false);
    }
  };

  const getInitials = (member) => {
    const name = member.fullName || "";
    if (!name.trim()) return "??";
    return name.split(/\s+/).filter(Boolean).map((w) => w[0]).join("").toUpperCase().slice(0, 2);
  };

  if (loading) return <LoadingState label="Loading team..." />;
  if (error) return <ErrorState title="Unable to load team" description={error} action={<Button variant="secondary" onClick={() => load()}>Retry</Button>} />;

  return (
    <div className="flex flex-col gap-6">
      <SectionHeader
        title="Team & Roles"
        description="Manage admin access, roles, and permission boundaries."
        actions={
          isOwner ? (
            <Button variant="primary" size="sm" icon={<UserPlus size={14} />} onClick={() => setInviteOpen(true)}>
              Add Admin
            </Button>
          ) : null
        }
      />

      <div className="flex gap-1 bg-slate-100 rounded-[10px] p-1 w-fit">
        {["members", "permissions"].map((t) => (
          <button key={t} onClick={() => setActiveTab(t)}
            className={`px-4 py-2 rounded-[8px] text-sm font-semibold capitalize transition-all
              ${activeTab === t ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}>
            {t === "members" ? "Team Members" : "Permissions Matrix"}
          </button>
        ))}
      </div>

      {activeTab === "members" && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {["owner", "finance_admin", "admin"].map((role) => {
              const cfg = ROLE_CONFIG[role];
              const count = roleCounts[role];
              return (
                <Card key={role} className="p-4">
                  <div className="flex items-center gap-2.5 mb-2">
                    <ShieldCheck size={15} className={cfg.color} />
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${cfg.color} ${cfg.bg} ${cfg.border}`}>{cfg.label}</span>
                  </div>
                  <p className="text-2xl font-bold text-slate-800 tabular-nums">{count}</p>
                  <p className="text-xs text-slate-400 mt-0.5">member{count !== 1 ? "s" : ""}</p>
                </Card>
              );
            })}
          </div>

          {team.length === 0 ? (
            <EmptyState title="No team members" description="No admin accounts found." />
          ) : (
            <Card>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr>
                      <Th>Member</Th>
                      <Th>Role</Th>
                      <Th>Status</Th>
                      <Th>Last Active</Th>
                      <Th>Added</Th>
                      {isOwner && <Th>Actions</Th>}
                    </tr>
                  </thead>
                  <tbody>
                    {team.map((member) => {
                      const cfg = roleConfigFor(member.role);
                      const isActive = member.isActive !== false;
                      return (
                        <Tr key={member._id || member.id}>
                          <Td>
                            <div className="flex items-center gap-3">
                              <Avatar initials={getInitials(member)} size="sm" />
                              <div>
                                <p className="text-sm font-semibold text-slate-800">{member.fullName || "Unknown"}</p>
                                <p className="text-xs text-slate-400 flex items-center gap-1">
                                  <Mail size={10} />{member.email || "—"}
                                </p>
                              </div>
                            </div>
                          </Td>
                          <Td>
                            <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full border ${cfg.color} ${cfg.bg} ${cfg.border}`}>
                              <ShieldCheck size={11} />{cfg.label}
                            </span>
                          </Td>
                          <Td>
                            <Badge variant={isActive ? "active" : "inactive"} dot />
                          </Td>
                          <Td><span className="text-xs text-slate-500">{relTime(member.lastLoginAt)}</span></Td>
                          <Td><span className="text-xs text-slate-500">{formatDate(member.createdAt)}</span></Td>
                          {isOwner && (
                            <Td>
                              <div className="flex items-center gap-1">
                                {member.role === "owner" ? (
                                  <span className="text-xs text-slate-400 italic">Protected</span>
                                ) : (
                                  <>
                                    <Button variant="secondary" size="sm" onClick={() => openRoleModal(member)}>Edit Role</Button>
                                    <Button variant="secondary" size="sm" onClick={() => openPasswordModal(member)}>Reset password</Button>
                                    <Button variant={isActive ? "danger" : "secondary"} size="sm" onClick={() => setStatusTarget(member)}>
                                      {isActive ? "Deactivate" : "Reactivate"}
                                    </Button>
                                  </>
                                )}
                              </div>
                            </Td>
                          )}
                        </Tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </>
      )}

      {activeTab === "permissions" && (
        <Card>
          <div className="p-5 border-b border-slate-100">
            <h2 className="text-sm font-bold text-slate-800">Role Permissions Matrix</h2>
            <p className="text-xs text-slate-500 mt-1">Read-only summary of what each role can access or perform.</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr>
                  <Th className="w-auto">Permission</Th>
                  {["owner", "finance_admin", "admin"].map((r) => (
                    <Th key={r} className="text-center w-24">
                      <span className={`${ROLE_CONFIG[r].color}`}>{ROLE_CONFIG[r].label}</span>
                    </Th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {permissions.map((p) => (
                  <Tr key={p.label}>
                    <Td><span className="text-sm text-slate-700">{p.label}</span></Td>
                    {["owner", "finance_admin", "admin"].map((r) => (
                      <Td key={r} className="text-center">
                        {p[r]
                          ? <Check size={15} className="text-green-500 mx-auto" />
                          : <X size={15} className="text-slate-200 mx-auto" />}
                      </Td>
                    ))}
                  </Tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <Modal open={inviteOpen} onClose={() => setInviteOpen(false)} title="Add Admin">
        <div className="flex flex-col gap-4">
          {inviteError && <div className="bg-red-50 border border-red-200 rounded-[10px] px-3.5 py-2.5 text-sm text-red-700" role="alert">{inviteError}</div>}

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-semibold text-slate-700">Full name <span className="text-red-500">*</span></label>
            <input value={inviteForm.fullName} onChange={(e) => setInviteForm({ ...inviteForm, fullName: e.target.value })}
              className="w-full h-10 bg-white border border-slate-200 rounded-[10px] px-3 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#BE1B2C]/20" />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-semibold text-slate-700">Work email address <span className="text-red-500">*</span></label>
            <div className="relative">
              <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input type="email" value={inviteForm.email} onChange={(e) => setInviteForm({ ...inviteForm, email: e.target.value })}
                placeholder="colleague@drewel.ops"
                className="w-full h-10 bg-white border border-slate-200 rounded-[10px] pl-9 pr-4 text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#BE1B2C]/20" />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-semibold text-slate-700">Temporary password <span className="text-red-500">*</span></label>
            <input type="password" value={inviteForm.password} onChange={(e) => setInviteForm({ ...inviteForm, password: e.target.value })}
              placeholder="At least 8 characters"
              className="w-full h-10 bg-white border border-slate-200 rounded-[10px] px-3 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#BE1B2C]/20" />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-semibold text-slate-700">Role</label>
            <div className="grid grid-cols-2 gap-2">
              {MANAGEABLE_ROLES.map((r) => {
                const cfg = ROLE_CONFIG[r];
                return (
                  <button key={r} type="button"
                    onClick={() => setInviteForm({ ...inviteForm, role: r })}
                    className={`flex items-start gap-2.5 p-3 rounded-[10px] border text-left transition-all
                      ${inviteForm.role === r ? `${cfg.bg} ${cfg.border} ring-1 ring-[#BE1B2C]` : "bg-white border-slate-200 hover:border-slate-300"}`}
                  >
                    <ShieldCheck size={14} className={`mt-0.5 shrink-0 ${inviteForm.role === r ? cfg.color : "text-slate-400"}`} />
                    <p className={`text-sm font-semibold ${inviteForm.role === r ? cfg.color : "text-slate-700"}`}>{cfg.label}</p>
                  </button>
                );
              })}
            </div>
          </div>

          <Card className="p-4">
            <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
              {ROLE_CONFIG[inviteForm.role].label} can
            </h4>
            {permissions.filter((p) => p[inviteForm.role]).slice(0, 5).map((p) => (
              <StatRow key={p.label} label="" value={
                <span className="flex items-center gap-2 text-xs text-green-700">
                  <Check size={11} className="text-green-500 shrink-0" />{p.label}
                </span>
              } />
            ))}
          </Card>

          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => setInviteOpen(false)}>Cancel</Button>
            <Button variant="primary"
              disabled={!inviteForm.fullName.trim() || !inviteForm.email.trim() || inviteForm.password.length < 8}
              loading={inviteLoading} onClick={handleInvite} icon={<Mail size={14} />}>
              Create admin
            </Button>
          </div>
        </div>
      </Modal>

      <Modal open={Boolean(roleTarget)} onClose={() => setRoleTarget(null)} title="Edit role">
        {roleTarget && (
          <div className="flex flex-col gap-4">
            {roleError && <div className="bg-red-50 border border-red-200 rounded-[10px] px-3.5 py-2.5 text-sm text-red-700" role="alert">{roleError}</div>}
            <p className="text-sm text-slate-600">Change the role for <strong>{roleTarget.fullName}</strong> ({roleTarget.email}).</p>
            <Select value={roleValue} onChange={setRoleValue} label="Role"
              options={MANAGEABLE_ROLES.map((r) => ({ value: r, label: ROLE_CONFIG[r].label }))} />
            <div className="flex justify-end gap-3">
              <Button variant="secondary" onClick={() => setRoleTarget(null)}>Cancel</Button>
              <Button variant="primary" loading={roleBusy} onClick={submitRoleChange}>Save role</Button>
            </div>
          </div>
        )}
      </Modal>

      <Modal open={Boolean(statusTarget)} onClose={() => setStatusTarget(null)} title={statusTarget?.isActive === false ? "Reactivate admin" : "Deactivate admin"}>
        {statusTarget && (
          <div className="flex flex-col gap-4">
            {statusError && <div className="bg-red-50 border border-red-200 rounded-[10px] px-3.5 py-2.5 text-sm text-red-700" role="alert">{statusError}</div>}
            <p className="text-sm text-slate-600">
              {statusTarget.isActive === false
                ? <>Restore admin access for <strong>{statusTarget.fullName}</strong> ({statusTarget.email})?</>
                : <><strong>{statusTarget.fullName}</strong> ({statusTarget.email}) will be signed out and unable to log in until reactivated.</>}
            </p>
            <div className="flex justify-end gap-3">
              <Button variant="secondary" onClick={() => setStatusTarget(null)}>Cancel</Button>
              <Button variant={statusTarget.isActive === false ? "primary" : "danger"} loading={statusBusy} onClick={submitStatusChange}>
                {statusTarget.isActive === false ? "Reactivate" : "Deactivate"}
              </Button>
            </div>
          </div>
        )}
      </Modal>

      <Modal open={Boolean(passwordTarget)} onClose={() => setPasswordTarget(null)} title="Reset password">
        {passwordTarget && (
          <div className="flex flex-col gap-4">
            {passwordError && <div className="bg-red-50 border border-red-200 rounded-[10px] px-3.5 py-2.5 text-sm text-red-700" role="alert">{passwordError}</div>}
            <p className="text-sm text-slate-600">
              Set a new password for <strong>{passwordTarget.fullName}</strong> ({passwordTarget.email}). Share it with them through a secure channel.
            </p>
            <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)}
              placeholder="At least 8 characters"
              className="w-full h-10 bg-white border border-slate-200 rounded-[10px] px-3 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#BE1B2C]/20" />
            <div className="flex justify-end gap-3">
              <Button variant="secondary" onClick={() => setPasswordTarget(null)}>Cancel</Button>
              <Button variant="primary" disabled={newPassword.length < 8} loading={passwordBusy} onClick={submitPasswordReset}>Reset password</Button>
            </div>
          </div>
        )}
      </Modal>

      {toast && <Toast message={toast} type="success" onClose={() => setToast(null)} />}
    </div>
  );
};

export default TeamRoles;
