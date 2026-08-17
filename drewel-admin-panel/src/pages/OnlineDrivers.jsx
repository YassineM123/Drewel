import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import Swal from "sweetalert2";
import TableUser from "../components/TableUser";
import { getOnlineDriverList, updateDriverReviewStatus } from "../utils/api";
import { useSocket } from "../context/SocketContext";
import {
  applyPresence,
  mergePresenceSnapshot,
  normalizeDriverPresence,
  presenceIsOnline,
  presenceVersion,
  shouldApplyPresence,
} from "../utils/driverPresence";

const statusBadgeClass = (status) => {
  switch ((status || "").toLowerCase()) {
    case "approved":
      return "badge badge-success";
    case "completed":
      return "badge badge-primary";
    case "rejected":
      return "badge badge-danger";
    default:
      return "badge badge-warning";
  }
};

const reasonLabels = {
  not_approved: "Not approved",
  restricted: "Restricted",
  deleted: "Deleted",
  profile_incomplete: "Profile incomplete",
  legacy_online_flag_off: "Online flag off",
  not_available: "Not available",
  active_ride: "On active ride",
  missing_current_location: "No GPS point",
  missing_location_time: "No GPS time",
  stale_gps: "Stale GPS",
  future_gps: "Future GPS",
  missing_accuracy: "No accuracy",
  low_accuracy: "Low GPS accuracy",
  missing_service_area: "No service area",
};

const driverName = (driver) =>
  `${driver.firstName || ""} ${driver.lastName || ""}`.trim() ||
  driver.fullName ||
  "N/A";

const maskPhone = (value) => {
  const phone = String(value || "").trim();
  if (phone.length <= 6) return phone || "N/A";
  return `${phone.slice(0, 4)}***${phone.slice(-3)}`;
};

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
  if (reasons.has("stale_gps") || reasons.has("future_gps")) return "warning";
  if (
    reasons.has("missing_current_location") ||
    reasons.has("missing_location_time") ||
    reasons.has("low_accuracy") ||
    reasons.has("missing_accuracy")
  ) {
    return "danger";
  }
  return "success";
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
  const [openDropdown, setOpenDropdown] = useState(null);
  const presenceVersions = useRef(new Map());
  const fetchInFlight = useRef(false);
  const driversRef = useRef([]);

  useEffect(() => {
    driversRef.current = drivers;
  }, [drivers]);

  const fetchDrivers = useCallback(async (silent = false) => {
    if (fetchInFlight.current) return;
    fetchInFlight.current = true;
    const versionsAtRequest = new Map(presenceVersions.current);
    try {
      if (!silent) {
        setLoading(true);
        setLoadError("");
      }
      const list = await getOnlineDriverList();
      setDrivers((current) => {
        const currentById = new Map(
          current.map((driver) => [String(driver._id), driver])
        );
        const snapshotIds = new Set();
        const next = [];
        list.forEach((rawDriver) => {
          const snapshot = normalizeDriverPresence(rawDriver);
          const driverId = String(snapshot._id);
          snapshotIds.add(driverId);
          const latestVersion = presenceVersions.current.get(driverId);
          const currentDriver = currentById.get(driverId);
          if (
            !currentDriver &&
            presenceVersion(latestVersion) > snapshot.presenceVersion
          ) {
            return;
          }
          const merged = mergePresenceSnapshot(
            currentDriver,
            snapshot,
            latestVersion
          );
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
      const message =
        error?.response?.data?.message ||
        error?.message ||
        "Failed to load online drivers.";
      if (!silent) {
        setDrivers([]);
        setLoadError(message);
      }
    } finally {
      fetchInFlight.current = false;
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDrivers();
  }, [fetchDrivers]);

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

      const found = driversRef.current.some(
        (driver) => String(driver._id) === driverId
      );
      setDrivers((current) => {
        const index = current.findIndex((driver) => String(driver._id) === driverId);
        if (!presenceIsOnline(update)) {
          return index !== -1
            ? current.filter((_, itemIndex) => itemIndex !== index)
            : current;
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
      if (
        vehicleFilter !== "all" &&
        String(driver.vehicleType || "").toLowerCase() !== vehicleFilter
      ) {
        return false;
      }
      if (discoverabilityFilter === "discoverable" && !driver.isDiscoverable) {
        return false;
      }
      if (discoverabilityFilter === "blocked" && driver.isDiscoverable) {
        return false;
      }
      if (!term) return true;
      const name = driverName(driver);
      const phone = `${driver.whatsappNumber || driver.phone || ""}`;
      return (
        name.toLowerCase().includes(term) ||
        phone.toLowerCase().includes(term)
      );
    });
  }, [drivers, search, vehicleFilter, discoverabilityFilter]);

  const vehicleOptions = useMemo(() => {
    const values = new Set(
      drivers
        .map((driver) => String(driver.vehicleType || "").trim().toLowerCase())
        .filter(Boolean)
    );
    return ["all", ...Array.from(values).sort()];
  }, [drivers]);

  const kpis = useMemo(() => {
    const blocked = drivers.filter((driver) => !driver.isDiscoverable).length;
    const stale = drivers.filter((driver) =>
      (driver.discoverabilityReasons || []).some((reason) =>
        ["stale_gps", "missing_current_location", "missing_location_time", "low_accuracy"].includes(reason)
      )
    ).length;
    const busy = drivers.filter((driver) => driver.availabilityStatus === "Busy").length;
    return {
      online: drivers.length,
      discoverable: drivers.length - blocked,
      busy,
      stale,
    };
  }, [drivers]);

  const updateStatus = async (driver, status, rejectionReason = "") => {
    try {
      await updateDriverReviewStatus(driver._id, {
        status,
        rejection_reason: rejectionReason,
      });
      Swal.fire("Success", "Driver status updated.", "success");
      fetchDrivers();
    } catch (error) {
      Swal.fire(
        "Error",
        error?.response?.data?.message || "Failed to update status.",
        "error"
      );
    }
  };

  const handleReject = async (driver) => {
    const result = await Swal.fire({
      title: "Reject Driver Request",
      input: "text",
      inputLabel: "Reason (optional)",
      showCancelButton: true,
      confirmButtonText: "Reject",
      confirmButtonColor: "#dc3545",
    });
    if (!result.isConfirmed) return;
    await updateStatus(driver, "rejected", result.value || "");
  };

  return (
    <main className="app-content">
      <div className="app-title tile p-3 d-flex justify-content-between align-items-center flex-wrap gap-2">
        <div>
          <h1>Online Drivers</h1>
          <p className="mb-0">
            Live admin presence with marketplace discoverability and GPS quality checks.
            {isConnected ? (
              <span className="text-success ms-2">Live</span>
            ) : (
              <span className="text-danger ms-2">Socket disconnected</span>
            )}
          </p>
        </div>
        <button
          type="button"
          className="btn btn-outline-primary btn-sm"
          onClick={() => fetchDrivers(false)}
          disabled={loading}
        >
          {loading ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      <section className="online-driver-kpis" aria-label="Online driver status">
        <article className="tile online-driver-kpi">
          <span>Online now</span>
          <strong>{kpis.online}</strong>
        </article>
        <article className="tile online-driver-kpi online-driver-kpi--success">
          <span>Discoverable</span>
          <strong>{kpis.discoverable}</strong>
        </article>
        <article className="tile online-driver-kpi">
          <span>On trip</span>
          <strong>{kpis.busy}</strong>
        </article>
        <article className={`tile online-driver-kpi ${kpis.stale ? "online-driver-kpi--warning" : ""}`}>
          <span>GPS warnings</span>
          <strong>{kpis.stale}</strong>
        </article>
      </section>

      <div className="tile p-3 mt-3">
        <div className="online-driver-toolbar mb-3">
          <input
            type="text"
            className="form-control"
            style={{ maxWidth: 300 }}
            placeholder="Search name / WhatsApp"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select
            className="form-control"
            style={{ maxWidth: 180 }}
            value={vehicleFilter}
            onChange={(event) => setVehicleFilter(event.target.value)}
            aria-label="Vehicle filter"
          >
            {vehicleOptions.map((option) => (
              <option key={option} value={option}>
                {option === "all" ? "All vehicles" : option}
              </option>
            ))}
          </select>
          <select
            className="form-control"
            style={{ maxWidth: 210 }}
            value={discoverabilityFilter}
            onChange={(event) => setDiscoverabilityFilter(event.target.value)}
            aria-label="Discoverability filter"
          >
            <option value="all">All online drivers</option>
            <option value="discoverable">Discoverable</option>
            <option value="blocked">Blocked from discovery</option>
          </select>
        </div>

        {loading ? (
          <div className="d-flex justify-content-center align-items-center" style={{ minHeight: 200 }}>
            <div className="loader" />
          </div>
        ) : loadError ? (
          <div className="alert alert-danger text-center" role="alert">
            <div>{loadError}</div>
            <button
              type="button"
              className="btn btn-outline-danger btn-sm mt-2"
              onClick={fetchDrivers}
            >
              Retry
            </button>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="table table-bordered table-hover">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Name</th>
                  <th>Vehicle</th>
                  <th>WhatsApp</th>
                  <th>Status</th>
                  <th>Presence</th>
                  <th>Last heartbeat</th>
                  <th>Discoverability</th>
                  <th>GPS</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredDrivers.map((driver, index) => {
                  const name = driverName(driver);
                  const reasons = driver.discoverabilityReasons || [];
                  const primaryReason = reasons[0];
                  const gpsClass = `badge badge-${gpsTone(driver)}`;
                  return (
                    <tr key={driver._id}>
                      <td>{index + 1}</td>
                      <td>{name}</td>
                      <td>
                        <div>{driver.vehicleType || "N/A"}</div>
                        <small className="text-muted">
                          {driver.vehicleModel || driver.registration || ""}
                        </small>
                      </td>
                      <td>{maskPhone(driver.whatsappNumber || driver.phone)}</td>
                      <td>
                        <span className={statusBadgeClass(driver.status)}>
                          {(driver.status || "pending").toUpperCase()}
                        </span>
                      </td>
                      <td>
                        <span className="badge badge-success">ONLINE</span>
                      </td>
                      <td>
                        {driver.presenceLastHeartbeatAt
                          ? new Date(driver.presenceLastHeartbeatAt).toLocaleTimeString()
                          : "Active"}
                      </td>
                      <td>
                        {driver.isDiscoverable ? (
                          <span className="badge badge-success">DISCOVERABLE</span>
                        ) : (
                          <div className="online-driver-reasons">
                            <span className="badge badge-warning">BLOCKED</span>
                            <small title={reasons.map((reason) => reasonLabels[reason] || reason).join(", ")}>
                              {reasonLabels[primaryReason] || "Review required"}
                              {reasons.length > 1 ? ` +${reasons.length - 1}` : ""}
                            </small>
                          </div>
                        )}
                      </td>
                      <td>
                        <span className={gpsClass}>{formatLocationAge(driver)}</span>
                        {Number.isFinite(Number(driver.locationAccuracyM)) && (
                          <small className="text-muted d-block">
                            +/-{Math.round(Number(driver.locationAccuracyM))}m
                          </small>
                        )}
                      </td>
                      <td>
                        <TableUser
                          user={driver}
                          openDropdown={openDropdown}
                          setOpenDropdown={setOpenDropdown}
                          handleView={() => navigate(`/driver-detail/${driver._id}`)}
                          handleApprove={() => updateStatus(driver, "approved")}
                          handleReject={() => handleReject(driver)}
                          driver
                        />
                      </td>
                    </tr>
                  );
                })}
                {filteredDrivers.length === 0 && (
                  <tr>
                    <td colSpan={10} className="text-center">
                      No online drivers found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </main>
  );
};

export default OnlineDrivers;
