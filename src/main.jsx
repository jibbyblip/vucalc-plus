import React from "react";
import ReactDOM from "react-dom/client";
import { Analytics } from "@vercel/analytics/react";
import LoanCalculator from "./LoanCalculator.jsx";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <LoanCalculator />
    <Analytics />
  </React.StrictMode>
);
