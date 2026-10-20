const { readFileSync } = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");
const React = require("react");

function loadTypeScript(relativePath, imports = {}) {
  const file = path.resolve(__dirname, relativePath);
  const compiled = ts.transpileModule(readFileSync(file, "utf8"), {
    compilerOptions: {
      jsx: ts.JsxEmit.React,
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
    },
  }).outputText;
  const context = vm.createContext({
    exports: {},
    require(name) {
      if (Object.hasOwn(imports, name)) return imports[name];
      throw new Error(`Unexpected import in ${file}: ${name}`);
    },
  });
  vm.runInContext(compiled, context, { filename: file });
  return context.exports;
}

const dictionary = loadTypeScript("../src/lib/en-translations.ts");
const language = loadTypeScript("../src/hooks/use-lang.tsx", {
  react: React,
  "@/lib/en-translations": dictionary,
});

function mockUseLang(lang) {
  return Object.assign(() => ({ lang }), {
    translate: language.useLang.translate,
    locale: language.useLang.locale,
  });
}

module.exports = { loadTypeScript, mockUseLang, language, dictionary };
