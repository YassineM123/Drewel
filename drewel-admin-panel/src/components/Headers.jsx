import { useEffect, useRef } from "react";
import PropTypes from "prop-types";
import { NavLink, useNavigate } from "react-router-dom";
import logo1 from "../assets/images/logo1.jpg";
import $ from "jquery";

const Headers = ({ setIsSideBarOpen }) => {
  const sidebarRef = useRef(null);
  const headerRef = useRef(null);
  const navigate = useNavigate();

  // Rest of your state and code...

  useEffect(() => {
    const treeviewMenu = $(".app-menu");

    // Handle click event for treeview toggles
    $("[data-toggle='treeview']").click(function (event) {
      event.preventDefault();
      const $parent = $(this).parent();

      // Close all expanded treeviews except the one being clicked
      treeviewMenu.find(".is-expanded").not($parent).removeClass("is-expanded");

      // Toggle the current treeview
      $parent.toggleClass("is-expanded");
      $(this).attr("aria-expanded", $parent.hasClass("is-expanded") ? "true" : "false");
    });

    const currentUrl = window.location.href;
    let isAnyExpanded = false;

    // Expand the parent if the current URL matches any link
    $(".app-menu a").each(function () {
      if (this.href === currentUrl) {
        $(this).parent().parent().prev().click();
      }
    });

    $(".treeview-menu a").each(function () {
      if (this.href === currentUrl) {
        $(this).parent().parent().prev().click();
        $(this).closest(".treeview").addClass("is-expanded");
        isAnyExpanded = true;
      }
    });

    if (isAnyExpanded) {
      treeviewMenu
        .find("[data-toggle='treeview']")
        .parent()
        .addClass("is-expanded");
    }

    // Handle sidebar toggle
    $('[data-toggle="sidebar"]').click(function (event) {
      event.preventDefault();
      $(".app").toggleClass("sidenav-toggled");
    });

    // Cleanup function
    return () => {
      // Safely remove click event handlers if the elements exist
      if ($("[data-toggle='treeview']").length) {
        $("[data-toggle='treeview']").off("click");
      }

      if ($('[data-toggle="sidebar"]').length) {
        $('[data-toggle="sidebar"]').off("click");
      }
    };
  }, []);

  const handleToggle = () => {
    setIsSideBarOpen((prev) => !prev);
  };

  useEffect(() => {
    const handleClickOutside = (event) => {

      if (
        sidebarRef.current &&
        !sidebarRef.current.contains(event.target) &&
        headerRef.current &&
        !headerRef.current.contains(event.target)
      ) {
        setIsSideBarOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [setIsSideBarOpen]);

  const handleLogout = () => {
    localStorage.removeItem("authToken");
    localStorage.removeItem("admin");
    navigate("/login");
  };

  return (
    <>
      <header ref={headerRef} className="app-header d-lg-none d-sm-block d-md-none d-xl-none d-xs-block">
        <NavLink className="app-header__logo" to="/">
          <p className="mb-0">Drewel</p>
        </NavLink>
        <a
          className="app-sidebar__toggle"
          to="#"
          data-toggle="sidebar"
          aria-label="Hide Sidebar"
          onClick={handleToggle}
        ></a>
      </header>

      <div className="app-sidebar__overlay"></div>
      <aside ref={sidebarRef} className="app-sidebar">
        <div className="app-sidebar__user">
          <img
            className="app-sidebar__user-avatar"
            src={logo1}
            alt="User Image"
          />
          <div>
            <p className="app-sidebar__user-name text-white">Drewel</p>
            {/* <img className="h-20 w-auto" src={logo1}  alt="logo Image"/> */}
            <p className="app-sidebar__user-designation text-white">
               Riadh Slama
            </p>
          </div>
        </div>
        <ul className="app-menu mt-4 your_class">
          <li>
            <NavLink className="app-menu__item" to="/">
              <svg
                className="app-menu__icon mx-3 new-icon"
                xmlns="http://www.w3.org/2000/svg"
                width="24"
                height="24"
                viewBox="0 0 31 30"
                fill="none"
              >
                <path
                  d="M3.25 7.5C3.25 5.14298 3.25 3.96446 3.98224 3.23224C4.71446 2.5 5.89298 2.5 8.25 2.5C10.607 2.5 11.7855 2.5 12.5178 3.23224C13.25 3.96446 13.25 5.14298 13.25 7.5V10C13.25 12.357 13.25 13.5355 12.5178 14.2677C11.7855 15 10.607 15 8.25 15C5.89298 15 4.71446 15 3.98224 14.2677C3.25 13.5355 3.25 12.357 3.25 10V7.5Z"
                  stroke="white"
                  strokeWidth="2.5"
                ></path>
                <path
                  d="M3.25 23.75C3.25 22.5851 3.25 22.0028 3.4403 21.5433C3.69404 20.9308 4.18073 20.444 4.79329 20.1903C5.25273 20 5.83515 20 7 20H9.5C10.6648 20 11.2473 20 11.7067 20.1903C12.3193 20.444 12.806 20.9308 13.0597 21.5433C13.25 22.0028 13.25 22.5851 13.25 23.75C13.25 24.9149 13.25 25.4972 13.0597 25.9567C12.806 26.5692 12.3193 27.056 11.7067 27.3097C11.2473 27.5 10.6648 27.5 9.5 27.5H7C5.83515 27.5 5.25273 27.5 4.79329 27.3097C4.18073 27.056 3.69404 26.5692 3.4403 25.9567C3.25 25.4972 3.25 24.9149 3.25 23.75Z"
                  stroke="white"
                  strokeWidth="2.5"
                ></path>
                <path
                  d="M18.25 20C18.25 17.643 18.25 16.4645 18.9823 15.7323C19.7145 15 20.893 15 23.25 15C25.607 15 26.7855 15 27.5177 15.7323C28.25 16.4645 28.25 17.643 28.25 20V22.5C28.25 24.857 28.25 26.0355 27.5177 26.7677C26.7855 27.5 25.607 27.5 23.25 27.5C20.893 27.5 19.7145 27.5 18.9823 26.7677C18.25 26.0355 18.25 24.857 18.25 22.5V20Z"
                  stroke="white"
                  strokeWidth="2.5"
                ></path>
                <path
                  d="M18.25 6.25C18.25 5.08515 18.25 4.50273 18.4402 4.04329C18.694 3.43073 19.1808 2.94404 19.7933 2.6903C20.2528 2.5 20.8351 2.5 22 2.5H24.5C25.6649 2.5 26.2472 2.5 26.7067 2.6903C27.3192 2.94404 27.806 3.43073 28.0597 4.04329C28.25 4.50273 28.25 5.08515 28.25 6.25C28.25 7.41485 28.25 7.99727 28.0597 8.45671C27.806 9.06927 27.3192 9.55596 26.7067 9.8097C26.2472 10 25.6649 10 24.5 10H22C20.8351 10 20.2528 10 19.7933 9.8097C19.1808 9.55596 18.694 9.06927 18.4402 8.45671C18.25 7.99727 18.25 7.41485 18.25 6.25Z"
                  stroke="white"
                  strokeWidth="2.5"
                ></path>
              </svg>
              <span className="app-menu__label">Dashboard</span>
            </NavLink>
          </li>
          <li>
            <NavLink className="app-menu__item" to="/users">
              <i
                className="app-menu__icon mx-3 fa-sharp fa-light fa-users pr-1"
                style={{ fontWeight: "700" }}
              ></i>
              <span className="app-menu__label">Users</span>
            </NavLink>
          </li>
          <li>
            <NavLink className="app-menu__item" to="/onlineDrivers">
              <i
                className="app-menu__icon mx-3 fa-sharp fa-light fa-users pr-1"
                style={{ fontWeight: "700" }}
              ></i>
              <span className="app-menu__label">Online Drivers</span>
            </NavLink>
          </li>
          <li>
            <NavLink className="app-menu__item" to="/drivers">
              <i
                className="app-menu__icon mx-3 fa-sharp fa-light fa-users pr-1"
                style={{ fontWeight: "700" }}
              ></i>
              <span className="app-menu__label">Total Drivers</span>
            </NavLink>
          </li>
          <li className="treeview">
            <button type="button" className="app-menu__item" data-toggle="treeview" aria-haspopup="true" aria-expanded="false" style={{ background: "none", borderTop: 0, borderRight: 0, borderBottom: 0, width: "100%", textAlign: "left" }}>
              <i className="app-menu__icon mx-3 fa-regular fa-file-lines" aria-hidden="true"></i>
              <span className="app-menu__label">Requests</span>
              <i className="treeview-indicator fa fa-angle-right" aria-hidden="true"></i>
            </button>
            <ul className="treeview-menu">
              <li><NavLink className={({ isActive }) => `treeview-item${isActive ? " active" : ""}`} to="/requests/pending">Pending Requests</NavLink></li>
              <li><NavLink className={({ isActive }) => `treeview-item${isActive ? " active" : ""}`} to="/requests/approved">Approved Requests</NavLink></li>
              <li><NavLink className={({ isActive }) => `treeview-item${isActive ? " active" : ""}`} to="/requests/rejected">Rejected Requests</NavLink></li>
              <li><NavLink className={({ isActive }) => `treeview-item${isActive ? " active" : ""}`} to="/requests/all">All Requests</NavLink></li>
            </ul>
          </li>
          <li>
            <NavLink className="app-menu__item" to="/sponsor">
              <i
                className="app-menu__icon mx-3 fa-sharp fa-light fa-users pr-1"
                style={{ fontWeight: "700" }}
              ></i>
              <span className="app-menu__label">Sponsor</span>
            </NavLink>
          </li>
          <li>
            <NavLink className="app-menu__item" to="/chat">
              <i
                className="app-menu__icon mx-3 fa-sharp fa-light fa-comments pr-1"
                style={{ fontWeight: "700" }}
              ></i>
              <span className="app-menu__label">Chat</span>
            </NavLink>
          </li>
          <li>
            <NavLink className="app-menu__item" to="/calls">
              <i className="app-menu__icon mx-3 fa fa-phone" aria-hidden="true"></i>
              <span className="app-menu__label">Secure Calls</span>
            </NavLink>
          </li>
          {/* <li>
            <NavLink className="app-menu__item" to="/clubs">
              <i
                className="app-menu__icon mx-3 fa-sharp fa-light fa-users pr-1"
                style={{ fontWeight: "700" }}
              ></i>
              <span className="app-menu__label">Clubs</span>
            </NavLink>
          </li> */}
          {/* <li>
            <NavLink className="app-menu__item" to="/golf-courses">
              <i
                className="app-menu__icon mx-3 fa-sharp fa-light fa-users pr-1"
                style={{ fontWeight: "700" }}
              ></i>
              <span className="app-menu__label">Golf courses</span>
            </NavLink>
          </li> */}


          {/* <li>
            <NavLink className="app-menu__item" to="/providers">
              <i
                className="fa-solid mx-3 fa-bars-progress app-menu__icon"
                style={{ fontWeight: "700" }}
              ></i>
              <span className="app-menu__label">Providers</span>
            </NavLink>
          </li>
          <li>
            <NavLink className="app-menu__item" to="/service-requests">
              <i className="app-menu__icon mx-3 fa-regular fa-heart"></i>
              <span className="app-menu__label">Service Requests</span>
            </NavLink>
          </li>
          <li>
            <NavLink className="app-menu__item" to="/orders">
              <i className="app-menu__icon mx-3 fa-regular fa-heart"></i>
              <span className="app-menu__label">Orders</span>
            </NavLink>
          </li>
          <li>
            <NavLink className="app-menu__item" to="/revenue">
              <i className="app-menu__icon mx-3 fa-regular fa-heart"></i>
              <span className="app-menu__label">Revenue</span>
            </NavLink>
          </li>
          <li>
            <NavLink className="app-menu__item" to="/cms-manage">
              <i
                className="fa-sharp mx-3 fa-light fa-laptop app-menu__icon pr-1"
                style={{ fontWeight: "700" }}
              ></i>
              <span className="app-menu__label">CMS Management</span>
            </NavLink>
          </li>
          <li>
            <NavLink className="app-menu__item" to="/notification">
              <i
                className="fa-sharp mx-3 fa-light fa-bell app-menu__icon"
                style={{ fontWeight: "700" }}
              ></i>
              <span className="app-menu__label">Notification Manage</span>
            </NavLink>
          </li>
          <li>
            <NavLink className="app-menu__item" to="/faq">
              <i
                className="app-menu__icon mx-3 fa-regular fa-circle-info"
                style={{ fontWeight: "700" }}
              ></i>
              <span className="app-menu__label">FAQ Management</span>
            </NavLink>
          </li>
          <li>
            <NavLink className="app-menu__item" to="/account-settings">
              <i
                className="app-menu__icon mx-3 fa-light fa-gear pr-1"
                style={{ fontWeight: "700" }}
              ></i>
              <span className="app-menu__label">Account Settings</span>
            </NavLink>
          </li> */}

          <li>
            <button className="app-menu__item" onClick={handleLogout} style={{ background: "none", border: "none", cursor: "pointer", width: "100%", textAlign: "left" }}>
              <i
                className="app-menu__icon mx-3 fa-light fa-right-from-bracket pr-1"
                style={{ fontWeight: "700" }}
              ></i>
              <span className="app-menu__label">Logout</span>
            </button>
          </li>

        </ul>
        {/* <div className="text-center develop mt-5">
          <p
            className="d-flex align-items-center"
            style={{ margin: 0, fontSize: "11px" }}
          >
            <span style={{ color: "red" }}>&#10084;</span>
            <span>&nbsp;Developed By</span>
            <span style={{ color: "red" }}>&nbsp;Delywizz</span>
            <span style={{ color: "green" }}>&nbsp;Technologies</span>
          </p>
        </div> */}
      </aside>
    </>
  );
};

Headers.propTypes = {
  setIsSideBarOpen: PropTypes.func.isRequired,
};

export default Headers;
