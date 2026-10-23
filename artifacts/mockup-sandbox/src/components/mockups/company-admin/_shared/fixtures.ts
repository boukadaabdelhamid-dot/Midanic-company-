export interface ErpTenant {
  id: number;
  ownerUserId: number;
  companyName: string;
  status: string;
  subdomain: string | null;
  hostname: string | null;
  domainStatus: "inactive" | "active";
  domainActivatedAt: string | null;
  trialStartedAt: string | null;
  trialEndsAt: string | null;
  contractPeriod: "monthly" | "yearly" | null;
  contractStartsAt: string | null;
  contractEndsAt: string | null;
  approvedAt: string | null;
  suspendedAt: string | null;
  notes: string | null;
  databaseStatus: "unprovisioned" | "provisioning" | "ready" | "failed";
  dataImportStatus: "not_requested" | "awaiting_backup" | "running" | "completed" | "failed";
  dataImportedAt: string | null;
  dataImportError: string | null;
  dataImportSummary: { tableCount: number } | null;
  webStoreStatus: "inactive" | "active";
  webStoreSubdomain: string | null;
  webStoreHostname: string | null;
  webStoreDomainStatus: "inactive" | "active";
  webStoreDomainActivatedAt: string | null;
  featureFlags: Record<string, boolean>;
  productCatalogMode: "separate" | "shared";
  maxStores: number | null;
  currentStores: number | null;
  storeCountStatus: "ready" | "not_ready" | "unavailable";
  createdAt: string;
  ownerEmail: string | null;
  ownerFirstName: string | null;
  ownerLastName: string | null;
}

// Synthetic preview records only. Never connected to production services.
function makeTenant(id: number, companyName: string, overrides: Partial<ErpTenant> = {}): ErpTenant {
return { id, ownerUserId: id + 100, companyName, status: 'active', subdomain: null, hostname: null, domainStatus: 'inactive', domainActivatedAt: null,
trialStartedAt: null, trialEndsAt: null, contractPeriod: null, contractStartsAt: null, contractEndsAt: null, approvedAt: null, suspendedAt: null, notes: null,
databaseStatus: 'ready', dataImportStatus: 'completed', dataImportedAt: null, dataImportError: null, dataImportSummary: { tableCount: 57 },
webStoreStatus: 'inactive', webStoreSubdomain: null, webStoreHostname: null, webStoreDomainStatus: 'inactive', webStoreDomainActivatedAt: null,
featureFlags: { manufacturing: false }, productCatalogMode: 'separate', maxStores: 3, currentStores: 2, storeCountStatus: 'ready', createdAt: '2026-10-12T12:00:00Z',
ownerEmail: 'contact@example.invalid', ownerFirstName: 'Compte', ownerLastName: 'Démo', ...overrides };
}
export const TENANTS: ErpTenant[] = [
makeTenant(13, 'Atlas Distribution', {status:'converted', contractPeriod:'monthly',contractStartsAt:'2026-10-01',contractEndsAt:'2026-11-01',hostname:'atlas.example.invalid',domainStatus:'active',productCatalogMode:'shared',featureFlags:{manufacturing:true},currentStores:3}),
makeTenant(12, 'Maison Lina', {status:'converted',ownerUserId:113,contractPeriod:'yearly',contractStartsAt:'2026-10-18',contractEndsAt:'2027-10-18',hostname:'lina.example.invalid',domainStatus:'active',currentStores:1}),
makeTenant(11, 'Atelier Nour', {status:'converted',contractPeriod:'monthly',contractStartsAt:'2026-09-28',contractEndsAt:'2026-10-28',hostname:'nour.example.invalid',domainStatus:'active',featureFlags:{manufacturing:true},productCatalogMode:'shared',currentStores:2}),
makeTenant(10, 'Sahara Trade', {status:'pending',dataImportStatus:'awaiting_backup',dataImportSummary:null,databaseStatus:'unprovisioned',currentStores:null,storeCountStatus:'not_ready'}),
makeTenant(9, 'Zina Mode', {status:'expired',trialStartedAt:'2026-10-01',trialEndsAt:'2026-10-15',dataImportStatus:'not_requested',dataImportSummary:null,currentStores:1}),
makeTenant(8, 'Studio Amal', {status:'converted',contractPeriod:'yearly',contractStartsAt:'2026-09-28',contractEndsAt:'2027-09-28',hostname:'amal.example.invalid',domainStatus:'active',currentStores:1}),
makeTenant(7, 'Dune Maison', {status:'active',dataImportStatus:'not_requested',dataImportSummary:null,currentStores:1})
];
