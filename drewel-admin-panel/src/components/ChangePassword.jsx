import React, { useState } from "react";

const ChangePassword = () => {
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [isPasswordVisible2, setIsPasswordVisible2] = useState(false);
  const [isPasswordVisible3, setIsPasswordVisible3] = useState(false);
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [oldPasswordError, setOldPasswordError] = useState("");
  const [newPasswordError, setNewPasswordError] = useState("");
  const [confirmPasswordError, setConfirmPasswordError] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState(false);

  const handlePasswordVisibility = (setter) => {
    setter((prev) => !prev);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    // Clear previous errors
    setOldPasswordError("");
    setNewPasswordError("");
    setConfirmPasswordError("");
    setError("");
    setMessage("");
    let hasError = false;

    // Validate passwords
    if (!oldPassword) {
      setOldPasswordError("Please enter your old password");
      hasError = true;
    }

    if (!newPassword) {
      setNewPasswordError("Please enter your new password");
      hasError = true;
    } else if (newPassword.length < 6) {
      setNewPasswordError("New password must be at least 6 characters long");
      hasError = true;
    }

    if (!confirmPassword) {
      setConfirmPasswordError("Please confirm your new password");
      hasError = true;
    } else if (newPassword !== confirmPassword) {
      setConfirmPasswordError("New password and confirmation do not match.");
      hasError = true;
    }

    if (hasError) return;
  };

  return (
    <form onSubmit={handleSubmit}>
      <div className="row">
        <div className="row">
          <div className="col-lg-12 mt-3">
            <label className="form-label">Old Password</label>

            <div className="input-group flex-nowrap">
              <input
                type={isPasswordVisible ? "text" : "password"}
                className={`form-control password-field ${oldPasswordError ? "is-invalid" : ""
                  }`}
                id="old-password"
                placeholder="**********"
                autoComplete="off"
                value={oldPassword}
                onChange={(e) => setOldPassword(e.target.value)}
              />
              <button
                style={{
                  border: "none",
                  color: "#00489d",
                }}
                type="button"
                className="toggle-password"
                onClick={() => handlePasswordVisibility(setIsPasswordVisible)}
                aria-label={
                  isPasswordVisible ? "Hide password" : "Show password"
                }
              >
                <i
                  className={
                    isPasswordVisible
                      ? "fa-solid fa-eye-slash eye"
                      : "fa-solid fa-eye eye"
                  }
                ></i>
              </button>
            </div>
            {oldPasswordError && (
              <div className="invalid-feedback" style={{ display: "block" }}>
                {oldPasswordError}
              </div>
            )}
          </div>

          <div className="col-lg-12 mt-3">
            <label className="form-label">New Password</label>

            <div className="input-group flex-nowrap">
              <input
                type={isPasswordVisible2 ? "text" : "password"}
                className={`form-control password-field ${newPasswordError ? "is-invalid" : ""
                  }`}
                id="new-password"
                placeholder="Enter Password"
                autoComplete="off"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
              <button
                style={{
                  border: "none",
                  color: "#00489d",
                }}
                type="button"
                className="toggle-password"
                onClick={() => handlePasswordVisibility(setIsPasswordVisible2)}
                aria-label={
                  isPasswordVisible2 ? "Hide password" : "Show password"
                }
              >
                <i
                  className={
                    isPasswordVisible2
                      ? "fa-solid fa-eye-slash eye"
                      : "fa-solid fa-eye eye"
                  }
                ></i>
              </button>
            </div>
            {newPasswordError && (
              <div className="invalid-feedback" style={{ display: "block" }}>
                {newPasswordError}
              </div>
            )}
          </div>
          <div className="col-lg-12 mt-3">
            <label className="form-label">Confirm Password</label>

            <div className="input-group flex-nowrap">
              <input
                type={isPasswordVisible3 ? "text" : "password"}
                className={`form-control password-field ${confirmPasswordError ? "is-invalid" : ""
                  }`}
                id="confirm-password"
                placeholder="Enter Confirm Password"
                autoComplete="off"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
              <button
                style={{
                  border: "none",
                  color: "#00489d",
                }}
                type="button"
                className="toggle-password"
                onClick={() => handlePasswordVisibility(setIsPasswordVisible3)}
                aria-label={
                  isPasswordVisible3 ? "Hide password" : "Show password"
                }
              >
                <i
                  className={
                    isPasswordVisible3
                      ? "fa-solid fa-eye-slash eye"
                      : "fa-solid fa-eye eye"
                  }
                ></i>
              </button>
            </div>
            {confirmPasswordError && (
              <div className="invalid-feedback" style={{ display: "block" }}>
                {confirmPasswordError}
              </div>
            )}
          </div>
          <div className="col-lg-12 mt-3">
            <button className="btn  text-white col-lg-w-25" style={{ backgroundColor: "#6c757d", color: "white" }}>
              {" "}
              Clear
            </button>
            <button
              className="btn custom-btn text-white col-lg-w-25 m-2"
              type="submit"
            >
              Submit
            </button>
          </div>
        </div>
      </div>
    </form>
  );
};

export default ChangePassword;
