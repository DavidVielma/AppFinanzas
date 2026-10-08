import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "./App.jsx";
import { SharedAccountView } from "./components/SharedAccountView.jsx";
import "./styles.css";

const isSharedAccountView = window.location.pathname.replace(/\/$/, "") === "/cuenta-compartida";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    {isSharedAccountView ? <SharedAccountView /> : <App />}
  </React.StrictMode>
);

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch((error) => {
      console.warn("No se pudo registrar la PWA.", error);
    });
  });
}
