import React, { useEffect, useState } from "react";
import "dropify/dist/css/dropify.css";
import $ from "jquery";
import "dropify";
import Swal from "sweetalert2";

const AddDiet = () => {
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    file: null,
  });
  const [errors, setErrors] = useState({});

  useEffect(() => {
    // Initialize Dropify
    $(".dropify").dropify();
  }, []);

  const handleSubmit = (e) => {
    e.preventDefault();

    const formErrors = {};

    if (!formData.title) formErrors.title = "Title is required.";
    if (!formData.description) formErrors.description = "Description is required.";
    if (!formData.file) formErrors.file = "File upload is required.";

    if (formData.file) {
      const file = formData.file[0];
      const validTypes = ["image/jpeg", "image/png", "image/gif", "image/webp"];
      if (!validTypes.includes(file.type)) {
        formErrors.file = "Invalid file type. Allowed types are JPG, PNG, GIF, and WEBP.";
      }
      if (file.size > 6 * 1024 * 1024) {
        formErrors.file = "File size is too large. Maximum size is 6MB.";
      }
    }

    if (Object.keys(formErrors).length > 0) {
      setErrors(formErrors);
    } else {
      console.log("Form data submitted successfully:", formData);
      setErrors({});

      // Success message with SweetAlert
      Swal.fire({
        title: "Success!",
        text: "Diet added successfully.",
        icon: "success",
        confirmButtonText: "OK",
      });

      // Clear form data
      setFormData({ title: "", description: "", file: null });

      // Reset Dropify
      const dropifyElement = $(".dropify").dropify();
      dropifyElement.data("dropify").resetPreview();
      dropifyElement.data("dropify").clearElement();
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
    const files = e.target.files;
    setFormData((prevData) => ({
      ...prevData,
      file: files,
    }));

    if (files.length > 0) {
      setErrors((prevErrors) => {
        const newErrors = { ...prevErrors };
        delete newErrors.file;
        return newErrors;
      });
    }
  };

  return (
    <main className="app-content">
      <div className="app-title tile p-3">
        <div>
          <h1>
            <span className="mr-4">&nbsp; Add Diet</span>
          </h1>
        </div>
      </div>
      <button
        className="btn mb-2 ms-2"
        style={{ backgroundColor: "#00489d", color: "white" }}
        type="button"
        onClick={() => window.history.back()}
      >
        <i className="fa-solid fa-arrow-left" style={{ color: "#fff" }}></i>{" "}
        &nbsp;Previous
      </button>

      <div className="row">
        <div className="col-md-10 px-5 w-100 d-flex align-items-center justify-content-center">
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
              <h4 className="mt-2">Add Diet</h4>
            </div>
            <div className="tile-body p-3">
              <form onSubmit={handleSubmit}>
                <div>
                  <div className="mb-3 w-100">
                    <label className="form-label">Title</label>
                    <input
                      className="form-control"
                      type="text"
                      placeholder="Enter Title Here"
                      name="title"
                      value={formData.title}
                      onChange={handleInputChange}
                    />
                    {errors.title && (
                      <small className="text-danger">{errors.title}</small>
                    )}
                  </div>
                  <div className="mb-3 w-100">
                    <label className="form-label">Description</label>
                    <textarea
                      rows={6}
                      className="form-control"
                      placeholder="Enter description"
                      name="description"
                      value={formData.description}
                      onChange={handleInputChange}
                    ></textarea>
                    {errors.description && (
                      <small className="text-danger">{errors.description}</small>
                    )}
                  </div>
                </div>

                <div className="form-group mb-0">
                  <label className="form-label">Upload Icon</label>
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
                    Maximum Icon Size: Up to 6MB per upload
                  </small>
                </div>

                <div className="mb-3 text-center mt-3">
                  <button
                    className="btn custom-btn text-white w-25"
                    type="submit"
                  >
                    <i className="fa-thin fa-paper-plane"></i> &nbsp; Add Diet
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

export default AddDiet;
