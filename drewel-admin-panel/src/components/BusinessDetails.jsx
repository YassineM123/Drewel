import React, { useEffect, useRef, useState } from "react";
import Swal from "sweetalert2";
import { createServices } from "../utils/authUtils";

const BusinessDetails = ({ business, onClose }) => {
  
    return (
      <div  style={{ position: "relative" }}>
        <button className="cross-button" aria-label="Close" onClick={close}>
          <i className="fa-solid fa-times"></i>
        </button>
        <div
          className="case-status d-flex justify-content-center text-align-center"
          style={{
            backgroundColor: "#002538",
            color: "#fff",
            height: "50px",
            textAlign: "center",
          }}
        >
          <h4 className="mt-2">Business Details</h4>
        </div>
        <div
          className="tile-body p-3"
        >
          <form >
            <div className="row">
              <div className="mb-3 col-md-6 text-div">
                <label className="form-label">Name</label>
                <input
                  className="form-control"
                  id="name"
                  type="text"
                  placeholder="Enter Name"
                //   value={formData.name}
                //   onChange={handleChange}
                />
                {/* {errors.name && <div className="text-danger">{errors.name}</div>}{" "} */}
              </div>
              <div className="mb-3 col-md-6 text-div">
                <label className="form-label">Upload Image</label>
                <input
                  className="form-control"
                  id="userId"
                  type="file"
                //   onChange={handleFileChange}
                />
                {/* {errors.userId && (
                  <div className="text-danger">{errors.userId}</div>
                )}{" "} */}
                {/* Error message */}
              </div>
            </div>
          </form>
        </div>
      </div>
    );
  };

export default BusinessDetails