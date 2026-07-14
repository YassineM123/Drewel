// import React, { useEffect, useState, useRef } from "react";
// import "dropify/dist/css/dropify.css";
// import $ from "jquery";
// import "dropify";
// import { useLocation } from "react-router-dom";
// import Select from "react-select";

// const AddProgram = () => {
//   const location = useLocation();
//   const programData = location.state?.program;
//   const dropifyRef = useRef(null);
//   const [isAlert, setIsAlert] = useState(false);
//   const [errors, setErrors] = useState({});
//   const [formData, setFormData] = useState({
//     companyName: "",
//     ownerName: "",
//     email: "",
//     vehicleNumber: "",
//     insuranceExpired: "",
//     charges: "",
//     lat: "",
//     long: "",
//     operatorLicense: null,
//     businessLicense: null,
//     driverLicense: null,
//     license: null,
//     password: "",
//   });

//   const handleChange = (e) => {
//     const { name, value } = e.target;
//     setFormData((prevData) => ({ ...prevData, [name]: value }));
//     setErrors((prevErrors) => ({ ...prevErrors, [name]: "" }));
//   };

//   const handleBack = () => {
//     window.history.back();
//   };

//   useEffect(() => {
//     // Initialize Dropify
//     const dropifyElement = $(".dropify").dropify();

//     // Handle file input change event
//     $(".dropify").on("change", function (event) {
//       const file = event.target.files[0];
//       setFormData((prevData) => ({ ...prevData, image: file }));
//       setErrors((prevErrors) => ({ ...prevErrors, image: "" }));
//     });

//     // Cleanup Dropify instance on component unmount
//     return () => {
//       if (dropifyElement) {
//         $(".dropify").dropify("destroy");
//       }
//     };
//   }, []);

//   const validate = () => {
//     const newErrors = {};
//     if (!formData.title) newErrors.title = "Title is required.";
//     if (!formData.description)
//       newErrors.description = "Description is required.";
//     if (!formData.image) {
//       newErrors.image = "Image upload is required.";
//     } else {
//       const file = formData.image[0];
//       const validTypes = ["image/jpeg", "image/png", "image/gif", "image/webp"];
//       if (!validTypes.includes(file.type)) {
//         newErrors.image =
//           "Invalid file type. Allowed types are JPG, PNG, GIF, and WEBP.";
//       }
//       if (file.size > 6 * 1024 * 1024) {
//         newErrors.image = "File size is too large. Maximum size is 6MB.";
//       }
//     }

//     if (!formData.duration) newErrors.duration = "Duration is required.";

//     return newErrors;
//   };

//   const handleSubmit = (e) => {
//     e.preventDefault();
//     const newErrors = validate();
//     if (Object.keys(newErrors).length > 0) {
//       setErrors(newErrors);
//       return;
//     }

//     Swal.fire({
//       title: "Success!",
//       text: `Program ${programData ? "updated" : "added"} successfully.`,
//       icon: "success",
//       confirmButtonText: "OK",
//     });

//     setFormData({ title: "", description: "", image: null, duration: "" });
//     const dropifyElement = $(".dropify").dropify();
//     dropifyElement.data("dropify").resetPreview();
//     dropifyElement.data("dropify").clearElement();
//   };

//   const handleFileChange = (e) => {
//     const files = e.target.files;
//     setFormData((prevData) => ({
//       ...prevData,
//       image: files,
//     }));

//     if (files.length > 0) {
//       setErrors((prevErrors) => {
//         const newErrors = { ...prevErrors };
//         delete newErrors.image;
//         return newErrors;
//       });
//     }
//   };

//   // Options for Duration dropdown
//   const durationOptions = Array.from({ length: 12 }, (_, i) => ({
//     value: i + 1,
//     label: `${i + 1} Week Plan`,
//   }));

//   const handleDurationChange = (selectedOption) => {
//     setFormData((prevData) => ({
//       ...prevData,
//       duration: selectedOption.value,
//     }));
//     setErrors((prevErrors) => ({ ...prevErrors, duration: "" }));
//   };

//   return (
//     <main className="app-content">
//       <div className="app-title tile p-3">
//         <h1>
//           <span className="mr-4 fw-bold">&nbsp;Add Provider</span>
//         </h1>
//       </div>
//       <button
//         className="btn mb-2 ms-2"
//         style={{
//           backgroundColor: "#00489d",
//           color: "white",
//         }}
//         type="button"
//         onClick={handleBack}
//       >
//         <i className="fa-solid fa-arrow-left" style={{ color: "#fff" }}></i>{" "}
//         &nbsp;Previous
//       </button>
//       <div className="row justify-content-center">
//         <div className="col-md-8 px-5">
//           <div className="tile">
//             <div
//               className="case-status d-flex justify-content-center"
//               style={{
//                 backgroundColor: "#00489d",
//                 color: "#fff",
//                 height: "50px",
//                 textAlign: "center",
//                 width: "100%",
//               }}
//             >
//               <h4 className="mt-2">Add Provider</h4>
//             </div>
//             <div className="tile-body p-3">
//               <div className="bs-component mb-3">
//               </div>
//               <form onSubmit={handleSubmit}>
//                 <div className="row">
//                   <div className="mb-3 col-md-12">
//                     <label className="form-label">Title</label>
//                     <input
//                       className={`form-control ${
//                         errors.title ? "is-invalid" : ""
//                       }`}
//                       name="title"
//                       type="text"
//                       placeholder="Enter Title"
//                       value={formData.title}
//                       onChange={handleChange}
//                     />
//                     {errors.title && (
//                       <div className="invalid-feedback">{errors.title}</div>
//                     )}
//                   </div>
//                   <div className="mb-3 col-md-12">
//                     <label className="form-label">Description</label>
//                     <textarea
//                       className={`form-control ${
//                         errors.description ? "is-invalid" : ""
//                       }`}
//                       name="description"
//                       rows="6"
//                       placeholder="Enter description"
//                       value={formData.description}
//                       onChange={handleChange}
//                     ></textarea>
//                     {errors.description && (
//                       <div className="invalid-feedback">
//                         {errors.description}
//                       </div>
//                     )}
//                   </div>
//                   <div className="form-group mb-0 pb-0">
//                     <label className="form-label">Upload Image</label>
//                     <input
//                       type="file"
//                       className={`dropify ${errors.image ? "is-invalid" : ""}`}
//                       data-height="100"
//                       accept=".jpg,.jpeg,.png,.gif,.webp"
//                       onChange={handleFileChange}
//                     />
//                     {errors.image && (
//                       <small className="text-danger">{errors.image}</small>
//                     )}
//                     <small className="form-text text-muted upload-info mt-2 mb-2">
//                       Maximum Image Size: Up to 6MB per upload
//                     </small>
//                   </div>

//                   <div className="mb-3 col-md-12">
//                     <label className="form-label">Duration</label>
//                     <Select
//                       options={durationOptions}
//                       value={durationOptions.find(
//                         (option) => option.value === formData.duration
//                       )}
//                       onChange={handleDurationChange}
//                       className={`${errors.duration ? "is-invalid" : ""}`}
//                     />
//                     {errors.duration && (
//                       <div className="invalid-feedback">{errors.duration}</div>
//                     )}
//                   </div>

//                   <div className="mb-3 col-lg-12 text-center">
//                     <button
//                       className="btn custom-btn text-white w-25"
//                       type="submit"
//                     >
//                       <i className="fa-thin fa-paper-plane"></i> &nbsp; Submit
//                     </button>
//                   </div>
//                 </div>
//               </form>
//             </div>
//           </div>
//         </div>
//       </div>
//     </main>
//   );
// };

// export default AddProgram;


import React, { useState, useEffect } from "react";
import axios from "axios";
import { API_URL } from "../utils/api.js";
import Swal from "sweetalert2";
import { useLocation } from "react-router-dom";
import Select from "react-select";
import $ from "jquery";
import { vehicleTypes, cityOptions } from "../utils/constants";
import SafeImage from "./SafeImage";

const fileFields = [
  "licenseCompany",
  "carLicenseFront",
  "carLicenseBack",
  "drivingLicenseFront",
  "drivingLicenseBack",
  "idProofFront",
  "idProofBack",
  "passportCopy",
  "profileImage",
];

const UpdateProgram = () => {
  const { state } = useLocation();
  const driversData = state?.driver;

  const [formData, setFormData] = useState({
    id: driversData?._id || "",
    countryCode: driversData?.countryCode || "",
    phone: driversData?.phone || "",
    whatsappNumber: driversData?.whatsappNumber || "",
    fullName: driversData?.fullName || "",
    email: driversData?.email || "",
    address: driversData?.address || "",
    city: driversData?.city || "",
    vehicleType: driversData?.vehicleType || "",
    lat: driversData?.lat || "",
    long: driversData?.long || "",
    ...fileFields.reduce((acc, f) => ({ ...acc, [f]: null }), {}),
  });


  const [loading, setLoading] = useState(false);
  const [countryCodes, setCountryCodes] = useState([]);
  const [errors, setErrors] = useState({});

  const [previews, setPreviews] = useState(
    fileFields.reduce(
      (acc, f) => ({ ...acc, [f]: driversData?.[`${f}Url`] || "" }),
      {}
    )
  );

  useEffect(() => {
    fetch("https://restcountries.com/v3.1/all?fields=name,idd,flag")
      .then(res => res.json())
      .then(data => {
        const formatted = data
          .filter(c => c.idd?.root)
          .map(c => ({
            value: `${c.idd.root}${c.idd.suffixes ? c.idd.suffixes[0] : ""}`,
            label: `${c.flag || ""} ${c.name.common} (${c.idd.root}${c.idd.suffixes ? c.idd.suffixes[0] : ""})`,
          }))
          .sort((a, b) => a.label.localeCompare(b.label));

        setCountryCodes(formatted);
      });
    $(".dropify").dropify();
    return () => {
      $(".dropify").dropify("destroy");
    };
  }, []);

  // ----------------------------
  //  Handle Text Input
  // ----------------------------
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((p) => ({ ...p, [name]: value }));
  };

  // ----------------------------
  //  Handle File Input
  // ----------------------------
  const handleFileChange = (e) => {
    const { name, files } = e.target;
    const file = files[0];

    if (file) {
      setFormData((prev) => ({ ...prev, [name]: file }));

      // preview URL
      setPreviews((prev) => ({
        ...prev,
        [name]: URL.createObjectURL(file),
      }));
    }
  };

  // ----------------------------
  //  Remove Image (set null)
  // ----------------------------
  const handleRemoveImage = (field) => {
    setFormData((prev) => ({ ...prev, [field]: null }));
    setPreviews((prev) => ({ ...prev, [field]: "" }));
  };

  // ----------------------------
  //  Submit Form
  // ----------------------------
  const handleSubmit = async (e) => {
    e.preventDefault();

    const confirm = await Swal.fire({
      title: "Update Driver?",
      icon: "question",
      showCancelButton: true,
      confirmButtonText: "Yes, Update",
    });

    if (!confirm.isConfirmed) return;

    const token = localStorage.getItem("authToken");

    const fd = new FormData();
    Object.keys(formData).forEach((key) => {
      fd.append(key, formData[key]);
    });

    fd.append("isAdmin", true);

    try {
      setLoading(true);
      await axios.post(
        `${API_URL}/driver/update-personal-details`,
        fd,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "multipart/form-data",
          },
        }
      );

      Swal.fire("Updated!", "Driver has been updated.", "success");
    } catch (err) {
      console.error(err);
      Swal.fire("Error", "Failed to update driver.", "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="app-content">
      <div className="app-title tile p-3">
        <h1>Edit Driver</h1>
      </div>

      <form onSubmit={handleSubmit} className="p-3">

        {/* TEXT FIELDS */}

        <div className="row">
          <div className="col-md-6 mb-3">
            <label className="form-label">Full Name</label>
            <input
              type={"text"}
              className={`form-control ${errors["fullName"] ? "is-invalid" : ""
                }`}
              name={"fullName"}
              value={formData["fullName"]}
              onChange={handleChange}
            />
            {errors["fullName"] && (
              <div className="invalid-feedback">
                {errors["fullName"]}
              </div>
            )}
          </div>
          <div className="col-md-6 mb-3">
            <label className="form-label">Country Code</label>
            <Select
              options={countryCodes}
              value={countryCodes.find(c => c.value === formData.countryCode)}
              onChange={(selected) =>
                setFormData(prev => ({ ...prev, countryCode: selected.value }))
              }
              placeholder="Select Country Code"
              isSearchable
            />
          </div>
          <div className="col-md-6 mb-3">
            <label className="form-label">Vehicle Type</label>
            <Select
              options={vehicleTypes}
              value={vehicleTypes.find(v => v.value === formData.vehicleType) || null}
              onChange={(selected) =>
                setFormData(prev => ({ ...prev, vehicleType: selected.value }))
              }
              placeholder="Select Vehicle Type"
              isSearchable
            />
          </div>
          <div className="col-md-6 mb-3">
            <label className="form-label">City</label>
            <Select
              options={cityOptions}
              value={cityOptions.find(c => c.value === formData.city) || null}
              onChange={(selected) =>
                setFormData(prev => ({ ...prev, city: selected.value }))
              }
              placeholder="Select City"
              isSearchable
            />
          </div>
        </div>
        <div className="row">
          {[
            // "fullName",
            // "countryCode",
            "phone",
            "whatsappNumber",
            "email",
            "address",
            // "city",
            // "vehicleType",
            // "lat",
            // "long",
          ].map((field, i) => (
            <div className="col-md-6 mb-3" key={i}>
              <label className="form-label">{field}</label>
              <input
                type="text"
                name={field}
                value={formData[field]}
                onChange={handleChange}
                className="form-control"
              />
            </div>
          ))}
        </div>

        {/* FILE UPLOADS */}
        <div className="row mt-4">
          {fileFields.map((field, index) => (
            <div className="col-md-6 mb-3" key={index}>
              <label className="form-label">{field}</label>

              {previews[field] && (
                <div>
                  <SafeImage
                    src={previews[field]}
                    alt="preview"
                    style={{
                      width: "120px",
                      height: "120px",
                      objectFit: "cover",
                      borderRadius: "10px",
                      marginBottom: "10px",
                    }}
                  />
                </div>
              )}

              <input
                type="file"
                name={field}
                accept="image/*"
                className="form-control"
                onChange={handleFileChange}
              />

              {previews[field] && (
                <button
                  type="button"
                  className="btn btn-danger btn-sm mt-2"
                  onClick={() => handleRemoveImage(field)}
                >
                  Remove Image
                </button>
              )}
            </div>
          ))}
        </div>

        <button className="btn btn-primary mt-3" disabled={loading}>
          {loading ? "Updating..." : "Update Driver"}
        </button>
      </form>
    </main>
  );
};

export default UpdateProgram;
