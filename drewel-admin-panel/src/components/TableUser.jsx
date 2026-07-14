import React, { useEffect, useRef } from "react";

const TableUser = ({
  setOpenDropdown,
  user,
  openDropdown,
  handleView,
  handleDelete,
  handleEdit,
  handleApprove,
  handleReject,
  handleRestrict,
  driver = false,
}) => {
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        if (openDropdown === user._id) {
          setOpenDropdown(null);
        }
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [openDropdown, setOpenDropdown, user._id]);

  const close = () => setOpenDropdown(null);
  const rowId = user?._id ?? user?.id ?? user;

  return (
    <div className="dropdown text-center" ref={dropdownRef}>
      <button
        className="dropdown-button"
        onClick={() =>
          setOpenDropdown(openDropdown === user._id ? null : user._id)
        }
        aria-haspopup="true"
        aria-expanded={openDropdown === user._id}
      >
        <i
          className={`fa fa-ellipsis-v ${
            openDropdown === user._id ? "rotate-icon" : ""
          }`}
        />
      </button>

      {openDropdown === user._id && (
        <div className="dropdown-menu show">
          {handleView && (
            <button
              className="dropdown-item"
              onClick={() => {
                handleView(user);
                close();
              }}
            >
              <i className="fa fa-eye" /> View
            </button>
          )}

          {driver && handleApprove && (
            <button
              className="dropdown-item"
              onClick={() => {
                handleApprove(user);
                close();
              }}
            >
              <i className="fa fa-check" /> Approve
            </button>
          )}

          {driver && handleReject && (
            <button
              className="dropdown-item"
              onClick={() => {
                handleReject(user);
                close();
              }}
            >
              <i className="fa fa-times" /> Reject
            </button>
          )}

          {handleRestrict && (
            <button
              className="dropdown-item"
              onClick={() => {
                handleRestrict(user);
                close();
              }}
            >
              <i className="fa fa-ban" /> Restrict
            </button>
          )}

          {handleEdit && (
            <button
              className="dropdown-item"
              onClick={() => {
                handleEdit(rowId);
                close();
              }}
            >
              <i className="fa fa-edit" /> Edit
            </button>
          )}

          {handleDelete && (
            <button
              className="dropdown-item"
              onClick={() => {
                handleDelete(rowId);
                close();
              }}
            >
              <i className="fa fa-trash" /> Delete
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default TableUser;
