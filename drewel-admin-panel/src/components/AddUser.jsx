import React, { useEffect, useRef, useState } from "react";
import Swal from "sweetalert2";

const AddUser = ({ user, onClose }) => {
  const [isEditMode, setIsEditMode] = useState(false);
  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
  });
  console.log("User", user)

  const [errors, setErrors] = useState({});
  const formRef = useRef(null);

  useEffect(() => {
    if (user) {
      setFormData({
        fullName: user.fullName || "",
        email: user.email || ""
      });
      setIsEditMode(true);
    }
    const handleClickOutside = (event) => {
      if (formRef.current && !formRef.current.contains(event.target)) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [user, onClose]);

  // Handle form field changes and update the formData state
  const handleChange = (e) => {
    const { id, value } = e.target;
    setFormData((prevData) => ({ ...prevData, [id]: value }));

    // Clear the error for the specific field when the user types
    setErrors((prevErrors) => ({ ...prevErrors, [id]: "" }));
  };

  const handlePasswordVisibility = () => {
    setIsPasswordVisible((prev) => !prev);
  };

  // Handle form submission for both creation and update
  const handleSubmit = (e) => {
    e.preventDefault();

    // Validate form fields
    const newErrors = {};

    if (!formData.fullName) {
      newErrors.fullName = "Name is required.";
    }

    if (!formData.email) {
      newErrors.email = "Email is required.";
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = "Email is invalid.";
    }

    // If there are errors, set the error state and return
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    // Proceed with form submission if there are no errors
    if (isEditMode) {
      // Logic for updating the user
      Swal.fire({
        title: "User Updated!",
        text: `User details updated successfully`,
        icon: "success",
        confirmButtonText: "OK",
      });
    } else {
      // Logic for creating a new user
      Swal.fire({
        title: "User Created!",
        text: `User added successfully`,
        icon: "success",
        confirmButtonText: "OK",
      });
    }
  };

  const resetForm = () => {
    setFormData({
      fullName: "",
      email: "",
    });
    setErrors({});
    setIsEditMode(false);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  return (
    <div ref={formRef} style={{ position: "relative" }}>
      <button className="cross-button" aria-label="Close" onClick={handleClose}>
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
        <h4 className="mt-2">{isEditMode ? "View" : "Add"} User Details</h4>
      </div>
      <div
        className="tile-body p-3"
      >
        <form onSubmit={handleSubmit}>
          <div className="row">
            <div className="mb-3 col-md-6 text-div">
              <label className="form-label">Name</label>
              <input
                className="form-control"
                id="name"
                type="text"
                placeholder="Enter Name"
                value={formData.fullName}
                onChange={handleChange}
              />
              {errors.fullName && <div className="text-danger">{errors.fullName}</div>}{" "}
            </div>
            <div className="mb-3 col-md-6 text-div">
              <label className="form-label">Email address</label>
              <input
                className="form-control"
                id="email"
                type="text"
                placeholder="Enter email"
                value={formData.email}
                onChange={handleChange}
              />
              {errors.email && (
                <div className="text-danger">{errors.email}</div>
              )}{" "}
              {/* Error message */}
            </div>
            {/* <div className="mb-3 col-lg-12 text-center text-div">
              <button className="btn custom-btn text-white w-25" type="submit">
                <i className="fa-thin fa-paper-plane"></i> &nbsp;
                {isEditMode ? "Update User" : "Submit"}
              </button>
            </div> */}
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddUser;
