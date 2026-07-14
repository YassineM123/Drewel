import React, { useEffect, useState, useRef } from 'react';

const ViewBusiness = ({ businessInfo, onClose }) => {
    const [isEditMode, setIsEditMode] = useState(false);
    const [formData, setFormData] = useState({
        companyName: "",
        email: "",
        ownerName: "",
        operatorLicense: "",
        businessLicense: ""
    });

    const formRef = useRef(null);

    useEffect(() => {
        if (businessInfo) {
            setFormData({
                companyName: businessInfo.companyName || "",
                email: businessInfo.email || "",
                ownerName: businessInfo.ownerName || "",
                operatorLicense: businessInfo.operatorLicense || "",
                businessLicense: businessInfo.bussinessLicense || ""
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
    }, [businessInfo, onClose]);

    const handleClose = () => {
        onClose();
    };

    return (
        <div ref={formRef} style={{ position: "relative" }}>
            <button className="cross-button" aria-label="Close" onClick={handleClose}>
                <i className="fa-solid fa-times"></i>
            </button>
            <div className="case-status d-flex justify-content-center text-align-center"
                style={{
                    backgroundColor: "#00489d",
                    color: "#fff",
                    height: "50px",
                    textAlign: "center",
                }}
            >
                <h4 className="mt-2">{isEditMode ? "View" : "Add"} Business Details</h4>
            </div>
            <div className="tile-body p-3">
                <form>
                    <div className="row">
                        {/* Company Name */}
                        <div className="mb-3 col-md-6">
                            <label className="form-label">Company Name</label>
                            <input
                                className="form-control"
                                type="text"
                                value={formData.companyName}
                                disabled
                            />
                        </div>

                        {/* Email */}
                        <div className="mb-3 col-md-6">
                            <label className="form-label">Email</label>
                            <input
                                className="form-control"
                                type="email"
                                value={formData.email}
                                disabled
                            />
                        </div>

                        {/* Owner Name */}
                        <div className="mb-3 col-md-6">
                            <label className="form-label">Owner Name</label>
                            <input
                                className="form-control"
                                type="text"
                                value={formData.ownerName}
                                disabled
                            />
                        </div>

                        {/* Operator License - Yes/No Radio */}
                        <div className="mb-3 col-md-12 d-flex">
                            <label className="form-label">Operator License</label>
                            <div style={{ marginLeft: "40px" }}>
                                <input style={{ marginLeft: "10px", color: "blue" }}
                                    type="radio"
                                    name="operatorLicense"
                                    value="yes"
                                    checked={!!formData.operatorLicense}
                                    disabled
                                /> Yes
                                &nbsp;&nbsp;
                                <input
                                    style={{ marginLeft: "10px" }}
                                    type="radio"
                                    name="operatorLicense"
                                    value="no"
                                    checked={!formData.operatorLicense}
                                    disabled
                                /> No
                            </div>
                        </div>

                        {/* Business License - Yes/No Radio */}
                        <div className="mb-3 col-md-12 d-flex">
                            <label className="form-label">Business License</label>
                            <div style={{ marginLeft: "43px" }}>
                                <input style={{ marginLeft: "10px", color: "blue" }}
                                    type="radio"
                                    name="businessLicense"
                                    value="yes"
                                    checked={!!formData.businessLicense}
                                    disabled
                                /> Yes
                                &nbsp;&nbsp;
                                <input
                                    style={{ marginLeft: "10px" }}
                                    type="radio"
                                    name="businessLicense"
                                    value="no"
                                    checked={!formData.businessLicense}
                                    disabled
                                /> No
                            </div>
                        </div>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default ViewBusiness;
