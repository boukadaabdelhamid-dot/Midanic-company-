/** Only ERP staff can inspect hidden products through the shared product API. */
export function isProductStaffRole(role: string | undefined): boolean {
  return role === "admin" || role === "tenant_admin" || role === "employee";
}

export function getProductExposureFilter(
  role: string | undefined,
  requestedFilter?: string,
): boolean | undefined {
  // Public callers cannot override visibility with filterExposed=false.
  if (!isProductStaffRole(role)) return true;
  const value = requestedFilter?.toLowerCase();
  if (value && ["oui", "true", "1", "yes"].includes(value)) return true;
  if (value && ["non", "false", "0", "no"].includes(value)) return false;
  return undefined;
}
