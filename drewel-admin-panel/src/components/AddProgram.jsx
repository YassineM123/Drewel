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


import React, { useState, useEffect, useCallback } from "react";
import "dropify/dist/css/dropify.css";
import $ from "jquery";
import "dropify";
import axios from "axios";
import { API_URL } from "../utils/api.js";
import Swal from "sweetalert2";
import Select from "react-select";
import { vehicleTypes, cityOptions } from "../utils/constants";
import { useParams } from "react-router-dom";

const AddProgram = () => {
  const { id } = useParams();
  const [countryCodes, setCountryCodes] = useState([]);
  const [formData, setFormData] = useState({
    countryCode: "+971",
    phone: "",
    whatsappNumber: "",
    fullName: "",
    email: "",
    address: "",
    city: "",
    vehicleType: "",
    lat: "",
    long: "",
    charges: "",
    password: "",

    // FILE FIELDS – aligned exactly to backend names
    licenseCompany: null,
    carLicenseFront: null,
    carLicenseBack: null,
    drivingLicenseFront: null,
    drivingLicenseBack: null,
    idProofFront: null,
    idProofBack: null,
    passportCopy: null,
    profileImage: null,
  });

  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);

  const fetchDriverData = useCallback(async () => {
    const authToken = localStorage.getItem("authToken");
    if (!id || !authToken) return;
    try {
      const response = await axios.get(
        `${API_URL}/driver/get-driver-details/${id}`,
        {
          headers: {
            Authorization: `Bearer ${authToken}`,
            Accept: "application/json",
          },
        }
      );
      if (response.data.success) {
        const driver = response.data.driver;
        setFormData((prev) => ({
          ...prev,
          ...driver,
          password: "", // Security: do not populate password field
        }));
      }
    } catch (err) {
      console.error("Failed to fetch driver details", err);
    }
  }, [id]);

  useEffect(() => {
    if (id) fetchDriverData();

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
  }, [id, fetchDriverData]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    setErrors((prev) => ({ ...prev, [name]: "" }));
  };

  const handleFileChange = (e) => {
    const { name, files } = e.target;
    setFormData((prev) => ({ ...prev, [name]: files[0] }));
  };

  const validate = () => {
    let newErrors = {};
    if (!formData.fullName) newErrors.fullName = "Full name required.";
    if (!formData.phone) newErrors.phone = "Phone number required.";
    if (!formData.countryCode) newErrors.countryCode = "Country code required.";

    return newErrors;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const newErrors = validate();
    if (Object.keys(newErrors).length) {
      setErrors(newErrors);
      return;
    }

    const result = await Swal.fire({
      title: "Confirm?",
      text: "Submit driver details?",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Yes, Submit",
    });

    if (!result.isConfirmed) return;

    const userExists = localStorage.getItem("admin");
    const authTokenExist = localStorage.getItem("authToken");

    if (!userExists) {
      Swal.fire({
        icon: "error",
        title: "Error",
        text: "User is not logged in or does not exist in localStorage.",
      });
      return;
    }
    if (!authTokenExist) {
      Swal.fire({
        icon: "error",
        title: "Error",
        text: "Auth token does not exist in localStorage.",
      });
      return;
    }

    const requestData = new FormData();
    Object.keys(formData).forEach((key) => {
      requestData.append(key, formData[key]);
    });

    try {
      setLoading(true);
      const response = await axios.post(
        `${API_URL}/driver/addDriver`,
        requestData,
        {
          headers: {
            "Authorization": `Bearer ${authTokenExist}`,
            "Content-Type": "multipart/form-data",
            "Accept": "application/json"
          }
        }
      );

      await Swal.fire({
        title: "Success!",
        text: "Driver details added successfully.",
        icon: "success",
      });
      setFormData({
        countryCode: "+971",
        phone: "",
        whatsappNumber: "",
        fullName: "",
        email: "",
        address: "",
        city: "",
        vehicleType: "",
        lat: "",
        long: "",
        charges: "",
        password: "",

        // FILE FIELDS – aligned exactly to backend names
        licenseCompany: null,
        carLicenseFront: null,
        carLicenseBack: null,
        drivingLicenseFront: null,
        drivingLicenseBack: null,
        idProofFront: null,
        idProofBack: null,
        passportCopy: null,
        profileImage: null,
      });

    } catch (error) {
      await Swal.fire({
        title: "Error!",
        text: "Failed to submit.",
        icon: "error",
      });
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => window.history.back();
  console.log(formData);

  return (
    <main className="app-content">
      <div className="app-title tile p-3">
        <h1>
          <span className="mr-4 fw-bold">&nbsp;Add Driver</span>
        </h1>
      </div>

      <button
        className="btn mb-2 ms-2"
        style={{ backgroundColor: "#00489d", color: "white" }}
        onClick={handleBack}
      >
        <i className="fa-solid fa-arrow-left"></i> &nbsp;Previous
      </button>

      <div className="row justify-content-center">
        <div className="col-md-12 px-5">
          <div className="tile">
            <div
              className="case-status d-flex justify-content-center"
              style={{
                backgroundColor: "#00489d",
                color: "#fff",
                height: "50px",
                textAlign: "center",
              }}
            >
              <h4 className="mt-2">Driver Details</h4>
            </div>

            <div className="tile-body p-3">
              <form onSubmit={handleSubmit} encType="multipart/form-data">
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
                    {errors["countryCode"] && (
                      <div className="invalid-feedback">
                        {errors["countryCode"]}
                      </div>
                    )}
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
                    { label: "Phone (without country code)", name: "phone" },
                    { label: "WhatsApp (with country code)", name: "whatsappNumber" },
                    { label: "Email", name: "email", type: "email" },
                    { label: "Address", name: "address" },
                    { label: "Charges", name: "charges" },
                    // { label: "Latitude", name: "lat" },
                    // { label: "Longitude", name: "long" },
                    { label: "Password", name: "password", type: "password" },
                  ].map((field, i) => (
                    <div key={i} className="col-md-6 mb-3">
                      <label className="form-label">{field.label}</label>
                      <input
                        type={field.type || "text"}
                        className={`form-control ${errors[field.name] ? "is-invalid" : ""
                          }`}
                        name={field.name}
                        value={formData[field.name]}
                        onChange={handleChange}
                      />
                      {errors[field.name] && (
                        <div className="invalid-feedback">
                          {errors[field.name]}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
                <div className="row">
                  {/* FILE FIELDS */}
                  {[
                    { label: "License Company", name: "licenseCompany" },
                    { label: "Car License Front", name: "carLicenseFront" },
                    { label: "Car License Back", name: "carLicenseBack" },
                    { label: "Driving License Front", name: "drivingLicenseFront" },
                    { label: "Driving License Back", name: "drivingLicenseBack" },
                    { label: "ID Proof Front", name: "idProofFront" },
                    { label: "ID Proof Back", name: "idProofBack" },
                    { label: "Passport Copy", name: "passportCopy" },
                    { label: "Profile Image", name: "profileImage" },
                  ].map((fileField, idx) => (
                    <div key={idx} className="col-md-6 mb-3">
                      <label className="form-label">{fileField.label}</label>
                      <input
                        type="file"
                        className="dropify"
                        name={fileField.name}
                        accept=".png,.jpg,.jpeg"
                        onChange={handleFileChange}
                      />
                    </div>
                  ))}
                </div>

                <button type="submit" className="btn btn-primary" disabled={loading}>
                  {loading ? "Adding..." : "Add Driver"}
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
};

export default AddProgram;