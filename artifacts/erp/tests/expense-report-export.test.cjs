const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { test } = require("node:test");
const ts = require("typescript");

function loadModule(relativePath, extras = {}) {
  const source = readFileSync(path.join(__dirname, relativePath), "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.React,
      esModuleInterop: true,
    },
  }).outputText;
  const sandbox = { exports: {}, ...extras };
  vm.runInNewContext(compiled, sandbox);
  return sandbox.exports;
}

const helpers = loadModule("../src/lib/expense-report-export.ts");
const options = {
  from: "2026-10-03", to: "2026-10-19", lang: "fr", storeName: "Magasin principal",
  items: [
    {
      id: 1, amount: 1234.56, category: "rent",
      description: 'Location; "octobre"\nDeuxième ligne', reference: "RENT-1",
      createdAt: "2026-10-05T10:30:00.000Z",
    },
    {
      id: 2, amount: 0.05, category: "other", description: "نقل", reference: null,
      createdAt: "2026-10-09T08:00:00.000Z",
    },
  ],
};

test("CSV contains the selected period, store, all entries and exact monetary total", async () => {
  const csv = helpers.buildExpenseReportCsv(options);
  const bytes = Buffer.from(await new Blob([csv]).arrayBuffer());
  assert.deepEqual([...bytes.subarray(0, 3)], [0xef, 0xbb, 0xbf]);
  assert.ok(csv.includes('"Du";"2026-10-03";"Au";"2026-10-19"'));
  assert.ok(csv.includes('"Magasin";"Magasin principal"'));
  assert.ok(csv.includes('"Date";"Catégorie";"Détail";"Référence";"Montant (DA)"'));
  assert.ok(csv.includes('"2026-10-05";"Loyer";"Location; ""octobre""\nDeuxième ligne";"RENT-1";"1234.56"'));
  assert.ok(csv.includes('"2026-10-09";"Autre";"نقل";"—";"0.05"'));
  assert.ok(csv.endsWith('"Total (DA)";"";"";"";"1234.61"'));
});

test("CSV neutralizes user-entered formulas without changing numeric negative amounts", () => {
  const csv = helpers.buildExpenseReportCsv({
    ...options, storeName: "+CMD",
    items: [{ ...options.items[0], amount: -1.25, description: " =HYPERLINK(\"bad\")", reference: "\t@SUM(1)" }],
  });
  assert.ok(csv.includes(`"'+CMD"`));
  assert.ok(csv.includes(`"' =HYPERLINK(""bad"")"`));
  assert.ok(csv.includes(`"'\t@SUM(1)"`));
  assert.ok(csv.includes('"-1.25"'));
});

test("print document escapes untrusted fields and includes full period, entries and total", () => {
  const html = helpers.buildExpenseReportPrintHtml({
    ...options, storeName: '<img src=x onerror="alert(1)">',
    items: [{ ...options.items[0], description: "</script><script>BAD()</script>", reference: "<b>REF</b>" }],
  });
  assert.ok(html.includes('lang="fr" dir="ltr"'));
  assert.ok(html.includes("2026-10-03") && html.includes("2026-10-19"));
  assert.ok(html.includes("Loyer"));
  assert.ok(html.includes("&lt;/script&gt;&lt;script&gt;BAD()&lt;/script&gt;"));
  assert.ok(html.includes("&lt;b&gt;REF&lt;/b&gt;"));
  assert.ok(!html.includes("<img"));
  assert.ok(html.includes("table-header-group"));
  assert.ok(html.includes("window.print()"));
  assert.ok(html.includes("1") && html.includes("234,56"));
});

test("Arabic and English exports use localized headers and categories; empty reports remain printable", () => {
  const ar = helpers.buildExpenseReportPrintHtml({ ...options, lang: "ar" });
  assert.ok(ar.includes('lang="ar" dir="rtl"'));
  assert.ok(ar.includes("تفاصيل المصاريف") && ar.includes("إيجار"));
  const en = helpers.buildExpenseReportCsv({ ...options, lang: "en" });
  assert.ok(en.includes('"Date";"Category";"Description";"Reference";"Amount (DA)"'));
  assert.ok(en.includes('"Rent"'));
  const empty = helpers.buildExpenseReportPrintHtml({ ...options, lang: "en", items: [] });
  assert.ok(empty.includes("No expenses in this period.") && empty.includes("0.00"));
  assert.ok(helpers.buildExpenseReportCsv({ ...options, items: [] }).endsWith('"0.00"'));
});

function reportHarness(query = { data: options.items, isLoading: false, isError: false }, popupBlocked = false) {
  const state = [options.from, options.to, 30, { month: "2026-10", ...options }, true];
  const captured = {};
  const react = {
    createElement: (type, props, ...children) => ({ type, props: { ...props, children } }),
  };
  const hook = () => ({ lang: "fr" });
  hook.translate = (_lang, fr) => fr;
  const printWindow = {
    opener: {},
    document: {
      open: () => { captured.opened = true; },
      write: (html) => { captured.html = html; },
      close: () => { captured.closed = true; },
    },
  };
  const componentModule = new Proxy({}, { get: (_, name) => name });
  const component = loadModule("../src/pages/Reports.tsx", {
    require: (name) => {
      if (name === "react") return {
        __esModule: true, default: react,
        useState: () => [state.shift(), () => {}],
      };
      if (name === "@/lib/expense-report-export") return helpers;
      if (name === "@/hooks/use-lang") return { useLang: hook };
      if (name === "@/hooks/use-permissions") return { usePermissions: () => ({ can: () => true }) };
      if (name === "@/hooks/use-store") return { useStoreContext: () => ({ currentStoreId: 1, stores: [] }) };
      if (name === "@workspace/erp-api-client-react") return new Proxy({}, {
        get: (_, key) => () => key === "useGetExpenseReportDetails" ? query : {},
      });
      return componentModule;
    },
    window: {
      open: () => popupBlocked ? null : printWindow,
      alert: (message) => { captured.alert = message; },
      setTimeout: (callback) => callback(),
    },
    document: {
      createElement: () => ({
        set href(value) { captured.href = value; },
        set download(value) { captured.filename = value; },
        click: () => { captured.downloaded = true; },
        remove: () => { captured.removed = true; },
      }),
      body: { appendChild: () => {} },
    },
    URL: {
      createObjectURL: (blob) => { captured.blob = blob; return "blob:expenses"; },
      revokeObjectURL: (url) => { captured.revoked = url; },
    },
    Blob,
  });
  const tree = component.default();
  const nodes = [];
  const walk = (node) => {
    if (Array.isArray(node)) return node.forEach(walk);
    if (node && typeof node === "object") {
      nodes.push(node);
      walk(node.props?.children);
    }
  };
  walk(tree);
  const buttons = nodes.filter((node) => node.type === "Button");
  return { captured, printWindow, buttons };
}

test("the dialog CSV button downloads the displayed data and releases the blob URL", async () => {
  const { buttons, captured } = reportHarness();
  const download = buttons.find((button) => button.props.onClick.name === "downloadExpenses");
  assert.ok(download && !download.props.disabled);
  download.props.onClick();
  assert.equal(captured.filename, "expenses-2026-10-03-2026-10-19-fr.csv");
  assert.equal(captured.blob.type, "text/csv;charset=utf-8;");
  assert.equal(captured.downloaded, true);
  assert.equal(captured.removed, true);
  assert.equal(captured.revoked, "blob:expenses");
  assert.deepEqual([...Buffer.from(await captured.blob.arrayBuffer()).subarray(0, 3)], [239, 187, 191]);
});

test("the print button opens an isolated complete document and handles blocked popups explicitly", () => {
  const normal = reportHarness();
  normal.buttons.find((button) => button.props.onClick.name === "printExpenses").props.onClick();
  assert.equal(normal.printWindow.opener, null);
  assert.equal(normal.captured.opened, true);
  assert.equal(normal.captured.closed, true);
  assert.ok(normal.captured.html.includes(options.from) && normal.captured.html.includes(options.to));
  const blocked = reportHarness(undefined, true);
  blocked.buttons.find((button) => button.props.onClick.name === "printExpenses").props.onClick();
  assert.ok(blocked.captured.alert.includes("fenêtres contextuelles"));
  assert.equal(blocked.captured.html, undefined);
});

test("exports are disabled while loading, on errors or without data, but allow an empty successful report", () => {
  for (const query of [
    { data: undefined, isLoading: true, isError: false },
    { data: undefined, isLoading: false, isError: false },
    { data: options.items, isLoading: false, isError: true },
  ]) {
    const { buttons, captured } = reportHarness(query);
    for (const button of buttons) {
      assert.equal(button.props.disabled, true);
      button.props.onClick();
    }
    assert.equal(captured.downloaded, undefined);
    assert.equal(captured.html, undefined);
  }
  assert.ok(reportHarness({ data: [], isLoading: false, isError: false }).buttons.every((button) => !button.props.disabled));
});
