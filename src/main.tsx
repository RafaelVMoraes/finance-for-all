import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { registerServiceWorker } from "@/lib/serviceWorker";

createRoot(document.getElementById("root")!).render(<App />);

registerServiceWorker(() => {
  window.dispatchEvent(new Event("sw-update-available"));
});

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    window.location.reload();
  });
}
