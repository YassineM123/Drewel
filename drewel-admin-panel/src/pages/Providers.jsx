import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import Swal from "sweetalert2";
import axios from "axios";
import { API_URL } from "../utils/api";
import ViewBusiness from "../components/ViewBusiness";
import ViewVehicleModal from "../components/ViewVehicleModal";
import EditProviderModal from "../components/EditProviderModal";

const Providers = () => {
  const DEFAULT_ITEMS_PER_PAGE = 10;
  const [itemsPerPage, setItemsPerPage] = useState(DEFAULT_ITEMS_PER_PAGE);
  const [tableData, setTableData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(0);
  const [searchTerm, setSearchTerm] = useState("");
  const [openDropdown, setOpenDropdown] = useState(null);
  const [selectedBusiness, setSelectedBusiness] = useState(null);
  const [showBusinessModal, setShowBusinessModal] = useState(false);
  const [selectedVehicle, setSelectedVehicle] = useState(null);
  const [selectedProvider, setSelectedProvider] = useState(null);
  const [showVehicleModal, setShowVehicleModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);

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

  // Fetch data from the API
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const response = await axios.get(
        `${API_URL}/v1/service-provider/get-all`,
        {
          headers: {
            Authorization: `Bearer ${authTokenExist}`,
          },
        }
      );
      const providers = response.data.serviceProviders;
      setTableData(providers);
    } catch (error) {
      console.error("Error fetching data:", error);
      Swal.fire({
        icon: "error",
        title: "Error",
        text: "Failed to fetch service providers.",
      });
    } finally {
      setLoading(false);
    }
  }, [authTokenExist]);

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
  }, [fetchData]);

  const handleViewBusiness = (businessInfo) => {
    if (!businessInfo) return;
    setSelectedBusiness(businessInfo);
    setShowBusinessModal(true);
  };

  const handleViewVehicle = (vehicleInfo) => {
    console.log("Vehicle Info before setting state:", vehicleInfo);
    setSelectedVehicle(vehicleInfo);
    setShowVehicleModal(true);
  };


  const handleEditProvider = (provider) => {
    setSelectedProvider(provider);
    setShowEditModal(true);
  };

  const handleSaveProvider = (updatedProvider) => {
    setTableData(prev =>
      prev.map(p => (p._id === updatedProvider._id ? updatedProvider : p))
    );
    setShowEditModal(false);
  };

  // Handle deleting a provider
  const handleDelete = (id) => {
    Swal.fire({
      title: "Are you sure?",
      text: "You will not be able to recover this provider!",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#d33",
      cancelButtonColor: "#3085d6",
      confirmButtonText: "Yes, delete it!",
    }).then((result) => {
      if (result.isConfirmed) {
        setTableData((prevData) =>
          prevData.filter((item) => item.id !== id)
        );
        Swal.fire("Deleted!", "Your provider has been deleted.", "success");
      }
    });
  };

  // Handle changing items per page
  const handleItemsPerPageChange = (e) => {
    setItemsPerPage(Number(e.target.value));
    setCurrentPage(0);
  };

  // Handle search input change
  const handleSearchChange = (e) => {
    setSearchTerm(e.target.value);
    setCurrentPage(0);
  };

  // Handle page change
  const handlePageChange = (page) => {
    setCurrentPage(page);
  };

  const toggleStatus = async (id, isActive, authTokenExist) => {
    try {
      const result = await Swal.fire({
        title: "Are you sure?",
        text: `You are about to ${isActive ? "deactivate" : "activate"} this user.`,
        icon: "warning",
        showCancelButton: true,
        confirmButtonColor: "#3085d6",
        cancelButtonColor: "#d33",
        confirmButtonText: "Yes, change it!",
      });

      if (!result.isConfirmed) {
        return;
      }

      const response = await fetch(
        `${API_URL}/v1/service-provider/update-status/${id}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${authTokenExist}`,
          },
          body: JSON.stringify({
            status: !isActive, // Toggle status
          }),
        }
      );

      const data = await response.json();

      if (response.ok) {
        setTableData((prevData) =>
          prevData.map((item) =>
            item._id === id ? { ...item, isActive: !isActive } : item
          )
        );

        Swal.fire({
          title: "Updated!",
          text: `User has been ${!isActive ? "activated" : "deactivated"}.`,
          icon: "success",
        });
      } else {
        Swal.fire({
          title: "Error!",
          text: data.message || "Failed to update status.",
          icon: "error",
        });
      }
    } catch (error) {
      console.error("Network error:", error);
      Swal.fire({
        title: "Network Error",
        text: "Something went wrong. Please try again later.",
        icon: "error",
      });
    }
  };


  // Filter data based on search term
  const filteredData = tableData.filter((user) =>
    user.bussinessInfo.companyName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Calculate total pages and paginated data
  const totalPages = Math.ceil(filteredData.length / itemsPerPage);
  const paginatedData = filteredData.slice(
    currentPage * itemsPerPage,
    (currentPage + 1) * itemsPerPage
  );

  return (
    <main className="app-content">
      <div className="app-title tile p-3">
        <div>
          <h1>
            <span className="mr-4 fw-bold">&nbsp; Manage Providers</span>
          </h1>
        </div>
      </div>
      {showBusinessModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <ViewBusiness businessInfo={selectedBusiness} onClose={() => setShowBusinessModal(false)} />
          </div>
        </div>
      )}

      {showVehicleModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <ViewVehicleModal vehicleInfo={selectedVehicle} onClose={() => setShowVehicleModal(false)} />
          </div>
        </div>
      )}

      {showEditModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <EditProviderModal
              provider={selectedProvider} onClose={() => setShowEditModal(false)} onSave={handleSaveProvider} />
          </div>
        </div>
      )}

      <div className="row mb-5">
        <div className="col-md-12 px-5">
          <div className="bt-ad-emp">
            <Link to="/drivers/addDriver" className="add-btt btn">
              <i className="fa-regular fa-plus"></i> Add Provider
            </Link>
          </div>
        </div>
      </div>
      <div className="row mt-4">
        <div className="col-md-12 px-5">
          <div className="tile">
            <div className="tile-body p-3">
              <div className="table-responsive">
                <div
                  className="table-controls"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                  }}
                >
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
                  <div className="search-container">
                    <span
                      className="search-text"
                      style={{ marginRight: "10px" }}
                    >
                      Search:
                    </span>
                    <input
                      type="text"
                      value={searchTerm}
                      onChange={handleSearchChange}
                      className="search-input"
                    />
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
                  <div className="table-responsive">
                    <table
                      className="table table-bordered table-hover dt-responsive mt-2"
                      id="data-table"
                    >
                      <thead>
                        <tr>
                          <th>S.No</th>
                          <th>Company Name</th>
                          <th>Business Details</th>
                          <th>Vehicle Details</th>
                          <th>Charges</th>
                          <th>Status</th>
                          <th>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {paginatedData.map((user, index) => (
                          <tr key={index}>
                            <td>{currentPage * itemsPerPage + index + 1}</td>
                            <td>{user?.bussinessInfo?.companyName}</td>
                            <td>
                              <button style={{}} onClick={() => handleViewBusiness(user.bussinessInfo)}>
                                Business Details
                              </button>
                            </td>
                            <td>
                              <button onClick={() => handleViewVehicle(user.vehicleDetails)}>
                                Vehicle Details
                              </button>
                            </td>
                            <td>{user.charges}</td>
                            <td>
                              <div className="form-check form-switch">
                                <input
                                  className="form-check-input"
                                  type="checkbox"
                                  role="switch"
                                  checked={user.isActive === true}
                                  onChange={() =>
                                    toggleStatus(user._id, user.isActive, authTokenExist)
                                  }
                                />
                              </div>
                            </td>
                            <td>
                              <div
                                ref={dropdownRef}
                                className="dropdown text-center"
                              >
                                <button
                                  className="dropdown-button"
                                  onClick={() =>
                                    setOpenDropdown(
                                      openDropdown === user._id
                                        ? null
                                        : user._id
                                    )
                                  }
                                  aria-haspopup="true"
                                  aria-expanded={openDropdown === user._id}
                                >
                                  <i
                                    className={`fa fa-ellipsis-v ${openDropdown === user._id
                                      ? "rotate-icon"
                                      : ""
                                      }`}
                                  ></i>
                                </button>
                                {openDropdown === user._id && (
                                  <div className="dropdown-menu show">
                                    <button
                                      className="dropdown-item"
                                      onClick={() => handleEditProvider(user)}
                                    >
                                      <i className="fa fa-edit"></i> Edit
                                    </button>
                                    <a
                                      className="dropdown-item"
                                      onClick={() => {
                                        handleDelete(user._id);
                                        setOpenDropdown(null);
                                      }}
                                    >
                                      <i className="fa fa-trash"></i> Delete
                                    </a>
                                  </div>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <div
                      className="pagination"
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
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
                          aria-label="First Page"
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
                          aria-label="Previous Page"
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
                          aria-label="Next Page"
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
                          aria-label="Last Page"
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

export default Providers;
