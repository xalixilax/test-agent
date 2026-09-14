import React from "react";
import ReactDOM from "react-dom/client";
import App from "./AppAlt";
import { watchForDevReload } from "@/shared/dev-reload";
import "@design-system/styles/global.css";

watchForDevReload();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
