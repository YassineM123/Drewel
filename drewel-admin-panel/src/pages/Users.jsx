import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import Swal from "sweetalert2";
import AddUser from "../components/AddUser";
import TableUser from "../components/TableUser";
import axios from "axios";
import { getUserList, API_URL } from "../utils/api";

const Users = () => {
  const navigate = useNavigate();
  const DEFAULT_ITEMS_PER_PAGE = 10;
  const [itemsPerPage, setItemsPerPage] = useState(DEFAULT_ITEMS_PER_PAGE);
  const [tableData, setTableData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(0);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sort, setSort] = useState("updatedAt");
  const [pagination, setPagination] = useState({ page: 1, limit: DEFAULT_ITEMS_PER_PAGE, total: 0, totalPages: 1 });
  const [openDropdown, setOpenDropdown] = useState(null);
  const [selectedUser, setSelectedUser] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const authTokenExist = localStorage.getItem("authToken");

  const dropdownRef = useRef(null);
  const visiblePages = 4;

  const getPaginationButtons = () => {
    const buttons = [];
    let startPage = Math.max(0, currentPage - Math.floor(visiblePages / 2));
    let endPage = Math.min(totalPages - 1, startPage + visiblePages - 1);

    if (endPage - startPage < visiblePages - 1) {
      startPage = Math.max(0, endPage - visiblePages + 1);
    }

    for (let i = startPage; i <= endPage; i++) {
      const isActive = i === currentPage;
      buttons.push(
        <button
          key={i}
          style={{
            padding: "7px 10px",
            backgroundColor: isActive ? "#00489d" : "#e9ecef",
            color: isActive ? "white" : "#00489d",
            border: "1px solid lightgrey",
          }}
          className={`page-btn ${isActive ? "active" : ""}`}
          onClick={() => handlePageChange(i)}
        >
          {i + 1}
        </button>
      );
    }

    return buttons;
  };

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getUserList({
        search: searchTerm,
        status: statusFilter,
        page: currentPage + 1,
        limit: itemsPerPage,
        sort,
        dir: "desc",
      });
      setTableData(res.users || []);
      setPagination(res.pagination || { page: currentPage + 1, limit: itemsPerPage, total: 0, totalPages: 1 });
    } catch {
      Swal.fire({
        icon: "error",
        title: "Error",
        text: "Failed to fetch user data.",
      });
    } finally {
      setLoading(false);
    }
  }, [currentPage, itemsPerPage, searchTerm, sort, statusFilter]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setOpenDropdown(null);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const handleItemsPerPageChange = (e) => {
    setItemsPerPage(Number(e.target.value));
    setCurrentPage(0);
  };

  const handleSearchChange = (e) => {
    setSearchTerm(e.target.value);
    setCurrentPage(0);
  };

  const maskPhone = (value) => {
    const phone = String(value || "").trim();
    if (phone.length <= 6) return phone || "N/A";
    return `${phone.slice(0, 4)}***${phone.slice(-3)}`;
  };

  const handlePageChange = (page) => {
    setCurrentPage(page);
  };

  const handleDelete = (id) => {
    const authToken = localStorage.getItem('authToken');
    if (!authToken) {
      Swal.fire({
        title: "Error!",
        text: "Authentication token is missing. Please log in again.",
        icon: "error",
        confirmButtonText: "OK",
      });
      return;
    }

    Swal.fire({
      title: "Are you sure?",
      text: "You won't be able to revert this!",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#d33",
      cancelButtonColor: "#3085d6",
      confirmButtonText: "Yes, delete it!",
      cancelButtonText: "Cancel",
    }).then((result) => {
      if (result.isConfirmed) {
        axios.delete(`${API_URL}/users/${id}`, {
          headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json',
          },
        })
        .then(response => {
          if (response.status === 200) {
            fetchData();
            Swal.fire("Deleted!", "The user has been deleted.", "success");
          } else {
            throw new Error('Failed to delete the user');
          }
        })
        .catch(error => {
          console.error('Error:', error);
          Swal.fire({
            title: "Error!",
            text: "Failed to delete the user. Please try again.",
            icon: "error",
            confirmButtonText: "OK",
          });
        });
      }
    });
  };

  const handleEdit = (id) => {
    const user = tableData.find((u) => u._id === id);
    if (user) {
      setSelectedUser(user);
      setShowModal(true);
    }
  };

  const handleViewUser = (user) => {
    navigate(`/users/${user._id}`);
  };

  // Updated filter logic: search by fullName, name, or phone
  const totalPages = pagination.totalPages;
  const paginatedData = tableData;

  const handleToggleStatus = async (id) => {
    const userToUpdate = tableData.find((user) => user._id === id);
    if (!userToUpdate) return;

    const newStatus = !userToUpdate.isActive;

    // Optimistic UI Update
    setTableData((prevData) =>
      prevData.map((user) =>
        user._id === id ? { ...user, isActive: newStatus } : user
      )
    );

    try {
      const response = await axios.post(
        `${API_URL}/users/toggle-restriction`,
        { userId: id }, {
        headers: {
          Authorization: `Bearer ${authTokenExist}`,
        },
      }
      );
      if (response.status === 200) {
        Swal.fire("Success", `User status changed`, "success");
        fetchData();
      } else {
        throw new Error("Failed to update status");
      }
    } catch {
      Swal.fire("Error", "Failed to update user status. Please try again.", "error");

      setTableData((prevData) =>
        prevData.map((user) =>
          user._id === id ? { ...user, isActive: !newStatus } : user
        )
      );
    }
  };

  return (
    <main className="app-content">
      <div className="app-title tile p-3">
        <div className="d-flex justify-content-between align-items-center flex-wrap" style={{ gap: 12 }}>
          <div>
            <h1 className="">
              <span className="mr-4 fw-bold">&nbsp; Users</span>
            </h1>
            <p className="mb-0">Passenger administration with account state, ride history, active rides and support evidence.</p>
          </div>
          <button type="button" className="btn btn-outline-primary btn-sm" disabled={loading} onClick={fetchData}>
            {loading ? "Refreshing..." : "Refresh"}
          </button>
        </div>
      </div>
      <section className="online-driver-kpis" aria-label="User operations status">
        <article className="tile online-driver-kpi"><span>Loaded users</span><strong>{tableData.length}</strong></article>
        <article className="tile online-driver-kpi online-driver-kpi--success"><span>Active</span><strong>{tableData.filter((user) => !user.isRestricted).length}</strong></article>
        <article className="tile online-driver-kpi"><span>Active rides</span><strong>{tableData.filter((user) => user.rideSummary?.activeRide).length}</strong></article>
        <article className={`tile online-driver-kpi ${tableData.some((user) => user.isRestricted || user.rideSummary?.disputed) ? "online-driver-kpi--warning" : ""}`}><span>Needs review</span><strong>{tableData.filter((user) => user.isRestricted || user.rideSummary?.disputed).length}</strong></article>
      </section>
      {showModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <AddUser
              user={selectedUser}
              onClose={() => setShowModal(false)}
            />
          </div>
        </div>
      )}
      <div className="row mt-4">
        <div className="col-md-12 px-5">
          <div className="tile p-3">
            <div className="tile-body">
              <div className="table-responsive">
                <div
                  className="table-controls"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                  }}
                >
                 
                  <div className="search-container">
                    <span
                      className="search-text"
                      style={{ marginRight: "10px",fontWeight:600 }}
                    >
                      Filter by Name or Phone:
                    </span>
                    <input
                      type="text"
                      value={searchTerm}
                      onChange={handleSearchChange}
                      className="search-input"
                      placeholder="Enter name or phone"
                    />
                  </div>
                  <div className="items-per-page-container">
                    <select
                      value={statusFilter}
                      onChange={(event) => { setStatusFilter(event.target.value); setCurrentPage(0); }}
                      className="items-per-page-select"
                      aria-label="User status filter"
                    >
                      <option value="all">All users</option>
                      <option value="active">Active</option>
                      <option value="restricted">Restricted</option>
                    </select>
                  </div>
                  <div className="items-per-page-container">
                    <select
                      value={sort}
                      onChange={(event) => { setSort(event.target.value); setCurrentPage(0); }}
                      className="items-per-page-select"
                      aria-label="Sort users"
                    >
                      <option value="updatedAt">Last activity</option>
                      <option value="createdAt">Joined</option>
                      <option value="fullName">Name</option>
                      <option value="phone">Phone</option>
                    </select>
                  </div>
                  <div className="items-per-page-container">
                    <select
                      value={itemsPerPage}
                      onChange={handleItemsPerPageChange}
                      className="items-per-page-select"
                    >
                      <option value={10}>10</option>
                      <option value={25}>25</option>
                      <option value={50}>50</option>
                    </select>
                    <span
                      className="entries-text"
                      style={{ marginLeft: "10px" }}
                    >
                      entries per page
                    </span>
                  </div>
                </div>
                {loading ? (
                  <div
                    style={{
                      height: "200px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <div className="loader"></div>
                  </div>
                ) : (
                  <div className="table-responsive mt-2">
                    <table className="table table-bordered table-hover dt-responsive">
                      <thead>
                        <tr>
                          <th>S.No</th>
                          <th>User Name</th>
                          <th>Phone No</th>
                          <th>Rides</th>
                          <th>Active Ride</th>
                          <th>Support</th>
                          <th>Last Activity</th>
                          <th>Status</th>
                          <th>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {paginatedData.map((user, index) => (
                          <tr key={user._id}>
                            <td>{index + 1 + currentPage * itemsPerPage}</td>
                            <td>{user.fullName || user.name || "N/A"}</td>
                            <td>{maskPhone(user.phone)}</td>
                            <td>
                              <div>{user.rideSummary?.completed || 0} completed</div>
                              <small className="text-muted">{user.rideSummary?.cancelled || 0} cancelled / {user.rideSummary?.disputed || 0} disputed</small>
                            </td>
                            <td>
                              {user.rideSummary?.activeRide ? (
                                <span className="badge badge-warning">{user.rideSummary.activeRide.reference || user.rideSummary.activeRide.status}</span>
                              ) : (
                                <span className="text-muted">None</span>
                              )}
                            </td>
                            <td>
                              <div>{user.supportSummary?.messagesSent || 0} messages</div>
                            </td>
                            <td>{user.lastActivityAt ? new Date(user.lastActivityAt).toLocaleString() : "N/A"}</td>
                            <td>
                              {user.isRestricted ? (
                                <span className="badge badge-danger">Restricted</span>
                              ) : (
                                <span className="badge badge-success">Active</span>
                              )}
                            </td>
                            <td>
                              <TableUser
                                openDropdown={openDropdown}
                                setOpenDropdown={setOpenDropdown}
                                user={user}
                                handleDelete={() => handleDelete(user._id)}
                                handleEdit={() => handleEdit(user._id)}
                                handleView={() => handleViewUser(user)}
                                handleRestrict={() => handleToggleStatus(user?._id)}
                              />
                            </td>
                          </tr>
                        ))}
                        {!paginatedData.length && (
                          <tr>
                            <td colSpan={9} className="text-center">No users found.</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                    <div
                      className="pagination"
                      style={{
                        display: "flex",
                        alignItems: "flex-start",
                        justifyContent: "space-between",
                        marginTop: "30px",
                      }}
                    >
                      <span className="pagination-info">
                        Showing {pagination.total === 0 ? 0 : currentPage * itemsPerPage + 1} to{" "}
                        {Math.min(
                          (currentPage + 1) * itemsPerPage,
                          pagination.total
                        )}{" "}
                        of {pagination.total} entries
                      </span>
                      <div>
                        <button
                          style={{
                            padding: "7px 10px",
                            backgroundColor: "#e9ecef",
                            color: "#00489d",
                            border: "1px solid lightgrey",
                            borderRadius: "5px 0px 0px 5px",
                          }}
                          className="page-btn"
                          onClick={() => handlePageChange(0)}
                          disabled={currentPage === 0}
                        >
                          &laquo;
                        </button>
                        <button
                          style={{
                            padding: "7px 10px",
                            backgroundColor: "#e9ecef",
                            color: "#00489d",
                            border: "1px solid lightgrey",
                          }}
                          className="page-btn"
                          onClick={() => handlePageChange(currentPage - 1)}
                          disabled={currentPage === 0}
                        >
                          &#x3c;
                        </button>
                        {getPaginationButtons()}
                        <button
                          style={{
                            padding: "7px 10px",
                            backgroundColor: "#e9ecef",
                            color: "#00489d",
                            border: "1px solid lightgrey",
                          }}
                          className="page-btn"
                          onClick={() => handlePageChange(currentPage + 1)}
                          disabled={currentPage >= totalPages - 1}
                        >
                          &#x3e;
                        </button>
                        <button
                          style={{
                            padding: "7px 10px",
                            backgroundColor: "#e9ecef",
                            color: "#00489d",
                            border: "1px solid lightgrey",
                            borderRadius: "0px 5px 5px 0px",
                          }}
                          className="page-btn"
                          onClick={() => handlePageChange(totalPages - 1)}
                          disabled={currentPage >= totalPages - 1}
                        >
                          &raquo;
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
};

export default Users;
