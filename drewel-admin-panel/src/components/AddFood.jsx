import React, { useState, useEffect, useRef } from "react";
import Swal from "sweetalert2"; // Import SweetAlert2
import { useLocation } from "react-router-dom";

const AddFood = () => {
  const location = useLocation();
  const userData = location.state ? location.state.user : null;

  // State variables
  const [foodName, setFoodName] = useState(
    userData ? userData.FoodCategory : ""
  );
  const [category, setCategory] = useState(
    userData ? userData.FoodCategory : ""
  );
  const [foodType, setFoodType] = useState(userData ? userData.FoodType : "");
  const [approvalStatus, setApprovalStatus] = useState(
    userData ? userData.Approved : ""
  );
  const [image, setImage] = useState(null); // State for uploaded image
  const [categories, setCategories] = useState(["Fruits", "Vegetables"]); // Predefined categories
  const [newCategory, setNewCategory] = useState(""); // New category input
  const [newCategoryImage, setNewCategoryImage] = useState(null); // State for new category image
  const [showModal, setShowModal] = useState(false); // Track modal visibility
  const [errors, setErrors] = useState({}); // State for storing field-specific errors
  const [foodItems, setFoodItems] = useState([]); // State to store food items
  const [isAlert, setIsAlert] = useState(false);

  const closRef = useRef(null);

  useEffect(() => {
    if (userData) {
      setFoodName(userData.FoodCategory);
      setCategory(userData.FoodCategory);
      setFoodType(userData.FoodType || "");
      setApprovalStatus(userData.Approved);
    }
  }, [userData]);

  // Validate form function
  const validateForm = () => {
    let formErrors = {};

    if (!foodName.trim()) {
      formErrors.foodName = "Food name is required.";
    }
    if (!category) {
      formErrors.category = "Please select a category.";
    }
    if (!foodType.trim()) {
      formErrors.foodType = "Food type is required.";
    }
    if (!approvalStatus) {
      formErrors.approvalStatus = "Please select an approval status.";
    }

    setErrors(formErrors);
    return Object.keys(formErrors).length === 0; // Return true if no errors
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    const formData = {
      foodName,
      category,
      foodType,
      approvalStatus,
      image,
    };

    if (userData) {
      // Update existing food item
      setFoodItems((prevItems) =>
        prevItems.map((item) =>
          item.foodName === userData.FoodCategory ? formData : item
        )
      );
      Swal.fire({
        icon: "success",
        title: "Food updated successfully",
        text: "Your food item has been updated!",
      });
    } else {
      // Add new food item
      setFoodItems((prevItems) => [...prevItems, formData]);
      Swal.fire({
        icon: "success",
        title: "Food added successfully",
        text: "Your food item has been submitted!",
      });
    }

    // Reset form
    resetForm();
  };

  const resetForm = () => {
    setFoodName("");
    setCategory("");
    setFoodType("");
    setApprovalStatus("");
    setImage(null);
    setNewCategory("");
    setNewCategoryImage(null);
    setErrors({});
  };

  const handleNewCategoryImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setNewCategoryImage(URL.createObjectURL(file)); // Store new category image URL for preview
    }
  };

  const handleEditCategory = (index) => {
    const categoryToEdit = categories[index];
    setNewCategory(categoryToEdit); // Set the selected category to the input for editing
    setCategories((prev) => prev.filter((_, i) => i !== index)); // Remove the category from the list temporarily for editing
    setShowModal(true); // Open the modal for editing
  };

  const handleDeleteCategory = (index) => {
    Swal.fire({
      title: "Are you sure?",
      text: "You won't be able to revert this!",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#d33",
      cancelButtonColor: "#3085d6",
      confirmButtonText: "Yes, delete it!",
    }).then((result) => {
      if (result.isConfirmed) {
        setCategories((prev) => prev.filter((_, i) => i !== index)); // Remove the category
        Swal.fire("Deleted!", "Your category has been deleted.", "success");
      }
    });
  };

  // Update the handleSaveCategory function to include editing
  const handleSaveCategory = () => {
    if (newCategory && !categories.includes(newCategory)) {
      setCategories((prev) => [...prev, newCategory]); // Update the categories state
      setCategory(newCategory); // Set the new category as selected
      setNewCategory(""); // Clear the input after saving
      setNewCategoryImage(null); // Reset new category image

      Swal.fire({
        icon: "success",
        title: "Category added",
        text: `The category "${newCategory}" has been added successfully.`,
      });
    } else if (newCategory) {
      Swal.fire({
        icon: "success",
        title: "Category updated",
        text: `The category has been updated to "${newCategory}".`,
      });
    } else {
      Swal.fire({
        icon: "error",
        title: "Category is empty",
        text: "Please enter a valid category name!",
      });
    }
  };

  // Function to go back to the previous page
  const handleBack = () => {
    window.history.back();
  };

  const handleCross = () => {
    resetForm();
    onClose();
  };

  return (
    <main className="app-content">
      <div className="app-title tile p-3">
        <h1>
          <span className="mr-4 fw-bold">&nbsp;Food Categories</span>
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
      <div className="row justify-content-center">
        <div className="col-md-10 px-5">
          <div className="tile">
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
              <h4 className="mt-2">{userData ? "Edit Food" : "Add Food"}</h4>
            </div>
            <div className="tile-body p-3">
              <form onSubmit={handleSubmit}>
                <div>
                  <div className="mb-3 w-100">
                    <label className="form-label">Food Name</label>
                    <input
                      className={`form-control ${
                        errors.foodName ? "is-invalid" : ""
                      }`}
                      type="text"
                      placeholder="Enter food name"
                      value={foodName}
                      onChange={(e) => setFoodName(e.target.value)}
                    />
                    {errors.foodName && (
                      <div className="invalid-feedback">{errors.foodName}</div>
                    )}
                  </div>
                  <div className="mb-3 col-lg-12">
                    <label className="form-label">Category</label>
                    <div className="d-flex align-items-center">
                      <select
                        className={`form-select ${
                          errors.category ? "is-invalid" : ""
                        }`}
                        value={category}
                        onChange={(e) => setCategory(e.target.value)}
                      >
                        <option value="" disabled>
                          Select a category
                        </option>
                        {categories.map((cat, index) => (
                          <option key={index} value={cat}>
                            {cat}
                          </option>
                        ))}
                      </select>
                      <button
                        className="btn ms-2"
                        type="button"
                        style={{ backgroundColor: "#00489d", color: "white" }}
                        onClick={() => setShowModal(true)}
                      >
                        <i className="fa fa-plus"></i>
                      </button>
                    </div>
                    {errors.category && (
                      <div className="invalid-feedback">{errors.category}</div>
                    )}
                  </div>
                  <div className="mb-3 col-lg-12">
                    <label className="form-label">Approval Status</label>
                    <div style={{ display: "flex" }}>
                      <div className="form-check">
                        <input
                          className="form-check-input"
                          type="radio"
                          name="approvalStatus"
                          value="Approved"
                          checked={approvalStatus === "Approved"}
                          onChange={(e) => setApprovalStatus(e.target.value)}
                        />
                        <label
                          className="form-check-label"
                          style={{ marginLeft: "5px" }}
                        >
                          Approved
                        </label>
                      </div>
                      <div
                        className="form-check"
                        style={{ marginLeft: "10px" }}
                      >
                        <input
                          className="form-check-input"
                          type="radio"
                          name="approvalStatus"
                          value="Non Approved"
                          checked={approvalStatus === "Non Approved"}
                          onChange={(e) => setApprovalStatus(e.target.value)}
                        />
                        <label
                          className="form-check-label"
                          style={{ marginLeft: "5px" }}
                        >
                          Non Approved
                        </label>
                      </div>
                    </div>
                    {errors.approvalStatus && (
                      <div className="invalid-feedback">
                        {errors.approvalStatus}
                      </div>
                    )}
                  </div>

                  <div className="mb-3 text-center mt-3">
                    <button
                      className="btn custom-btn text-white w-50"
                      type="submit"
                    >
                      Submit
                    </button>
                  </div>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>

      {/* Add New Category Modal */}
      {showModal && (
        <div
          className="modal-overlay"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "flex-start",
            flexDirection: "column",
          }}
        >
          <div className="modal-content animated-modal p-0">
            <div className="modal-header">
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
                <h4 className="mt-2">Add New Category</h4>
              </div>
            </div>
            <div className="modal-body p-2">
              <div className="mb-3">
                <label htmlFor="newCategory" className="form-label">
                  Category Name
                </label>
                <input
                  type="text"
                  className="form-control"
                  id="newCategory"
                  placeholder="Enter new category name"
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
                />
              </div>
              <div className="mb-3">
                <label htmlFor="newCategoryImage" className="form-label">
                  Icon
                </label>
                <input
                  type="file"
                  className="form-control"
                  id="newCategoryImage"
                  accept="image/*"
                  onChange={handleNewCategoryImageChange}
                />
                {newCategoryImage && (
                  <img
                    src={newCategoryImage}
                    alt="New Category Icon"
                    className="mt-2"
                    style={{ maxWidth: "100px", maxHeight: "100px" }}
                  />
                )}
              </div>
            </div>
            <div
              className="modal-footer p-2"
              style={{
                display: "flex",
                alignItems: "flex-start",
                justifyContent: "flex-start",
              }}
            >
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setShowModal(false)}
              >
                Close
              </button>
              <button
                type="button"
                className="btn ms-2"
                style={{
                  backgroundColor: "#00489d",
                  color: "white",
                  marginLeft: "10px",
                }}
                onClick={handleSaveCategory}
              >
                Save Category
              </button>
            </div>
            <table className="table mt-2 table-bordered table-hover dt-responsive">
              <thead>
                <tr>
                  <th>Sr.No</th>
                  <th>Category</th>
                  <th>Icon</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {categories.map((cat, index) => (
                  <tr key={index}>
                    <td>{index + 1}</td>
                    <td>{cat}</td>
                    <td>
                      <img src={newCategoryImage} alt="icon" />
                    </td>
                    <td>
                      <button
                        className="btn btn-warning"
                        style={{ padding: "2px 6px" }}
                        onClick={() => handleEditCategory(index)}
                      >
                        Edit
                      </button>
                      <button
                        className="btn btn-danger"
                        style={{ marginLeft: "10px", padding: "2px 6px" }}
                        onClick={() => handleDeleteCategory(index)}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <style>{`
        .modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background: rgba(0, 0, 0, 0.5);
          display: flex;
          justify-content: center;
          align-items: flex-start;
          padding-top: 50px;
          z-index: 1000;
        }
        .modal-content {
          background: white;
          border-radius: 8px;
          padding: 20px;
          max-width: 500px;
          width: 100%;
        }
        .modal-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .btn-close {
          background: none;
          border: none;
          font-size: 1.5rem;
        }
        @keyframes slideDown {
          0% {
            transform: translateY(-100%);
            opacity: 0;
          }
          100% {
            transform: translateY(0);
            opacity: 1;
          }
        }
        .animated-modal {
          animation: slideDown 0.5s ease-in-out;
        }
      `}</style>
    </main>
  );
};

export default AddFood;
