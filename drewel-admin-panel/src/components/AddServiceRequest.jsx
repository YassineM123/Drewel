import React, { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom"; // Import useLocation
import "dropify/dist/css/dropify.css";
import $ from "jquery";
import "dropify";
import Swal from "sweetalert2";
import { addServiceRequest } from "../utils/authUtils";

const AddServiceRequest = () => {
  const location = useLocation();
  const [isAlert, setIsAlert] = useState(false);
  const navigate = useNavigate();

  // Initialize state for input fields
  const [formData, setFormData] = useState({
    name: "",
    file: null,
  });
  const [errors, setErrors] = useState({});

  useEffect(() => {
    // Initialize Dropify
    $(".dropify").dropify();

    // Pre-fill the form if redirected with data for editing
    if (location.state && location.state.row) {
      const { name, description } = location.state.row;
      setFormData({ name, description, file: null });
    }
  }, [location.state]);

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Check if a file is selected
    if (!formData.file || formData.file.length === 0) {
      setErrors({ file: "Please upload a file." });
      return;
    }

    const file = formData.file;
    const validTypes = ["image/jpeg", "image/png", "image/gif", "image/webp"];

    if (!validTypes.includes(file.type)) {
      setErrors({ file: "Invalid file type. Allowed types: JPG, PNG, GIF, WEBP." });
      return;
    }
    if (file.size > 6 * 1024 * 1024) {
      setErrors({ file: "File size too large. Maximum allowed: 6MB." });
      return;
    }

    const requestData = new FormData();
    requestData.append("serviceImage", formData.file);
    requestData.append("name", formData.name.trim());

    console.log("FormData before sending:", formData);
    for (let pair of requestData.entries()) {
      console.log(pair[0], pair[1]);
    }

    try {
      await addServiceRequest(requestData);
      Swal.fire("Success!", "Service added successfully.", "success").then(() => {
        navigate("/service-requests");
      });

      setFormData({ name: "", file: null });
      // Reset Dropify
      $(".dropify").data("dropify").resetPreview();
      $(".dropify").data("dropify").clearElement();
    } catch (error) {
      console.error("Error submitting form:", error);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prevData) => ({
      ...prevData,
      [name]: value,
    }));
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    setFormData((prevData) => ({
      ...prevData,
      file: file,
    }));

    if (file) {
      setErrors((prevErrors) => {
        const newErrors = { ...prevErrors };
        delete newErrors.file;
        return newErrors;
      });
    }
  };


  const handleBack = () => {
    window.history.back();
  };

  return (
    <main className="app-content">
      <div className="app-title tile p-3">
        <div>
          <h1>
            <span className="mr-4">&nbsp; Add Service</span>
          </h1>
        </div>
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
      </div>
      <div className="row">
        <div
          className="col-md-10 w-100"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div className="tile w-75">
            <div
              className="case-status d-flex justify-content-center text-align-center"
              style={{
                backgroundColor: "#00489d",
                color: "#fff",
                height: "50px",
                textAlign: "center",
                width: "100%",
              }}
            >
              <h4 className="mt-2">Add Service</h4>
            </div>
            <div className="tile-body p-3">
              <form onSubmit={handleSubmit}>
                <div className="mb-3 col-md-6 w-100">
                  <label className="form-label">Name</label>
                  <input
                    className="form-control"
                    type="text"
                    placeholder="Enter Program Title"
                    name="name"
                    value={formData.name}
                    onChange={handleInputChange}
                  />
                  {errors.name && (
                    <small className="text-danger">{errors.name}</small>
                  )}
                </div>

                <div className="form-group mb-0 pb-0">
                  <label className="form-label">Service Image</label>
                  <input
                    type="file"
                    className="dropify"
                    data-height="100"
                    multiple
                    accept=".jpg,.jpeg,.png,.gif,.webp,.pdf"
                    onChange={handleFileChange}
                  />
                  {errors.file && (
                    <small className="text-danger">{errors.file}</small>
                  )}
                  <small className="form-text text-muted upload-info mt-2 mb-2">
                    Maximum Image Size: Up to 6MB per upload
                  </small>
                </div>

                <div className="mb-3 col-lg-12 text-center mt-3">
                  <button
                    className="btn custom-btn text-white"
                    type="submit"
                  >
                    <i className="fa-thin fa-paper-plane"></i> &nbsp; Submit
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
};

export default AddServiceRequest;
