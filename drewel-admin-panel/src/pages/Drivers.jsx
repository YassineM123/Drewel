import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import Swal from "sweetalert2";
import TableUser from "../components/TableUser";
import {
  getDriverList,
  updateDriverReviewStatus,
} from "../utils/api";

const statusOptions = ["all", "pending", "approved", "rejected", "completed"];
const availabilityOptions = ["all", "Online", "Busy", "Offline"];
const discoverabilityOptions = ["all", "discoverable", "blocked"];
const sortOptions = [
  ["updatedAt", "Last updated"],
  ["createdAt", "Joined"],
  ["basicRequestSubmittedAt", "Submitted"],
  ["presenceLastHeartbeatAt", "Last heartbeat"],
  ["locationUpdatedAt", "Last GPS"],
  ["status", "Status"],
];

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

const label = (value) => String(value || "N/A").replaceAll("_", " ");
const driverName = (driver) =>
  `${driver.firstName || ""} ${driver.lastName || ""}`.trim() ||
  driver.fullName ||
  "N/A";
const maskPhone = (value) => {
  const phone = String(value || "").trim();
  if (phone.length <= 6) return phone || "N/A";
  return `${phone.slice(0, 4)}***${phone.slice(-3)}`;
};
const date = (value) => value ? new Date(value).toLocaleString() : "N/A";
const points = (driver) => Number(driver.pointsWallet?.availablePoints || 0).toLocaleString();
const gpsLabel = (driver) => {
  const seconds = Number(driver.locationAgeSeconds);
  if (!Number.isFinite(seconds)) return "No GPS";
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m ago`;
};

const Drivers = () => {
  const navigate = useNavigate();
  const [drivers, setDrivers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState("all");
  const [availabilityFilter, setAvailabilityFilter] = useState("all");
  const [discoverabilityFilter, setDiscoverabilityFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState("updatedAt");
  const [dir, setDir] = useState("desc");
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 1 });
  const [openDropdown, setOpenDropdown] = useState(null);
  const [loadError, setLoadError] = useState("");

  const fetchDrivers = useCallback(async () => {
    try {
      setLoading(true);
      setLoadError("");
      const result = await getDriverList({
        status: statusFilter,
        availability: availabilityFilter,
        discoverability: discoverabilityFilter,
        search,
        page,
        limit: 20,
        sort,
        dir,
      });
      setDrivers(Array.isArray(result.drivers) ? result.drivers : []);
      setPagination(result.pagination || { page, limit: 20, total: 0, totalPages: 1 });
    } catch (error) {
      setDrivers([]);
      setLoadError(error?.response?.data?.message || "Unable to load drivers right now.");
    } finally {
      setLoading(false);
    }
  }, [availabilityFilter, dir, discoverabilityFilter, page, search, sort, statusFilter]);

  useEffect(() => {
    fetchDrivers();
  }, [fetchDrivers]);

  useEffect(() => {
    setPage(1);
  }, [availabilityFilter, discoverabilityFilter, search, sort, dir, statusFilter]);

  const kpis = useMemo(() => {
    return drivers.reduce((acc, driver) => {
      if (driver.isDiscoverable) acc.discoverable += 1;
      if (driver.availabilityStatus === "Busy") acc.busy += 1;
      if (driver.isRestricted) acc.restricted += 1;
      if (Number(driver.pointsWallet?.availablePoints || 0) < 20) acc.lowPoints += 1;
      return acc;
    }, { discoverable: 0, busy: 0, restricted: 0, lowPoints: 0 });
  }, [drivers]);

  const changeSort = (field) => {
    setSort((current) => {
      if (current === field) {
        setDir((value) => (value === "asc" ? "desc" : "asc"));
        return current;
      }
      setDir("desc");
      return field;
    });
  };

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

  const handleApprove = async (driver) => {
    await updateStatus(driver, "approved");
  };

  const handleReject = async (driver) => {
    const result = await Swal.fire({
      title: "Reject Driver Request",
      input: "text",
      inputLabel: "Reason (optional)",
      inputPlaceholder: "Reason for rejection",
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
        <div>
          <h1>Drivers</h1>
          <p className="mb-0">Operational driver administration with verification, availability, points, rides and GPS evidence.</p>
        </div>
        <button type="button" className="btn btn-outline-primary btn-sm" disabled={loading} onClick={fetchDrivers}>
          {loading ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      <section className="online-driver-kpis" aria-label="Driver operations status">
        <article className="tile online-driver-kpi"><span>Loaded drivers</span><strong>{drivers.length}</strong></article>
        <article className="tile online-driver-kpi online-driver-kpi--success"><span>Discoverable</span><strong>{kpis.discoverable}</strong></article>
        <article className="tile online-driver-kpi"><span>On trip</span><strong>{kpis.busy}</strong></article>
        <article className={`tile online-driver-kpi ${kpis.lowPoints || kpis.restricted ? "online-driver-kpi--warning" : ""}`}><span>Needs review</span><strong>{kpis.lowPoints + kpis.restricted}</strong></article>
      </section>

      <div className="tile p-3 mt-3">
        <div className="d-flex flex-wrap align-items-center justify-content-between mb-3" style={{ gap: 12 }}>
          <div className="d-flex flex-wrap align-items-center" style={{ gap: 10 }}>
            <label className="mb-0 fw-bold">Status</label>
            <select
              className="form-control"
              style={{ minWidth: 180 }}
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              {statusOptions.map((status) => (
                <option key={status} value={status}>
                  {status.toUpperCase()}
                </option>
              ))}
            </select>
            <select
              className="form-control"
              style={{ minWidth: 160 }}
              value={availabilityFilter}
              onChange={(e) => setAvailabilityFilter(e.target.value)}
              aria-label="Availability filter"
            >
              {availabilityOptions.map((status) => (
                <option key={status} value={status}>
                  {status === "all" ? "ALL AVAILABILITY" : status.toUpperCase()}
                </option>
              ))}
            </select>
            <select
              className="form-control"
              style={{ minWidth: 190 }}
              value={discoverabilityFilter}
              onChange={(e) => setDiscoverabilityFilter(e.target.value)}
              aria-label="Discoverability filter"
            >
              {discoverabilityOptions.map((option) => (
                <option key={option} value={option}>
                  {option === "all" ? "ALL DISCOVERABILITY" : option.toUpperCase()}
                </option>
              ))}
            </select>
            <select
              className="form-control"
              style={{ minWidth: 170 }}
              value={sort}
              onChange={(e) => setSort(e.target.value)}
              aria-label="Sort drivers"
            >
              {sortOptions.map(([value, text]) => (
                <option key={value} value={value}>{text}</option>
              ))}
            </select>
          </div>

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
          <div
            className="d-flex justify-content-center align-items-center"
            style={{ minHeight: 200 }}
          >
            <div className="loader" />
          </div>
        ) : loadError ? (
          <div className="alert alert-danger text-center" role="alert">
            <div>{loadError}</div>
            <button type="button" className="btn btn-outline-danger btn-sm mt-2" onClick={fetchDrivers}>
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
                  <th>Availability</th>
                  <th>Discoverability</th>
                  <th>Points</th>
                  <th>Rides</th>
                  <th>
                    <button type="button" className="ride-sort-button" onClick={() => changeSort("locationUpdatedAt")}>
                      Last GPS {sort === "locationUpdatedAt" ? (dir === "asc" ? "ASC" : "DESC") : ""}
                    </button>
                  </th>
                  <th>Documents</th>
                  <th>
                    <button type="button" className="ride-sort-button" onClick={() => changeSort("updatedAt")}>
                      Last activity {sort === "updatedAt" ? (dir === "asc" ? "ASC" : "DESC") : ""}
                    </button>
                  </th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {drivers.map((driver, index) => {
                  const fullName = driverName(driver);
                  const doc = driver.documentSummary || {};
                  return (
                    <tr key={driver._id}>
                      <td>{(pagination.page - 1) * pagination.limit + index + 1}</td>
                      <td>{fullName}</td>
                      <td>
                        <div>{driver.vehicleType || "N/A"}</div>
                        <small className="text-muted">{driver.vehicleModel || driver.registration || ""}</small>
                      </td>
                      <td>{maskPhone(driver.whatsappNumber || driver.phone)}</td>
                      <td>
                        <span className={statusBadgeClass(driver.status)}>
                          {(driver.status || "pending").toUpperCase()}
                        </span>
                      </td>
                      <td>
                        <span className={`badge ${driver.availabilityStatus === "Online" ? "badge-success" : driver.availabilityStatus === "Busy" ? "badge-warning" : "badge-secondary"}`}>
                          {driver.availabilityStatus || "Offline"}
                        </span>
                      </td>
                      <td>
                        {driver.isDiscoverable ? <span className="badge badge-success">DISCOVERABLE</span> : <span className="badge badge-warning">{label(driver.discoverabilityReasons?.[0] || "blocked")}</span>}
                      </td>
                      <td>{points(driver)}</td>
                      <td>
                        <div>{driver.rideSummary?.completed || 0} completed</div>
                        {driver.rideSummary?.activeRide && <small className="text-muted">{driver.rideSummary.activeRide.reference || driver.rideSummary.activeRide.status}</small>}
                      </td>
                      <td>{gpsLabel(driver)}</td>
                      <td>{doc.available ?? 0}/{doc.total ?? 0}</td>
                      <td>{date(driver.lastActivityAt || driver.updatedAt)}</td>
                      <td>
                        <TableUser
                          user={driver}
                          openDropdown={openDropdown}
                          setOpenDropdown={setOpenDropdown}
                          handleView={() => navigate(`/driver-detail/${driver._id}`)}
                          handleApprove={() => handleApprove(driver)}
                          handleReject={() => handleReject(driver)}
                          driver
                        />
                      </td>
                    </tr>
                  );
                })}
                {drivers.length === 0 && (
                  <tr>
                    <td colSpan={13} className="text-center">
                      No drivers found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
        {!loading && !loadError && (
          <div className="d-flex justify-content-between align-items-center mt-3 flex-wrap" style={{ gap: 12 }}>
            <span className="text-muted">
              Page {pagination.page} of {pagination.totalPages} - {pagination.total} drivers
            </span>
            <div className="btn-group">
              <button type="button" className="btn btn-outline-secondary btn-sm" disabled={pagination.page <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))}>Previous</button>
              <button type="button" className="btn btn-outline-secondary btn-sm" disabled={pagination.page >= pagination.totalPages} onClick={() => setPage((value) => value + 1)}>Next</button>
            </div>
          </div>
        )}
      </div>
    </main>
  );
};

export default Drivers;
