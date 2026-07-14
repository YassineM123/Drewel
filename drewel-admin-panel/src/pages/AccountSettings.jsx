import React, { useState } from "react";
import ChangePassword from "../components/ChangePassword";
import ChangeEmail from "../components/ChangeEmail";

const AccountSettings = () => {
  const [isChangingPassword, setIsChangingPassword] = useState(true);

  return (
    <main className="app-content">
      <div className="app-title tile p-3">
        <div>
          <h1 className="">
            <span className="mr-4 fw-bold">&nbsp; Account Settings</span>
          </h1>
        </div>
      </div>

      <div className="row">
        <div className="col-md-6 px-5 mx-auto w-75 account">
          <div className="tile">
            <div
              className="case-status d-flex justify-content-center text-align-center"
              style={{
                backgroundColor: "#00489d",
                color: "#fff",
                height: "50px",
                textAlign: "center",
                width: "100%",
              }}
            >
              <h4 className="mt-2">
                {isChangingPassword ? "Change Password" : "Change Email"}
              </h4>
            </div>
            <div className="tile-body p-3">
              <div className="switch-button">
                <button
                  className={`switch-item ${
                    isChangingPassword ? "active" : ""
                  }`}
                  onClick={() => setIsChangingPassword(true)}
                >
                  Change Password
                </button>
                <button
                  className={`switch-item ${
                    !isChangingPassword ? "active" : ""
                  }`}
                  onClick={() => setIsChangingPassword(false)}
                >
                  Change Email
                </button>
              </div>
              {isChangingPassword ? <ChangePassword /> : <ChangeEmail />}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
};

export default AccountSettings;
