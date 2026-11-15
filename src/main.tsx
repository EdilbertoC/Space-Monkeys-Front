import React from "react";
import ReactDOM from "react-dom/client";
// Preserve the existing cascade order when components move between feature modules.
import "./features/map/styles/map-location.css";
import "./features/sensors/sensors.css";
import "./features/history/date-selection/date-calendar.css";
import "./features/prevention-demo/prevention.css";
import "./features/history/styles/exploration.css";
import App from "./app/App";
import "./shared/styles/index.css";
import "./shared/styles/refinements.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
