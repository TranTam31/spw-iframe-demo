import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.tsx";
import ImageTweakpane from "./ImageTweakpane.tsx";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
    {/* <ImageTweakpane /> */}
  </StrictMode>
);
