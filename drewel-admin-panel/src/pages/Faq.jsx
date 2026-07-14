import React, { useEffect, useRef, useState } from "react";
import Swal from "sweetalert2";

const Faq = () => {
  const dropdownRef = useRef(null);
  const [formData, setFormData] = useState([]);

  const DEFAULT_ITEMS_PER_PAGE = 10;
  const [newQuestion, setNewQuestion] = useState("");
  const [newAnswer, setNewAnswer] = useState("");
  const [error, setError] = useState({ question: "", answer: "" });
  const [editId, setEditId] = useState(null);
  const [itemsPerPage, setItemsPerPage] = useState(DEFAULT_ITEMS_PER_PAGE);
  const [currentPage, setCurrentPage] = useState(0);
  const [searchTerm, setSearchTerm] = useState("");
  const [openDropdown, setOpenDropdown] = useState(null);

  const visiblePages = 4;

  const fetchFAQs = async () => {
    try {
      const authToken = localStorage.getItem("authToken");

      if (!authToken) {
        Swal.fire("Error!", "Authentication token not found.", "error");
        return;
      }

      const response = await fetch("http://157.173.222.27:3008/api/v1/faq/get-all", {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`,
        },
      });

      const data = await response.json();

      if (response.ok) {
        setFormData(data.faqs || []); // Set API data in formData
      } else {
        Swal.fire("Error!", data.message || "Failed to fetch FAQs.", "error");
      }
    } catch (error) {
      Swal.fire("Error!", "Something went wrong. Please try again.", "error");
    }
  };

  useEffect(() => {
    fetchFAQs();
  }, []);


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

  const submittedFaq = async () => {
    try {
      const authToken = localStorage.getItem("authToken");
  
      if (!authToken) {
        Swal.fire("Error!", "Authentication token not found.", "error");
        return;
      }
  
      const response = await fetch("http://157.173.222.27:3008/api/v1/faq/add-new", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          question: newQuestion,
          answer: newAnswer,
        }),
      });
  
      const data = await response.json();
  
      if (response.ok) {
        Swal.fire("Success!", "Your FAQ has been added.", "success");
        resetForm();
        fetchFAQs();
      } else {
        Swal.fire("Error!", data.message || "Something went wrong.", "error");
      }
    } catch (error) {
      Swal.fire("Error!", "Failed to submit FAQ. Please try again.", "error");
    }
  };


  const handleSubmit = (e) => {
    e.preventDefault();
    let hasError = false;
    const newError = { question: "", answer: "" };

    if (!newQuestion) {
      newError.question = "Question is required.";
      hasError = true;
    }
    if (!newAnswer) {
      newError.answer = "Answer is required.";
      hasError = true;
    }

    if (hasError) {
      setError(newError);
      return;
    }

    Swal.fire({
      title: "Add New Item?",
      text: "Are you sure you want to add this item?",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#3085d6",
      cancelButtonColor: "#d33",
      confirmButtonText: "Yes, proceed!",
    }).then((result) => {
      if (result.isConfirmed) {
        submittedFaq();
      }
    });
  };


  const handleEdit = (id) => {
    const faqToEdit = formData.find((item) => item.id === id);
    setNewQuestion(faqToEdit.que);
    setNewAnswer(faqToEdit.ans);
    setEditId(id);
  };

  const handleDelete = async (id) => {
    const authToken = localStorage.getItem("authToken");
    console.log("Id", id);

    Swal.fire({
      title: "Are you sure?",
      text: "This will permanently delete the FAQ!",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#d33",
      cancelButtonColor: "#3085d6",
      confirmButtonText: "Yes, delete it!",
    }).then(async (result) => {
      if (result.isConfirmed) {
        try {
          const response = await fetch(`http://157.173.222.27:3008/api/v1/faq/delete/${id}`, {
            method: "DELETE",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${authToken}`,
            },
          });

          if (!response.ok) {
            throw new Error("Failed to delete FAQ.");
          }

          setFormData((prevData) => prevData.filter((item) => item._id !== id));
          Swal.fire("Deleted!", "Your FAQ has been deleted.", "success");
        } catch (error) {
          Swal.fire("Error!", "Failed to delete FAQ. Please try again.", "error");
        }
      }
    });
  };

  const toggleStatus = (id) => {
    setFormData((prevData) =>
      prevData.map((item) =>
        item.id === id ? { ...item, status: !item.status } : item
      )
    );
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

  const filteredData = formData.filter(
    (item) =>
      item.question.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.answer.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalPages = Math.ceil(filteredData.length / itemsPerPage);
  const paginatedData = filteredData.slice(
    currentPage * itemsPerPage,
    (currentPage + 1) * itemsPerPage
  );

  const resetForm = () => {
    setNewQuestion("");
    setNewAnswer("");
    setError({ question: "", answer: "" });
    setEditId(null);
  };

  return (
    <main className="app-content">
      <div className="app-title tile p-3">
        <h1>
          <span className="mr-4 fw-bold">&nbsp;FAQ</span>
        </h1>
      </div>

      <div className="row">
        <div
          className="col-md-12 mx-auto"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div className="tile faq-res w-75">
            <div
              className="case-status d-flex justify-content-center text-align-center"
              style={{
                backgroundColor: "#00489d",
                color: "#fff",
                height: "50px",
                textAlign: "center",
              }}
            >
              <h4 className="mt-2">Add FAQ</h4>
            </div>
            <div className="tile-body p-3">
              <form onSubmit={handleSubmit}>
                <div className="row">
                  <div className="col-lg-12 mt-2">
                    <label className="form-label">Question</label>
                    <input
                      className={`form-control mt-2 ${error.question ? "is-invalid" : ""
                        }`}
                      type="text"
                      placeholder="Question"
                      value={newQuestion}
                      onChange={(e) => setNewQuestion(e.target.value)}
                    />
                    {error.question && (
                      <div className="invalid-feedback">{error.question}</div>
                    )}
                  </div>
                  <div className="col-lg-12 mt-3">
                    <label className="form-label">Answer</label>
                    <textarea
                      className={`form-control ${error.answer ? "is-invalid" : ""
                        }`}
                      rows="3"
                      value={newAnswer}
                      placeholder="Answer"
                      onChange={(e) => setNewAnswer(e.target.value)}
                    ></textarea>
                    {error.answer && (
                      <div className="invalid-feedback">{error.answer}</div>
                    )}
                  </div>
                  <div className="col-lg-12 mt-3">
                    <button type="submit" className="btn custom-btn text-white">
                      Submit
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
                <table className="table mt-2 table-bordered table-hover dt-responsive">
                  <thead>
                    <tr>
                      <th>S.Num</th>
                      <th>Question</th>
                      <th>Answer</th>
                      {/* <th>Status</th> */}
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedData.map((data, index) => (
                      <tr key={data._id}>
                        <td>{index + 1 + currentPage * itemsPerPage}</td>
                        <td>{data.question}</td>
                        <td>{data.answer}</td>
                        {/* <td>
                          <div className="form-check form-switch">
                            <input
                              className="form-check-input"
                              type="checkbox"
                              role="switch"
                              checked={data.status}
                              onChange={() => toggleStatus(data._id)} // Use `_id` instead of `id`
                            />
                          </div>
                        </td> */}
                        <td>
                          <div className="dropdown text-center" ref={dropdownRef}>
                            <button
                              className="dropdown-button"
                              onClick={() => {
                                console.log("Dropdown clicked for ID:", data._id);
                                setOpenDropdown(openDropdown === data._id ? null : data._id);
                              }}
                              aria-haspopup="true"
                              aria-expanded={openDropdown === data._id}
                            >
                              <i
                                className={`fa fa-ellipsis-v ${openDropdown === data._id ? "rotate-icon" : ""}`}
                              ></i>
                            </button>
                            {openDropdown === data._id && (
                              <div className="dropdown-menu show">
                                <a
                                  className="dropdown-item"
                                  // onClick={(e) => {
                                  //   e.preventDefault();
                                  //   handleEdit(data._id);
                                  //   setOpenDropdown(null);
                                  // }}
                                >
                                  <i className="fa fa-edit"></i> Edit
                                </a>
                                <a
                                  className="dropdown-item"
                                  onClick={(e) => {
                                    e.preventDefault();
                                    console.log("Delete button clicked for ID:", data._id); 
                                    handleDelete(data._id);
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
                  <div
                    style={{
                      position: "absolute",
                      right: "12px",
                      margin: "0px 0px 0px 0px",
                    }}
                  >
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
    </main>
  );
};

export default Faq;
