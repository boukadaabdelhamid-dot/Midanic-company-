const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { test } = require("node:test");
const ts = require("typescript");
const React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");

// Exercise the real dashboard presentation without signing in, touching a
// database, or changing the source module's exports.
const source = readFileSync(path.join(__dirname, "../src/pages/Dashboard.tsx"), "utf8");
const ast = ts.createSourceFile("Dashboard.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const names = [
  "fmtNum", "partyTypeLabel", "KpiCard", "SimpleTable",
  "ClientsTab", "FournisseursTab", "ClientReceivablesModal", "SupplierDebtsModal",
  "canAggregateDashboard", "getTokenRole", "GeneralTab",
];
const functions = ast.statements.filter((node) =>
  ts.isFunctionDeclaration(node) && names.includes(node.name?.text),
);
assert.equal(functions.length, names.length);
const compiled = ts.transpileModule(functions.map((node) => node.getText(ast)).join("\n"), {
  compilerOptions: { jsx: ts.JsxEmit.React, target: ts.ScriptTarget.ES2022 },
}).outputText;
const container = ({ children }) => React.createElement("div", null, children);

function setup(rows, { loading = false, error = null, general, caisses, debts } = {}) {
  const requests = [];
  const context = vm.createContext({
    React,
    atob,
    useState: (value) => [value, () => {}],
    useEffect: () => {},
    Package: container, RefreshCw: container,
    StockDetailModal: () => null,
    Card: container, CardHeader: container, CardTitle: container, CardContent: container,
    Dialog: container, DialogContent: container, DialogHeader: container, DialogTitle: container,
    Users: container, Truck: container, Wallet: container, TrendingUp: container,
    AlertCircle: container, Loader2: container,
    KpiCardSkeleton: () => React.createElement("span", null, "loading"),
    LoadingGrid: () => React.createElement("span", null, "loading"),
    ErrorState: () => React.createElement("span", null, "error"),
    buildPath: (url, storeId) => `${url}?storeId=${storeId}`,
    useFetchList: (url) => {
      requests.push(url);
      return { rows: url.includes("supplier-debts") && debts ? debts : rows, loading, error };
    },
    useFetch: (url) => {
      requests.push(url);
      return { data: url.includes("/caisses") ? caisses : general, loading, error };
    },
  });
  const components = vm.runInContext(`${compiled}\n({${names.join(",")}})`, context);
  return { components, requests };
}

for (const lang of ["fr", "ar"]) {
  const t = (fr, ar) => lang === "fr" ? fr : ar;
  test(`receivables render every party type and total (${lang})`, () => {
    const rows = ["customer", "supplier", "customer_supplier"].map((party_type, i) => ({
      id: `contact:${i}`, name: `Contact ${i}`, party_type, balance: "100.00",
    }));
    const { components, requests } = setup(rows);
    const html = renderToStaticMarkup(React.createElement(components.ClientsTab, {
      t, currency: "DZD", storeId: "12",
    }));
    for (const type of ["Client", "Fournisseur", "Client / fournisseur"].map(
      (label, i) => lang === "fr" ? label : ["زبون", "مورد", "زبون / مورد"][i],
    )) assert.ok(html.includes(type), type);
    assert.ok(html.includes("300,00"));
    assert.ok(html.includes(lang === "fr" ? "Créance" : "المبلغ المستحق"));
    assert.deepEqual(requests, ["/api/erp/dashboard/client-receivables?storeId=12"]);
  });

  test(`debts and their detail modal display positive magnitudes (${lang})`, () => {
    const rows = [
      { id: "contact:1", name: "First", party_type: "customer_supplier", balance: "-125.50" },
      { id: "supplier:2", name: "Second", party_type: "supplier", balance: "-50.00" },
    ];
    const { components, requests } = setup(rows);
    for (const Component of [components.FournisseursTab, components.SupplierDebtsModal]) {
      const html = renderToStaticMarkup(React.createElement(Component, {
        rows, loading: false, error: null, open: true, onClose() {},
        t, currency: "DZD", storeId: "12",
      }));
      for (const value of ["125,50", "50,00", "175,50"]) assert.ok(html.includes(value), value);
      assert.ok(!html.includes("-125,50"));
      assert.ok(!html.includes("-175,50"));
      assert.ok(html.includes(lang === "fr" ? "Type" : "النوع"));
    }
    assert.deepEqual(requests, ["/api/erp/dashboard/supplier-debts?storeId=12"]);
  });
}

test("empty, loading and error states remain supported", () => {
  const t = (fr) => fr;
  for (const name of ["ClientsTab", "FournisseursTab"]) {
    for (const [options, expected] of [
      [{}, name === "ClientsTab" ? "Aucune créance." : "Aucune dette."],
      [{ loading: true }, "loading"],
      [{ error: "unavailable" }, "error"],
    ]) {
      const { components } = setup([], options);
      const html = renderToStaticMarkup(React.createElement(components[name], { t, currency: "DZD" }));
      assert.ok(html.includes(expected), `${name}: ${expected}`);
    }
  }
});

test("Company API routing and Arabic tab labels are preserved", () => {
  assert.ok(source.includes('import { getApiBase } from "../lib/api-base"'));
  assert.ok(!source.includes("import.meta.env.VITE_API_URL"));
  assert.match(source, /value: "clients".*labelAr: "المستحقات"/);
  assert.match(source, /value: "fournisseurs".*labelAr: "الديون"/);
});

test("company owners and standalone admins have the store selector, employees do not", () => {
  const { components } = setup([]);
  for (const role of ["admin", "tenant_admin", "employee", "customer"]) {
    const token = `header.${Buffer.from(JSON.stringify({ role })).toString("base64url")}.signature`;
    assert.equal(components.canAggregateDashboard(components.getTokenRole(token)),
      role === "admin" || role === "tenant_admin");
  }
  assert.equal(components.canAggregateDashboard(components.getTokenRole(null)), false);
});

test("actual General tab reproduces both screenshots' assets formulas and scopes", () => {
  for (const sample of [
    { scope: "1", stock: 7788615.32, debt: "-2440893.70", total: 8288709.22 },
    { scope: "all", stock: 10579512.82, debt: "-2515893.70", total: 11004606.72 },
  ]) {
    const { components, requests } = setup([
      { id: "customer:1", name: "Example", party_type: "customer", balance: "1519511" },
    ], {
      general: { stockValue: sample.stock, productsWithoutCost: 0 },
      caisses: { total: "1421476.60", caisses: [] },
      debts: [{ id: "supplier:1", name: "Example", party_type: "supplier", balance: sample.debt }],
    });
    const html = renderToStaticMarkup(React.createElement(components.GeneralTab, {
      t: (fr) => fr, lang: "fr", currency: "DA", storeId: sample.scope,
    }));
    const compact = html.replace(/[\s\u00a0\u202f]/g, "");
    assert.ok(compact.includes(sample.total.toFixed(2).replace(".", ",")));
    for (const endpoint of ["general", "caisses", "client-receivables", "supplier-debts"]) {
      assert.ok(requests.includes(`/api/erp/dashboard/${endpoint}?storeId=${sample.scope}`));
    }
  }
});

test("store selector is rendered for tenant owners but never for employees", () => {
  const dashboard = ast.statements.find((node) =>
    ts.isFunctionDeclaration(node) && node.name?.text === "Dashboard",
  ).getText(ast).replace("export default ", "");
  const tabs = ast.statements.find((node) =>
    ts.isVariableStatement(node) && node.declarationList.declarations.some(
      (d) => d.name.getText(ast) === "ALL_TABS",
    ),
  ).getText(ast);
  const js = ts.transpileModule(`${dashboard}\n${tabs}`, {
    compilerOptions: { jsx: ts.JsxEmit.React, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  for (const role of ["tenant_admin", "admin", "employee"]) {
    const token = `header.${Buffer.from(JSON.stringify({ role })).toString("base64url")}.signature`;
    const { components } = setup([]);
    const context = vm.createContext({
      React, ...components,
      useAuth: () => ({ token }),
      useLang: () => ({ lang: "fr" }),
      usePermissions: () => ({ can: () => true }),
      useEffect: () => {},
      useState: (value) => [
        Array.isArray(value) ? [{ id: 1, nameEn: "Store One", nameAr: "المتجر الأول" }] : value,
        () => {},
      ],
      LayoutDashboard: container, ShoppingCart: container, TrendingUp: container,
      Users: container, UserCog: container, Package: container, Wallet: container,
      Truck: container, Building2: container,
      Tabs: container, TabsList: container, TabsTrigger: container, TabsContent: () => null,
      GeneralTab: () => null, VentesTab: () => null, VentePlusTab: () => null,
      BeneficeTab: () => null, ClientsTab: () => null, EmployesTab: () => null,
      StockTab: () => null, CaissesTab: () => null, FournisseursTab: () => null,
    });
    const Component = vm.runInContext(`${js}\nDashboard`, context);
    const html = renderToStaticMarkup(React.createElement(Component));
    assert.equal(html.includes("<select"), role !== "employee");
    if (role !== "employee") {
      assert.ok(html.includes("Tous les magasins"));
      assert.ok(html.includes("Store One"));
    }
  }
});
