import React, { useEffect, useRef, useState } from "react";
import Swal from "sweetalert2";
import AddUser from "../components/AddUser";
import TableUser from "../components/TableUser";
import { deleteUser } from "../utils/authUtils";
import axios from "axios";
import { getUserList, API_URL } from "../utils/api";

const Users = () => {
  const DEFAULT_ITEMS_PER_PAGE = 10;
  const [itemsPerPage, setItemsPerPage] = useState(DEFAULT_ITEMS_PER_PAGE);
  const [tableData, setTableData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(0);
  const [searchTerm, setSearchTerm] = useState("");
  const [openDropdown, setOpenDropdown] = useState(null);
  const [selectedUser, setSelectedUser] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [viewUser, setViewUser] = useState(null);
  const [showViewModal, setShowViewModal] = useState(false);
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

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await getUserList();
      // console.log("Response", res);
      setTableData(res);
    } catch (error) {
      Swal.fire({
        icon: "error",
        title: "Error",
        text: "Failed to fetch user data.",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();

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
    setViewUser(user);
    setShowViewModal(true);
  };

  // Updated filter logic: search by fullName, name, or phone
  const filteredData = tableData.filter((user) =>
    (user.fullName && user.fullName.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (user.name && user.name.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (user.phone && user.phone.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const totalPages = Math.ceil(filteredData.length / itemsPerPage);
  const paginatedData = filteredData.slice(
    currentPage * itemsPerPage,
    (currentPage + 1) * itemsPerPage
  );

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
    } catch (error) {
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
        <div>
          <h1 className="">
            <span className="mr-4 fw-bold">&nbsp; All Users</span>
          </h1>
        </div>
      </div>
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
      {showViewModal && viewUser && (
        <div className="modal-overlay">
          <div className="modal-content p-3">
            <h2>User Details</h2>
            <p><strong>Name:</strong> {viewUser.name}</p>
            <p><strong>Phone:</strong> {viewUser.phone}</p>
            {/* Add more fields as needed */}
            <button className="border py-1 text " onClick={() => setShowViewModal(false)}>Close</button>
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
                          <th>Status</th>
                          <th>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {paginatedData.map((user, index) => (
                          <tr key={user._id}>
                            <td>{index + 1 + currentPage * itemsPerPage}</td>
                            <td>{user.name}</td>
                            <td>{user.phone}</td>
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
                        Showing {currentPage * itemsPerPage + 1} to{" "}
                        {Math.min(
                          (currentPage + 1) * itemsPerPage,
                          filteredData.length
                        )}{" "}
                        of {filteredData.length} entries
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
