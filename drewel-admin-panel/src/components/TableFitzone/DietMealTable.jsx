import React, { useEffect, useRef } from "react";

const DietMealTable = ({
  setOpenDropdown,
  openDropdown,
  handleEdit,
  handleDelete,
  user,
}) => {
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        if (openDropdown === user.SNo) {
          setOpenDropdown(null);
        }
      }
    };

    document.addEventListener("mousedown", handleClickOutside);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [openDropdown, setOpenDropdown, user.SNo]);

  return (
    <div className="dropdown text-center" ref={dropdownRef}>
      <button
        className="dropdown-button"
        onClick={() =>
          setOpenDropdown(openDropdown === user.SNo ? null : user.SNo)
        }
        aria-haspopup="true"
        aria-expanded={openDropdown === user.SNo}
      >
        <i
          className={`fa fa-ellipsis-v ${
            openDropdown === user.SNo ? "rotate-icon" : ""
          }`}
        ></i>
      </button>
      {openDropdown === user.SNo && (
        <div className="dropdown-menu show">
          <button
            className="dropdown-item"
            onClick={() => {
              handleEdit(user);
              setOpenDropdown(null);
            }}
          >
            <i className="fa fa-edit"></i> Edit
          </button>
          <a
            className="dropdown-item"
            onClick={() => {
              handleDelete(user.SNo);
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

export default DietMealTable;
