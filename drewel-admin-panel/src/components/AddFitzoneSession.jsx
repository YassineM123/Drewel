import React, { useEffect, useState } from "react";
import "dropify/dist/css/dropify.css";
import $ from "jquery";
import "dropify";
import Swal from "sweetalert2";
import Select from "react-select";

const AddFitzoneSession = () => {
  const [formData, setFormData] = useState({
    title: "",
    video: null,
    category: "",
    description: "",
  });
  const [errors, setErrors] = useState({});

  useEffect(() => {
    $(".dropify").dropify();
  }, []);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value,
    });
  };

  const handleSelectChange = (selectedOption) => {
    console.log("Selected Option:", selectedOption);
    setFormData((prevData) => ({
      ...prevData,
      category: selectedOption.value,
    }));
  };

  const handleFileChange = (e) => {
    const files = e.target.files;
    setFormData((prevData) => ({
      ...prevData,
      video: files,
    }));

    if (files.length > 0) {
      setErrors((prevErrors) => {
        const newErrors = { ...prevErrors };
        delete newErrors.video;
        return newErrors;
      });
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    const formErrors = {};

    if (!formData.title) formErrors.title = "Title is required.";
    if (!formData.category) formErrors.category = "Category is required.";
    if (!formData.description)
      formErrors.description = "Description is required.";

    if (!formData.video) formErrors.video = "Video upload is required.";
    if (formData.video) {
      const file = formData.video[0];
      const validTypes = ["video/mp4", "video/avi", "video/mov"];
      if (!validTypes.includes(file.type)) {
        formErrors.video =
          "Invalid file type. Allowed types are MP4, AVI, and MOV.";
      }
    }

    if (Object.keys(formErrors).length > 0) {
      setErrors(formErrors);
    } else {
      console.log("Form data submitted successfully:", formData);
      setErrors({});

      Swal.fire({
        title: "Success!",
        text: "Session added successfully.",
        icon: "success",
        confirmButtonText: "OK",
      });

      setFormData({ title: "", video: null, category: "", description: "" });

      const dropifyElement = $(".dropify").dropify();
      dropifyElement.data("dropify").resetPreview();
      dropifyElement.data("dropify").clearElement();
    }
  };

  const handleBack = () => {
    window.history.back();
  };

  const categoryOptions = [
    { value: "Category 1", label: "Category 1" },
    { value: "Category 2", label: "Category 2" },
    { value: "Category 3", label: "Category 3" },
    { value: "Category 4", label: "Category 4" },
    { value: "Category 5", label: "Category 5" },
    { value: "Category 6", label: "Category 6" },
  ];

  return (
    <main className="app-content">
      <div className="app-title tile p-3">
        <h1>
          <span className="mr-4 fw-bold">&nbsp; Add Session</span>
        </h1>
      </div>
      <button
        className="btn mb-2 ms-2"
        style={{ backgroundColor: "#00489d", color: "white" }}
        type="button"
        onClick={handleBack}
      >
        <i className="fa-solid fa-arrow-left" style={{ color: "#fff" }}></i>{" "}
        &nbsp;Previous
      </button>

      <div className="row">
        <div
          className="col-md-10 px-5 w-100"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div className="tile w-75">
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
              <h4 className="mt-2">Add Session</h4>
            </div>
            <div className="tile-body p-3">
              <form onSubmit={handleSubmit}>
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
                  <label className="form-label">Video</label>
                  <input
                    name="video"
                    type="file"
                    className="dropify"
                    data-height="100"
                    accept=".mp4,.avi,.mov"
                    onChange={handleFileChange}
                  />
                  {errors.video && (
                    <small className="text-danger">{errors.video}</small>
                  )}
                </div>
                <div className="mb-3 col-md-12">
                  <label className="form-label">Category</label>
                  <Select
                    options={categoryOptions}
                    placeholder="Enter Category Here"
                    onChange={handleSelectChange}
                    value={
                      categoryOptions.find(
                        (option) => option.value === formData.category
                      ) || null
                    }
                  />
                  {errors.category && (
                    <div className="text-danger">{errors.category}</div>
                  )}
                </div>

                <div className="mb-3 w-100">
                  <label className="form-label">Description</label>
                  <textarea
                    rows={6}
                    className="form-control"
                    placeholder="Enter Description"
                    name="description"
                    value={formData.description}
                    onChange={handleInputChange}
                  ></textarea>
                  {errors.description && (
                    <small className="text-danger">{errors.description}</small>
                  )}
                </div>

                <div className="text-center mt-3">
                  <button
                    className="btn custom-btn text-white w-50"
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

export default AddFitzoneSession;
