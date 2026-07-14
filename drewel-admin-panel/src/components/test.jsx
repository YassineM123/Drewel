// File change handler
const handleFileChange = (e) => {
  const files = e.target.files;
  setFormData((prev) => ({
    ...prev,
    file: files, // Update file state
  }));

  // Reset file error if the user selects a file
  if (files.length > 0) {
    setErrors((prevErrors) => {
      const newErrors = { ...prevErrors };
      delete newErrors.file; // Clear any previous file error
      return newErrors;
    });
  }
};

// Modify form submission to validate file upload
const handleSubmit = (e) => {
  e.preventDefault();

  const formErrors = {};

  // Validate Title
  if (!formData.title) {
    formErrors.title = "Title is required.";
  }

  // Validate Description
  if (!formData.description) {
    formErrors.description = "Description is required.";
  }

  // Validate File Upload
  if (!formData.file || formData.file.length === 0) {
    formErrors.file = "An icon is required.";
  } else {
    const validTypes = ["image/jpeg", "image/png", "image/gif", "image/webp"];
    const file = formData.file[0]; // Get the first file
    if (!validTypes.includes(file.type)) {
      formErrors.file = "Invalid file type. Allowed types are JPG, PNG, GIF, and WEBP.";
    }
    if (file.size > 6 * 1024 * 1024) { // 6MB limit
      formErrors.file = "File size is too large. Maximum size is 6MB.";
    }
  }

  // If there are errors, set the error state and do not submit
  if (Object.keys(formErrors).length > 0) {
    setErrors(formErrors);
    return;
  }

  // If no errors, proceed with form submission (e.g., API call)
  console.log("Form data submitted successfully:", formData);
  setErrors({}); // Clear errors on successful submission
};

// In the JSX (file upload section)
<div className="form-group mb-0 pb-0">
  <label className="form-label">Upload Icon</label>
  <input
    name="pdf_file[]"
    type="file"
    className="dropify"
    data-height="100"
    required
    multiple
    accept=".jpg,.jpeg,.png,.gif,.webp,.pdf"
    onChange={handleFileChange} // Call file change handler
  />
  {errors.file && <small className="text-danger">{errors.file}</small>} {/* Display file error */}
  <small className="form-text text-muted upload-info mt-2 mb-2">
    Maximum Icon Size: Up to 6MB per upload
  </small>
</div>
