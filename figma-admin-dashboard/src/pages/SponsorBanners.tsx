import { useState, useRef, useEffect } from "react";
import { Plus, LayoutGrid, List, Eye, Pencil, Trash2, Archive, ToggleLeft, ToggleRight, Image } from "lucide-react";
import {
  Badge, Button, Card, Modal, ConfirmDialog, Toast, SectionHeader, EmptyState, StatRow
} from "../components/ui";
import { getBanners, deleteBanner as apiDeleteBanner, toggleBannerStatus } from "../api";

type ViewMode = "grid" | "list";

export default function SponsorBanners() {
  const [view, setView] = useState<ViewMode>("grid");
  const [banners, setBanners] = useState<any[]>([]);
  const [previewBanner, setPreviewBanner] = useState<any | null>(null);
  const [deleteBanner, setDeleteBanner] = useState<any | null>(null);
  const [archiveBanner, setArchiveBanner] = useState<any | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);
  const [loading, setLoading] = useState(false);

  // Create form state
  const [createTitle, setCreateTitle] = useState("");
  const [createBrand, setCreateBrand] = useState("");
  const [createStart, setCreateStart] = useState("");
  const [createEnd, setCreateEnd] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState("");

  const resetCreate = () => { setCreateTitle(""); setCreateBrand(""); setCreateStart(""); setCreateEnd(""); setFileName(""); };
  const createValid = createTitle.trim() && createBrand.trim() && createStart && createEnd;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await getBanners();
        if (!cancelled) setBanners(data);
      } catch (err) {
        console.error("Failed to load banners", err);
      } finally {
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const active = banners.filter(b => (b.status ?? "draft") === "active").length;
  const inactive = banners.filter(b => (b.status ?? "draft") === "inactive").length;
  const draft = banners.filter(b => (b.status ?? "draft") === "draft").length;

  const handleDelete = async () => {
    if (!deleteBanner) return;
    setLoading(true);
    try {
      await apiDeleteBanner(deleteBanner.id);
      setBanners(prev => prev.filter(b => b.id !== deleteBanner.id));
      setToast({ msg: "Banner deleted successfully.", type: "success" });
    } catch (err) {
      console.error("Failed to delete banner", err);
      setToast({ msg: "Failed to delete banner.", type: "error" });
    } finally {
      setLoading(false);
      setDeleteBanner(null);
    }
  };

  const handleArchive = async () => {
    if (!archiveBanner) return;
    setLoading(true);
    try {
      await toggleBannerStatus(archiveBanner.id, false);
      setBanners(prev => prev.map(b => b.id === archiveBanner.id ? { ...b, status: "inactive" } : b));
      setToast({ msg: "Banner archived.", type: "success" });
    } catch (err) {
      console.error("Failed to archive banner", err);
      setToast({ msg: "Failed to archive banner.", type: "error" });
    } finally {
      setLoading(false);
      setArchiveBanner(null);
    }
  };

  const toggleStatus = async (id: string) => {
    const banner = banners.find(b => b.id === id);
    if (!banner) return;
    const newActive = (banner.status ?? "draft") !== "active";
    try {
      await toggleBannerStatus(id, newActive);
      setBanners(prev => prev.map(b => b.id === id ? { ...b, status: newActive ? "active" : "inactive" } : b));
    } catch (err) {
      console.error("Failed to toggle banner status", err);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <SectionHeader
        title="Sponsor Banners"
        description="Manage advertising placements and campaign performance."
        actions={
          <>
            {/* Status summary */}
            <div className="hidden sm:flex items-center gap-2">
              <span className="text-xs text-green-700 bg-green-50 border border-green-200 px-2 py-1 rounded-full font-medium">{active} active</span>
              <span className="text-xs text-slate-500 bg-slate-100 px-2 py-1 rounded-full">{inactive} inactive</span>
              {draft > 0 && <span className="text-xs text-amber-700 bg-amber-50 border border-amber-200 px-2 py-1 rounded-full font-medium">{draft} draft</span>}
            </div>
            {/* View toggle */}
            <div className="flex items-center bg-slate-100 rounded-[8px] p-0.5">
              <button onClick={() => setView("grid")} className={`p-1.5 rounded-[6px] transition-all ${view === "grid" ? "bg-white shadow-sm text-slate-700" : "text-slate-400 hover:text-slate-600"}`}>
                <LayoutGrid size={15} />
              </button>
              <button onClick={() => setView("list")} className={`p-1.5 rounded-[6px] transition-all ${view === "list" ? "bg-white shadow-sm text-slate-700" : "text-slate-400 hover:text-slate-600"}`}>
                <List size={15} />
              </button>
            </div>
            <Button variant="primary" size="sm" icon={<Plus size={15} />} onClick={() => setCreateOpen(true)}>
              New Banner
            </Button>
          </>
        }
      />

      {banners.length === 0 ? (
        <EmptyState
          title="No banners yet"
          description="Create your first sponsor banner to start running campaigns."
          action={<Button variant="primary" size="sm" icon={<Plus size={14} />} onClick={() => setCreateOpen(true)}>Create Banner</Button>}
        />
      ) : view === "grid" ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {banners.map(banner => (
            <BannerCard
              key={banner.id}
              banner={banner}
              onPreview={() => setPreviewBanner(banner)}
              onToggle={() => toggleStatus(banner.id)}
              onArchive={() => setArchiveBanner(banner)}
              onDelete={() => setDeleteBanner(banner)}
            />
          ))}
        </div>
      ) : (
        <Card>
          <div className="divide-y divide-slate-100">
            {banners.map(banner => (
              <BannerRow
                key={banner.id}
                banner={banner}
                onPreview={() => setPreviewBanner(banner)}
                onToggle={() => toggleStatus(banner.id)}
                onArchive={() => setArchiveBanner(banner)}
                onDelete={() => setDeleteBanner(banner)}
              />
            ))}
          </div>
        </Card>
      )}

      {/* Preview modal */}
      <Modal open={!!previewBanner} onClose={() => setPreviewBanner(null)} title="Banner Preview" width="max-w-2xl">
        {previewBanner && (
          <div className="flex flex-col gap-5">
            <div className="relative rounded-[10px] overflow-hidden bg-slate-100 aspect-[2/1]">
              <img src={previewBanner.imageUrl} alt={previewBanner.title} className="w-full h-full object-cover" />
              <div className="absolute top-3 right-3">
                <Badge variant={previewBanner.status as "active" | "inactive" | "draft"} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-x-8">
              <StatRow label="Brand" value={previewBanner.brand} />
              <StatRow label="Placement" value={previewBanner.placement} />
              <StatRow label="Start Date" value={previewBanner.startDate} />
              <StatRow label="End Date" value={previewBanner.endDate} />
              <StatRow label="Targeting" value={previewBanner.targeting} />
              <StatRow label="CTR" value={previewBanner.ctr} />
              <StatRow label="Impressions" value={previewBanner.impressions.toLocaleString()} />
              <StatRow label="Clicks" value={previewBanner.clicks.toLocaleString()} />
            </div>
            <div className="flex justify-end gap-3">
              <Button variant="secondary" icon={<Pencil size={14} />}>Edit</Button>
              <Button variant="primary" icon={previewBanner.status === "active" ? <ToggleRight size={14} /> : <ToggleLeft size={14} />}
                onClick={() => { toggleStatus(previewBanner.id); setPreviewBanner(null); }}>
                {previewBanner.status === "active" ? "Deactivate" : "Activate"}
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Create modal */}
      <Modal open={createOpen} onClose={() => { setCreateOpen(false); resetCreate(); }} title="Create Sponsor Banner">
        <div className="flex flex-col gap-4">
          {/* Upload area */}
          <div
            role="button"
            tabIndex={0}
            onClick={() => fileRef.current?.click()}
            onKeyDown={e => e.key === "Enter" && fileRef.current?.click()}
            className={`border-2 border-dashed rounded-[10px] h-32 flex flex-col items-center justify-center gap-2 cursor-pointer transition-all
              ${fileName ? "border-red-300 bg-red-50/20" : "border-slate-200 hover:border-blue-300 hover:bg-red-50/20"}`}
          >
            <Image size={22} className={fileName ? "text-[#BE1B2C]" : "text-slate-300"} />
            <p className="text-sm font-medium text-slate-600">{fileName || "Click to upload banner image"}</p>
            <p className="text-xs text-slate-400">JPG, PNG or WebP · Max 2MB · 1200×628px recommended</p>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={e => setFileName(e.target.files?.[0]?.name ?? "")}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-slate-700">Campaign Title <span className="text-red-500">*</span></label>
            <input
              value={createTitle}
              onChange={e => setCreateTitle(e.target.value)}
              placeholder="e.g. Lagos Food Festival 2025"
              className="h-10 bg-white border border-slate-200 rounded-[10px] px-3 text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-red-700/20 focus:border-red-400 transition-all"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-slate-700">Brand / Advertiser <span className="text-red-500">*</span></label>
            <input
              value={createBrand}
              onChange={e => setCreateBrand(e.target.value)}
              placeholder="e.g. FoodCo Nigeria"
              className="h-10 bg-white border border-slate-200 rounded-[10px] px-3 text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-red-700/20 focus:border-red-400 transition-all"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-slate-700">Start Date <span className="text-red-500">*</span></label>
              <input
                type="date"
                value={createStart}
                onChange={e => setCreateStart(e.target.value)}
                className="h-10 bg-white border border-slate-200 rounded-[10px] px-3 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-red-700/20 focus:border-red-400 transition-all"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-slate-700">End Date <span className="text-red-500">*</span></label>
              <input
                type="date"
                value={createEnd}
                min={createStart}
                onChange={e => setCreateEnd(e.target.value)}
                className="h-10 bg-white border border-slate-200 rounded-[10px] px-3 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-red-700/20 focus:border-red-400 transition-all"
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" onClick={() => { setCreateOpen(false); resetCreate(); }}>Cancel</Button>
            <Button variant="secondary" disabled={!createValid} onClick={() => { setCreateOpen(false); resetCreate(); setToast({ msg: "Banner saved as draft.", type: "success" }); }}>Save as Draft</Button>
            <Button variant="primary" disabled={!createValid} onClick={() => { setCreateOpen(false); resetCreate(); setToast({ msg: `"${createTitle}" banner created and scheduled.`, type: "success" }); }}>
              Create & Publish
            </Button>
          </div>
        </div>
      </Modal>

      {/* Archive confirm */}
      <ConfirmDialog
        open={!!archiveBanner}
        onClose={() => setArchiveBanner(null)}
        onConfirm={handleArchive}
        loading={loading}
        title="Archive Banner"
        confirmLabel="Archive"
        variant="primary"
        message={<p>Archive <strong>{archiveBanner?.title}</strong>? It will be deactivated and moved to the inactive list. You can reactivate it at any time.</p>}
      />

      {/* Delete confirm */}
      <ConfirmDialog
        open={!!deleteBanner}
        onClose={() => setDeleteBanner(null)}
        onConfirm={handleDelete}
        loading={loading}
        title="Delete Banner"
        confirmLabel="Delete Permanently"
        variant="danger"
        message={<p>Permanently delete <strong>{deleteBanner?.title}</strong>? This action cannot be undone and all performance data will be lost.</p>}
      />

      {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}

function BannerCard({ banner, onPreview, onToggle, onArchive, onDelete }: {
  banner: any; onPreview: () => void; onToggle: () => void; onArchive: () => void; onDelete: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  return (
    <Card className="overflow-hidden">
      <div className="relative bg-slate-100 aspect-[2/1] overflow-hidden cursor-pointer" onClick={onPreview}>
        <img src={banner.imageUrl} alt={banner.title} className="w-full h-full object-cover hover:scale-105 transition-transform duration-300" />
        <div className="absolute top-2.5 right-2.5">
          <Badge variant={banner.status as "active" | "inactive" | "draft"} />
        </div>
      </div>
      <div className="p-4">
        <div className="flex items-start justify-between gap-2 mb-1">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-800 truncate">{banner.title}</p>
            <p className="text-xs text-slate-500 mt-0.5">{banner.brand}</p>
          </div>
          <div className="relative shrink-0">
            <button onClick={() => setMenuOpen(!menuOpen)} className="p-1.5 rounded-[6px] text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="3" r="1.2" fill="currentColor"/><circle cx="8" cy="8" r="1.2" fill="currentColor"/><circle cx="8" cy="13" r="1.2" fill="currentColor"/></svg>
            </button>
            {menuOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
                <div className="absolute right-0 top-full mt-1 w-40 bg-white rounded-[10px] shadow-lg border border-slate-200 z-20 overflow-hidden py-1">
                  <button onClick={() => { onPreview(); setMenuOpen(false); }} className="w-full text-left text-sm text-slate-700 px-3 py-2 hover:bg-slate-50 flex items-center gap-2"><Eye size={13} /> Preview</button>
                  <button onClick={() => { setMenuOpen(false); }} className="w-full text-left text-sm text-slate-700 px-3 py-2 hover:bg-slate-50 flex items-center gap-2"><Pencil size={13} /> Edit</button>
                  <button onClick={() => { onArchive(); setMenuOpen(false); }} className="w-full text-left text-sm text-slate-700 px-3 py-2 hover:bg-slate-50 flex items-center gap-2"><Archive size={13} /> Archive</button>
                  <div className="h-px bg-slate-100 mx-2 my-1" />
                  <button onClick={() => { onDelete(); setMenuOpen(false); }} className="w-full text-left text-sm text-red-600 px-3 py-2 hover:bg-red-50 flex items-center gap-2"><Trash2 size={13} /> Delete</button>
                </div>
              </>
            )}
          </div>
        </div>

        <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
          <span>{banner.placement}</span>
          <span className="text-slate-400">{banner.startDate} – {banner.endDate}</span>
        </div>

        {banner.status !== "draft" && banner.impressions > 0 && (
          <div className="mt-3 grid grid-cols-3 gap-2">
            {[
              { label: "Impressions", value: (banner.impressions / 1000).toFixed(1) + "K" },
              { label: "Clicks", value: banner.clicks.toLocaleString() },
              { label: "CTR", value: banner.ctr },
            ].map(s => (
              <div key={s.label} className="bg-slate-50 rounded-[8px] p-2 text-center">
                <div className="text-sm font-semibold text-slate-700">{s.value}</div>
                <div className="text-[10px] text-slate-400 mt-0.5">{s.label}</div>
              </div>
            ))}
          </div>
        )}

        <div className="mt-3 flex items-center gap-2">
          <button onClick={onToggle} className={`flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-[8px] transition-all
            ${banner.status === "active" ? "bg-green-50 text-green-700 border border-green-200 hover:bg-green-100" : "bg-slate-100 text-slate-500 hover:bg-slate-200"}`}>
            {banner.status === "active" ? <ToggleRight size={13} /> : <ToggleLeft size={13} />}
            {banner.status === "active" ? "Active" : "Activate"}
          </button>
          <button onClick={onPreview} className="flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-[8px] text-slate-500 hover:bg-slate-100 transition-all">
            <Eye size={13} /> Preview
          </button>
        </div>
      </div>
    </Card>
  );
}

function BannerRow({ banner, onPreview, onDelete }: {
  banner: any; onPreview: () => void; onToggle?: () => void; onArchive?: () => void; onDelete: () => void;
}) {
  return (
    <div className="flex items-center gap-4 px-5 py-3.5 hover:bg-slate-50 transition-colors">
      <div className="w-24 h-12 rounded-[8px] bg-slate-100 overflow-hidden shrink-0">
        <img src={banner.imageUrl} alt={banner.title} className="w-full h-full object-cover" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-slate-800 truncate">{banner.title}</p>
        <p className="text-xs text-slate-500 mt-0.5">{banner.brand} · {banner.placement}</p>
      </div>
      <div className="hidden md:flex items-center gap-6 text-xs text-slate-500 shrink-0">
        <span>{banner.startDate} – {banner.endDate}</span>
        {banner.impressions > 0 && <span className="tabular-nums">{(banner.impressions / 1000).toFixed(1)}K impressions · {banner.ctr} CTR</span>}
      </div>
      <Badge variant={banner.status as "active" | "inactive" | "draft"} />
      <div className="flex items-center gap-1 shrink-0">
        <Button variant="ghost" size="sm" icon={<Eye size={13} />} onClick={onPreview} />
        <Button variant="ghost" size="sm" icon={<Pencil size={13} />} />
        <Button variant="ghost" size="sm" icon={<Trash2 size={13} />} onClick={onDelete} className="text-red-400 hover:text-red-600 hover:bg-red-50" />
      </div>
    </div>
  );
}
