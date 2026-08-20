import { useState, useEffect } from "react";
import {
  Card, Button, SectionHeader, Th, Td, Tr, Avatar, Badge, Modal, Toast, StatRow
} from "../components/ui";
import { ShieldCheck, UserPlus, Mail, MoreHorizontal, Check, X } from "lucide-react";
import { getTeam } from "../api";

interface TeamMember {
  id: string;
  name: string;
  avatar: string;
  email: string;
  role: "owner" | "admin" | "support" | "analyst";
  status: "active" | "inactive";
  lastActive: string;
  addedAt: string;
}

const ROLE_CONFIG: Record<string, { label: string; color: string; bg: string; border: string }> = {
  owner:   { label: "Owner",   color: "text-violet-700", bg: "bg-violet-50",  border: "border-violet-200" },
  admin:   { label: "Admin",   color: "text-violet-700",   bg: "bg-violet-50",    border: "border-violet-200"   },
  support: { label: "Support", color: "text-amber-700",  bg: "bg-amber-50",   border: "border-amber-200"  },
  analyst: { label: "Analyst", color: "text-slate-600",  bg: "bg-slate-100",  border: "border-slate-200"  },
};

interface TeamMember {
  id: string;
  name: string;
  avatar: string;
  email: string;
  role: "owner" | "admin" | "support" | "analyst";
  status: "active" | "inactive";
  lastActive: string;
  addedAt: string;
}

const PERMISSIONS: { label: string; owner: boolean; admin: boolean; support: boolean; analyst: boolean }[] = [
  { label: "View Dashboard & KPIs",         owner: true,  admin: true,  support: true,  analyst: true  },
  { label: "View Live Rides",               owner: true,  admin: true,  support: true,  analyst: true  },
  { label: "Cancel or Intervene in Rides",  owner: true,  admin: true,  support: false, analyst: false },
  { label: "Resolve Disputes",              owner: true,  admin: true,  support: false, analyst: false },
  { label: "View Driver Profiles",          owner: true,  admin: true,  support: true,  analyst: true  },
  { label: "Restrict / Unrestrict Drivers", owner: true,  admin: true,  support: false, analyst: false },
  { label: "Approve Verification Requests", owner: true,  admin: true,  support: false, analyst: false },
  { label: "View Point Balances",           owner: true,  admin: true,  support: true,  analyst: true  },
  { label: "Add Points to Drivers",         owner: true,  admin: false, support: false, analyst: false },
  { label: "Approve Point Requests",        owner: true,  admin: false, support: false, analyst: false },
  { label: "Read Chat / Calls",             owner: true,  admin: true,  support: true,  analyst: false },
  { label: "Manage Sponsor Banners",        owner: true,  admin: true,  support: false, analyst: false },
  { label: "View Audit Logs",               owner: true,  admin: true,  support: false, analyst: false },
  { label: "Acknowledge & Resolve Alerts",  owner: true,  admin: true,  support: false, analyst: false },
  { label: "Manage Team & Roles",           owner: true,  admin: false, support: false, analyst: false },
  { label: "Edit Operational Settings",     owner: true,  admin: false, support: false, analyst: false },
];

export default function TeamRoles() {
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<TeamMember["role"]>("support");
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"members" | "permissions">("members");
  const [team, setTeam] = useState<TeamMember[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await getTeam({ limit: 50 });
        if (!cancelled) setTeam(res.admins ?? []);
      } catch (err) {
        console.error("Failed to load team", err);
      } finally {
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const handleInvite = () => {
    if (!inviteEmail.trim()) return;
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      setInviteOpen(false);
      setInviteEmail("");
      setToast(`Invitation sent to ${inviteEmail}.`);
    }, 900);
  };

  return (
    <div className="flex flex-col gap-6">
      <SectionHeader
        title="Team & Roles"
        description="Manage admin access, roles, and permission boundaries."
        actions={
          <Button variant="primary" size="sm" icon={<UserPlus size={14} />} onClick={() => setInviteOpen(true)}>
            Invite Member
          </Button>
        }
      />

      {/* Tab switcher */}
      <div className="flex gap-1 bg-slate-100 rounded-[10px] p-1 w-fit">
        {(["members", "permissions"] as const).map(t => (
          <button key={t} onClick={() => setActiveTab(t)}
            className={`px-4 py-2 rounded-[8px] text-sm font-semibold capitalize transition-all
              ${activeTab === t ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}>
            {t === "members" ? "Team Members" : "Permissions Matrix"}
          </button>
        ))}
      </div>

      {activeTab === "members" && (
        <>
          {/* Role summary */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {(["owner", "admin", "support", "analyst"] as TeamMember["role"][]).map(role => {
              const cfg = ROLE_CONFIG[role];
              const count = team.filter(m => m.role === role).length;
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

          {/* Members table */}
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
                    <Th>Actions</Th>
                  </tr>
                </thead>
                <tbody>
                  {team.map(member => {
                    const cfg = ROLE_CONFIG[member.role];
                    return (
                      <Tr key={member.id}>
                        <Td>
                          <div className="flex items-center gap-3">
                            <Avatar initials={member.avatar} size="sm" />
                            <div>
                              <p className="text-sm font-semibold text-slate-800">{member.name}</p>
                              <p className="text-xs text-slate-400 flex items-center gap-1">
                                <Mail size={10} />{member.email}
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
                          <Badge variant={member.status === "active" ? "active" : "inactive"} dot />
                        </Td>
                        <Td><span className="text-xs text-slate-500">{relTime(member.lastActive)}</span></Td>
                        <Td><span className="text-xs text-slate-500">{formatDate(member.addedAt)}</span></Td>
                        <Td>
                          <div className="flex items-center gap-1">
                            {member.role !== "owner" && (
                              <>
                                <Button variant="secondary" size="sm">Edit Role</Button>
                                <button className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-[7px] transition-colors">
                                  <MoreHorizontal size={14} />
                                </button>
                              </>
                            )}
                            {member.role === "owner" && (
                              <span className="text-xs text-slate-400 italic">Protected</span>
                            )}
                          </div>
                        </Td>
                      </Tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
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
                  {(["owner", "admin", "support", "analyst"] as TeamMember["role"][]).map(r => (
                    <Th key={r} className="text-center w-24">
                      <span className={`${ROLE_CONFIG[r].color}`}>{ROLE_CONFIG[r].label}</span>
                    </Th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {PERMISSIONS.map(p => (
                  <Tr key={p.label}>
                    <Td><span className="text-sm text-slate-700">{p.label}</span></Td>
                    {(["owner", "admin", "support", "analyst"] as TeamMember["role"][]).map(r => (
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

      {/* Invite modal */}
      <Modal open={inviteOpen} onClose={() => setInviteOpen(false)} title="Invite Team Member">
        <div className="flex flex-col gap-4">
          <div className="bg-amber-50 border border-amber-200 rounded-[10px] p-3 text-sm text-amber-800">
            An invitation email will be sent to the address below. The invitee can set their password on first login.
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-semibold text-slate-700">Work email address <span className="text-red-500">*</span></label>
            <div className="relative">
              <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="email"
                value={inviteEmail}
                onChange={e => setInviteEmail(e.target.value)}
                placeholder="colleague@drewel.ops"
                className="w-full h-10 bg-white border border-slate-200 rounded-[10px] pl-9 pr-4 text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-red-700/20 focus:border-red-400 transition-all"
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-semibold text-slate-700">Role</label>
            <div className="grid grid-cols-2 gap-2">
              {(["admin", "support", "analyst"] as TeamMember["role"][]).map(r => {
                const cfg = ROLE_CONFIG[r];
                return (
                  <button key={r}
                    onClick={() => setInviteRole(r)}
                    className={`flex items-start gap-2.5 p-3 rounded-[10px] border text-left transition-all
                      ${inviteRole === r ? `${cfg.bg} ${cfg.border} ring-1 ring-[#BE1B2C]` : "bg-white border-slate-200 hover:border-slate-300"}`}
                  >
                    <ShieldCheck size={14} className={`mt-0.5 shrink-0 ${inviteRole === r ? cfg.color : "text-slate-400"}`} />
                    <div>
                      <p className={`text-sm font-semibold ${inviteRole === r ? cfg.color : "text-slate-700"}`}>{cfg.label}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Permission summary */}
          <Card className="p-4">
            <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
              {ROLE_CONFIG[inviteRole].label} can
            </h4>
            {PERMISSIONS.filter(p => p[inviteRole]).slice(0, 5).map(p => (
              <StatRow key={p.label} label="" value={
                <span className="flex items-center gap-2 text-xs text-green-700">
                  <Check size={11} className="text-green-500 shrink-0" />{p.label}
                </span>
              } />
            ))}
            {PERMISSIONS.filter(p => p[inviteRole]).length > 5 && (
              <p className="text-xs text-slate-400 mt-2 text-right">+{PERMISSIONS.filter(p => p[inviteRole]).length - 5} more permissions</p>
            )}
          </Card>

          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => setInviteOpen(false)}>Cancel</Button>
            <Button variant="primary" disabled={!inviteEmail.trim()} loading={loading} onClick={handleInvite} icon={<Mail size={14} />}>
              Send Invitation
            </Button>
          </div>
        </div>
      </Modal>

      {toast && <Toast message={toast} type="success" onClose={() => setToast(null)} />}
    </div>
  );
}

function relTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const h = Math.floor(diff / 3600000);
  if (h < 1) return "< 1h ago";
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}
