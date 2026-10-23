import type { ErpTenant } from "../src/lib/admin-api";

// Reserved example.test addresses; no database, account, token or password.
function tenant(id: number, ownerUserId: number, companyName: string): ErpTenant {
  return {
    id, ownerUserId, companyName,
    ownerEmail: `owner-${ownerUserId}@example.test`,
    ownerFirstName: `Fixture ${ownerUserId}`, ownerLastName: "Owner",
    status: "active",
    subdomain: `company-${id}`, hostname: `company-${id}.example.test`,
    domainStatus: "inactive", domainActivatedAt: null,
    trialStartedAt: "2026-01-01", trialEndsAt: "2026-02-01",
    contractPeriod: null, contractStartsAt: null, contractEndsAt: null,
    approvedAt: null, suspendedAt: null, notes: null,
    databaseStatus: "ready", dataImportStatus: "not_requested",
    dataImportedAt: null, dataImportError: null, dataImportSummary: null,
    webStoreStatus: "inactive", webStoreSubdomain: `shop-${id}`,
    webStoreHostname: `shop-${id}.example.test`,
    webStoreDomainStatus: "inactive", webStoreDomainActivatedAt: null,
    featureFlags: { reports: id !== 202 },
    productCatalogMode: id === 202 ? "shared" : "separate",
    maxStores: id === 202 ? 7 : 3, currentStores: 1, storeCountStatus: "ready",
    createdAt: "2026-01-01T00:00:00Z",
  };
}

export function companyFixtures(): ErpTenant[] {
  return [
    tenant(101, 9001, "Fixture Alpha"),
    { ...tenant(202, 9001, "Fixture Beta"), status: "converted",
      contractPeriod: "yearly", contractStartsAt: "2026-03-01", contractEndsAt: "2027-03-01" },
    { ...tenant(303, 9002, "Fixture Gamma"), status: "suspended" },
  ];
}
