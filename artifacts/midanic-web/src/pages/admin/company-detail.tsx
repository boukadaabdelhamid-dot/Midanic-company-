import { useEffect, useState, type ReactNode } from "react";
import { ArrowLeft, Building2, CalendarDays, Factory, Globe2, KeyRound, LockKeyhole, MapPin, RefreshCw, Settings2, ShoppingBag, Upload } from "lucide-react";
import type { ErpTenant } from "@/lib/admin-api";
import { useAdminText } from "@/lib/admin-i18n";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel } from "@/components/ui/alert-dialog";
import { CompanyStatus } from "./company-register";

type Tab = "general" | "locations" | "features" | "contract" | "security";
interface Props {
  tenant: ErpTenant;
  ownerCount: number;
  features: readonly { key: string; label: string }[];
  refreshing: boolean;
  onBack: () => void;
  onContract: () => void;
  onPassword: () => void;
  onDomain: () => void;
  onWebStore: () => void;
  onFeatures: () => void;
  onRefresh: () => void;
  onImport: () => void;
  onStatus: (status: string) => Promise<void>;
  onCatalog: (mode: "shared" | "separate") => Promise<boolean>;
}

function DetailCard({ title, children }: { title: string; children: ReactNode }) {
  return <section className="console-detail-card"><h3>{title}</h3>{children}</section>;
}

export function CompanyDetail(props: Props) {
  const { tenant: t } = props;
  const { tAdmin, language } = useAdminText();
  const [tab, setTab] = useState<Tab>("general");
  const [catalog, setCatalog] = useState<"shared" | "separate">(t.productCatalogMode ?? "separate");
  const [confirmCatalog, setConfirmCatalog] = useState(false);
  const [nextStatus, setNextStatus] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  useEffect(() => { setCatalog(t.productCatalogMode ?? "separate"); }, [t.id, t.productCatalogMode]);
  const date = (value: string | null) => value ? new Date(value).toLocaleDateString(language) : "—";
  const tabs: { key: Tab; label: string; Icon: typeof Building2 }[] = [
    { key: "general", label: "General", Icon: Building2 },
    { key: "locations", label: "Locations", Icon: MapPin },
    { key: "features", label: "Features", Icon: Settings2 },
    { key: "contract", label: "Contract & import", Icon: CalendarDays },
    { key: "security", label: "Access & security", Icon: LockKeyhole },
  ];
  const importReviewRequired = t.dataImportStatus === "failed"
    && (!!t.dataImportSummary || t.dataImportError?.includes("must be checked before another upload"));
  const canImport = t.dataImportStatus === "awaiting_backup" || (t.dataImportStatus === "failed" && !importReviewRequired);
  return <section data-testid={`company-detail-${t.id}`}>
    <button className="console-back" onClick={props.onBack} disabled={saving}><ArrowLeft size={16} />{tAdmin("Back to register")}</button>
    <div className="console-detail-heading">
      <span className="console-company-avatar large">{t.companyName.slice(0, 2).toUpperCase()}</span>
      <div><small>{tAdmin("Tenant")} #{t.id}</small><h2>{t.companyName}</h2><CompanyStatus status={t.status} /></div>
      <div className="console-owner-spaces"><strong>{props.ownerCount}</strong><small>{tAdmin("Same owner accounts")}</small></div>
    </div>
    <div className="console-detail-tabs" role="tablist" aria-label={tAdmin("Company details")}>
      {tabs.map(({ key, label, Icon }) => <button key={key} id={`company-tab-${key}`} role="tab" aria-selected={tab === key}
        aria-controls="company-detail-panel" tabIndex={tab === key ? 0 : -1}
        onKeyDown={event => {
          if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
          event.preventDefault();
          const direction = (event.key === "ArrowRight" ? 1 : -1) * (language === "ar" ? -1 : 1);
          const index = event.key === "Home" ? 0 : event.key === "End" ? tabs.length - 1 : (tabs.findIndex(item => item.key === tab) + direction + tabs.length) % tabs.length;
          setTab(tabs[index].key);
          document.getElementById(`company-tab-${tabs[index].key}`)?.focus();
        }}
        onClick={() => setTab(key)} className={tab === key ? "selected" : ""}>
        <Icon size={16} />{tAdmin(label)}
      </button>)}
    </div>
    <div role="tabpanel" id="company-detail-panel" aria-labelledby={`company-tab-${tab}`} className="console-detail-grid">
      {tab === "general" && <>
        <DetailCard title={tAdmin("Company details")}><dl className="console-data">
          <div><dt>{tAdmin("Company name")}</dt><dd>{t.companyName}</dd></div>
          <div><dt>{tAdmin("Owner")}</dt><dd>{[t.ownerFirstName, t.ownerLastName].filter(Boolean).join(" ") || `#${t.ownerUserId}`}</dd></div>
          <div><dt>{tAdmin("Email")}</dt><dd dir="ltr">{t.ownerEmail ?? "—"}</dd></div>
          <div><dt>{tAdmin("Created")}</dt><dd>{date(t.createdAt)}</dd></div>
        </dl></DetailCard>
        <DetailCard title={tAdmin("Status")}><dl className="console-data">
          <div><dt>{tAdmin("Database")}</dt><dd><CompanyStatus status={t.databaseStatus} /></dd></div>
          <div><dt>{tAdmin("Import status")}</dt><dd><CompanyStatus status={t.dataImportStatus} /></dd></div>
          <div><dt>{tAdmin("Product catalog")}</dt><dd>{tAdmin(t.productCatalogMode === "shared" ? "Share products across stores" : "Separate products by store")}</dd></div>
        </dl></DetailCard>
      </>}
      {tab === "locations" && <>
        <DetailCard title={tAdmin("Locations")}><div className="console-location-total"><MapPin size={22} /><strong>{t.currentStores ?? "—"}</strong><span>{tAdmin("stores")}</span></div>
          <p className="text-sm text-muted-foreground">{t.maxStores == null ? "∞" : t.maxStores} · {tAdmin("Store limit")}</p>
          <p className="mt-3 text-sm text-muted-foreground">{tAdmin("Location names are managed inside the ERP.")}</p>
          <Button variant="outline" className="mt-4" onClick={props.onRefresh} disabled={props.refreshing}><RefreshCw size={15} className={props.refreshing ? "animate-spin" : ""} />{tAdmin("Refresh")}</Button>
        </DetailCard>
        <DetailCard title={tAdmin("Production unit")}><Factory size={26} className="text-amber-600 mb-4" /><CompanyStatus status={t.featureFlags?.manufacturing === true ? "active" : "inactive"} /><Button variant="outline" className="mt-4 block" onClick={props.onFeatures}>{tAdmin("Manage features")}</Button></DetailCard>
      </>}
      {tab === "features" && <>
        <DetailCard title={tAdmin("Product catalog")}>
          <label className="sr-only" htmlFor={`catalog-mode-${t.id}`}>{tAdmin("Product catalog")}</label>
          <select id={`catalog-mode-${t.id}`} value={catalog} onChange={e => setCatalog(e.target.value as typeof catalog)} disabled={saving} className="console-select w-full">
            <option value="separate">{tAdmin("Separate products by store")}</option><option value="shared">{tAdmin("Share products across stores")}</option>
          </select>
          <p className="my-4 text-sm text-muted-foreground">{tAdmin("This applies to new products; existing products stay unchanged.")}</p>
          <div className="flex flex-wrap gap-2"><Button disabled={saving || catalog === (t.productCatalogMode ?? "separate")} onClick={() => setConfirmCatalog(true)}>{tAdmin("Save changes")}</Button>
            <Button variant="outline" disabled={saving || catalog === (t.productCatalogMode ?? "separate")} onClick={() => setCatalog(t.productCatalogMode ?? "separate")}>{tAdmin("Discard changes")}</Button></div>
        </DetailCard>
        <DetailCard title={tAdmin("Features")}><div className="console-feature-list">{props.features.map(feature => <div key={feature.key}><span>{tAdmin(feature.label)}</span><CompanyStatus status={t.featureFlags?.[feature.key] !== false ? "active" : "inactive"} /></div>)}</div>
          <Button variant="outline" className="mt-4" onClick={props.onFeatures}><Settings2 size={16} />{tAdmin("Manage features")}</Button>
        </DetailCard>
      </>}
      {tab === "contract" && <>
        <DetailCard title={tAdmin("Contract")}><dl className="console-data">
          <div><dt>{tAdmin("Contract term")}</dt><dd>{t.contractPeriod ? tAdmin(t.contractPeriod) : tAdmin("No contract")}</dd></div>
          <div><dt>{tAdmin("Contract start date")}</dt><dd>{date(t.contractStartsAt)}</dd></div>
          <div><dt>{tAdmin("Contract expiry")}</dt><dd>{date(t.contractEndsAt)}</dd></div>
          <div><dt>{tAdmin("Trial ends")}</dt><dd>{date(t.trialEndsAt)}</dd></div>
        </dl><Button variant="outline" className="mt-4" onClick={props.onContract}><CalendarDays size={16} />{tAdmin(t.contractPeriod ? "Manage contract" : "Set contract")}</Button></DetailCard>
        <DetailCard title={tAdmin("Import status")}><CompanyStatus status={t.dataImportStatus} />
          {t.dataImportSummary && <p className="mt-3">{tAdmin("Imported")}: {t.dataImportSummary.tableCount ?? 0} {tAdmin("tables")}</p>}
          {importReviewRequired && <p className="my-3 text-sm text-amber-700">{tAdmin("Imported data was retained; review required")}</p>}
          {t.dataImportError && <p className="my-3 break-words text-sm text-destructive">{t.dataImportError}</p>}
          {canImport && <Button variant="outline" className="mt-4" onClick={props.onImport} data-testid={`button-import-backup-${t.id}`}><Upload size={16} />{tAdmin(t.dataImportStatus === "failed" ? "Retry backup import" : "Import backup")}</Button>}
        </DetailCard>
      </>}
      {tab === "security" && <>
        <DetailCard title={tAdmin("Access & security")}>
          <label className="block text-sm mb-2" htmlFor={`company-status-${t.id}`}>{tAdmin("Status")}</label>
          <select id={`company-status-${t.id}`} className="console-select" value={t.status} onChange={e => setNextStatus(e.target.value)}>
            {["pending", "active", "suspended", "expired", "converted"].map(status => <option key={status} value={status}>{tAdmin(status)}</option>)}
          </select>
          <p className="mt-5 mb-3 text-sm text-muted-foreground">{tAdmin("Owner password is shared across their accounts.")}</p>
          <Button variant="outline" onClick={props.onPassword} data-testid={`button-owner-password-${t.id}`}><KeyRound size={16} />{tAdmin("Change owner password")}</Button>
        </DetailCard>
        <DetailCard title={tAdmin("Company domain")}><p dir="ltr" className="break-all">{t.hostname ?? "—"}</p><CompanyStatus status={t.domainStatus} />
          <Button variant="outline" className="mt-4 block" onClick={props.onDomain}><Globe2 size={16} />{tAdmin("Company domain")}</Button>
          <h3 className="mt-6">{tAdmin("Web Store")}</h3><p dir="ltr" className="break-all">{t.webStoreHostname ?? "—"}</p><CompanyStatus status={t.webStoreStatus} />
          <Button variant="outline" className="mt-4 block" onClick={props.onWebStore}><ShoppingBag size={16} />{tAdmin("Configure Web Store")}</Button>
        </DetailCard>
      </>}
    </div>
    <AlertDialog open={confirmCatalog} onOpenChange={open => { if (!saving) setConfirmCatalog(open); }}>
      <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>{tAdmin("Confirm catalog change")}</AlertDialogTitle><AlertDialogDescription>{t.companyName} · #{t.id}<br />{tAdmin("Only this company's catalog setting will change.")}</AlertDialogDescription></AlertDialogHeader>
        <AlertDialogFooter><AlertDialogCancel disabled={saving}>{tAdmin("Cancel")}</AlertDialogCancel><Button disabled={saving} onClick={async () => { setSaving(true); try { if (await props.onCatalog(catalog)) setConfirmCatalog(false); } finally { setSaving(false); } }}>{tAdmin(saving ? "Saving..." : "Confirm")}</Button></AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    <AlertDialog open={nextStatus !== null} onOpenChange={open => { if (!open && !saving) setNextStatus(null); }}>
      <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>{tAdmin("Confirm access change")}</AlertDialogTitle><AlertDialogDescription>{t.companyName} · #{t.id}<br />{tAdmin("This changes ERP access for this company.")} {nextStatus && tAdmin(nextStatus)}</AlertDialogDescription></AlertDialogHeader>
        <AlertDialogFooter><AlertDialogCancel disabled={saving}>{tAdmin("Cancel")}</AlertDialogCancel><Button disabled={saving} onClick={async () => { if (!nextStatus) return; setSaving(true); try { await props.onStatus(nextStatus); setNextStatus(null); } finally { setSaving(false); } }}>{tAdmin(saving ? "Saving..." : "Confirm")}</Button></AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </section>;
}
