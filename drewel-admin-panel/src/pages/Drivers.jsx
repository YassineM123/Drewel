import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import Swal from "sweetalert2";
import TableUser from "../components/TableUser";
import {
  getDriverList,
  updateDriverReviewStatus,
} from "../utils/api";

const statusOptions = ["all", "pending", "approved", "rejected", "completed"];

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

const Drivers = () => {
  const navigate = useNavigate();
  const [drivers, setDrivers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [openDropdown, setOpenDropdown] = useState(null);

  const fetchDrivers = async () => {
    try {
      setLoading(true);
      const list = await getDriverList(statusFilter);
      setDrivers(Array.isArray(list) ? list : []);
    } catch (error) {
      Swal.fire("Error", "Failed to load drivers.", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDrivers();
  }, [statusFilter]);

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
        <h1>Driver Verification Requests</h1>
      </div>

      <div className="tile p-3 mt-3">
        <div className="d-flex flex-wrap align-items-center justify-content-between mb-3" style={{ gap: 12 }}>
          <div className="d-flex align-items-center" style={{ gap: 10 }}>
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
        ) : (
          <div className="table-responsive">
            <table className="table table-bordered table-hover">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Name</th>
                  <th>WhatsApp</th>
                  <th>Submitted At</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredDrivers.map((driver, index) => {
                  const fullName = `${driver.firstName || ""} ${driver.lastName || ""}`.trim() || driver.fullName || "N/A";
                  const submittedAt = driver.basicRequestSubmittedAt || driver.createdAt;
                  return (
                    <tr key={driver._id}>
                      <td>{index + 1}</td>
                      <td>{fullName}</td>
                      <td>{driver.whatsappNumber || "N/A"}</td>
                      <td>{submittedAt ? new Date(submittedAt).toLocaleString() : "N/A"}</td>
                      <td>
                        <span className={statusBadgeClass(driver.status)}>
                          {(driver.status || "pending").toUpperCase()}
                        </span>
                      </td>
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
                {filteredDrivers.length === 0 && (
                  <tr>
                    <td colSpan={6} className="text-center">
                      No drivers found.
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

export default Drivers;
