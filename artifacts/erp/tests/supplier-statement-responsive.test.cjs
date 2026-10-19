const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { test } = require("node:test");
const ts = require("typescript");
const React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");

const source = readFileSync(path.join(__dirname, "../src/pages/Suppliers.tsx"), "utf8");
const ast = ts.createSourceFile("Suppliers.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const statementNode = ast.statements.find(
  (node) => ts.isFunctionDeclaration(node) && node.name?.text === "StatementSheet",
);
assert.ok(statementNode, "StatementSheet must remain available for presentation testing");

const compiled = ts.transpileModule(statementNode.getText(ast), {
  compilerOptions: { jsx: ts.JsxEmit.React, target: ts.ScriptTarget.ES2022 },
}).outputText;

const operationNote = "REFERENCE-WITHOUT-SPACES-".repeat(8);
const sampleData = {
  operations: [{
    id: 41,
    source: "supplier",
    date: "2026-10-18",
    type: "purchase",
    amount: "1234.50",
    reference: null,
    note: operationNote,
    runningBalance: "1234.50",
    balanceBefore: "0.00",
    balanceAfter: "1234.50",
    storeNameEn: "Main Store",
    storeNameAr: "المتجر الرئيسي",
  }, {
    id: 42,
    source: "supplier",
    date: "2026-10-19",
    type: "payment",
    amount: "250.00",
    reference: null,
    note: `<script>alert('x')</script>\nline, "quoted"; note`,
    runningBalance: "984.50",
    balanceBefore: "1234.50",
    balanceAfter: "984.50",
    storeNameEn: "Main Store",
    storeNameAr: "المتجر الرئيسي",
  }],
  contactBalance: null,
};

const passthrough = (tag) => ({ children, ...props }) => React.createElement(tag, props, children);
const icon = () => React.createElement("span", { "aria-hidden": "true" });
const components = {
  Sheet: ({ children }) => React.createElement(React.Fragment, null, children),
  SheetContent: ({ children, className, style }) => React.createElement("section", { className, style }, children),
  SheetHeader: passthrough("header"),
  SheetTitle: passthrough("h2"),
  Button: ({ children, size, variant, ...props }) => React.createElement("button", props, children),
  FileText: icon,
  Minimize2: icon,
  Maximize2: icon,
  RefreshCw: icon,
  Download: icon,
  Printer: icon,
  TrendingUp: icon,
  TrendingDown: icon,
  SlidersHorizontal: icon,
  Skeleton: () => React.createElement("span", null, "loading"),
  Label: passthrough("label"),
  Input: passthrough("input"),
  Table: ({ children, className }) => React.createElement(
    "div",
    { className: `relative w-full overflow-auto ${className ?? ""}`.trim() },
    React.createElement("table", null, children),
  ),
  TableHeader: passthrough("thead"),
  TableBody: passthrough("tbody"),
  TableRow: passthrough("tr"),
  TableHead: passthrough("th"),
  TableCell: passthrough("td"),
};

function renderStatement(lang) {
  const buttonHandlers = {};
  const browser = { csvBlob: null, downloadedFilename: "", printHtml: "", popupBlocked: false };
  const link = {
    href: "",
    download: "",
    click() { browser.downloadedFilename = this.download; },
    remove() {},
  };
  const printWindow = {
    opener: null,
    document: {
      open() {},
      write(html) { browser.printHtml = html; },
      close() {},
    },
  };
  const Button = ({ children, size, variant, ...props }) => {
    if (props["data-testid"] && props.onClick) buttonHandlers[props["data-testid"]] = props.onClick;
    return React.createElement("button", props, children);
  };
  const context = vm.createContext({
    React,
    useState: React.useState,
    useEffect() {},
    useQuery: () => ({ data: sampleData, isLoading: false, isError: false }),
    ...components,
    Button,
    useLang: () => ({ lang }),
    useQueryClient: () => ({ invalidateQueries() {} }),
    getGetSupplierOperationsQueryKey: (id) => ["supplier-operations", id],
    fmt: (value) => String(value),
    Blob,
    URL: {
      createObjectURL(blob) { browser.csvBlob = blob; return "blob:test"; },
      revokeObjectURL() {},
    },
    document: {
      createElement() { return link; },
      body: { appendChild() {} },
    },
    window: {
      open() { return printWindow; },
      alert() { browser.popupBlocked = true; },
      setTimeout() {},
    },
  });
  const StatementSheet = vm.runInContext(`${compiled}\nStatementSheet`, context);
  const supplier = {
    id: 17,
    name: "North Supplier",
    currentBalance: "1234.50",
    globalSupplierId: 9,
  };
  const html = renderToStaticMarkup(React.createElement(StatementSheet, {
    supplier,
    open: true,
    onOpenChange() {},
    expanded: false,
    onToggleExpanded() {},
  }));
  return { html, browser, buttonHandlers };
}

function findElementByTestId(html, testId) {
  const markerAt = html.indexOf(`data-testid="${testId}"`);
  assert.notEqual(markerAt, -1, `missing ${testId}`);
  const start = html.lastIndexOf("<", markerAt);
  const tag = html.slice(start + 1).match(/^[a-z][\w-]*/i)?.[0];
  assert.ok(tag, `could not find opening tag for ${testId}`);

  const tagPattern = new RegExp(`<\\/?${tag}\\b[^>]*>`, "gi");
  tagPattern.lastIndex = start;
  let depth = 0;
  let match;
  while ((match = tagPattern.exec(html))) {
    if (match[0].startsWith("</")) depth -= 1;
    else if (!match[0].endsWith("/>")) depth += 1;
    if (depth === 0) return html.slice(start, tagPattern.lastIndex);
  }
  assert.fail(`could not find closing tag for ${testId}`);
}

const phoneWidth = 390;
const desktopWidth = 1280;
const mediumBreakpoint = 768;
assert.ok(phoneWidth < mediumBreakpoint && desktopWidth >= mediumBreakpoint);

for (const lang of ["fr", "ar"]) {
  const { html, browser, buttonHandlers } = renderStatement(lang);
  const expected = lang === "ar"
    ? ["شراء", "المرجع / ملاحظة", "مدين", "دائن", "الرصيد", "قبل", "بعد", "المتجر الرئيسي"]
    : ["Achat", "Référence / Note", "Débit", "Crédit", "Solde", "Ancien", "Nouveau", "Main Store"];

  test(`statement exports are offered in the active language (${lang})`, () => {
    assert.ok(html.includes('data-testid="button-download-supplier-statement-csv"'));
    assert.ok(html.includes('data-testid="button-print-supplier-statement"'));
    assert.ok(html.includes(lang === "ar" ? "تنزيل CSV" : "Télécharger CSV"));
    assert.ok(html.includes(lang === "ar" ? "طباعة / PDF" : "Imprimer / PDF"));
  });

  test(`CSV and print exports keep statement order, locale, and safe text (${lang})`, async () => {
    buttonHandlers["button-download-supplier-statement-csv"]();
    const csv = Buffer.from(await browser.csvBlob.arrayBuffer()).toString("utf8");
    assert.ok(csv.startsWith("\uFEFF"), "CSV should include a UTF-8 BOM for Arabic and Excel");
    assert.ok(csv.includes(lang === "ar" ? "التاريخ" : "Date"));
    assert.ok(csv.indexOf("2026-10-18") < csv.indexOf("2026-10-19"), "CSV should preserve operation order");
    assert.ok(csv.includes(`"<script>alert('x')</script>\nline, ""quoted""; note"`), "CSV cells should quote delimiters, quotes, and line breaks");
    assert.match(browser.downloadedFilename, /all-dates/);

    buttonHandlers["button-print-supplier-statement"]();
    assert.ok(browser.printHtml.includes(`lang="${lang}" dir="${lang === "ar" ? "rtl" : "ltr"}"`));
    assert.ok(browser.printHtml.includes("2026-10-18") && browser.printHtml.includes("2026-10-19"));
    assert.ok(browser.printHtml.includes("&lt;script&gt;alert(&#39;x&#39;)&lt;/script&gt;"));
    assert.ok(!browser.printHtml.includes("<script>alert('x')</script>"), "operation text must not become executable HTML");
  });

  test(`phone layout keeps essential supplier-operation fields readable (${lang}, ${phoneWidth}px)`, () => {
    const cards = findElementByTestId(html, "supplier-statement-cards");
    assert.match(cards, /class="space-y-3 md:hidden"/);
    assert.doesNotMatch(cards, /overflow-x-(?:auto|scroll)|overflow-auto|whitespace-nowrap/);
    assert.match(cards, /class="min-w-0 rounded-lg border bg-card p-3 space-y-3"/);
    assert.match(cards, /break-words/);
    assert.ok(html.includes(`dir="${lang === "ar" ? "rtl" : "ltr"}"`));
    assert.ok(cards.includes("2026-10-18"));
    assert.ok(cards.includes(operationNote), "long reference/note must remain present and wrap");
    assert.ok(cards.includes("1234.50"));
    for (const label of expected) assert.ok(cards.includes(label), label);
    assert.ok(cards.includes("0.00"), "the previous balance must be shown");
  });

  test(`desktop layout keeps the supplier-operation table visible (${lang}, ${desktopWidth}px)`, () => {
    const table = findElementByTestId(html, "supplier-statement-table");
    assert.match(table, /class="hidden overflow-hidden rounded-md border md:block"/);
    assert.ok(table.includes("<table"));
    assert.ok(table.includes("2026-10-18"));
    assert.ok(table.includes(operationNote));
    assert.ok(!/min-w-\[/.test(table), "the desktop table should not force a minimum-width horizontal scroll");
    for (const label of expected.slice(0, 6)) assert.ok(table.includes(label), label);
  });
}
