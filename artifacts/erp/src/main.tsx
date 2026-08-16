import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { setBaseUrl, setAuthTokenGetter } from "@workspace/erp-api-client-react";

// Register the token getter here — earliest possible execution point —
// so every generated-client request carries Authorization: Bearer <token>
// regardless of React module import order.
setAuthTokenGetter(() => localStorage.getItem("midanic_token"));

// In production, VITE_API_URL is set explicitly.
// In development, we use Vite's BASE_URL (e.g. "/erp") so that relative API
// requests become /erp/api/... and pass through the Vite proxy → ERP API (8082).
// Without this, /api/products goes directly to Replit's path router → Platform API (8080).
const apiUrl =
  (import.meta.env.VITE_API_URL as string | undefined) ||
  (import.meta.env.BASE_URL as string | undefined)?.replace(/\/$/, "");

if (apiUrl) {
  setBaseUrl(apiUrl);
}

createRoot(document.getElementById("root")!).render(<App />);
