import { useMemo, useState } from "react";
import "./_group.css";
import "./organized.css";
import {
  Activity, ArrowDownUp, ArrowLeft, ArrowRight, BadgeCheck, Building2, CalendarDays,
  Check, ChevronDown, ChevronRight, CircleAlert, CircleCheck, Clock3,
  Factory, FileText, Globe2, KeyRound, LayoutDashboard, LifeBuoy, ListFilter, LockKeyhole,
  MapPin, Menu, MoreHorizontal, Package, Search, Settings2, ShieldCheck, Store, X,
} from "lucide-react";
import { TENANTS, type ErpTenant } from "./_shared/fixtures";

type Screen = "overview" | "companies" | "licenses";
type DetailTab = "general" | "locations" | "features" | "contract" | "security";
type Filter = "all" | "active" | "trial" | "pending" | "attention";

const labels: Record<string, string> = {
  active: "Actif", converted: "Sous contrat", pending: "En attente", expired: "Expiré",
  suspended: "Suspendu", ready: "Prête", unprovisioned: "À créer", provisioning: "En préparation",
  failed: "À vérifier", completed: "Terminé", awaiting_backup: "Sauvegarde attendue",
  running: "En cours", not_requested: "Non demandé", monthly: "Mensuel", yearly: "Annuel",
};
const accountStatus = (t: ErpTenant) => t.status === "converted" ? "active" : t.status;
const isTrial = (t: ErpTenant) => !!(t.trialStartedAt || t.trialEndsAt);
const hasAttention = (t: ErpTenant) => {
  const contractEnd = t.contractEndsAt ? Date.parse(`${t.contractEndsAt.slice(0, 10)}T12:00:00`) : null;
  const expiresSoon = contractEnd !== null && contractEnd >= Date.now() &&
    contractEnd - Date.now() <= 7 * 24 * 60 * 60 * 1000;
  return t.status === "pending" || t.status === "expired" ||
    t.dataImportStatus === "failed" || t.databaseStatus === "failed" || expiresSoon;
};
const date = (value: string | null) => value ? new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(`${value.slice(0, 10)}T12:00:00`)) : "—";
const ownerName = (t: ErpTenant) => [t.ownerFirstName, t.ownerLastName].filter(Boolean).join(" ") || `Compte ${t.ownerUserId}`;

function Status({ value }: { value: string }) {
  return <span className={`org-status org-status-${value}`}>{labels[value] ?? value}</span>;
}

export function Organized() {
  const [screen, setScreen] = useState<Screen>("overview");
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [tab, setTab] = useState<DetailTab>("general");
  const [menuOpen, setMenuOpen] = useState(false);
  const [notice, setNotice] = useState("");
  const [staged, setStaged] = useState(false);
  const [catalog, setCatalog] = useState<"separate" | "shared">("separate");
  const [savedCatalogs, setSavedCatalogs] = useState<Record<number, "separate" | "shared">>({});
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [savedMessage, setSavedMessage] = useState("");

  const tenants = TENANTS;
  const selected = tenants.find(t => t.id === selectedId) ?? null;
  const filtered = useMemo(() => tenants.filter(t => {
    const text = `${t.companyName} ${ownerName(t)} ${t.ownerEmail ?? ""} ${t.hostname ?? ""}`.toLowerCase();
    const matchQuery = text.includes(query.trim().toLowerCase());
    const matchFilter = filter === "all" ||
      (filter === "active" && accountStatus(t) === "active" && !isTrial(t)) ||
      (filter === "trial" && isTrial(t)) ||
      (filter === "pending" && t.status === "pending") ||
      (filter === "attention" && hasAttention(t));
    return matchQuery && matchFilter;
  }), [tenants, query, filter]);
  const counts = {
    all: tenants.length,
    active: tenants.filter(t => accountStatus(t) === "active" && !isTrial(t)).length,
    trial: tenants.filter(isTrial).length,
    pending: tenants.filter(t => t.status === "pending").length,
    attention: tenants.filter(hasAttention).length,
  };
  const ownerCompanyCount = selected ? tenants.filter(t => t.ownerUserId === selected.ownerUserId).length : 0;

  const showNotice = (message: string) => {
    setNotice(message);
    window.setTimeout(() => setNotice(""), 4200);
  };
  const openCompany = (tenant: ErpTenant) => {
    setSelectedId(tenant.id);
    setTab("general");
    setStaged(false);
    setSavedMessage("");
    setCatalog(savedCatalogs[tenant.id] ?? tenant.productCatalogMode ?? "separate");
    setScreen("companies");
    setMenuOpen(false);
  };
  const goScreen = (next: Screen) => {
    setScreen(next);
    setSelectedId(null);
    setMenuOpen(false);
  };
  const saveDemo = () => {
    if (selectedId !== null) {
      setSavedCatalogs(previous => ({ ...previous, [selectedId]: catalog }));
    }
    setConfirmOpen(false);
    setStaged(false);
    setSavedMessage("Aperçu enregistré localement. Aucune donnée réelle n’a été modifiée.");
    showNotice("Modifications enregistrées dans cet aperçu uniquement.");
  };

  return (
    <div className="company-admin-prototype dark org-shell">
      <header className="org-topbar">
        <button className="org-mobile-menu" aria-label="Ouvrir le menu" onClick={() => setMenuOpen(v => !v)} data-testid="button-mobile-menu">
          {menuOpen ? <X /> : <Menu />}
        </button>
        <div className="org-brand">
          <img src="/__mockup/images/midanic-company-logo.png" alt="Midanic Company" />
          <span className="org-brand-divider" />
          <span className="org-brand-admin">Administration</span>
        </div>
        <div className="org-top-right">
          <span className="org-preview"><span /> Aperçu de démonstration</span>
          <button className="org-avatar" aria-label="Compte administrateur de démonstration" title="Administrateur de démonstration">MA</button>
        </div>
      </header>
      <div className="org-frame">
        {menuOpen && <button className="org-scrim" aria-label="Fermer le menu" onClick={() => setMenuOpen(false)} />}
        <aside className={`org-sidebar ${menuOpen ? "org-sidebar-open" : ""}`}>
          <div className="org-workspace">
            <div className="org-workspace-mark">M</div>
            <div><strong>Espace plateforme</strong><span>Super-administrateur</span></div>
            <ChevronDown size={15} />
          </div>
          <div className="org-nav-label">GESTION</div>
          <nav aria-label="Navigation administration">
            <button className={`org-nav-item ${screen === "overview" ? "is-active" : ""}`} onClick={() => goScreen("overview")} data-testid="nav-overview">
              <LayoutDashboard size={17} /><span>Vue d’ensemble</span>
            </button>
            <button className={`org-nav-item ${screen === "companies" ? "is-active" : ""}`} onClick={() => goScreen("companies")} data-testid="nav-companies">
              <Building2 size={17} /><span>Entreprises ERP</span><span className="org-nav-count">{tenants.length}</span>
            </button>
            <button className={`org-nav-item ${screen === "licenses" ? "is-active" : ""}`} onClick={() => goScreen("licenses")} data-testid="nav-licenses">
              <KeyRound size={17} /><span>Licences desktop</span>
            </button>
          </nav>
          <div className="org-nav-label org-nav-label-spaced">PLATEFORME</div>
          <nav>
            {[
              ["Utilisateurs", Activity], ["Catalogue produits", Package], ["Contrats", FileText],
              ["Assistance", LifeBuoy],
            ].map(([label, Icon]) => {
              const NavIcon = Icon as typeof Activity;
              return <button key={label as string} className="org-nav-item org-nav-future" onClick={() => showNotice(`${label} : section hors périmètre de cet aperçu.`)}><NavIcon size={17} /><span>{label as string}</span><span className="org-nav-soon">Aperçu</span></button>;
            })}
          </nav>
          <div className="org-sidebar-bottom">
            <div className="org-sidebar-help"><ShieldCheck size={17} /><span><strong>Accès administrateur</strong><small>Les actions sont simulées</small></span></div>
            <div className="org-sidebar-version">MIDANIC COMPANY <span>•</span> CONSOLE</div>
          </div>
        </aside>

        <main className="org-main">
          <div className="org-mobile-context">
            <button onClick={() => selected ? setSelectedId(null) : goScreen("overview")} aria-label="Retour"><ArrowLeft size={16} /></button>
            <span>{selected ? selected.companyName : screen === "licenses" ? "Licences desktop" : "Administration"}</span>
          </div>
          {selected ? (
            <CompanyDetail
              tenant={selected}
              tab={tab}
              setTab={setTab}
              onBack={() => { setSelectedId(null); setSavedMessage(""); }}
              ownerCompanyCount={ownerCompanyCount}
              catalog={catalog}
              savedCatalog={savedCatalogs[selected.id] ?? selected.productCatalogMode ?? "separate"}
              setCatalog={setCatalog}
              staged={staged}
              setStaged={setStaged}
              savedMessage={savedMessage}
              onSave={() => setConfirmOpen(true)}
              onAction={showNotice}
            />
          ) : screen === "licenses" ? (
            <Licenses onReturn={() => goScreen("companies")} />
          ) : (
            <Overview
              screen={screen}
              filter={filter}
              setFilter={setFilter}
              query={query}
              setQuery={setQuery}
              counts={counts}
              tenants={filtered}
              total={tenants.length}
              onOpen={openCompany}
              onAll={() => { setFilter("all"); setScreen("companies"); }}
              onNotice={showNotice}
            />
          )}
        </main>
      </div>
      {notice && <div className="org-toast" role="status"><CircleCheck size={18} /><span>{notice}</span><button onClick={() => setNotice("")} aria-label="Fermer"><X size={15} /></button></div>}
      {confirmOpen && (
        <div className="org-modal-backdrop" role="presentation" onMouseDown={e => { if (e.target === e.currentTarget) setConfirmOpen(false); }}>
          <section className="org-confirm" role="dialog" aria-modal="true" aria-labelledby="confirm-title">
            <div className="org-confirm-icon"><ShieldCheck size={21} /></div>
            <h2 id="confirm-title">Confirmer l’enregistrement de démonstration</h2>
            <p>Les changements seront uniquement visibles dans cet aperçu local. Aucun compte, contrat ou accès réel ne sera modifié.</p>
            <div className="org-confirm-actions"><button className="org-button org-button-quiet" onClick={() => setConfirmOpen(false)}>Annuler</button><button className="org-button org-button-primary" onClick={saveDemo}><Check size={15} /> Confirmer l’aperçu</button></div>
          </section>
        </div>
      )}
    </div>
  );
}

function Overview({ screen, filter, setFilter, query, setQuery, counts, tenants, total, onOpen, onAll, onNotice }: {
  screen: Screen; filter: Filter; setFilter: (v: Filter) => void; query: string; setQuery: (v: string) => void;
  counts: Record<Filter, number>; tenants: ErpTenant[]; total: number; onOpen: (t: ErpTenant) => void; onAll: () => void; onNotice: (s: string) => void;
}) {
  const isHome = screen === "overview";
  const [status, setStatus] = useState("all");
  const visible = tenants.filter(t => status === "all" || t.status === status);
  const cards: { key: Filter; label: string; note: string; icon: typeof Building2; tone: string }[] = [
    { key: "all", label: "Entreprises ERP", note: "Tous les espaces", icon: Building2, tone: "blue" },
    { key: "active", label: "En activité", note: "Contrats et accès actifs", icon: BadgeCheck, tone: "green" },
    { key: "trial", label: "Période d’essai", note: "Essais enregistrés", icon: Clock3, tone: "amber" },
    { key: "attention", label: "À examiner", note: "Échéances et activation", icon: CircleAlert, tone: "rose" },
  ];
  return <div className="org-content">
    <div className="org-breadcrumb"><span>Plateforme</span><ChevronRight size={13} /><span>{isHome ? "Vue d’ensemble" : "Entreprises ERP"}</span></div>
    <div className="org-page-heading">
      <div><div className="org-eyebrow">ESPACE ADMINISTRATEUR</div><h1>{isHome ? "Vue d’ensemble" : "Entreprises ERP"}</h1><p>{isHome ? "Les bons repères pour gérer les espaces de vos entreprises." : "Un seul registre pour les comptes, essais et contrats ERP."}</p></div>
      <button className="org-button org-button-outline org-refresh" onClick={() => onNotice("Données de démonstration actualisées localement.")}><Activity size={15} /> Actualiser l’aperçu</button>
    </div>
    {isHome && <div className="org-welcome-strip"><div className="org-welcome-icon"><Building2 size={18} /></div><div><strong>Gestion des entreprises, sans doublons</strong><span>Chaque entreprise ERP est gérée dans un registre unique. Les licences desktop restent séparées.</span></div><button onClick={onAll}>Ouvrir le registre <ArrowRight size={15} /></button></div>}
    <section className="org-metrics" aria-label="Résumé des entreprises">
      {cards.map(({ key, label, note, icon: Icon, tone }) => <button key={key} className={`org-metric ${filter === key ? "org-metric-selected" : ""}`} onClick={() => { setFilter(key); if (!isHome) setStatus("all"); }} data-testid={`metric-${key}`}>
        <div className={`org-metric-icon ${tone}`}><Icon size={17} /></div><div className="org-metric-copy"><span>{label}</span><strong>{counts[key]}</strong><small>{note}</small></div><ArrowRight className="org-metric-arrow" size={15} />
      </button>)}
    </section>
    <section className="org-list-panel">
      <div className="org-list-head"><div><div className="org-section-title">{isHome ? "Entreprises récentes" : "Registre des entreprises"} <span>{total} au total</span></div><p>{isHome ? "Accédez aux informations et réglages de chaque espace." : `${visible.length} résultat${visible.length > 1 ? "s" : ""} affiché${visible.length > 1 ? "s" : ""}`}</p></div>{isHome && <button className="org-text-link" onClick={onAll}>Voir tout <ArrowRight size={15} /></button>}</div>
      <div className="org-toolbar">
        <label className="org-search"><Search size={16} /><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Rechercher une entreprise, un responsable…" aria-label="Rechercher des entreprises" data-testid="input-company-search" />{query && <button onClick={() => setQuery("")} aria-label="Effacer la recherche"><X size={14} /></button>}</label>
        <label className="org-filter-select"><ListFilter size={15} /><select value={status} onChange={e => setStatus(e.target.value)} aria-label="Filtrer par statut" data-testid="select-company-status"><option value="all">Tous les statuts</option><option value="active">Actif</option><option value="converted">Sous contrat</option><option value="pending">En attente</option><option value="expired">Expiré</option><option value="suspended">Suspendu</option></select><ChevronDown size={14} /></label>
      </div>
      <div className="org-table-wrap">
        <table className="org-table"><thead><tr><th>ENTREPRISE</th><th>RESPONSABLE</th><th>ACCÈS ERP</th><th>IMPLANTATIONS</th><th>CONTRAT / ESSAI</th><th></th></tr></thead><tbody>
          {visible.map(t => {
            const owned = TENANTS.filter(x => x.ownerUserId === t.ownerUserId).length;
            return <tr key={t.id} data-testid={`company-row-${t.id}`} onClick={() => onOpen(t)} tabIndex={0} onKeyDown={e => { if (e.key === "Enter") onOpen(t); }}>
              <td><div className="org-company-cell"><div className="org-company-avatar">{t.companyName.split(" ").map(w => w[0]).slice(0, 2).join("")}</div><div><strong>{t.companyName}</strong><span>ID entreprise #{t.id} {owned > 1 && <em>· {owned} espaces du responsable</em>}</span></div></div></td>
              <td><div className="org-owner">{ownerName(t)}</div><span className="org-subtext">{t.ownerEmail ?? `Compte utilisateur #${t.ownerUserId}`}</span></td>
              <td><Status value={t.status} /><span className="org-subtext org-db-line"><span className={`org-dot ${t.databaseStatus === "ready" ? "dot-ready" : "dot-wait"}`} />Base {labels[t.databaseStatus]?.toLowerCase() ?? t.databaseStatus}</span></td>
              <td><strong className="org-locations-count">{t.currentStores ?? "—"}</strong><span className="org-subtext">point{t.currentStores === 1 ? "" : "s"} de vente {t.maxStores ? `sur ${t.maxStores}` : ""}{t.featureFlags.manufacturing ? " · usine" : ""}</span></td>
              <td>{t.contractPeriod ? <><strong className="org-contract">{labels[t.contractPeriod]}</strong><span className="org-subtext">Jusqu’au {date(t.contractEndsAt)}</span></> : isTrialTenant(t) ? <><strong className="org-trial">Période d’essai</strong><span className="org-subtext">Fin le {date(t.trialEndsAt)}</span></> : <><strong className="org-no-contract">Sans contrat</strong><span className="org-subtext">{t.status === "pending" ? "Activation en attente" : "À définir"}</span></>}</td>
              <td><button className="org-row-open" aria-label={`Ouvrir ${t.companyName}`}><ChevronRight size={17} /></button></td>
            </tr>;
          })}
          {visible.length === 0 && <tr><td colSpan={6}><div className="org-empty"><Search size={21} /><strong>Aucune entreprise trouvée</strong><span>Essayez un autre nom ou ajustez les filtres.</span><button onClick={() => { setQuery(""); setStatus("all"); setFilter("all"); }}>Effacer les filtres</button></div></td></tr>}
        </tbody></table>
      </div>
      <div className="org-list-footer"><span>Source : données fictives issues des fixtures du prototype</span><span>Affichage local <ArrowDownUp size={13} /></span></div>
    </section>
    <div className="org-info-note"><LockKeyhole size={15} /><span>Les informations affichées sont des données de démonstration. Aucune action n’est transmise à la plateforme.</span></div>
  </div>;
}
function isTrialTenant(t: ErpTenant) { return !!(t.trialStartedAt || t.trialEndsAt); }

function CompanyDetail({ tenant: t, tab, setTab, onBack, ownerCompanyCount, catalog, savedCatalog, setCatalog, staged, setStaged, savedMessage, onSave, onAction }: {
  tenant: ErpTenant; tab: DetailTab; setTab: (v: DetailTab) => void; onBack: () => void; ownerCompanyCount: number;
  catalog: "separate" | "shared"; savedCatalog: "separate" | "shared"; setCatalog: (v: "separate" | "shared") => void; staged: boolean; setStaged: (v: boolean) => void;
  savedMessage: string; onSave: () => void; onAction: (s: string) => void;
}) {
  const tabItems: { key: DetailTab; label: string; icon: typeof Building2 }[] = [
    { key: "general", label: "Général", icon: Building2 }, { key: "locations", label: "Implantations", icon: MapPin },
    { key: "features", label: "Fonctionnalités", icon: Settings2 }, { key: "contract", label: "Contrat & import", icon: FileText },
    { key: "security", label: "Accès & sécurité", icon: LockKeyhole },
  ];
  const features = Object.entries(t.featureFlags ?? {});
  const enabledFeatures = features.filter(([, value]) => value).length;
  const storeCount = t.currentStores ?? 0;
  const locations = Array.from({ length: storeCount }, (_, i) => ({
    name: ["Centre-ville", "Bab Ezzouar", "El Biar", "Oran Centre"][i % 4],
    type: "Magasin",
  }));
  if (t.featureFlags.manufacturing) locations.push({ name: "Site de production", type: "Usine" });
  return <div className="org-content org-detail-content">
    <div className="org-breadcrumb"><button onClick={onBack}>Entreprises ERP</button><ChevronRight size={13} /><span>{t.companyName}</span></div>
    <div className="org-detail-head">
      <button className="org-back-button" onClick={onBack} aria-label="Retour au registre"><ArrowLeft size={17} /></button>
      <div className="org-company-avatar org-avatar-large">{t.companyName.split(" ").map(w => w[0]).slice(0, 2).join("")}</div>
      <div className="org-detail-title"><div className="org-eyebrow">ENTREPRISE ERP · #{t.id}</div><h1>{t.companyName}</h1><div className="org-detail-meta"><Status value={t.status} /><span>{t.hostname ?? "Domaine non attribué"}</span><span className="org-meta-divider" />{ownerCompanyCount > 1 && <span>{ownerCompanyCount} espaces liés au même responsable</span>}</div></div>
      <button className="org-button org-button-outline org-more" onClick={() => onAction("Menu d’actions de l’entreprise : aperçu uniquement.")}><MoreHorizontal size={18} /><span>Actions</span></button>
    </div>
    <div className="org-detail-tabs" role="tablist" aria-label="Informations entreprise">
      {tabItems.map(({ key, label, icon: Icon }) => <button key={key} role="tab" aria-selected={tab === key} className={tab === key ? "active" : ""} onClick={() => setTab(key)} data-testid={`tab-${key}`}><Icon size={15} /><span>{label}</span></button>)}
    </div>
    {savedMessage && <div className="org-saved-message"><CircleCheck size={16} />{savedMessage}</div>}
    {tab === "general" && <div className="org-detail-grid">
      <section className="org-detail-card org-overview-card"><div className="org-card-heading"><div><h2>Informations générales</h2><p>Identité et espace de l’entreprise</p></div><Building2 size={18} /></div>
        <div className="org-data-grid"><Data label="Nom de l’entreprise" value={t.companyName} /><Data label="Identifiant ERP" value={`#${t.id}`} /><Data label="Responsable" value={ownerName(t)} /><Data label="Compte responsable" value={t.ownerEmail ?? `Utilisateur #${t.ownerUserId}`} /><Data label="Sous-domaine" value={t.hostname ?? "Non attribué"} /><Data label="Créée le" value={date(t.createdAt)} /></div>
      </section>
      <section className="org-detail-card"><div className="org-card-heading"><div><h2>État de l’espace</h2><p>État issu des données fictives</p></div><Activity size={18} /></div>
        <div className="org-state-list"><div><span>Accès ERP</span><Status value={t.status} /></div><div><span>Base de données</span><Status value={t.databaseStatus} /></div><div><span>Import des données</span><Status value={t.dataImportStatus} /></div></div>
      </section>
      <section className="org-detail-card"><div className="org-card-heading"><div><h2>Implantations</h2><p>Magasins et sites de production</p></div><MapPin size={18} /></div>
        <div className="org-location-summary"><div className="org-loc-icon"><Store size={17} /></div><strong>{t.currentStores ?? "—"}</strong><span>point{t.currentStores === 1 ? "" : "s"} de vente</span>{t.featureFlags.manufacturing && <><i /><Factory size={16} /><span>1 usine</span></>}</div><button className="org-inline-link" onClick={() => setTab("locations")}>Consulter les implantations <ArrowRight size={14} /></button>
      </section>
      <section className="org-detail-card"><div className="org-card-heading"><div><h2>Contrat & import</h2><p>Suivi administratif</p></div><FileText size={18} /></div>
        <div className="org-compact-data"><div><span>Formule</span><strong>{t.contractPeriod ? labels[t.contractPeriod] : isTrialTenant(t) ? "Période d’essai" : "Aucune formule"}</strong></div><div><span>Fin de période</span><strong>{date(t.contractEndsAt ?? t.trialEndsAt)}</strong></div></div><button className="org-inline-link" onClick={() => setTab("contract")}>Voir contrat et import <ArrowRight size={14} /></button>
      </section>
    </div>}
    {tab === "locations" && <section className="org-detail-card org-wide-card"><div className="org-card-heading"><div><h2>Implantations de {t.companyName}</h2><p>Exemples de libellés de sites pour cette maquette. Les quantités de points de vente suivent les fixtures.</p></div><button className="org-button org-button-outline" onClick={() => onAction("Ajout d’implantation indisponible dans cet aperçu.")}><MapPin size={15} /> Ajouter un site</button></div>
      <div className="org-location-list">{locations.length ? locations.map((location, i) => <div key={`${location.type}-${i}`} className="org-location-row"><div className={`org-location-symbol ${location.type === "Usine" ? "factory-symbol" : ""}`}>{location.type === "Usine" ? <Factory size={17} /> : <Store size={17} />}</div><div><strong>{location.name}</strong><span>{location.type} · Nom illustratif</span></div><span className="org-location-tag">{location.type}</span></div>) : <div className="org-empty-inline">Aucun point de vente disponible dans les données de démonstration.</div>}</div>
      <div className="org-inline-note">Les sites listés ici illustrent l’organisation magasin / usine ; leur nom n’est pas fourni par les fixtures.</div>
    </section>}
    {tab === "features" && <section className="org-detail-card org-wide-card"><div className="org-card-heading"><div><h2>Fonctionnalités & catalogue</h2><p>{enabledFeatures} fonctionnalité{enabledFeatures > 1 ? "s" : ""} activée{enabledFeatures > 1 ? "s" : ""} parmi {features.length}</p></div><Settings2 size={18} /></div>
      <div className="org-feature-list">{features.map(([key, enabled]) => <div key={key} className="org-feature-row"><span className={`org-feature-check ${enabled ? "enabled" : ""}`}>{enabled ? <Check size={13} /> : null}</span><span>{featureName(key)}</span><span className={`org-feature-status ${enabled ? "enabled" : ""}`}>{enabled ? "Activée" : "Désactivée"}</span></div>)}</div>
      <div className="org-staged-control"><div><strong>Catalogue produits</strong><span>Organisation des produits entre magasins</span></div><select value={catalog} onChange={e => { setCatalog(e.target.value as "separate" | "shared"); setStaged(true); }} aria-label="Mode du catalogue produits" data-testid="select-catalog-mode"><option value="separate">Séparé par magasin</option><option value="shared">Partagé entre magasins</option></select></div>
      {staged && <StagedSave onSave={onSave} onCancel={() => { setCatalog(savedCatalog); setStaged(false); }} />}
    </section>}
    {tab === "contract" && <div className="org-detail-grid org-contract-grid">
      <section className="org-detail-card"><div className="org-card-heading"><div><h2>Contrat ou période d’essai</h2><p>Dates présentes dans les données de démonstration</p></div><CalendarDays size={18} /></div>
        <div className="org-data-grid"><Data label="Statut" value={t.contractPeriod ? labels[t.contractPeriod] : isTrialTenant(t) ? "Période d’essai" : "Sans contrat"} /><Data label="Début du contrat" value={date(t.contractStartsAt)} /><Data label="Fin du contrat" value={date(t.contractEndsAt)} /><Data label="Fin de l’essai" value={date(t.trialEndsAt)} /></div><button className="org-button org-button-outline org-action-wide" onClick={() => onAction("La modification de contrat est simulée et non disponible.")}>Gérer le contrat <ArrowRight size={15} /></button>
      </section>
      <section className="org-detail-card"><div className="org-card-heading"><div><h2>Import de sauvegarde</h2><p>Suivi des données initiales</p></div><Package size={18} /></div><div className="org-import-state"><div className="org-import-icon"><Status value={t.dataImportStatus} /></div><strong>{labels[t.dataImportStatus] ?? t.dataImportStatus}</strong><span>{t.dataImportSummary ? `${t.dataImportSummary.tableCount} tables indiquées par la fixture` : t.dataImportError ? "Une vérification est indiquée dans la fixture." : "Aucun résumé d’import disponible."}</span></div><button className="org-button org-button-outline org-action-wide" onClick={() => onAction("L’import de sauvegarde n’est pas exécuté dans cet aperçu.")}>Détails de l’import <ArrowRight size={15} /></button></section>
    </div>}
    {tab === "security" && <div className="org-security-stack">
      <section className="org-detail-card org-wide-card"><div className="org-card-heading"><div><h2>Accès et sécurité</h2><p>Les commandes sensibles sont regroupées ici, à l’écart de la liste.</p></div><ShieldCheck size={18} /></div>
        <div className="org-security-action"><div className="org-security-icon"><KeyRound size={18} /></div><div><strong>Accès du responsable</strong><span>Responsable : {ownerName(t)} · {t.ownerEmail ?? "adresse non renseignée"}</span><small>Aucun mot de passe ne peut être saisi ou modifié depuis cette démonstration.</small></div><button className="org-button org-button-outline" onClick={() => onAction("Réinitialisation du mot de passe non disponible : aucune donnée réelle n’est connectée.")}>Réinitialisation simulée</button></div>
        <div className="org-security-action"><div className="org-security-icon"><Globe2 size={18} /></div><div><strong>Domaine de l’entreprise</strong><span>{t.hostname ?? "Aucun domaine attribué"} · {labels[t.domainStatus] ?? t.domainStatus}</span><small>État d’exemple, sans vérification réseau.</small></div><button className="org-button org-button-outline" onClick={() => onAction("La configuration de domaine est simulée uniquement.")}>Configurer</button></div>
      </section>
      <div className="org-security-note"><LockKeyhole size={16} /><span>Les actions d’accès sont présentées pour organiser la future interface. Elles ne déclenchent aucune modification de compte.</span></div>
    </div>}
  </div>;
}

function Data({ label, value }: { label: string; value: string }) { return <div className="org-data-item"><span>{label}</span><strong>{value}</strong></div>; }
function StagedSave({ onSave, onCancel }: { onSave: () => void; onCancel: () => void }) {
  return <div className="org-save-bar"><span><CircleAlert size={15} /> Changement en attente d’enregistrement</span><div><button className="org-button org-button-quiet" onClick={onCancel}>Annuler</button><button className="org-button org-button-primary" onClick={onSave}><Check size={14} /> Enregistrer</button></div></div>;
}
function featureName(key: string) {
  const names: Record<string, string> = { manufacturing: "Fabrication", dashboard: "Tableau de bord", orders: "Ventes et commandes", products: "Produits", inventory: "Stocks", purchases: "Achats", customers: "Clients", suppliers: "Fournisseurs", hr: "Ressources humaines", accounting: "Comptabilité", reports: "Rapports", transfers: "Transferts", caisse: "Caisses", realtime: "Temps réel", alerts: "Alertes", settings: "Paramètres", web_store: "Boutique en ligne" };
  return names[key] ?? key;
}

function Licenses({ onReturn }: { onReturn: () => void }) {
  return <div className="org-content">
    <div className="org-breadcrumb"><span>Plateforme</span><ChevronRight size={13} /><span>Licences desktop</span></div>
    <div className="org-page-heading"><div><div className="org-eyebrow">GESTION DISTINCTE</div><h1>Licences desktop</h1><p>Les licences desktop ne sont pas des entreprises ERP.</p></div></div>
    <section className="org-license-panel"><div className="org-license-icon"><KeyRound size={23} /></div><div className="org-eyebrow">PÉRIMÈTRE DE CET APERÇU</div><h2>Deux registres, deux usages</h2><p>Les licences desktop restent une rubrique dédiée. La gestion des entreprises ERP, de leurs essais et de leurs contrats se trouve dans un registre unique, sans onglet d’entreprises dupliqué.</p><button className="org-button org-button-primary" onClick={onReturn}>Ouvrir les entreprises ERP <ArrowRight size={15} /></button><div className="org-license-divider" /><div className="org-license-caption"><CircleAlert size={15} />Cette section explique l’organisation proposée ; aucun écran de gestion de licences n’est simulé.</div></section>
  </div>;
}
