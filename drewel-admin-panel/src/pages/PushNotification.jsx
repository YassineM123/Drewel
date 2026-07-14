import React, { useEffect, useState } from "react";
import Swal from "sweetalert2";
import send from "../assets/images/send.png";

const PushNotification = () => {
  const DEFAULT_ITEMS_PER_PAGE = 10;
  const [itemsPerPage, setItemsPerPage] = useState(DEFAULT_ITEMS_PER_PAGE);
  const [currentPage, setCurrentPage] = useState(0);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const [pageName, setPageName] = useState("");
  const [errors, setErrors] = useState({ pageName: "" });
  const [notifications, setNotifications] = useState([]);
  const [recipients, setRecipients] = useState({
    subAdmin: false,
    user: false,
    both: false,
  });

  const visiblePages = 4;

  const handlePageChange = (page) => {
    setCurrentPage(page);
  };

  const fetchData = () => {
    setTimeout(() => {
      const users = [
        {
          srNum: 1,
          createdDate: "3 Jan 2024",
          message: "I am Anjali Verma",
        },
        {
          srNum: 2,
          createdDate: "3 Oct 2024",
          message: "Hello, I'm Rahul Singh",
        },
      ];
      setNotifications(users);
      setLoading(false);
    }, 1000);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleItemsPerPageChange = (e) => {
    setItemsPerPage(Number(e.target.value));
    setCurrentPage(0);
  };

  const handleSearchChange = (e) => {
    setSearchTerm(e.target.value);
    setCurrentPage(0);
  };

  const handleAddNotification = (e) => {
    e.preventDefault();

    if (!pageName.trim()) {
      setErrors({ pageName: "Message cannot be empty." });
    } else {
      setErrors({ pageName: "" });

      Swal.fire({
        title: "Are you sure?",
        text: "Do you want to add this notification?",
        icon: "question",
        showCancelButton: true,
        confirmButtonColor: "#3085d6",
        cancelButtonColor: "#d33",
        confirmButtonText: "Yes, add it!",
      }).then((result) => {
        if (result.isConfirmed) {
          const selectedRecipients = [];
          if (recipients.subAdmin) selectedRecipients.push("Sub-Admin");
          if (recipients.user) selectedRecipients.push("User");
          if (recipients.both) selectedRecipients.push("Both");

          const newNotification = {
            srNum: notifications.length + 1,
            createdDate: new Date().toLocaleDateString("en-US", {
              day: "numeric",
              month: "short",
              year: "numeric",
            }),
            message: pageName,
            recipients: selectedRecipients.join(", "),
          };

          setNotifications([...notifications, newNotification]);
          setPageName("");
          setRecipients({ subAdmin: false, user: false, both: false });
          Swal.fire("Success!", "Notification added!", "success");
        }
      });
    }
  };

  const filteredData = notifications.filter((user) =>
    user.message.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const paginatedData = filteredData.slice(
    currentPage * itemsPerPage,
    (currentPage + 1) * itemsPerPage
  );

  const totalPages = Math.ceil(filteredData.length / itemsPerPage);

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

  return (
    <main className="app-content">
      <div className="app-title tile p-3">
        <h1>
          <span className="mr-4 fw-bold">Add Notification</span>
        </h1>
      </div>
      <div
        className="row p-3"
        style={{ display: "flex", justifyContent: "center" }}
      >
        <div className="col-md-12 px-5">
          <div className="tile">
            <div
              className="case-status d-flex justify-content-center text-align-center"
              style={{
                backgroundColor: "#00489d",
                color: "#fff",
                height: "50px",
              }}
            >
              <h4 className="mt-2">Add Message</h4>
            </div>
            <div className="tile-body p-3">
              <form onSubmit={handleAddNotification}>
                <div className="row">
                  <div className="col-lg-12 mt-2">
                    <label className="form-label" htmlFor="pageName">
                      Message
                    </label>
                    <textarea
                      className={`form-control ${
                        errors.pageName ? "is-invalid" : ""
                      }`}
                      id="pageName"
                      rows={6}
                      placeholder="Enter Message Here"
                      value={pageName}
                      onChange={(e) => setPageName(e.target.value)}
                    />
                    {errors.pageName && (
                      <div className="invalid-feedback">{errors.pageName}</div>
                    )}
                  </div>
                  <div className="col-lg-12 text-center mt-2">
                    <button
                      className="btn custom-btn text-white mt-2 w-20pr"
                      type="submit"
                    >
                      Send
                      <i
                        className="fa-regular fa-paper-plane"
                        style={{ marginLeft: "5px" }}
                      ></i>
                    </button>
                  </div>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>
      <div className="row">
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
                  <div className="table-responsive mt-2">
                    <table className="table table-bordered table-hover mt-2">
                      <thead>
                        <tr>
                          <th>Sr. num</th>
                          <th>Create Date</th>
                          <th>Message</th>
                        </tr>
                      </thead>
                      <tbody>
                        {paginatedData.length > 0 ? (
                          paginatedData.map((row, index) => (
                            <tr key={index}>
                              <td>{index + 1 + currentPage * itemsPerPage}</td>
                              <td>{row.createdDate}</td>
                              <td>
                                {row.message.length > 10
                                  ? row.message.substring(0, 100) + "..."
                                  : row.message}
                              </td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan="5">No Data Found...</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                    <div className="pagination d-flex justify-content-between">
                      <span>
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

export default PushNotification;
