import React, { useEffect, useRef, useState } from "react";
import Swal from "sweetalert2";

const AddFitezoneCategory = ({ onClose }) => {
  const [title, setTitle] = useState("");
  const [duration, setDuration] = useState("");
  const [errors, setErrors] = useState({});
  const formRef = useRef(null);

  const validateForm = () => {
    let formErrors = {};

    if (!title.trim()) {
      formErrors.title = "Title is required.";
    }

    if (!duration.trim()) {
      formErrors.duration = "Duration is required.";
    }

    setErrors(formErrors);
    return Object.keys(formErrors).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    Swal.fire({
      icon: "success",
      title: "Category Added",
      text: "Your category has been successfully submitted!",
      confirmButtonText: "Okay",
      customClass: {
        confirmButton: "btn btn-primary",
      },
      buttonsStyling: false,
    });

    const formData = {
      title,
      duration,
    };

    console.log("Form data:", formData);

    // Reset form
    setTitle("");
    setDuration("");
    setErrors({});
    onClose();
  };

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (formRef.current && !formRef.current.contains(event.target)) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [onClose]);

  return (
    <div ref={formRef} style={{ position: "relative" }}>
      <button className="cross-button" aria-label="Close" onClick={onClose}>
        <i className="fa-solid fa-times"></i>
      </button>
      <div
        className="case-status d-flex justify-content-center text-align-center"
        style={{
          backgroundColor: "#00489d",
          color: "#fff",
          height: "50px",
          textAlign: "center",
        }}
      >
        <h4 className="mt-2">Add Category</h4>
      </div>
      <div className="tile-body p-3">
        <form onSubmit={handleSubmit}>
          <div className="mb-3 w-100">
            <label className="form-label">Title</label>
            <input
              className={`form-control ${errors.title ? "is-invalid" : ""}`}
              type="text"
              placeholder="Enter Title Here"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
            {errors.title && (
              <div className="invalid-feedback">{errors.title}</div>
            )}
          </div>

          <div className="mb-3 w-100">
            <label className="form-label">Duration</label>
            <input
              className={`form-control ${errors.duration ? "is-invalid" : ""}`}
              placeholder="Enter Duration"
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
            />
            {errors.duration && (
              <div className="invalid-feedback">{errors.duration}</div>
            )}
          </div>

          <div className="mb-3 text-center mt-3">
            <button className="btn custom-btn text-white w-25" type="submit">
              Submit
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddFitezoneCategory;
