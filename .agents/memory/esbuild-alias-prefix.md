---
name: esbuild alias prefix matching
description: esbuild alias option does prefix matching, not exact matching — use onResolve plugin for exact module name redirects
---

## Rule
esbuild's `alias` config option treats keys as **path component prefixes**. `alias: { foo: 'bar' }` remaps `foo` → `bar` AND `foo/sub` → `bar/sub`. This breaks cases where you want to remap an exact package name but preserve its sub-paths.

**Why:** Discovered when `alias: { zod: 'zod/v4' }` remapped `zod/v4` imports (in drizzle-zod) to `zod/v4/v4`, causing build failures.

**How to apply:** For exact-module aliasing, use an esbuild plugin:
```js
const exactAliasPlugin = {
  name: 'exact-alias',
  setup(build) {
    build.onResolve({ filter: /^zod$/ }, async (args) => {
      return build.resolve('zod/v4', { resolveDir: args.resolveDir, kind: args.kind });
    });
  },
};
```
