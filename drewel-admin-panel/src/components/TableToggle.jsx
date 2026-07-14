import React, { useEffect, useRef } from "react";
const TableToggle = ({
  setOpenDropdown,
  user,
  openDropdown,
  handleEdit,
  handleDelete,
}) => {
  const dropdownRef = useRef(null);
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        if (openDropdown === user.srNum) {
          setOpenDropdown(null);
        }
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [openDropdown, setOpenDropdown, user.srNum]);
  return (
    <div className="dropdown text-center" ref={dropdownRef}>
      <button
        className="dropdown-button"
        onClick={() =>
          setOpenDropdown(openDropdown === user.srNum ? null : user.srNum)
        }
        aria-haspopup="true"
        aria-expanded={openDropdown === user.srNum}
      >
        <i
          className={`fa fa-ellipsis-v ${
            openDropdown === user.srNum ? "rotate-icon" : ""
          }`}
        ></i>
      </button>
      {openDropdown === user.srNum && (
        <div className="dropdown-menu show">
          <a
            className="dropdown-item"
            onClick={() => {
              handleEdit(user.srNum);
              setOpenDropdown(null);
            }}
          >
            <i className="fa fa-edit"></i> Edit
          </a>
          <a
            className="dropdown-item"
            onClick={() => {
              handleDelete(user.srNum);
              setOpenDropdown(null);
            }}
          >
            <i className="fa fa-trash"></i> Delete
          </a>
        </div>
      )}
    </div>
  );
};
export default TableToggle;
