import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import StaffApp from "./StaffApp.jsx";
import "./style.css";

const isStaffRoute = window.location.pathname.toLowerCase().startsWith("/staff");

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    {isStaffRoute ? <StaffApp /> : <App />}
  </React.StrictMode>
);