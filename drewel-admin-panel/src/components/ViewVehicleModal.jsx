import React from 'react';

const ViewVehicleModal = ({ vehicleInfo, onClose }) => {

    return (
        <div style={{ position: "relative" }}>
            <button className="cross-button" aria-label="Close" onClick={onClose}>
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
                <h4 className="mt-2">View Vehicle Details</h4>
            </div>

            <div className="tile-body p-3">
                <form>
                    <div className="row">

                        {/* Vehicle Number */}
                        <div className="mb-3 col-md-6">
                            <label className="form-label">Vehicle Number</label>
                            <input
                                className="form-control"
                                type="text"
                                value={vehicleInfo.vehicleNumber || "N/A"}
                                disabled
                            />
                        </div>

                        {/* Insurance Expiry Date */}
                        <div className="mb-3 col-md-6">
                            <label className="form-label">Insurance Expiry Date</label>
                            <input
                                className="form-control"
                                type="text"
                                value={vehicleInfo.insuranceExpired
                                    ? new Date(vehicleInfo.insuranceExpired).toLocaleDateString()
                                    : "N/A"
                                }
                                disabled
                            />
                        </div>

                        {/* License - Yes/No Radio */}
                        <div className="mb-3 col-md-12 d-flex">
                            <label className="form-label">License</label>
                            <div style={{ marginLeft: "60px" }}>
                                <input style={{ marginLeft: "10px" }}
                                    type="radio"
                                    name="license"
                                    value="yes"
                                    checked={!!vehicleInfo.license}
                                    disabled
                                /> Yes
                                &nbsp;&nbsp;
                                <input
                                    style={{ marginLeft: "10px" }}
                                    type="radio"
                                    name="license"
                                    value="no"
                                    checked={!vehicleInfo.license}
                                    disabled
                                /> No
                            </div>
                        </div>

                        {/* Driver License - Yes/No Radio */}
                        <div className="mb-3 col-md-12 d-flex">
                            <label className="form-label">Driver License</label>
                            <div style={{ marginLeft: "32px" }}>
                                <input style={{ marginLeft: "10px" }}
                                    type="radio"
                                    name="driverLicense"
                                    value="yes"
                                    checked={!!vehicleInfo.driverLicense}
                                    disabled
                                /> Yes
                                &nbsp;&nbsp;
                                <input
                                    style={{ marginLeft: "10px" }}
                                    type="radio"
                                    name="driverLicense"
                                    value="no"
                                    checked={!vehicleInfo.driverLicense}
                                    disabled
                                /> No
                            </div>
                        </div>

                    </div>
                </form>
            </div>
        </div>
    );
}

export default ViewVehicleModal;
