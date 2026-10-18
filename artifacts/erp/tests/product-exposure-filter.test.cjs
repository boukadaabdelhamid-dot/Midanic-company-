const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { test } = require("node:test");
const ts = require("typescript");
const React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");

const source = readFileSync(path.join(__dirname, "../src/components/ProductExposureFilter.tsx"), "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: {
    jsx: ts.JsxEmit.React,
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2022,
    esModuleInterop: true,
  },
}).outputText;

function load(lang) {
  const context = vm.createContext({
    exports: {},
    require: (name) => {
      if (name === "react") return React;
      if (name === "@/hooks/use-lang") return { useLang: () => ({ lang }) };
      throw new Error(`Unexpected import: ${name}`);
    },
  });
  vm.runInContext(compiled, context);
  return context.exports.default;
}

for (const lang of ["fr", "ar"]) {
  for (const compact of [false, true]) {
    test(`three exposure choices render and send the API values (${lang}, compact=${compact})`, () => {
      const Filter = load(lang);
      const changes = [];
      for (const value of ["", "true", "false"]) {
        const element = Filter({ value, compact, onChange: (next) => changes.push(next) });
        const select = element.props.children.find((child) => child.type === "select");
        assert.equal(select.props.value, value);
        assert.deepEqual(select.props.children.map((option) => option.props.value), ["", "true", "false"]);
        assert.equal(element.props.children[0].props.htmlFor, select.props.id);
        select.props.onChange({ target: { value } });
        const html = renderToStaticMarkup(React.createElement(Filter, { value, compact, onChange: () => {} }));
        assert.ok(html.includes(`value="${value}" selected=""`));
        assert.ok(html.includes(lang === "fr" ? "Boutique en ligne" : "المتجر الإلكتروني"));
      }
      assert.deepEqual(changes, ["", "true", "false"]);
    });
  }
}

test("toolbar and column filters share state, server query and cache key", () => {
  const page = readFileSync(path.join(__dirname, "../src/pages/Products.tsx"), "utf8");
  assert.equal((page.match(/filterExposed: debouncedFilters\.exposed \|\| undefined/g) || []).length, 2);
  assert.equal((page.match(/value=\{columnFilters\.exposed\}/g) || []).length, 2);
  assert.equal((page.match(/setColumnFilter\("exposed", value\)/g) || []).length, 2);
  assert.ok(page.includes("setPage(1); }, [debouncedSearch, pageSize, debouncedFilters]"));
  assert.ok(page.includes("setSelected(new Set()); }, [page, debouncedSearch, debouncedFilters]"));
  assert.ok(page.includes("const clearColumnFilters = () => setColumnFilters({ ...EMPTY_FILTERS })"));
});

test("existing API translates displayed, hidden and all into the correct database conditions", () => {
  const api = readFileSync(path.join(__dirname, "../../erp-api-server/src/routes/products.ts"), "utf8");
  const ast = ts.createSourceFile("products.ts", api, ts.ScriptTarget.Latest, true);
  let exposureCondition;
  function visit(node) {
    if (ts.isIfStatement(node) && node.expression.getText(ast) === "filterExposed") {
      exposureCondition = node.getText(ast);
    }
    ts.forEachChild(node, visit);
  }
  visit(ast);
  assert.ok(exposureCondition, "API filter must exist");
  for (const [filterExposed, expected] of [
    ["", []],
    ["true", [["isExposed", true]]],
    ["false", [["isExposed", false]]],
  ]) {
    const conditions = [];
    vm.runInNewContext(exposureCondition, {
      filterExposed, conditions,
      schema: { productsTable: { isExposed: "isExposed" } },
      eq: (column, value) => [column, value],
    });
    assert.deepEqual(conditions, expected);
  }
});
