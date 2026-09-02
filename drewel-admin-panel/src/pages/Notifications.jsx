import { useCallback, useEffect, useMemo, useState } from "react";
import {
  RefreshCw, Search, Send, Bell,
} from "lucide-react";
import {
  getAdminNotifications, sendAdminNotification, notificationsErrorMessage,
} from "../api/domains/notifications";
import {
  Badge, Button, Card, Drawer, EmptyState, ErrorState, Input,
  LoadingState, Modal, Pagination, SectionHeader, Select, Toast,
} from "../components/ui";

const RECIPIENT_OPTIONS = [
  { value: "", label: "All Types" },
  { value: "user", label: "Users" },
  { value: "driver", label: "Drivers" },
  { value: "admin", label: "Admins" },
];

const BROADCAST_TARGETS = [
  { value: "both", label: "All Users & Drivers" },
  { value: "user", label: "Users Only" },
  { value: "driver", label: "Drivers Only" },
];

function formatDate(v) {
  if (!v) return "\u2014";
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(v));
}

function formatRelTime(iso) {
  if (!iso) return "\u2014";
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 60000) return "just now";
  const m = Math.floor(diff / 60000);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

const Notifications = () => {
  const [notifications, setNotifications] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [recipientFilter, setRecipientFilter] = useState("");
  const [search, setSearch] = useState("");
  const [toast, setToast] = useState(null);
  const [selected, setSelected] = useState(null);
  const [broadcastModal, setBroadcastModal] = useState(false);
  const [broadcastForm, setBroadcastForm] = useState({ recipients: "both", title: "", message: "", type: "GENERAL" });
  const [broadcastLoading, setBroadcastLoading] = useState(false);

  const load = useCallback(async (signal) => {
    try {
      setLoading(true);
      setError("");
      const result = await getAdminNotifications(
        {
          page: pagination.page,
          limit: pagination.limit,
          recipientType: recipientFilter || undefined,
        },
        signal,
      );
      setNotifications(result.notifications);
      setPagination((p) => ({ ...p, total: result.pagination.total, totalPages: result.pagination.totalPages }));
    } catch (err) {
      if (err?.name === "CanceledError" || err?.code === "ERR_CANCELED") return;
      setError(notificationsErrorMessage(err, "Failed to load notifications."));
    } finally {
      setLoading(false);
    }
  }, [pagination.page, pagination.limit, recipientFilter]);

  useEffect(() => {
    const controller = new AbortController();
    load(controller.signal);
    return () => controller.abort();
  }, [load]);

  const filteredNotifications = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return notifications;
    return notifications.filter((notification) =>
      [notification.title, notification.message, notification.type]
        .some((value) => String(value || "").toLowerCase().includes(term)),
    );
  }, [notifications, search]);

  const handleBroadcast = useCallback(async () => {
    if (!broadcastForm.message.trim()) return;
    setBroadcastLoading(true);
    try {
      await sendAdminNotification(broadcastForm);
      setToast({ message: "Notification broadcast sent successfully.", type: "success" });
      setBroadcastModal(false);
      setBroadcastForm({ recipients: "both", title: "", message: "", type: "GENERAL" });
      load();
    } catch (err) {
      setToast({
        message: notificationsErrorMessage(err, "Failed to send notification."),
        type: "error",
      });
    } finally {
      setBroadcastLoading(false);
    }
  }, [broadcastForm, load]);

  const recipientTypeVariant = (type) => {
    if (type === "driver") return "info";
    if (type === "user") return "approved";
    return "pending";
  };

  return (
    <div className="space-y-6">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      <SectionHeader
        title="Notifications"
        description="View all in-app and push notifications sent across the platform. Broadcast new messages to users and drivers."
        actions={
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" icon={<RefreshCw size={13} className={loading ? "animate-spin" : ""} />} onClick={load}>
              Refresh
            </Button>
            <Button size="sm" icon={<Send size={13} />} onClick={() => setBroadcastModal(true)}>
              Send Broadcast
            </Button>
          </div>
        }
      />

      <Card className="overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100 flex flex-wrap items-center gap-2">
          <div className="min-w-[200px] flex-1">
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search notifications..." leftIcon={<Search size={14} />} />
          </div>
          <Select
            value={recipientFilter}
            onChange={(value) => {
              setRecipientFilter(value);
              setPagination((previous) => ({ ...previous, page: 1 }));
            }}
            options={RECIPIENT_OPTIONS}
          />
        </div>

        {loading ? (
          <LoadingState label="Loading notifications..." />
        ) : error ? (
          <ErrorState title="Unable to load notifications" description={error} action={<Button variant="secondary" onClick={load}>Retry</Button>} />
        ) : filteredNotifications.length === 0 ? (
          <EmptyState
            title="No notifications found"
            description={search ? "No notifications on this page match your search." : "No notifications have been sent yet."}
            icon={<Bell size={24} className="text-slate-300" />}
          />
        ) : (
          <div className="divide-y divide-slate-100">
            {filteredNotifications.map((n) => (
              <div
                key={n.id}
                onClick={() => setSelected(n)}
                className="px-4 py-3.5 hover:bg-slate-50 cursor-pointer transition-colors flex items-start gap-3"
              >
                <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-white text-xs font-bold
                  ${n.recipientType === "driver" ? "bg-blue-500" : n.recipientType === "user" ? "bg-green-500" : "bg-amber-500"}`}>
                  {n.recipientType === "driver" ? "D" : n.recipientType === "user" ? "U" : "A"}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    {n.title && <span className="text-sm font-semibold text-slate-800 truncate">{n.title}</span>}
                    <Badge variant={recipientTypeVariant(n.recipientType)} label={n.recipientType} />
                    {n.read ? (
                      <span className="text-[10px] font-medium text-green-600 bg-green-50 border border-green-200 px-1.5 py-0.5 rounded-full">Read</span>
                    ) : (
                      <span className="text-[10px] font-medium text-amber-600 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded-full">Unread</span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">{n.message}</p>
                  <div className="flex items-center gap-3 mt-1.5 text-[11px] text-slate-400">
                    <span>{n.type || "General"}</span>
                    <span>{formatRelTime(n.createdAt)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {!loading && !error && notifications.length > 0 && (
          <Pagination page={pagination.page} total={pagination.total} perPage={pagination.limit} onChange={(p) => setPagination((prev) => ({ ...prev, page: p }))} />
        )}
      </Card>

      {/* Detail Drawer */}
      <Drawer open={Boolean(selected)} onClose={() => setSelected(null)} title="Notification Details" width="w-[480px]">
        {selected && (
          <div className="p-6 space-y-4">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant={recipientTypeVariant(selected.recipientType)} label={selected.recipientType} />
                {selected.read ? (
                  <span className="text-xs font-medium text-green-600 bg-green-50 border border-green-200 px-2 py-0.5 rounded-full">Read</span>
                ) : (
                  <span className="text-xs font-medium text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">Unread</span>
                )}
              </div>
              {selected.title && <h3 className="text-base font-semibold text-slate-800 mt-2">{selected.title}</h3>}
            </div>

            <div className="bg-slate-50 border border-slate-100 rounded-[10px] p-4">
              <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">{selected.message}</p>
            </div>

            <div className="space-y-0">
              <div className="flex items-center justify-between py-2.5 border-b border-slate-100">
                <span className="text-xs text-slate-400">Type</span>
                <span className="text-sm font-medium text-slate-700">{selected.type || "General"}</span>
              </div>
              <div className="flex items-center justify-between py-2.5 border-b border-slate-100">
                <span className="text-xs text-slate-400">Sent</span>
                <span className="text-sm text-slate-700">{formatDate(selected.createdAt)}</span>
              </div>
              {selected.readAt && (
                <div className="flex items-center justify-between py-2.5 border-b border-slate-100">
                  <span className="text-xs text-slate-400">Read at</span>
                  <span className="text-sm text-slate-700">{formatDate(selected.readAt)}</span>
                </div>
              )}
              {selected.deepLink && (
                <div className="flex items-center justify-between py-2.5">
                  <span className="text-xs text-slate-400">Deep link</span>
                  <span className="text-sm text-slate-700 font-mono">{selected.deepLink}</span>
                </div>
              )}
            </div>
          </div>
        )}
      </Drawer>

      {/* Broadcast Modal */}
      <Modal open={broadcastModal} onClose={() => setBroadcastModal(false)} title="Send Broadcast Notification">
        <div className="space-y-4">
          <div className="bg-amber-50 border border-amber-200 rounded-[10px] px-3.5 py-2.5 text-xs text-amber-700">
            This will send an in-app notification (and push if configured) to all selected recipients.
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-slate-700">Recipients</label>
            <select
              value={broadcastForm.recipients}
              onChange={(e) => setBroadcastForm((prev) => ({ ...prev, recipients: e.target.value }))}
              className="h-10 bg-white border border-slate-200 rounded-[10px] px-3 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#BE1B2C]/20 focus:border-[#BE1B2C]/40"
            >
              {BROADCAST_TARGETS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-slate-700">Title (optional)</label>
            <input
              type="text"
              value={broadcastForm.title}
              onChange={(e) => setBroadcastForm((prev) => ({ ...prev, title: e.target.value }))}
              maxLength={160}
              placeholder="Notification title..."
              className="h-10 bg-white border border-slate-200 rounded-[10px] px-3 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#BE1B2C]/20 focus:border-[#BE1B2C]/40"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-slate-700">Message <span className="text-red-500">*</span></label>
            <textarea
              value={broadcastForm.message}
              onChange={(e) => setBroadcastForm((prev) => ({ ...prev, message: e.target.value }))}
              rows={4}
              maxLength={1000}
              placeholder="Notification message (1-1000 characters)..."
              className="w-full bg-white border border-slate-200 rounded-[10px] p-3 text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#BE1B2C]/20 focus:border-[#BE1B2C]/40 resize-none"
            />
            <p className="text-[11px] text-slate-400 text-right">{broadcastForm.message.length}/1000</p>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-slate-700">Type</label>
            <input
              type="text"
              value={broadcastForm.type}
              onChange={(e) => setBroadcastForm((prev) => ({ ...prev, type: e.target.value }))}
              maxLength={80}
              placeholder="GENERAL"
              className="h-10 bg-white border border-slate-200 rounded-[10px] px-3 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#BE1B2C]/20 focus:border-[#BE1B2C]/40"
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" onClick={() => setBroadcastModal(false)}>Cancel</Button>
            <Button onClick={handleBroadcast} loading={broadcastLoading} disabled={!broadcastForm.message.trim()} icon={<Send size={13} />}>
              Send Notification
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default Notifications;
