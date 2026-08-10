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

const OnlineDrivers = () => {
  const navigate = useNavigate();
  const { socket, isConnected } = useSocket();
  const [drivers, setDrivers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [search, setSearch] = useState("");
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
    if (!term) return drivers;
    return drivers.filter((driver) => {
      const name = `${driver.firstName || ""} ${driver.lastName || ""}`.trim();
      const phone = `${driver.whatsappNumber || driver.phone || ""}`;
      return (
        name.toLowerCase().includes(term) ||
        phone.toLowerCase().includes(term)
      );
    });
  }, [drivers, search]);

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
      <div className="app-title tile p-3 d-flex justify-content-between align-items-center">
        <h1>Online Drivers</h1>
      </div>

      <div className="tile p-3 mt-3">
        <div className="d-flex justify-content-end mb-3">
          <input
            type="text"
            className="form-control"
            style={{ maxWidth: 300 }}
            placeholder="Search name / WhatsApp"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
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
                  <th>WhatsApp</th>
                  <th>Status</th>
                  <th>Presence</th>
                  <th>Last heartbeat</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredDrivers.map((driver, index) => {
                  const name = `${driver.firstName || ""} ${driver.lastName || ""}`.trim() || driver.fullName || "N/A";
                  return (
                    <tr key={driver._id}>
                      <td>{index + 1}</td>
                      <td>{name}</td>
                      <td>{driver.whatsappNumber || "N/A"}</td>
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
                    <td colSpan={7} className="text-center">
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
