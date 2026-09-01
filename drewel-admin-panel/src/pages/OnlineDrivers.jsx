import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import Swal from "sweetalert2";
import { Search, RefreshCw, Eye, CheckCircle2, XCircle } from "lucide-react";
import { getOnlineDriverList, updateDriverReviewStatus } from "../utils/api";
import { useSocket } from "../context/SocketContext";
import {
  applyPresence, mergePresenceSnapshot, normalizeDriverPresence,
  presenceIsOnline, presenceVersion, shouldApplyPresence,
} from "../utils/driverPresence";
import {
  Badge, OnlineBadge, Button, Card, KpiCard, Select, Th, Td, Tr,
  EmptyState, ErrorState, LoadingState, SectionHeader,
} from "../components/ui";

const reasonLabels = {
  not_approved: "Not approved", restricted: "Restricted", deleted: "Deleted",
  profile_incomplete: "Profile incomplete", legacy_online_flag_off: "Online flag off",
  not_available: "Not available", active_ride: "On active ride",
  missing_current_location: "No GPS point", missing_location_time: "No GPS time",
  stale_gps: "Stale GPS", future_gps: "Future GPS", missing_accuracy: "No accuracy",
  low_accuracy: "Low GPS accuracy", missing_service_area: "No service area",
};

const driverName = (driver) => `${driver.firstName || ""} ${driver.lastName || ""}`.trim() || driver.fullName || "N/A";

const formatLocationAge = (driver) => {
  const seconds = Number(driver.locationAgeSeconds);
  if (!Number.isFinite(seconds)) return "No GPS";
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m ago`;
};

const gpsTone = (driver) => {
  const reasons = new Set(driver.discoverabilityReasons || []);
  if (reasons.has("stale_gps") || reasons.has("future_gps")) return "bg-amber-50 text-amber-700 border-amber-200";
  if (reasons.has("missing_current_location") || reasons.has("missing_location_time") || reasons.has("low_accuracy") || reasons.has("missing_accuracy")) {
    return "bg-red-50 text-red-700 border-red-200";
  }
  return "bg-green-50 text-green-700 border-green-200";
};

const OnlineDrivers = () => {
  const navigate = useNavigate();
  const { socket, isConnected } = useSocket();
  const [drivers, setDrivers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [search, setSearch] = useState("");
  const [vehicleFilter, setVehicleFilter] = useState("all");
  const [discoverabilityFilter, setDiscoverabilityFilter] = useState("all");
  const presenceVersions = useRef(new Map());
  const fetchInFlight = useRef(false);
  const driversRef = useRef([]);

  useEffect(() => { driversRef.current = drivers; }, [drivers]);

  const fetchDrivers = useCallback(async (silent = false) => {
    if (fetchInFlight.current) return;
    fetchInFlight.current = true;
    const versionsAtRequest = new Map(presenceVersions.current);
    try {
      if (!silent) { setLoading(true); setLoadError(""); }
      const list = await getOnlineDriverList();
      setDrivers((current) => {
        const currentById = new Map(current.map((driver) => [String(driver._id), driver]));
        const snapshotIds = new Set();
        const next = [];
        list.forEach((rawDriver) => {
          const snapshot = normalizeDriverPresence(rawDriver);
          const driverId = String(snapshot._id);
          snapshotIds.add(driverId);
          const latestVersion = presenceVersions.current.get(driverId);
          const currentDriver = currentById.get(driverId);
          if (!currentDriver && presenceVersion(latestVersion) > snapshot.presenceVersion) return;
          const merged = mergePresenceSnapshot(currentDriver, snapshot, latestVersion);
          if (snapshot.presenceVersion >= presenceVersion(latestVersion)) {
            presenceVersions.current.set(driverId, snapshot.presenceVersion);
          }
          if (presenceIsOnline(merged)) next.push(merged);
        });
        current.forEach((driver) => {
          const driverId = String(driver._id);
          if (snapshotIds.has(driverId)) return;
          const before = presenceVersion(versionsAtRequest.get(driverId));
          const now = presenceVersion(presenceVersions.current.get(driverId));
          if (now > before && presenceIsOnline(driver)) next.push(driver);
        });
        return next;
      });
    } catch (error) {
      const message = error?.response?.data?.message || error?.message || "Failed to load online drivers.";
      if (!silent) { setDrivers([]); setLoadError(message); }
    } finally {
      fetchInFlight.current = false;
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => { fetchDrivers(); }, [fetchDrivers]);

  useEffect(() => {
    const timer = window.setInterval(() => fetchDrivers(true), 30000);
    return () => window.clearInterval(timer);
  }, [fetchDrivers]);

  useEffect(() => {
    if (!socket || !isConnected) return;
    fetchDrivers(true);

    const onPresence = (update) => {
      const driverId = String(update?.driverId || "");
      if (!driverId) return;
      const currentVersion = presenceVersions.current.get(driverId);
      if (!shouldApplyPresence(currentVersion, update)) return;
      presenceVersions.current.set(driverId, presenceVersion(update.version));

      const found = driversRef.current.some((driver) => String(driver._id) === driverId);
      setDrivers((current) => {
        const index = current.findIndex((driver) => String(driver._id) === driverId);
        if (!presenceIsOnline(update)) {
          return index !== -1 ? current.filter((_, itemIndex) => itemIndex !== index) : current;
        }
        if (index === -1) return current;
        const next = current.slice();
        next[index] = applyPresence(next[index], update);
        return next;
      });
      // Presence events intentionally contain no profile data. Refetch an
      // unknown Online driver so the table never invents partial rows.
      if (presenceIsOnline(update) && !found) fetchDrivers(true);
    };

    socket.on("driver:presence", onPresence);
    return () => socket.off("driver:presence", onPresence);
  }, [socket, isConnected, fetchDrivers]);

  const filteredDrivers = useMemo(() => {
    const term = search.trim().toLowerCase();
    return drivers.filter((driver) => {
      if (vehicleFilter !== "all" && String(driver.vehicleType || "").toLowerCase() !== vehicleFilter) return false;
      if (discoverabilityFilter === "discoverable" && !driver.isDiscoverable) return false;
      if (discoverabilityFilter === "blocked" && driver.isDiscoverable) return false;
      if (!term) return true;
      const name = driverName(driver);
      const phone = `${driver.whatsappNumber || driver.phone || ""}`;
      return name.toLowerCase().includes(term) || phone.toLowerCase().includes(term);
    });
  }, [drivers, search, vehicleFilter, discoverabilityFilter]);

  const vehicleOptions = useMemo(() => {
    const values = new Set(drivers.map((driver) => String(driver.vehicleType || "").trim().toLowerCase()).filter(Boolean));
    return [{ value: "all", label: "All vehicles" }, ...Array.from(values).sort().map((v) => ({ value: v, label: v }))];
  }, [drivers]);

  const kpis = useMemo(() => {
    const blocked = drivers.filter((driver) => !driver.isDiscoverable).length;
    const stale = drivers.filter((driver) =>
      (driver.discoverabilityReasons || []).some((reason) => ["stale_gps", "missing_current_location", "missing_location_time", "low_accuracy"].includes(reason))
    ).length;
    const busy = drivers.filter((driver) => driver.availabilityStatus === "Busy").length;
    return { online: drivers.length, discoverable: drivers.length - blocked, busy, stale };
  }, [drivers]);

  const updateStatus = async (driver, status, rejectionReason = "") => {
    try {
      await updateDriverReviewStatus(driver._id, { status, rejection_reason: rejectionReason });
      Swal.fire("Success", "Driver status updated.", "success");
      fetchDrivers();
    } catch (error) {
      Swal.fire("Error", error?.response?.data?.message || "Failed to update status.", "error");
    }
  };

  const handleReject = async (driver) => {
    const result = await Swal.fire({
      title: "Reject Driver Request", input: "text", inputLabel: "Reason (optional)",
      showCancelButton: true, confirmButtonText: "Reject", confirmButtonColor: "#dc3545",
    });
    if (!result.isConfirmed) return;
    await updateStatus(driver, "rejected", result.value || "");
  };

  return (
    <div className="flex flex-col gap-6">
      <SectionHeader
        title="Online Drivers"
        description="Live admin presence with marketplace discoverability and GPS quality checks."
        actions={
          <>
            <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded-full border
              ${isConnected ? "bg-green-50 text-green-700 border-green-200" : "bg-red-50 text-red-700 border-red-200"}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${isConnected ? "bg-green-500 live-pulse" : "bg-red-500"}`} />
              {isConnected ? "Live" : "Socket disconnected"}
            </span>
            <Button variant="secondary" size="sm" icon={<RefreshCw size={14} className={loading ? "animate-spin" : ""} />} onClick={() => fetchDrivers(false)} disabled={loading}>Refresh</Button>
          </>
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard label="Online Now" value={kpis.online} />
        <KpiCard label="Discoverable" value={kpis.discoverable} />
        <KpiCard label="On Trip" value={kpis.busy} />
        <KpiCard label="GPS warnings" value={kpis.stale} urgent={kpis.stale > 0} />
      </div>

      <Card className="p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-52 max-w-sm">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name / WhatsApp"
              className="w-full h-10 bg-white border border-slate-200 rounded-[10px] pl-9 pr-4 text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-red-700/20 focus:border-red-400 transition-all" />
          </div>
          <Select value={vehicleFilter} onChange={setVehicleFilter} options={vehicleOptions} className="w-40" aria-label="Vehicle filter" />
          <Select value={discoverabilityFilter} onChange={setDiscoverabilityFilter} className="w-52" aria-label="Discoverability filter"
            options={[{ value: "all", label: "All online drivers" }, { value: "discoverable", label: "Discoverable" }, { value: "blocked", label: "Blocked from discovery" }]} />
        </div>
      </Card>

      <Card>
        {loading ? (
          <LoadingState label="Loading online drivers…" />
        ) : loadError ? (
          <ErrorState description={loadError} action={<Button variant="secondary" size="sm" onClick={() => fetchDrivers()}>Retry</Button>} />
        ) : filteredDrivers.length === 0 ? (
          <EmptyState title="No online drivers found" description="Try adjusting your search or filters." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr>
                  <Th>Name</Th>
                  <Th>Vehicle</Th>
                  <Th>WhatsApp</Th>
                  <Th>Status</Th>
                  <Th>Last Heartbeat</Th>
                  <Th>Discoverability</Th>
                  <Th>GPS</Th>
                  <Th>Actions</Th>
                </tr>
              </thead>
              <tbody>
                {filteredDrivers.map((driver) => {
                  const reasons = driver.discoverabilityReasons || [];
                  const primaryReason = reasons[0];
                  return (
                    <Tr key={driver._id}>
                      <Td>
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full bg-[#BE1B2C]/10 flex items-center justify-center text-[11px] font-bold text-[#BE1B2C] shrink-0">
                            {driverName(driver).split(/\s+/).filter(Boolean).map((p) => p[0]?.toUpperCase()).slice(0, 2).join("") || "?"}
                          </div>
                          <span className="text-sm font-medium text-slate-800">{driverName(driver)}</span>
                        </div>
                      </Td>
                      <Td>
                        <div className="text-sm text-slate-700">{driver.vehicleType || "N/A"}</div>
                        <div className="text-xs text-slate-400">{driver.vehicleModel || driver.registration || ""}</div>
                      </Td>
                      <Td><span className="font-mono text-xs text-slate-600">{driver.whatsappNumber || driver.phone || "N/A"}</span></Td>
                      <Td><Badge variant={String(driver.status || "pending").toLowerCase()} /></Td>
                      <Td>{driver.presenceLastHeartbeatAt ? new Date(driver.presenceLastHeartbeatAt).toLocaleTimeString() : "Active"}</Td>
                      <Td>
                        {driver.isDiscoverable ? (
                          <OnlineBadge status="online_available" />
                        ) : (
                          <div className="flex flex-col gap-0.5">
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded-full w-fit">BLOCKED</span>
                            <span className="text-[11px] text-slate-400" title={reasons.map((reason) => reasonLabels[reason] || reason).join(", ")}>
                              {reasonLabels[primaryReason] || "Review required"}{reasons.length > 1 ? ` +${reasons.length - 1}` : ""}
                            </span>
                          </div>
                        )}
                      </Td>
                      <Td>
                        <span className={`inline-flex items-center text-xs font-semibold px-2 py-0.5 rounded-full border ${gpsTone(driver)}`}>{formatLocationAge(driver)}</span>
                        {Number.isFinite(Number(driver.locationAccuracyM)) && (
                          <div className="text-[11px] text-slate-400 mt-0.5">±{Math.round(Number(driver.locationAccuracyM))}m</div>
                        )}
                      </Td>
                      <Td>
                        <div className="flex items-center gap-1.5">
                          <button type="button" title="View" onClick={() => navigate(`/driver-detail/${driver._id}`)}
                            className="p-1.5 rounded-[6px] text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"><Eye size={14} /></button>
                          <button type="button" title="Approve" onClick={() => updateStatus(driver, "approved")}
                            className="p-1.5 rounded-[6px] text-green-500 hover:text-green-700 hover:bg-green-50 transition-colors"><CheckCircle2 size={14} /></button>
                          <button type="button" title="Reject" onClick={() => handleReject(driver)}
                            className="p-1.5 rounded-[6px] text-red-500 hover:text-red-700 hover:bg-red-50 transition-colors"><XCircle size={14} /></button>
                        </div>
                      </Td>
                    </Tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
};

export default OnlineDrivers;
