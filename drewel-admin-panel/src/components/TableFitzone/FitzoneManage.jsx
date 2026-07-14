import React, { useEffect, useRef } from "react";
import { Link } from "react-router-dom";

const FitzoneManage = ({
  handleDropdownToggle,
  setOpenDropdownIndex,
  user,
  openDropdownIndex,
}) => {
  const dropdownRef = useRef(null);
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        if (openDropdownIndex === user.srNum) {
          setOpenDropdownIndex(null);
        }
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [openDropdownIndex, setOpenDropdownIndex, user.id]);
  return (
    <div className="dropdown text-center" ref={dropdownRef}>
      <button
        className="dropdown-button"
        onClick={() => handleDropdownToggle(user.srNum)}
        aria-haspopup="true"
        aria-expanded={openDropdownIndex === user.srNum}
      >
        <i
          className={`fa fa-ellipsis-v ${
            openDropdownIndex === user.srNum ? "rotate-icon" : ""
          }`}
        ></i>
      </button>
      {openDropdownIndex === user.srNum && (
        <div className="dropdown-menu show">
          
        </div>
      )}
    </div>
  );
};

export default FitzoneManage;
