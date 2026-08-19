import { useState, useEffect, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { Search, Download, X, ArrowUp, ArrowDown } from "lucide-react";
import {
  Card, Button, SectionHeader, Th, Td, Tr, Pagination, Avatar,
  Select, EmptyState, Drawer, Toast, TabBar
} from "../../components/ui";
import { getRides } from "../../api";
import { type Ride, type RideStatus } from "../../data/mockRides";
import { RideStatusBadge } from "../Dashboard";
import RideDetails from "./RideDetails";

function mapApiRide(r: any): Ride {
  return {
    id: r._id || r.id || "",
    offerId: r.offerId || "",
    driver: { id: r.driver?._id || r.driver?.id || "", name: r.driver?.name || "Unknown", avatar: r.driver?.avatar || r.driver?.name?.charAt(0) || "?", phone: r.driver?.phone || "" },
    user: { id: r.user?._id || r.user?.id || "", name: r.user?.name || "Unknown", avatar: r.user?.avatar || r.user?.name?.charAt(0) || "?", phone: r.user?.phone || "" },
    pickup: { address: r.pickup_location?.address || r.pickup?.address || "", lat: r.pickup_location?.lat || r.pickup?.lat || 0, lng: r.pickup_location?.lng || r.pickup?.lng || 0 },
    destination: { address: r.destination?.address || "", lat: r.destination?.lat || 0, lng: r.destination?.lng || 0 },
    status: (r.status || "offer_sent") as RideStatus,
    fareNGN: r.fare || r.fareNGN || 0,
    vehicleType: r.vehicleType || "sedan",
    pointsCharged: r.pointsCharged || 0,
    pointsReserved: r.pointsReserved || 0,
    startedAt: r.startedAt || null,
    completedAt: r.completedAt || null,
    cancelledAt: r.cancelledAt || null,
    cancelReason: r.cancelReason || null,
    cancelledBy: r.cancelledBy || null,
    createdAt: r.createdAt || new Date().toISOString(),
    eta: r.eta ?? null,
    distanceKm: r.distanceKm ?? null,
    lastLocationUpdate: r.lastLocationUpdate || null,
    isStuck: r.isStuck || false,
    isStaleLocation: r.isStaleLocation || false,
    isDisputed: r.isDisputed || r.status === "disputed",
    disputeNote: r.disputeNote || null,
    city: r.city || "",
    adminNote: r.adminNote || null,
    internalNotes: r.internalNotes || [],
    timeline: r.timeline || [],
  };
}

type TabId = "all" | "active" | "completed" | "cancelled" | "disputes";

const TABS: { id: TabId; label: string }[] = [
  { id: "all", label: "All Rides" },
  { id: "active", label: "Active" },
  { id: "completed", label: "Completed" },
  { id: "cancelled", label: "Cancelled" },
  { id: "disputes", label: "Disputes" },
];

const ACTIVE_STATUSES = ["offer_sent", "offer_accepted", "driver_on_way", "driver_arrived", "pickup_confirmed", "ride_started"];

function matchesTab(ride: Ride, tab: TabId): boolean {
  if (tab === "all") return true;
  if (tab === "disputes") return ride.isDisputed;
  if (tab === "active") return ACTIVE_STATUSES.includes(ride.status) && !ride.isDisputed;
  if (tab === "completed") return ride.status === "completed";
  if (tab === "cancelled") return ride.status === "cancelled" || ride.status === "cancelled_user" || ride.status === "cancelled_driver" || ride.status === "cancelled_admin" || ride.status === "technical_failure";
  return true;
}

type SortKey = "id" | "createdAt" | "status" | "fareNGN" | "distanceKm" | "lastLocationUpdate";
type SortDir = "asc" | "desc";

function durationStr(ride: Ride): string {
  if (!ride.startedAt || !ride.completedAt) return "—";
  const mins = Math.round((new Date(ride.completedAt).getTime() - new Date(ride.startedAt).getTime()) / 60000);
  if (mins < 60) return `${mins}m`;
  return `${Math.floor(mins / 60)}h ${mins % 60}m`;
}

export default function AllRides({ defaultTab = "all" }: { defaultTab?: TabId }) {
  const [searchParams] = useSearchParams();
  const initialTab = (searchParams.get("tab") as TabId) ?? defaultTab;
  const preSelected = searchParams.get("id");

  const [tab, setTab] = useState<TabId>(initialTab);
  const [search, setSearch] = useState("");
  const [cityF, setCityF] = useState("all");
  const [vehicleF, setVehicleF] = useState("all");
  const [sortKey, setSortKey] = useState<SortKey>("createdAt");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [page, setPage] = useState(1);
  const [toast, setToast] = useState<string | null>(null);

  const [rides, setRides] = useState<Ride[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getRides({ page, limit: 50 })
      .then(({ rides: apiRides }) => {
        if (cancelled) return;
        setRides((apiRides || []).map(mapApiRide));
      })
      .catch((err) => {
        console.error("Failed to load rides", err);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [page]);

  const [selectedRide, setSelectedRide] = useState<Ride | null>(
    preSelected ? null : null
  );

  useEffect(() => {
    if (preSelected && rides.length > 0) {
      setSelectedRide(rides.find(r => r.id === preSelected) ?? null);
    }
  }, [preSelected, rides]);

  const tabCounts = useMemo(() => ({
    all: rides.length,
    active: rides.filter(r => matchesTab(r, "active")).length,
    completed: rides.filter(r => matchesTab(r, "completed")).length,
    cancelled: rides.filter(r => matchesTab(r, "cancelled")).length,
    disputes: rides.filter(r => matchesTab(r, "disputes")).length,
  }), [rides]);

  const filtered = useMemo(() => {
    const base = rides.filter(r => {
      const matchSearch = !search ||
        r.id.toLowerCase().includes(search.toLowerCase()) ||
        r.driver.name.toLowerCase().includes(search.toLowerCase()) ||
        r.user.name.toLowerCase().includes(search.toLowerCase());
      const matchCity = cityF === "all" || r.city === cityF;
      const matchVehicle = vehicleF === "all" || r.vehicleType === vehicleF;
      return matchSearch && matchCity && matchVehicle && matchesTab(r, tab);
    });
    return [...base].sort((a, b) => {
      let av: string | number = 0, bv: string | number = 0;
      if (sortKey === "id") { av = a.id; bv = b.id; }
      else if (sortKey === "createdAt") { av = a.createdAt; bv = b.createdAt; }
      else if (sortKey === "status") { av = a.status; bv = b.status; }
      else if (sortKey === "fareNGN") { av = a.fareNGN ?? 0; bv = b.fareNGN ?? 0; }
      else if (sortKey === "distanceKm") { av = a.distanceKm ?? 0; bv = b.distanceKm ?? 0; }
      else if (sortKey === "lastLocationUpdate") { av = a.lastLocationUpdate ?? ""; bv = b.lastLocationUpdate ?? ""; }
      if (av < bv) return sortDir === "asc" ? -1 : 1;
      if (av > bv) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
  }, [search, cityF, vehicleF, tab, sortKey, sortDir]);

  const perPage = 10;
  const paginated = filtered.slice((page - 1) * perPage, page * perPage);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("desc"); }
  };

  const handleTabChange = (t: string) => {
    setTab(t as TabId);
    setPage(1);
    setSearch("");
  };

  function SortIcon({ col }: { col: SortKey }) {
    if (sortKey !== col) return <span className="opacity-20 ml-0.5">↕</span>;
    return sortDir === "asc" ? <ArrowUp size={11} className="ml-0.5 inline" /> : <ArrowDown size={11} className="ml-0.5 inline" />;
  }

  return (
    <div className="flex flex-col gap-5">
      <SectionHeader
        title="Rides"
        description="Complete ride history with inspection, cancellation, and dispute resolution tools."
        actions={
          <Button variant="secondary" size="sm" icon={<Download size={14} />}>Export CSV</Button>
        }
      />

      <TabBar
        tabs={TABS.map(t => ({ id: t.id, label: t.label, count: tabCounts[t.id] > 0 ? tabCounts[t.id] : undefined }))}
        active={tab}
        onChange={handleTabChange}
      />

      {/* Filters row */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-52 max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
            placeholder="Ride ID, driver or passenger…"
            className="w-full h-10 bg-white border border-slate-200 rounded-[10px] pl-9 pr-9 text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-red-700/20 focus:border-red-400 transition-all"
          />
          {search && (
            <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
              <X size={12} />
            </button>
          )}
        </div>
        <Select value={cityF} onChange={v => { setCityF(v); setPage(1); }}
          options={[{ value: "all", label: "All Cities" }, { value: "Lagos", label: "Lagos" }, { value: "Abuja", label: "Abuja" }]}
          className="w-36"
        />
        <Select value={vehicleF} onChange={v => { setVehicleF(v); setPage(1); }}
          options={[{ value: "all", label: "All Vehicles" }, { value: "sedan", label: "Sedan" }, { value: "suv", label: "SUV" }, { value: "premium", label: "Premium" }]}
          className="w-36"
        />
        <span className="text-xs text-slate-400">{filtered.length} ride{filtered.length !== 1 ? "s" : ""}</span>
      </div>

      {/* Table */}
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr>
                <Th><button className="flex items-center gap-0.5 hover:text-slate-800" onClick={() => handleSort("id")}>Ride ID <SortIcon col="id" /></button></Th>
                <Th>Driver</Th>
                <Th>Passenger</Th>
                <Th><button className="flex items-center gap-0.5 hover:text-slate-800" onClick={() => handleSort("status")}>Status <SortIcon col="status" /></button></Th>
                <Th>Pickup → Destination</Th>
                <Th><button className="flex items-center gap-0.5 hover:text-slate-800" onClick={() => handleSort("fareNGN")}>Fare (₦) <SortIcon col="fareNGN" /></button></Th>
                <Th>Duration</Th>
                <Th><button className="flex items-center gap-0.5 hover:text-slate-800" onClick={() => handleSort("lastLocationUpdate")}>Last Update <SortIcon col="lastLocationUpdate" /></button></Th>
                <Th><button className="flex items-center gap-0.5 hover:text-slate-800" onClick={() => handleSort("createdAt")}>Created <SortIcon col="createdAt" /></button></Th>
                <Th></Th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={10}>
                    <div className="flex items-center justify-center py-16">
                      <div className="w-5 h-5 border-2 border-[#BE1B2C] border-t-transparent rounded-full animate-spin" />
                      <span className="ml-3 text-sm text-slate-400">Loading rides…</span>
                    </div>
                  </td>
                </tr>
              ) : paginated.length === 0 ? (
                <tr>
                  <td colSpan={10}>
                    <EmptyState
                      title="No rides match your filters"
                      description={search ? "Try a different search term or clear filters." : `No ${tab === "all" ? "" : tab} rides found.`}
                    />
                  </td>
                </tr>
              ) : paginated.map(ride => (
                <Tr key={ride.id} onClick={() => setSelectedRide(ride)}>
                  <Td>
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono text-xs text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded">{ride.id}</span>
                      {ride.isStuck && <span className="text-[10px] font-bold text-red-600 bg-red-50 border border-red-200 px-1.5 py-0.5 rounded-full">Stuck</span>}
                      {ride.isDisputed && <span className="text-[10px] font-bold text-orange-600 bg-orange-50 border border-orange-200 px-1.5 py-0.5 rounded-full">Dispute</span>}
                    </div>
                  </Td>
                  <Td>
                    <div className="flex items-center gap-2">
                      <Avatar initials={ride.driver.avatar} size="xs" />
                      <span className="text-sm text-slate-700">{ride.driver.name}</span>
                    </div>
                  </Td>
                  <Td>
                    <div className="flex items-center gap-2">
                      <Avatar initials={ride.user.avatar} size="xs" />
                      <span className="text-sm text-slate-700">{ride.user.name}</span>
                    </div>
                  </Td>
                  <Td><RideStatusBadge status={ride.isStuck ? "stuck" : ride.status} /></Td>
                  <Td>
                    <div className="text-xs text-slate-600 max-w-[200px]">
                      <div className="truncate">{ride.pickup.address}</div>
                      <div className="truncate text-slate-400">→ {ride.destination.address}</div>
                    </div>
                  </Td>
                  <Td>
                    <span className="text-xs font-semibold text-slate-700 tabular-nums">
                      {ride.fareNGN ? `₦${ride.fareNGN.toLocaleString()}` : "—"}
                    </span>
                  </Td>
                  <Td><span className="text-xs text-slate-500 tabular-nums">{durationStr(ride)}</span></Td>
                  <Td>
                    <span className={`text-xs tabular-nums ${ride.isStaleLocation ? "text-amber-600 font-medium" : "text-slate-500"}`}>
                      {ride.lastLocationUpdate
                        ? (() => {
                            const m = Math.floor((Date.now() - new Date(ride.lastLocationUpdate).getTime()) / 60000);
                            return m < 1 ? "now" : `${m}m ago`;
                          })()
                        : "—"}
                    </span>
                  </Td>
                  <Td><span className="text-xs text-slate-500">{formatTs(ride.createdAt)}</span></Td>
                  <Td>
                    <Button variant="secondary" size="sm" onClick={e => { e.stopPropagation(); setSelectedRide(ride); }}>
                      Inspect
                    </Button>
                  </Td>
                </Tr>
              ))}
            </tbody>
          </table>
        </div>
        <Pagination page={page} total={filtered.length} perPage={perPage} onChange={setPage} />
      </Card>

      {/* Full ride detail drawer */}
      <Drawer open={!!selectedRide} onClose={() => setSelectedRide(null)} title="" width="w-[640px]">
        {selectedRide && (
          <RideDetails ride={selectedRide} onClose={() => setSelectedRide(null)} />
        )}
      </Drawer>

      {toast && <Toast message={toast} type="success" onClose={() => setToast(null)} />}
    </div>
  );
}

function formatTs(iso: string) {
  return new Date(iso).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}
