import React, { useEffect, useRef } from "react";

const FitzoneCategoryTable = ({
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
        if (openDropdown === user.id) {
          setOpenDropdown(null);
        }
      }
    };

    document.addEventListener("mousedown", handleClickOutside);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [openDropdown, setOpenDropdown, user.id]);
  return (
    <div className="dropdown text-center" ref={dropdownRef}>
      <button
        className="dropdown-button"
        onClick={() =>
          setOpenDropdown(openDropdown === user.id ? null : user.id)
        }
        aria-haspopup="true"
        aria-expanded={openDropdown === user.id}
      >
        <i
          className={`fa fa-ellipsis-v ${
            openDropdown === user.id ? "rotate-icon" : ""
          }`}
        ></i>
      </button>
      {openDropdown === user.id && (
        <div className="dropdown-menu show">
          <a
            className="dropdown-item"
            onClick={() => {
              handleEdit(user.id);
              setOpenDropdown(null);
            }}
          >
            <i className="fa fa-edit"></i> Edit
          </a>
          <a
            className="dropdown-item"
            onClick={() => {
              handleDelete(user.id);
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

export default FitzoneCategoryTable;
