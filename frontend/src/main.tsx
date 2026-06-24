import { createRoot } from "react-dom/client";
import App from "./app/App.tsx";
import "./styles/index.css";

const isExtension = typeof chrome !== "undefined" && chrome?.runtime?.id;
if (isExtension) {
  document.documentElement.classList.add("is-extension");
}

createRoot(document.getElementById("root")!).render(<App />);