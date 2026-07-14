import React, { useEffect, useRef } from "react";

const FitzoneSessionAddTable = ({
  openDropdownIndex,
  setOpenDropdownIndex,
  user,
  handleEdit,
}) => {
  const dropdownRef = useRef(null);
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        if (openDropdownIndex === user.SNo) {
          setOpenDropdownIndex(null);
        }
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [openDropdownIndex, setOpenDropdownIndex, user.SNo]);
  return (
    <div className="dropdown text-center" ref={dropdownRef}>
      <button
        className="dropdown-button"
        onClick={() =>
          setOpenDropdownIndex(openDropdownIndex === user.SNo ? null : user.SNo)
        }
        aria-haspopup="true"
        aria-expanded={openDropdownIndex === user.SNo}
      >
        <i className="fa fa-ellipsis-v"></i>
      </button>
      {openDropdownIndex === user.SNo && (
        <div className="dropdown-menu show">
          <button className="dropdown-item" onClick={() => handleEdit(user)}>
            <i className="fa fa-edit"></i> Edit
          </button>
          {/* <a className="dropdown-item" onClick={() => handleDelete(user.SNo)}>
            <i className="fa fa-trash"></i> Delete
          </a> */}
        </div>
      )}
    </div>
  );
};

export default FitzoneSessionAddTable;
