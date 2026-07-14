import React, { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { format } from "date-fns";
import DietMealTable from "./TableFitzone/DietMealTable";
import Swal from "sweetalert2";

const Diet = () => {
  const DEFAULT_ITEMS_PER_PAGE = 10;
  const [tableData, setTableData] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const [openDropdownIndex, setOpenDropdownIndex] = useState(null);
  const [itemsPerPage, setItemsPerPage] = useState(DEFAULT_ITEMS_PER_PAGE);
  const [currentPage, setCurrentPage] = useState(0);
  const [searchTerm, setSearchTerm] = useState("");

  const dropdownRef = useRef(null);

  const fetchData = () => {
    setTimeout(() => {
      const dietPlans = [
        { SNo: 1, LastEdit: "2024-10-17", Status: "Active" },
        { SNo: 2, LastEdit: "2024-10-18", Status: "Inactive" },
      ];
      setTableData(dietPlans);
      setLoading(false);
    }, 1000);
  };

  useEffect(() => {
    fetchData();
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setOpenDropdownIndex(null);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

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
          onClick={() => handlePageChange(i)}
        >
          {i + 1}
        </button>
      );
    }

    return buttons;
  };

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

  const filteredData = tableData.filter(
    (diet) =>
      diet.Status.toLowerCase().includes(searchTerm.toLowerCase()) ||
      format(new Date(diet.LastEdit), "dd-MM-yyyy")
        .toLowerCase()
        .includes(searchTerm.toLowerCase())
  );

  const totalPages = Math.ceil(filteredData.length / itemsPerPage);
  const paginatedData = filteredData.slice(
    currentPage * itemsPerPage,
    (currentPage + 1) * itemsPerPage
  );

  const handleToggleStatus = (sNo) => {
    setTableData((prevData) =>
      prevData.map((item) =>
        item.SNo === sNo
          ? {
              ...item,
              Status: item.Status === "Active" ? "Inactive" : "Active",
            }
          : item
      )
    );
  };

  const handleEdit = (diet) => {
    setOpenDropdownIndex(null);
    navigate("/manage-program/manage/diet-plan/add-diet", { state: { diet } });
  };

  const handleDelete = (sNo) => {
    Swal.fire({
      title: "Are you sure?",
      text: "You won't be able to revert this!",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#3085d6",
      cancelButtonColor: "#d33",
      confirmButtonText: "Yes, delete it!",
    }).then((result) => {
      if (result.isConfirmed) {
        setTableData((prevData) => prevData.filter((item) => item.SNo !== sNo));
        setOpenDropdownIndex(null);
        Swal.fire("Deleted!", "Your record has been deleted.", "success");
      }
    });
  };

  // Function to go back to the previous page
  const handleBack = () => {
    window.history.back();
  };

  return (
    <main className="app-content">
      <div className="app-title tile p-3">
        <h1>
          <span className="mr-4 fw-bold">&nbsp; Manage Diet Meal plan</span>
        </h1>
      </div>
      <div
        className="d-flex"
        style={{ alignItems: "center", justifyContent: "space-between" }}
      >
        <button
          className="btn mb-2 ms-2"
          style={{
            backgroundColor: "#00489d",
            color: "white",
          }}
          type="button"
          onClick={handleBack}
        >
          <i className="fa-solid fa-arrow-left" style={{ color: "#fff" }}></i>{" "}
          &nbsp;Previous
        </button>
        <div className="row">
          <div className="col-md-12 px-5">
            <div className="bt-ad-emp">
              <Link
                className="add-btt btn"
                to="/manage-program/manage/diet-plan/add-diet"
              >
                <i className="fa-regular fa-plus"></i> Add Diet & Meal
              </Link>
            </div>
          </div>
        </div>
      </div>
      <div className="row mt-4">
        <div className="col-md-12 px-5">
          <div className="tile p-2">
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
                  <table className="table table-bordered table-hover dt-responsive mt-2">
                    <thead>
                      <tr>
                        <th>S.No</th>
                        <th>Last Edit </th>
                        <th>Status</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedData.map((diet, index) => (
                        <tr key={diet.SNo}>
                          <td>{index + 1}</td>
                          <td>
                            {format(new Date(diet.LastEdit), "dd-MM-yyyy")}
                          </td>
                          <td>
                            <div className="form-check form-switch">
                              <input
                                className="form-check-input"
                                type="checkbox"
                                role="switch"
                                checked={diet.Status === "Active"}
                                onChange={() => handleToggleStatus(diet.SNo)}
                              />
                            </div>
                          </td>
                          <td>
                            <DietMealTable
                              setOpenDropdown={setOpenDropdownIndex}
                              openDropdown={openDropdownIndex}
                              handleEdit={handleEdit}
                              handleDelete={handleDelete}
                              user={diet}
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
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
                      onClick={() => handlePageChange(totalPages - 1)}
                      disabled={currentPage >= totalPages - 1}
                      aria-label="Last Page"
                    >
                      &raquo;
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {totalPages > 1 && (
        <div className="pagination-container text-center">
          {getPaginationButtons()}
        </div>
      )}
    </main>
  );
};

export default Diet;
