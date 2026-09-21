import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { setBaseUrl } from "@workspace/erp-api-client-react";
import { getApiBase } from "./lib/api-base";

// Company Web Store domains use their matching ERP origin. Development still
// uses BASE_URL (e.g. "/store") so Vite can proxy requests to ERP API (8082).
const apiUrl = getApiBase();

if (apiUrl) {
  setBaseUrl(apiUrl);
}

createRoot(document.getElementById("root")!).render(<App />);
