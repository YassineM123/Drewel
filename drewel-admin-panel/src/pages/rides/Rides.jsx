import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import PropTypes from "prop-types";
import { Search, Download, RefreshCw } from "lucide-react";
import { getRides, ridesErrorMessage } from "../../api/domains/rides";
import { useSocket } from "../../context/SocketContext";
import {
  Button, Card, Select, Th, Td, Tr, Pagination,
  EmptyState, ErrorState, LoadingState, SectionHeader, TabBar,
} from "../../components/ui";

const FILTERS = [
  { id: "live", label: "Live" },
  { id: "requested", label: "Requested" },
  { id: "searching", label: "Searching" },
  { id: "assigned", label: "Assigned" },
  { id: "active", label: "Active" },
  { id: "completed", label: "Completed" },
  { id: "cancelled", label: "Cancelled" },
  { id: "disputed", label: "Disputes" },
  { id: "stuck", label: "Stuck" },
  { id: "all", label: "All reservations" },
];

const ACTIVE = new Set([
  "confirmed", "driver_on_the_way", "driver_arrived", "pickup_confirmed",
  "in_progress", "accepted", "driver_arriving", "disputed",
]);

const STALE_LOCATION_SECONDS = 120;

const date = (value) => {
  const parsed = new Date(value);
  return value && !Number.isNaN(parsed.getTime()) ? parsed.toLocaleString() : "—";
};

const label = (value) => String(value || "unknown").replaceAll("_", " ");
const person = (value) => value?.fullName || value?.displayName || value?.name || "Drewel participant";
const place = (value) => value?.address || value?.label || value?.name || "—";
const csv = (value) => `"${String(value ?? "").replaceAll('"', '""')}"`;

const statusStyle = (status) => {
  if (ACTIVE.has(status)) return "bg-sky-50 text-sky-700 border-sky-200";
  if (status === "completed") return "bg-green-50 text-green-700 border-green-200";
  if (String(status).startsWith("cancelled")) return "bg-red-50 text-red-700 border-red-200";
  if (status === "disputed") return "bg-amber-50 text-amber-700 border-amber-200";
  if (status === "stuck") return "bg-red-50 text-red-700 border-red-200";
  return "bg-slate-100 text-slate-600 border-slate-200";
};

const distance = (meters) => {
  if (!Number.isFinite(meters) || meters < 0) return "—";
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(1)} km`;
};

const locationWarning = (ride) => {
  if (ride.lastGpsAgeSeconds == null) {
    return ride.status === "disputed" ? null : "no GPS signal";
  }
  return ride.lastGpsAgeSeconds > STALE_LOCATION_SECONDS ? `stale ${Math.floor(ride.lastGpsAgeSeconds / 60)} min` : null;
};

const viewCopy = {
  live: { title: "Live Reservations", description: "Monitor active ride states, routes, remaining distance, GPS freshness and exceptions in real time." },
  all: { title: "All Reservations", description: "Search and export backend-authoritative Drewel ride records." },
  completed: { title: "Completed Reservations", description: "Review finished reservations and final audit evidence." },
  cancelled: { title: "Cancelled Reservations", description: "Inspect cancellation reasons, review state and point evidence." },
  disputed: { title: "Disputes", description: "Review disputed reservations using backend ride state and audit records." },
  stuck: { title: "Stuck Rides", description: "Active rides whose backend state has not progressed for more than one hour." },
};

const Rides = ({ initialFilter = "active", lockedFilter = false }) => {
  const navigate = useNavigate();
  const [filter, setFilter] = useState(initialFilter);
  const [search, setSearch] = useState("");
  const [driver, setDriver] = useState("");
  const [customer, setCustomer] = useState("");
  const [city, setCity] = useState("");
  const [vehicleType, setVehicleType] = useState("");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [sort, setSort] = useState("updatedAt");
  const [dir, setDir] = useState("desc");
  const [state, setState] = useState({ loading: true, error: "", rides: [], pagination: {} });
  const [live, setLive] = useState(false);
  const [exporting, setExporting] = useState(false);
  const { socket, isConnected } = useSocket();
  const loadRef = useRef(null);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [search]);

  const queryParams = useCallback((overrides = {}) => ({
    status: filter,
    search: debouncedSearch,
    filters: {
      driver: driver.trim() || undefined,
      customer: customer.trim() || undefined,
      city: city.trim() || undefined,
      vehicleType: vehicleType.trim() || undefined,
      minPrice: minPrice.trim() || undefined,
      maxPrice: maxPrice.trim() || undefined,
    },
    range: from || to ? { from: from || undefined, to: to || undefined } : undefined,
    sort, dir, page, limit,
    ...overrides,
  }), [filter, debouncedSearch, driver, customer, city, vehicleType, minPrice, maxPrice, from, to, sort, dir, page, limit]);

  const load = useCallback(async (signal) => {
    setState((current) => ({ ...current, loading: true, error: "" }));
    try {
      const payload = await getRides(queryParams(), signal);
      const rides = Array.isArray(payload?.rides) ? payload.rides : [];
      setState({
        loading: false, error: "", rides,
        pagination: payload?.pagination || { page, limit, total: rides.length, totalPages: 1 },
      });
    } catch (error) {
      if (error?.code !== "ERR_CANCELED") {
        setState((current) => ({ ...current, loading: false, error: ridesErrorMessage(error, "Unable to load reservations.") }));
      }
    }
  }, [queryParams, page, limit]);

  useEffect(() => { loadRef.current = load; }, [load]);

  useEffect(() => {
    const controller = new AbortController();
    load(controller.signal);
    return () => controller.abort();
  }, [load]);

  useEffect(() => {
    setLive(initialFilter === "live" || (typeof isConnected === "boolean" && filter === "live"));
  }, [initialFilter, filter, isConnected]);

  useEffect(() => {
    if (!live || !socket || !isConnected) return undefined;
    const refresh = () => loadRef.current?.();
    const refreshSoon = () => window.setTimeout(refresh, 250);
    const events = [
      "ride:status_changed", "ride:participants_unlocked", "ride:points_refunded",
      "ride:internal_note_added", "ride:eta_updated", "driver:location",
    ];
    socket.emit("driver-map:track", { on: true });
    for (const event of events) socket.on(event, refreshSoon);
    return () => {
      socket.emit("driver-map:track", { on: false });
      for (const event of events) socket.off(event, refreshSoon);
    };
  }, [live, socket, isConnected]);

  const selectFilter = (value) => { setFilter(value); setPage(1); };

  const sortBy = (field) => {
    setSort((current) => {
      if (current === field) { setDir((value) => (value === "asc" ? "desc" : "asc")); return current; }
      setDir("desc");
      return field;
    });
    setPage(1);
  };

  const exportCsv = async () => {
    if (exporting) return;
    setExporting(true);
    try {
      // Export must cover every filtered reservation, not just the current
      // page — fetch in bulk pages up to a sane cap rather than dumping
      // whatever happens to be loaded in the table right now.
      const EXPORT_PAGE_SIZE = 100;
      const MAX_EXPORT_ROWS = 5000;
      const first = await getRides(queryParams({ page: 1, limit: EXPORT_PAGE_SIZE }));
      let rides = Array.isArray(first?.rides) ? first.rides : [];
      const total = Number(first?.pagination?.total ?? rides.length);
      const pagesToFetch = Math.min(
        Math.ceil(total / EXPORT_PAGE_SIZE) || 1,
        Math.ceil(MAX_EXPORT_ROWS / EXPORT_PAGE_SIZE),
      );
      for (let p = 2; p <= pagesToFetch && rides.length < MAX_EXPORT_ROWS; p += 1) {
        const next = await getRides(queryParams({ page: p, limit: EXPORT_PAGE_SIZE }));
        rides = rides.concat(Array.isArray(next?.rides) ? next.rides : []);
      }

      const rows = [
        ["Reference", "Status", "Customer", "Driver", "Vehicle Type", "Pickup", "Destination", "Updated", "ETA Minutes", "Remaining Distance", "Last GPS"],
        ...rides.map((ride) => [
          ride.reference || ride.id || ride._id, label(ride.status), person(ride.user || ride.passenger), person(ride.driver),
          ride.vehicleType || ride.driver?.vehicleType || "", place(ride.pickup), place(ride.destination),
          date(ride.updatedAt), ride.etaMinutes ?? "", distance(ride.distanceMeters), date(ride.lastGpsAt),
        ]),
      ];
      const blob = new Blob([rows.map((row) => row.map(csv).join(",")).join("\r\n")], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `drewel-reservations-${filter}-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.append(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } catch (error) {
      setState((current) => ({ ...current, error: ridesErrorMessage(error, "Unable to export reservations.") }));
    } finally {
      setExporting(false);
    }
  };

  const pagination = state.pagination;
  const totalPages = Math.max(1, Number(pagination.totalPages || 1));
  const copy = viewCopy[initialFilter] || { title: "Reservations", description: "Monitor the live booking lifecycle, exceptions, point activity and audit evidence." };

  return (
    <div className="flex flex-col gap-6">
      <SectionHeader
        title={copy.title}
        description={copy.description}
        actions={
          <>
            {live && (
              <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded-full border
                ${isConnected ? "bg-green-50 text-green-700 border-green-200" : "bg-amber-50 text-amber-700 border-amber-200"}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${isConnected ? "bg-green-500 live-pulse" : "bg-amber-500"}`} />
                {isConnected ? "Live updates connected" : "Live updates reconnecting…"}
              </span>
            )}
            <Button variant="secondary" size="sm" icon={<RefreshCw size={14} />} onClick={() => load()} disabled={state.loading}>Refresh</Button>
            <Button variant="secondary" size="sm" icon={<Download size={14} />} onClick={exportCsv} loading={exporting} disabled={state.loading || state.rides.length === 0}>Export CSV</Button>
          </>
        }
      />

      {!lockedFilter && (
        <TabBar
          tabs={FILTERS.map((f) => ({ id: f.id, label: f.label }))}
          active={filter}
          onChange={selectFilter}
        />
      )}

      <Card className="p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-52">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              placeholder="Reference, booking ID, driver or customer"
              className="w-full h-10 bg-slate-50 border border-slate-200 rounded-[10px] pl-9 pr-4 text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-red-700/20 focus:border-red-400 transition-all" />
          </div>
          <input value={driver} onChange={(e) => { setDriver(e.target.value); setPage(1); }} placeholder="Driver name or ID"
            className="h-10 w-40 bg-white border border-slate-200 rounded-[10px] px-3 text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-red-700/20 focus:border-red-400" />
          <input value={customer} onChange={(e) => { setCustomer(e.target.value); setPage(1); }} placeholder="Customer name or ID"
            className="h-10 w-40 bg-white border border-slate-200 rounded-[10px] px-3 text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-red-700/20 focus:border-red-400" />
          <input value={city} onChange={(e) => { setCity(e.target.value); setPage(1); }} placeholder="Dubai, Abu Dhabi…"
            className="h-10 w-32 bg-white border border-slate-200 rounded-[10px] px-3 text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-red-700/20 focus:border-red-400" />
          <input value={vehicleType} onChange={(e) => { setVehicleType(e.target.value); setPage(1); }} placeholder="Vehicle type"
            className="h-10 w-36 bg-white border border-slate-200 rounded-[10px] px-3 text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-red-700/20 focus:border-red-400" />
          <input type="number" min="0" value={minPrice} onChange={(e) => { setMinPrice(e.target.value); setPage(1); }} placeholder="Min price"
            className="h-10 w-24 bg-white border border-slate-200 rounded-[10px] px-3 text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-red-700/20 focus:border-red-400" />
          <input type="number" min="0" value={maxPrice} onChange={(e) => { setMaxPrice(e.target.value); setPage(1); }} placeholder="Max price"
            className="h-10 w-24 bg-white border border-slate-200 rounded-[10px] px-3 text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-red-700/20 focus:border-red-400" />
          <input type="date" value={from} onChange={(e) => { setFrom(e.target.value); setPage(1); }}
            className="h-10 bg-white border border-slate-200 rounded-[10px] px-3 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-red-700/20 focus:border-red-400" />
          <input type="date" value={to} onChange={(e) => { setTo(e.target.value); setPage(1); }}
            className="h-10 bg-white border border-slate-200 rounded-[10px] px-3 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-red-700/20 focus:border-red-400" />
          <Select value={String(limit)} onChange={(v) => { setLimit(Number(v)); setPage(1); }} className="w-24"
            options={[{ value: "10", label: "10 rows" }, { value: "20", label: "20 rows" }, { value: "50", label: "50 rows" }]} />
          <Select value={`${sort}:${dir}`} onChange={(v) => { const [s, d] = v.split(":"); setSort(s); setDir(d); setPage(1); }} className="w-44"
            options={[
              { value: "updatedAt:desc", label: "Updated newest" },
              { value: "updatedAt:asc", label: "Updated oldest" },
              { value: "createdAt:desc", label: "Created newest" },
              { value: "createdAt:asc", label: "Created oldest" },
              { value: "status:asc", label: "Status A-Z" },
              { value: "vehicleType:asc", label: "Vehicle A-Z" },
            ]} />
        </div>
      </Card>

      <Card>
        {state.loading ? (
          <LoadingState label="Loading reservations…" />
        ) : state.error ? (
          <ErrorState title="Reservations unavailable" description={state.error} action={<Button variant="secondary" size="sm" onClick={() => load()}>Retry</Button>} />
        ) : state.rides.length === 0 ? (
          <EmptyState title="No reservations found" description="There are no records matching this status and search." />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr>
                    <Th>Reservation</Th>
                    <Th><button type="button" onClick={() => sortBy("status")} className="hover:text-slate-600">Status</button></Th>
                    <Th>Customer</Th>
                    <Th>Driver</Th>
                    <Th>Pickup</Th>
                    <Th>Destination</Th>
                    <Th><button type="button" onClick={() => sortBy("updatedAt")} className="hover:text-slate-600">Updated</button></Th>
                    <Th>Route / ETA</Th>
                    <Th>Remaining</Th>
                    <Th>GPS</Th>
                    <Th>Action</Th>
                  </tr>
                </thead>
                <tbody>
                  {state.rides.map((ride) => {
                    const warning = live ? locationWarning(ride) : null;
                    return (
                      <Tr key={ride.id || ride._id}>
                        <Td><strong className="font-mono text-xs text-slate-700">{ride.reference || ride.id || ride._id}</strong></Td>
                        <Td><span className={`inline-flex items-center text-xs font-semibold px-2 py-0.5 rounded-full border ${statusStyle(ride.status)}`}>{label(ride.status)}</span></Td>
                        <Td>{person(ride.user || ride.passenger)}</Td>
                        <Td>{person(ride.driver)}</Td>
                        <Td className="max-w-[160px] truncate">{place(ride.pickup)}</Td>
                        <Td className="max-w-[160px] truncate">{place(ride.destination)}</Td>
                        <Td>{date(ride.updatedAt)}</Td>
                        <Td>
                          {ride.etaMinutes != null ? `${ride.etaMinutes} min` : "—"}
                          <div className="text-[11px] text-slate-400">{ride.routeUpdatedAt ? `as of ${date(ride.routeUpdatedAt)}` : "No fresh route"}</div>
                        </Td>
                        <Td>{distance(ride.distanceMeters)}</Td>
                        <Td>
                          {ride.lastGpsAt ? date(ride.lastGpsAt) : "—"}
                          {warning && <div className="text-[11px] text-amber-600 font-medium">{label(warning)}</div>}
                        </Td>
                        <Td>
                          <Button variant="secondary" size="sm" onClick={() => navigate(`/rides/${ride.id || ride._id}`)}>View details</Button>
                        </Td>
                      </Tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <Pagination page={page} total={Number(pagination.total || state.rides.length)} perPage={limit} onChange={setPage} />
            <p className="text-xs text-slate-400 px-4 pb-3">Page {page} of {totalPages}</p>
          </>
        )}
      </Card>
    </div>
  );
};

Rides.propTypes = {
  initialFilter: PropTypes.string,
  lockedFilter: PropTypes.bool,
};

export default Rides;
