import React, { useEffect, useRef, useState } from "react";
import { Editor } from "@tinymce/tinymce-react";
import Swal from "sweetalert2";
import axios from "axios";

const CmsManagement = () => {
  const editorRef = useRef(null);
  const api_key = "3e4i7xmjvw1ebtnzlwcfxtlk0tuwjfui4s1w0l2pibtj6egn";

  const DEFAULT_ITEMS_PER_PAGE = 10;
  const [itemsPerPage, setItemsPerPage] = useState(DEFAULT_ITEMS_PER_PAGE);
  const [tableData, setTableData] = useState([]);
  const [currentPage, setCurrentPage] = useState(0);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const [pageName, setPageName] = useState("Privacy Policy");
  const [editorContent, setEditorContent] = useState("");
  const [editingItem, setEditingItem] = useState(null);
  const [errors, setErrors] = useState({ pageName: "", editorContent: "" });
  const [openDropdown, setOpenDropdown] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [privacyData, setPrivacyData] = useState({
    title: "Privacy Ploicy",
    description: ""
  })
  const dropdownRef = useRef(null);
  const modalRef = useRef(null);

  const fetchData = () => {
    setTimeout(() => {
      const users = [
        {
          srNum: 1,
          title: "Privacy Policy",
          content: privacyData.description,
          status: "Inactive",
        },
      ];
      setTableData(users);
      setLoading(false);
    }, 1000);
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

  // Filter data based on search term
  const filteredData = tableData.filter(
    (user) =>
      user.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.content.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalPages = Math.ceil(filteredData.length / itemsPerPage);
  const paginatedData = filteredData.slice(
    currentPage * itemsPerPage,
    (currentPage + 1) * itemsPerPage
  );

  // Handle form submission for adding/editing a CMS page
  const handleSubmit = (e) => {
    e.preventDefault();

    let newErrors = { pageName: "Privacy Policy", editorContent: "" };

    if (!pageName) {
      newErrors.pageName = "Page Name is required.";
    }

    if (!editorContent || editorContent.trim() === "") {
      newErrors.editorContent = "Page Content is required.";
    }

    if (newErrors.pageName || newErrors.editorContent) {
      setErrors(newErrors);
      return;
    }

    Swal.fire({
      title: editingItem ? "Update Item?" : "Add New Item?",
      text: editingItem
        ? "Are you sure you want to update this item?"
        : "Are you sure you want to add this item?",
      icon: "warning",
      showCancelButton: true,
    }).then((result) => {
      if (result.isConfirmed) {
        if (editingItem) {
          setTableData((prevData) =>
            prevData.map((item) =>
              item.srNum === editingItem.srNum
                ? { ...item, title: pageName, content: editorContent }
                : item
            )
          );
        } else {
          const newItem = {
            srNum: tableData.length + 1,
            title: pageName,
            content: editorContent,
            status: "Active",
          };
          setTableData((prevData) => [...prevData, newItem]);
        }
        resetForm();
        Swal.fire("Success!", "Your item has been saved.", "success");
      }
    });
  };

  const handleClose = () => {
    setIsModalOpen(false);
  };

  const handleEdit = (item) => {
    setEditingItem(item);
    setPageName(item.title);
    setEditorContent(item.content);
    setIsModalOpen(true);
  };

  const fetchPrivacy = async () => {
    try {
      const res = await axios.get("http://157.173.222.27:3008/api/v1/privacy/get/67c4a3fc79e4c95fba108799")
      console.log("res", res);
      setPrivacyData({
        title: "Privacy Policy",
        description: res.data.privacy.description
      })
    } catch (error) {

    }
  }
  console.log("privacy", privacyData);

  useEffect(() => {
    fetchPrivacy()
    // setPageName("Privacy Policy");
  }, []);
  const resetForm = () => {
    setPageName("Privacy Policy");
    setEditorContent("");
    setErrors({ pageName: "", editorContent: "" });
    setEditingItem(null);
    if (editorRef.current) {
      editorRef.current.setContent("");
    }
  };


  return (
    <main className="app-content">
      <div className="app-title tile p-3">
        <div>
          <h1>
            <span className="mr-4 fw-bold">&nbsp;CMS</span>
          </h1>
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
                  <div className="table-responsive">
                    <table
                      className="table table-bordered table-hover dt-responsive mt-2"
                      id="data-table"
                    >
                      <thead>
                        <tr>
                          <th>Sr. num</th>
                          <th>Page name</th>
                          {/* <th>Status</th> */}
                          <th>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {paginatedData?.length > 0 ? (
                          paginatedData?.map((row, index) => (
                            <tr key={index}>
                              <td>{index + 1 + currentPage * itemsPerPage}</td>
                              <td>{row.title}</td>
                              <td>
                                <div className="dropdown text-center">
                                  <button
                                    className="dropdown-button"
                                    onClick={() =>
                                      setOpenDropdown(
                                        openDropdown === row.srNum
                                          ? null
                                          : row.srNum
                                      )
                                    }
                                    aria-haspopup="true"
                                    aria-expanded={openDropdown === row.srNum}
                                  >
                                    <i
                                      className={`fa fa-ellipsis-v ${openDropdown === row.srNum
                                        ? "rotate-icon"
                                        : ""
                                        }`}
                                    ></i>
                                  </button>
                                  {openDropdown === row.srNum && (
                                    <div
                                      className="dropdown-menu show"
                                      ref={dropdownRef}
                                    >
                                      <a
                                        className="dropdown-item"
                                        onClick={() => {
                                          handleEdit(row);
                                          setOpenDropdown(null);
                                        }}
                                      >
                                        <i className="fa fa-edit"></i> Edit
                                      </a>
                                    </div>
                                  )}
                                </div>
                              </td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <h1 className="text-center">No Data Found</h1>{" "}
                          </tr>
                        )}
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
      {isModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content" ref={modalRef}>
            {" "}
            <button
              className="cross-button"
              aria-label="Close"
              onClick={handleClose}
            >
              <i className="fa-solid fa-times"></i>
            </button>
            <div
              className="case-status d-flex justify-content-center"
              style={{
                backgroundColor: "#00489d",
                color: "#fff",
                height: "50px",
                textAlign: "center",
                width: "100%",
              }}
            >
              <h4 style={{ marginTop: "12px" }}>
                {editingItem ? "Edit CMS" : "Add CMS"}
              </h4>
            </div>
            <div className="tile-body p-3">
              <form onSubmit={handleSubmit}>
                <div className="row">
                  <div className="col-lg-12 mt-2">
                    <label className="form-label" htmlFor="editorContent">
                      Page Content
                    </label>
                    <div>
                      <Editor
                        apiKey={api_key}
                        onEditorChange={(content) => setEditorContent(content)}
                        value={editorContent}
                        onInit={(evt, editor) => (editorRef.current = editor)}
                      />
                    </div>
                    {errors.editorContent && (
                      <div className="invalid-feedback d-block">
                        {errors.editorContent}
                      </div>
                    )}
                  </div>
                  <div className="col-lg-12 text-center mt-2">
                    <button
                      className="btn custom-btn text-white mt-2 w-20pr"
                      type="submit"
                    >
                      {editingItem ? "Update Page" : "Add Page"}
                    </button>
                    <button
                      className="btn btn-secondary mt-2 w-20pr"
                      style={{ marginLeft: "10px" }}
                      onClick={() => setIsModalOpen(false)}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </main>
  );
};

export default CmsManagement;
