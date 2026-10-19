import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { build } from "esbuild";
import esbuildPluginPino from "esbuild-plugin-pino";

globalThis.require = createRequire(import.meta.url);
const root = path.dirname(fileURLToPath(import.meta.url));
const output = path.join(root, "dist/erp-owner-password.test.mjs");

await build({
  entryPoints: [path.join(root, "src/lib/erp-owner-password.test.ts")],
  outdir: path.join(root, "dist"),
  entryNames: "[name]",
  outExtension: { ".js": ".mjs" },
  bundle: true,
  platform: "node",
  format: "esm",
  banner: { js: 'import { createRequire } from "node:module"; const require = createRequire(import.meta.url);' },
  packages: "bundle",
  external: ["*.node", "pg-native", "@google/*"],
  plugins: [
    {
      name: "zod-v4-exact-alias",
      setup(bundle) {
        bundle.onResolve({ filter: /^zod$/ }, (args) =>
          bundle.resolve("zod/v4", { resolveDir: args.resolveDir, kind: args.kind }));
      },
    },
    esbuildPluginPino({ transports: ["pino-pretty"] }),
  ],
});

const result = spawnSync(process.execPath, ["--test", output], { stdio: "inherit" });
process.exit(result.status ?? 1);
