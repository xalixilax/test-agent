import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import Popup from "./Popup";
import { watchForDevReload } from "@/shared/dev-reload";
import "@design-system/styles/global.css";

watchForDevReload();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Popup />
  </StrictMode>,
);
