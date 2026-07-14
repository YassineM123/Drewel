import React, { useState } from "react";
import Headers from "./Headers";

const Layout = () => {
  const [isSideBarOpen, setIsSideBarOpen] = useState(false);

  return (
    <div
      className={`app sidebar-mini ${
        isSideBarOpen ? " sidenav-toggled" : ""
      }`}
    >
      <Headers isSideBarOpen={isSideBarOpen} setIsSideBarOpen={setIsSideBarOpen}/>
    </div>
  );
};

export default Layout;
