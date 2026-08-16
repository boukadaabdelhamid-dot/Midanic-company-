import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { setBaseUrl } from "@workspace/erp-api-client-react";

// In dev VITE_API_URL is empty; use BASE_URL (e.g. "/store") so that
// the generated client prefixes every request with /store/api/* and
// Vite's proxy can forward them to ERP API (8082).
const apiUrl =
  (import.meta.env.VITE_API_URL as string | undefined) ||
  ((import.meta.env.BASE_URL as string | undefined) ?? "").replace(/\/+$/, "");

if (apiUrl) {
  setBaseUrl(apiUrl);
}

createRoot(document.getElementById("root")!).render(<App />);
