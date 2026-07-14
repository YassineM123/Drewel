import React, { useEffect, useRef, useState } from "react";
import Swal from "sweetalert2";
import CreatableSelect from "react-select/creatable";

const AddSubAdmin = ({ user, onClose }) => {
  const closRef = useRef(null);
  const countries = [
    "United States",
    "Canada",
    "Mexico",
    "United Kingdom",
    "India",
    "Australia",
  ];
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    hospital: "",
    location: null,
    phone: "",
    designation: "",
    password: "",
  });
  const [searchTerm, setSearchTerm] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [errors, setErrors] = useState({});
  const [isEditMode, setIsEditMode] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [showAddButton, setShowAddButton] = useState(false);
  const [locationOptions, setLocationOptions] = useState([
    { value: "United States", label: "United States" },
    { value: "Canada", label: "Canada" },
    { value: "Mexico", label: "Mexico" },
    { value: "United Kingdom", label: "United Kingdom" },
    { value: "India", label: "India" },
    { value: "Australia", label: "Australia" },
  ]);

  const [location, setLocation] = useState(null); // Update formData to store selected location

  const formRef = useRef(null);

  // Inside useEffect, update formData to set location as an object when editing
  useEffect(() => {
    if (user) {
      setFormData({
        name: user.username,
        email: user.email,
        hospital: user.hospital,
        location: user.location
          ? { value: user.location, label: user.location }
          : null, // Ensure location is an object
        phone: user.phone,
        designation: user.designation,
        password: user.password,
      });
      setIsEditMode(true);
    }

    const handleClickOutside = (event) => {
      if (
        formRef.current &&
        !formRef.current.contains(event.target) &&
        !closRef.current.contains(event.target)
      ) {
        onClose();
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [user, onClose]);

  // Handle location change in CreatableSelect
  const handleLocationChange = (selectedOption) => {
    setLocation(selectedOption);
    setFormData({
      ...formData,
      location: selectedOption
        ? { value: selectedOption.value, label: selectedOption.label }
        : null,
    });
    if (selectedOption) {
      setErrors({ ...errors, location: "" });
    }
  };

  const customSelectStyles = {
    control: (base, state) => ({
      ...base,
      borderColor: errors.location ? "red" : base.borderColor,
      "&:hover": { borderColor: errors.location ? "red" : base.borderColor },
    }),
  };

  // Add specific logic for clearing the country input
  const handleClearLocation = () => {
    setLocation(null);
    setFormData({
      ...formData,
      location: "",
    });
  };

  const validateForm = () => {
    const newErrors = {};

    // Name validation
    if (!formData.name) {
      newErrors.name = "Name is required.";
    } else {
      const namePattern = /^[A-Za-z\s]+$/; // regex to allow only letters and spaces
      if (!namePattern.test(formData.name)) {
        newErrors.name = "Name should only contain letters.";
      }
    }

    // Other validations
    if (!formData.email) newErrors.email = "Email is required.";
    if (!formData.hospital)
      newErrors.hospital = "Hospital/Clinic name is required.";
    if (!formData.location) {
      newErrors.location = "Location is required.";
    }
    if (!formData.phone) newErrors.phone = "Phone number is required.";
    if (!formData.designation)
      newErrors.designation = "Designation is required.";

    if (!formData.password && !isEditMode) {
      newErrors.password = "Password is required.";
    } else if (formData.password && formData.password.length < 8) {
      newErrors.password = "Password must be at least 8 characters long.";
    } else if (!/[A-Z]/.test(formData.password)) {
      newErrors.password =
        "Password must contain at least one uppercase letter.";
    } else if (!/[a-z]/.test(formData.password)) {
      newErrors.password =
        "Password must contain at least one lowercase letter.";
    } else if (!/[0-9]/.test(formData.password)) {
      newErrors.password = "Password must contain at least one numeric digit.";
    } else if (!/[!@#$%^&*(),.?":{}|<>]/.test(formData.password)) {
      newErrors.password =
        "Password must contain at least one special character.";
    }

    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (formData.email && !emailPattern.test(formData.email)) {
      newErrors.email = "Please enter a valid email address.";
    }

    if (
      formData.phone &&
      (!/^\d{10}$/.test(formData.phone.replace(/[-\s]/g, "")) ||
        formData.phone.length !== 10)
    ) {
      newErrors.phone = "Phone number must be a 10-digit numeric value.";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleChange = (e) => {
    const { id, value } = e.target;
    setFormData({ ...formData, [id]: value });
    setErrors({ ...errors, [id]: "" });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!validateForm()) return;
    Swal.fire({
      title: "Sub-Admin Added!",
      text: `Sub-Admin added successfully`,
      icon: "success",
      confirmButtonText: "OK",
    });
    setFormData({
      name: "",
      email: "",
      hospital: "",
      location: "",
      phone: "",
      designation: "",
      password: "",
    });
  };

  const handleClose = () => {
    setFormData({
      name: "",
      email: "",
      hospital: "",
      location: "",
      phone: "",
      designation: "",
      password: "",
    });
    setIsEditMode(false);
    onClose();
  };

  const handleUpdate = (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    Swal.fire({
      title: "Sub-Admin Updated!",
      text: `Sub-Admin updated successfully`,
      icon: "success",
      confirmButtonText: "OK",
    });

    setFormData({
      name: "",
      email: "",
      hospital: "",
      location: "",
      phone: "",
      designation: "",
      password: "",
    });
    setIsEditMode(false);
    onClose(); // Close the modal or form
  };

  return (
    <div ref={formRef} style={{ position: "relative" }}>
      <button
        className="cross-button"
        aria-label="Close"
        onClick={handleClose}
        ref={closRef}
      >
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
        <h4 className="mt-2">Sub-Admin</h4>
      </div>
      <div className="tile-body p-3">
        <form onSubmit={isEditMode ? handleUpdate : handleSubmit}>
          <div className="row">
            <div className="mb-3 col-md-6">
              <label className="form-label">Name</label>
              <input
                className={`form-control ${errors.name ? "is-invalid" : ""}`}
                id="name"
                type="text"
                placeholder="Enter Name"
                value={formData.name}
                onChange={handleChange}
              />
              {errors.name && (
                <div className="invalid-feedback">{errors.name}</div>
              )}
            </div>
            <div className="mb-3 col-md-6">
              <label className="form-label">Email address</label>
              <input
                className={`form-control ${errors.email ? "is-invalid" : ""}`}
                id="email"
                type="text"
                placeholder="Enter email"
                value={formData.email}
                onChange={handleChange}
              />
              {errors.email && (
                <div className="invalid-feedback">{errors.email}</div>
              )}
            </div>
            <div className="mb-3 col-md-6">
              <label className="form-label">Hospital/Clinic Name</label>
              <input
                className={`form-control ${
                  errors.hospital ? "is-invalid" : ""
                }`}
                id="hospital"
                type="text"
                placeholder="Enter Hospital/Clinic name"
                value={formData.hospital}
                onChange={handleChange}
              />
              {errors.hospital && (
                <div className="invalid-feedback">{errors.hospital}</div>
              )}
            </div>
            <div className="mb-3 col-md-6" style={{ position: "relative" }}>
              <label className="form-label">Country</label>
              <CreatableSelect
                value={formData.location}
                options={locationOptions}
                onChange={handleLocationChange}
                onCreateOption={(inputValue) => {
                  const newLocation = { value: inputValue, label: inputValue };
                  setLocationOptions([...locationOptions, newLocation]);
                  setLocation(newLocation);
                  setFormData({
                    ...formData,
                    location: newLocation,
                  });
                }}
                onClear={handleClearLocation}
                placeholder="Enter or select Country"
                classNamePrefix="react-select"
                styles={customSelectStyles} // Apply custom styles here
                className={errors.location ? "is-invalid" : ""} // Conditional class
              />
              {errors.location && (
                <div className="invalid-feedback">{errors.location}</div>
              )}
            </div>

            <div className="mb-3 col-md-6">
              <label className="form-label">Phone Number</label>
              <input
                className={`form-control ${errors.phone ? "is-invalid" : ""}`}
                id="phone"
                type="tel"
                placeholder="Enter Number"
                value={formData.phone}
                onChange={handleChange}
                pattern="[0-9]*"
                maxLength="10"
                onKeyPress={(e) => {
                  if (!/[0-9]/.test(e.key)) {
                    e.preventDefault();
                  }
                }}
              />
              {errors.phone && (
                <div className="invalid-feedback">{errors.phone}</div>
              )}
            </div>
            <div className="mb-3 col-md-6">
              <label className="form-label">Designation</label>
              <input
                className={`form-control ${
                  errors.designation ? "is-invalid" : ""
                }`}
                id="designation"
                type="text"
                placeholder="Enter Designation"
                value={formData.designation}
                onChange={handleChange}
              />
              {errors.designation && (
                <div className="invalid-feedback">{errors.designation}</div>
              )}
            </div>
            <div className="mb-3 col-md-6">
              <label className="form-label">Password</label>
              <input
                className={`form-control ${
                  errors.password ? "is-invalid" : ""
                }`}
                id="password"
                type="password"
                placeholder="Enter Password"
                value={formData.password}
                onChange={handleChange}
              />
              {errors.password && (
                <div className="invalid-feedback">{errors.password}</div>
              )}
            </div>
          </div>
          <div className="mb-3 col-lg-12 text-center">
            <button
              className={`btn custom-btn text-white ${
                isEditMode ? "w-50" : "w-50"
              }`}
              type="submit"
            >
              <i className="fa-thin fa-paper-plane"></i> &nbsp;
              {isEditMode ? "Update Sub-Admin" : "Add Sub-Admin"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddSubAdmin;
