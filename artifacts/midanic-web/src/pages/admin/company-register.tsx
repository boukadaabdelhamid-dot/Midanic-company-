import { ArrowRight, Building2, CircleAlert, Clock3, BadgeCheck } from "lucide-react";
import type { ErpTenant } from "@/lib/admin-api";
import { useAdminText } from "@/lib/admin-i18n";

export function needsCompanyAttention(tenant: ErpTenant, now = Date.now()) {
  const ends = tenant.contractEndsAt ?? tenant.trialEndsAt;
  const days = ends ? (new Date(ends).getTime() - now) / 86400000 : null;
  return ["pending", "expired", "suspended"].includes(tenant.status)
    || tenant.databaseStatus === "failed" || tenant.dataImportStatus === "failed"
    || (days !== null && days <= 7);
}

export function CompanyStatus({ status }: { status: string }) {
  const { tAdmin } = useAdminText();
  const tone = ["active", "converted", "ready", "completed"].includes(status) ? "good"
    : ["failed", "expired", "suspended"].includes(status) ? "danger" : "pending";
  return <span className={`console-status ${tone}`}>{tAdmin(status)}</span>;
}

export function CompanyMetrics({ tenants, selected, onSelect }: {
  tenants: ErpTenant[]; selected: string; onSelect: (filter: string) => void;
}) {
  const { tAdmin } = useAdminText();
  const metrics = [
    { key: "all", label: "ERP Companies", count: tenants.length, Icon: Building2, tone: "blue" },
    { key: "active", label: "In operation", count: tenants.filter(t => ["active", "converted"].includes(t.status)).length, Icon: BadgeCheck, tone: "green" },
    { key: "trial", label: "Trial accounts", count: tenants.filter(t => !t.contractPeriod && t.status !== "converted" && (t.trialStartedAt || t.trialEndsAt)).length, Icon: Clock3, tone: "amber" },
    { key: "attention", label: "Needs attention", count: tenants.filter(t => needsCompanyAttention(t)).length, Icon: CircleAlert, tone: "rose" },
  ];
  return <div className="console-metrics">
    {metrics.map(({ key, label, count, Icon, tone }) => <button type="button" key={key}
      className={`console-metric ${selected === key ? "selected" : ""}`} aria-pressed={selected === key}
      onClick={() => onSelect(key)} data-testid={`company-metric-${key}`}>
      <span className={`console-metric-icon ${tone}`}><Icon size={19} /></span>
      <span><small>{tAdmin(label)}</small><strong>{count}</strong></span>
      <ArrowRight size={15} className="console-metric-arrow" />
    </button>)}
  </div>;
}

export function CompanyRegister({ tenants, allTenants = tenants, onOpen }: {
  tenants: ErpTenant[]; allTenants?: ErpTenant[]; onOpen: (tenant: ErpTenant) => void;
}) {
  const { tAdmin, language } = useAdminText();
  const date = (value: string | null) => value ? new Date(value).toLocaleDateString(language) : "—";
  return <div className="console-register">
    <table>
      <thead><tr>
        {["Company", "Owner", "Status", "Locations", "Contract"].map(label => <th key={label}>{tAdmin(label)}</th>)}<th><span className="sr-only">{tAdmin("Open company")}</span></th>
      </tr></thead>
      <tbody>{tenants.map(tenant => {
        const ownerCount = allTenants.filter(t => t.ownerUserId === tenant.ownerUserId).length;
        return <tr key={tenant.id} data-testid={`company-row-${tenant.id}`}>
          <td data-label={tAdmin("Company")}><button className="console-company-link" onClick={() => onOpen(tenant)} data-testid={`open-company-${tenant.id}`}>
            <span className="console-company-avatar">{tenant.companyName.slice(0, 2).toUpperCase()}</span>
            <span><strong>{tenant.companyName}</strong><small>#{tenant.id}{ownerCount > 1 ? ` · ${ownerCount} ${tAdmin("Same owner accounts")}` : ""}</small></span>
          </button></td>
          <td data-label={tAdmin("Owner")}><strong>{[tenant.ownerFirstName, tenant.ownerLastName].filter(Boolean).join(" ") || `#${tenant.ownerUserId}`}</strong><small dir="ltr">{tenant.ownerEmail}</small></td>
          <td data-label={tAdmin("Status")}><CompanyStatus status={tenant.status} /><small>{tAdmin("Database")}: {tAdmin(tenant.databaseStatus)}</small></td>
          <td data-label={tAdmin("Locations")}><strong>{tenant.currentStores ?? "—"}{tenant.maxStores != null ? ` / ${tenant.maxStores}` : ""}</strong><small>{tAdmin("stores")}{tenant.featureFlags?.manufacturing === true ? ` · ${tAdmin("Production unit")}` : ""}</small></td>
          <td data-label={tAdmin("Contract")}><strong>{tenant.contractPeriod ? tAdmin(tenant.contractPeriod) : (tenant.trialStartedAt || tenant.trialEndsAt) ? tAdmin("Trial account") : tAdmin("No contract")}</strong><small>{date(tenant.contractEndsAt ?? tenant.trialEndsAt)}</small></td>
          <td><button className="console-open-company" onClick={() => onOpen(tenant)} aria-label={`${tAdmin("Open company")}: ${tenant.companyName}`}><ArrowRight size={18} /></button></td>
        </tr>;
      })}</tbody>
    </table>
    {!tenants.length && <div className="console-empty">{tAdmin("No matching companies")}</div>}
  </div>;
}
