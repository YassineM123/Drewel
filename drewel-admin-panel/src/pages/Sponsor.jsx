import { useCallback, useEffect, useState } from "react";
import Swal from "sweetalert2";
import {
  Image, Plus, Pencil, Trash2, Eye, EyeOff, Calendar, BarChart3,
  ShieldCheck, AlertTriangle, X,
} from "lucide-react";
import {
  addBanner,
  bannersErrorMessage,
  deleteBanner,
  getBanners,
  getContentAudits,
  toggleBannerStatus,
  updateBanner,
} from "../api/domains/banners";
import SafeImage from "../components/SafeImage";

const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const PLACEMENTS = ["home", "splash", "ride", "checkout", "promo"];

const fmtDate = (iso) => {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
};

const dateValue = (iso) => (iso ? new Date(iso).toISOString().slice(0, 10) : "");

function StatusPill({ active }) {
  return active ? (
    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-green-700 bg-green-50 border border-green-200 px-2 py-0.5 rounded-full">
      <Eye size={10} /> Active
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-slate-500 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-full">
      <EyeOff size={10} /> Inactive
    </span>
  );
}

function BannerForm({ banner, onCancel, onSaved, onToast }) {
  const [title, setTitle] = useState(banner?.title || "");
  const [placement, setPlacement] = useState(banner?.placement || "home");
  const [active, setActive] = useState(banner?.active ?? true);
  const [startDate, setStartDate] = useState(dateValue(banner?.startDate));
  const [endDate, setEndDate] = useState(dateValue(banner?.endDate));
  const [image, setImage] = useState(null);
  const [preview, setPreview] = useState(banner?.imageUrl || null);
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    setFormError("");
    if (!file) {
      setImage(null);
      setPreview(banner?.imageUrl || null);
      return;
    }
    if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
      e.target.value = "";
      setFormError("Choose a JPG, PNG, WebP, or GIF image.");
      return;
    }
    if (file.size > MAX_IMAGE_SIZE) {
      e.target.value = "";
      setFormError("The image must be 5 MB or smaller.");
      return;
    }
    setImage(file);
    const reader = new FileReader();
    reader.onload = (ev) => setPreview(ev.target.result);
    reader.onerror = () => setFormError("The selected image could not be read.");
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError("");
    if (!banner && !image) {
      setFormError("Please select a banner image.");
      return;
    }
    if (startDate && endDate && startDate > endDate) {
      setFormError("Start date must not be after end date.");
      return;
    }
    setSaving(true);
    try {
      const formData = new FormData();
      formData.append("title", title);
      formData.append("placement", placement);
      formData.append("active", String(active));
      if (startDate) formData.append("startDate", startDate);
      if (endDate) formData.append("endDate", endDate);
      if (image) formData.append("image", image);

      if (banner) {
        await updateBanner(banner._id, formData);
        onToast("Banner updated and audited.");
      } else {
        await addBanner(formData);
        onToast("Banner created and audited.");
      }
      onSaved();
    } catch (error) {
      setFormError(bannersErrorMessage(error, "Operation failed."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onCancel}>
      <div className="relative bg-white rounded-[16px] shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <button type="button" onClick={onCancel}
          className="absolute top-3 right-3 w-8 h-8 flex items-center justify-center rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 transition-colors"
          aria-label="Close">
          <X size={14} />
        </button>
        <div className="p-6 border-b border-slate-100">
          <h3 className="text-base font-bold text-slate-900">{banner ? "Edit Banner" : "Create Banner"}</h3>
          <p className="text-xs text-slate-400 mt-0.5">Changes are confirmed and written to the audit log.</p>
        </div>
        <form onSubmit={handleSubmit} className="p-6 flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-slate-700">Title</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120}
              placeholder="Banner title"
              className="w-full h-10 bg-white border border-slate-200 rounded-[10px] px-3 text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-red-700/20 focus:border-red-400 transition-all" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-slate-700">Placement</label>
              <select value={placement} onChange={(e) => setPlacement(e.target.value)}
                className="h-10 bg-white border border-slate-200 rounded-[10px] px-3 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-red-700/20 focus:border-red-400 transition-all">
                {PLACEMENTS.map((p) => <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-1.5 justify-end">
              <label className="flex items-center gap-2 text-sm font-medium text-slate-700 pb-2 cursor-pointer">
                <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)}
                  className="w-3.5 h-3.5 accent-[#BE1B2C]" />
                Active
              </label>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-slate-700">Start date</label>
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)}
                className="h-10 bg-white border border-slate-200 rounded-[10px] px-3 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-red-700/20 focus:border-red-400 transition-all" />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-slate-700">End date</label>
              <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)}
                className="h-10 bg-white border border-slate-200 rounded-[10px] px-3 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-red-700/20 focus:border-red-400 transition-all" />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-slate-700">Banner image</label>
            <input type="file" accept={ACCEPTED_IMAGE_TYPES.join(",")} onChange={handleImageChange}
              className="block w-full border border-gray-300 rounded-[10px] px-3 py-2 bg-white cursor-pointer focus:outline-none focus:ring-2 focus:ring-red-700/20" />
            {preview && (
              <SafeImage src={preview} alt="Banner preview" fallbackLabel="Banner preview unavailable"
                className="w-full max-h-44 object-cover rounded-[10px] mt-1 border border-gray-200" />
            )}
            <small className="text-xs text-slate-400">JPG, PNG, WebP, or GIF. Maximum 5 MB.</small>
          </div>

          {formError && <div className="bg-red-50 border border-red-200 rounded-[10px] px-3 py-2 text-xs text-red-700" role="alert">{formError}</div>}

          <div className="flex justify-end gap-3">
            <button type="button" onClick={onCancel}
              className="h-9 inline-flex items-center gap-2 px-3.5 rounded-[10px] border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-all">
              Cancel
            </button>
            <button type="submit" disabled={saving}
              className="h-9 inline-flex items-center gap-2 px-3.5 rounded-[10px] bg-[#BE1B2C] text-xs font-semibold text-white hover:bg-[#A31725] disabled:opacity-60 transition-all">
              {saving ? <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Plus size={13} />}
              {banner ? "Update Banner" : "Create Banner"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function Sponsor() {
  const [banners, setBanners] = useState([]);
  const [audits, setAudits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [modal, setModal] = useState(null);
  const [toast, setToast] = useState(null);

  const fetchBanners = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      setBanners(await getBanners());
    } catch (error) {
      setLoadError(bannersErrorMessage(error, "Failed to fetch banners."));
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchAudits = useCallback(async () => {
    try {
      const result = await getContentAudits({ entityType: "banner", page: 1, limit: 8 });
      setAudits(result.items || []);
    } catch {
      setAudits([]);
    }
  }, []);

  useEffect(() => { void fetchBanners(); void fetchAudits(); }, [fetchBanners, fetchAudits]);

  const handleToggle = async (banner) => {
    const next = !banner.active;
    const confirm = await Swal.fire({
      title: next ? "Activate banner?" : "Deactivate banner?",
      text: next
        ? `"${banner.title || "Untitled"}" will become visible in the app.`
        : `"${banner.title || "Untitled"}" will be hidden from the app.`,
      icon: "question",
      showCancelButton: true,
      confirmButtonText: next ? "Yes, activate" : "Yes, deactivate",
      cancelButtonText: "Cancel",
    });
    if (!confirm.isConfirmed) return;
    try {
      await toggleBannerStatus(banner._id, next);
      setToast({ message: next ? "Banner activated." : "Banner deactivated.", type: "success" });
      void fetchBanners();
      void fetchAudits();
    } catch (error) {
      setToast({ message: bannersErrorMessage(error, "Unable to update banner status."), type: "error" });
    }
  };

  const handleDelete = async (banner) => {
    const confirm = await Swal.fire({
      title: "Delete banner?",
      text: "This permanently removes the banner. The change is recorded in the audit log.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Yes, delete it!",
      cancelButtonText: "Cancel",
    });
    if (!confirm.isConfirmed) return;
    try {
      await deleteBanner(banner._id);
      setToast({ message: "Banner deleted.", type: "success" });
      void fetchBanners();
      void fetchAudits();
    } catch (error) {
      setToast({ message: bannersErrorMessage(error, "Delete failed."), type: "error" });
    }
  };

  const activeCount = banners.filter((b) => b.active).length;
  const totalImpressions = banners.reduce((sum, b) => sum + (b.impressionCount || 0), 0);
  const totalClicks = banners.reduce((sum, b) => sum + (b.clickCount || 0), 0);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-[22px] font-bold text-slate-900 leading-tight tracking-[-0.01em]">Sponsor Banners</h1>
          <p className="text-sm text-slate-500 mt-0.5">Manage production banner images, scheduling and placement across Drewel apps.</p>
        </div>
        <button type="button" onClick={() => setModal({})}
          className="h-9 inline-flex items-center gap-2 px-4 rounded-[10px] bg-[#BE1B2C] text-xs font-semibold text-white hover:bg-[#A31725] transition-all">
          <Plus size={14} /> Create Banner
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: "Total banners", value: banners.length, icon: Image },
          { label: "Active", value: activeCount, icon: Eye },
          { label: "Impressions", value: totalImpressions.toLocaleString(), icon: BarChart3 },
          { label: "Clicks", value: totalClicks.toLocaleString(), icon: Eye },
        ].map((kpi) => (
          <div key={kpi.label} className="bg-white rounded-[14px] border border-slate-200 p-4">
            <div className="flex items-center gap-2 mb-2">
              <kpi.icon size={14} className="text-[#BE1B2C]" />
              <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">{kpi.label}</span>
            </div>
            <p className="text-xl font-black tabular-nums text-slate-900">{kpi.value}</p>
          </div>
        ))}
      </div>

      {loadError && (
        <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-[10px] px-4 py-3" role="alert">
          <AlertTriangle size={16} className="text-red-500 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm text-red-700">{loadError}</p>
            <button type="button" onClick={fetchBanners} className="text-xs font-semibold text-red-700 hover:text-red-900 mt-1">Retry</button>
          </div>
        </div>
      )}

      <div className="bg-white rounded-[14px] border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="text-left text-[11px] font-semibold text-slate-400 uppercase tracking-wider px-5 py-3">Preview</th>
                <th className="text-left text-[11px] font-semibold text-slate-400 uppercase tracking-wider px-5 py-3">Banner</th>
                <th className="text-left text-[11px] font-semibold text-slate-400 uppercase tracking-wider px-5 py-3">Placement</th>
                <th className="text-left text-[11px] font-semibold text-slate-400 uppercase tracking-wider px-5 py-3">Schedule</th>
                <th className="text-left text-[11px] font-semibold text-slate-400 uppercase tracking-wider px-5 py-3">Stats</th>
                <th className="text-left text-[11px] font-semibold text-slate-400 uppercase tracking-wider px-5 py-3">Status</th>
                <th className="text-left text-[11px] font-semibold text-slate-400 uppercase tracking-wider px-5 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7}>
                  <div className="flex items-center justify-center py-16">
                    <div className="w-6 h-6 border-2 border-[#BE1B2C]/30 border-t-[#BE1B2C] rounded-full animate-spin" />
                  </div>
                </td></tr>
              ) : banners.length === 0 ? (
                <tr><td colSpan={7}>
                  <div className="flex flex-col items-center gap-2 py-16 text-center">
                    <Image size={24} className="text-slate-300" />
                    <p className="text-sm font-medium text-slate-600">No banners yet</p>
                    <p className="text-xs text-slate-400">Create your first sponsor banner to get started.</p>
                  </div>
                </td></tr>
              ) : banners.map((banner) => (
                <tr key={banner._id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                  <td className="px-5 py-3">
                    <SafeImage src={banner.imageUrl} alt={banner.title || "Banner"} fallbackLabel="Banner"
                      className="w-24 h-14 object-cover rounded-[10px] border border-slate-100" />
                  </td>
                  <td className="px-5 py-3">
                    <p className="text-sm font-medium text-slate-800">{banner.title || "Untitled banner"}</p>
                    <p className="text-[10px] font-mono text-slate-400">{banner._id?.slice(-8) || ""}</p>
                  </td>
                  <td className="px-5 py-3">
                    <span className="inline-flex text-[10px] font-semibold text-slate-600 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-full capitalize">
                      {banner.placement || "home"}
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-1 text-xs text-slate-600">
                      <Calendar size={11} className="text-slate-400" />
                      {fmtDate(banner.startDate)} — {fmtDate(banner.endDate)}
                    </div>
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex flex-col gap-0.5 text-xs">
                      <span className="text-slate-600">{banner.impressionCount || 0} impressions</span>
                      <span className="text-slate-600">{banner.clickCount || 0} clicks</span>
                    </div>
                  </td>
                  <td className="px-5 py-3"><StatusPill active={banner.active} /></td>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-1.5">
                      <button type="button" onClick={() => setModal(banner)}
                        className="h-7 inline-flex items-center gap-1 px-2.5 rounded-[8px] border border-slate-200 bg-white text-[10px] font-semibold text-slate-600 hover:bg-slate-50 transition-all">
                        <Pencil size={10} /> Edit
                      </button>
                      <button type="button" onClick={() => handleToggle(banner)}
                        className="h-7 inline-flex items-center gap-1 px-2.5 rounded-[8px] border border-slate-200 bg-white text-[10px] font-semibold text-slate-600 hover:bg-slate-50 transition-all"
                        aria-label={banner.active ? "Deactivate banner" : "Activate banner"}>
                        {banner.active ? <EyeOff size={10} /> : <Eye size={10} />}
                        {banner.active ? "Deactivate" : "Activate"}
                      </button>
                      <button type="button" onClick={() => handleDelete(banner)}
                        className="h-7 inline-flex items-center gap-1 px-2.5 rounded-[8px] border border-red-200 bg-white text-[10px] font-semibold text-red-600 hover:bg-red-50 transition-all">
                        <Trash2 size={10} /> Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-white rounded-[14px] border border-slate-200 p-5">
        <div className="flex items-center gap-2 mb-3">
          <ShieldCheck size={14} className="text-slate-400" />
          <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Recent content changes (audited)</h4>
        </div>
        {audits.length === 0 ? (
          <p className="text-xs text-slate-400">No content changes recorded yet.</p>
        ) : (
          <div className="flex flex-col">
            {audits.map((audit) => (
              <div key={audit.id} className="flex items-center justify-between gap-3 py-2 border-b border-slate-50 last:border-0">
                <div className="flex items-center gap-2">
                  <span className={`text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded
                    ${["deleted", "deactivated"].includes(audit.action) ? "bg-red-50 text-red-700" : audit.action === "created" ? "bg-green-50 text-green-700" : "bg-sky-50 text-sky-700"}`}>
                    {audit.action}
                  </span>
                  <span className="text-xs text-slate-600">{audit.actorName || "Admin"}</span>
                </div>
                <span className="text-[10px] text-slate-400">{new Date(audit.occurredAt).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {modal && <BannerForm banner={modal._id ? modal : null} onCancel={() => setModal(null)}
        onSaved={() => { setModal(null); void fetchBanners(); void fetchAudits(); }}
        onToast={(msg) => setToast({ message: msg, type: "success" })} />}

      {toast && (
        <div className={`fixed bottom-6 right-6 z-[70] px-4 py-3 rounded-[12px] shadow-xl text-sm font-semibold
          ${toast.type === "success" ? "bg-green-600 text-white" : "bg-red-600 text-white"}`}>
          {toast.message}
        </div>
      )}
    </div>
  );
}