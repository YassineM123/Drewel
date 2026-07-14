import React, { useState } from "react";
import { useNavigate } from "react-router-dom";

const ChangeEmail = () => {
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [isOtpSent, setIsOtpSent] = useState(false);
  const [generatedOtp, setGeneratedOtp] = useState("");
  const [emailError, setEmailError] = useState("");
  const [otpError, setOtpError] = useState("");
  const navigate = useNavigate();

  const validateEmail = (email) => {
    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return regex.test(email);
  };

  const handleEmailSubmit = (e) => {
    e.preventDefault();
    setEmailError("");
    if (!validateEmail(email)) {
      setEmailError("Please enter a valid email address.");
      return;
    }

    const newOtp = Math.floor(100000 + Math.random() * 900000).toString();
    setGeneratedOtp(newOtp);
    console.log(`OTP sent to ${email}: ${newOtp}`);
    setIsOtpSent(true);
  };

  const handleOtpSubmit = (e) => {
    e.preventDefault();
    setOtpError("");
    if (otp.length !== 6) {
      setOtpError("OTP must be 6 digits long.");
      return;
    }

    if (otp === generatedOtp) {
      console.log("OTP verified. Redirecting to login...");
      navigate("/login");
    } else {
      setOtpError("Invalid OTP. Please try again.");
    }
  };

  return (
    <div>
      {!isOtpSent ? (
        <form onSubmit={handleEmailSubmit}>
          <div className="row">
            <div className="col-lg-12 mt-3">
              <label className="form-label">Enter New Email</label>
              <div className="input-group flex-nowrap">
                <input
                  type="email"
                  className={`form-control ${emailError ? "is-invalid" : ""}`}
                  id="new-email"
                  placeholder="Email here"
                  autoComplete="off"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              {emailError && (
                <div className="invalid-feedback">{emailError}</div>
              )}
            </div>
            <div className="col-lg-12 mt-3">
              <button
                className="btn custom-btn text-white col-lg-w-100"
                type="submit"
              >
                <i className="icon pr-2 fa-solid fa-key-skeleton"></i> Submit
              </button>
            </div>
          </div>
        </form>
      ) : (
        <form onSubmit={handleOtpSubmit}>
          <div className="row">
            <div className="col-lg-12 mt-3">
              <label className="form-label">Enter OTP</label>
              <div className="input-group">
                <input
                  type="text"
                  className={`form-control ${otpError ? "is-invalid" : ""}`}
                  id="otp"
                  placeholder="Enter OTP here"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value)}
                />
              </div>
              {otpError && <div className="invalid-feedback">{otpError}</div>}
            </div>
            <div className="col-lg-12 mt-3">
              <button
                className="btn custom-btn text-white col-lg-w-100"
                type="submit"
              >
                Verify OTP
              </button>
            </div>
          </div>
        </form>
      )}
    </div>
  );
};

export default ChangeEmail;
