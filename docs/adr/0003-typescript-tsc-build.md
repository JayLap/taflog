# TypeScript compiled with tsc; zero runtime dependencies; Node >= 20 to install

**Status:** Accepted (2025-10-23)

## Context

We want TypeScript's types across the domain/ports/application seams, the
friction-free `npm install -g taflog`, and the README's "dependency-free"
promise. Two facts were verified on Node v24.19.0:

- A `.ts` entry point runs directly (type-stripping, shebang included), but
- type-stripping is refused for any file under `node_modules`, so a raw `.ts`
  bin fails after `npm install -g` with
  `ERR_UNSUPPORTED_NODE_MODULES_TYPE_STRIPPING`.

## Decision

Source is TypeScript under `src/`. `tsc` compiles it to `dist/`; `package.json`
declares `bin: { "taflog": "dist/main.js" }`, `files: ["dist"]`, and runs the
build from `prepare` so `npm pack`/`npm publish` always ship compiled output.
There are **no runtime dependencies**. Dev dependencies are `typescript` and
`@types/node`. `engines.node` is `>= 20` for consumers; contributors who want
the no-build loop (`node src/main.ts`) use Node `>= 24`.

## Considered Options

- **Plain JavaScript + JSDoc.** Viable and build-free, but gives up TypeScript
  syntax at the seams where this design leans on it most.
- **Ship raw `.ts`.** Rejected: verified broken for global installs.
- **Bundle with `tsup`/esbuild.** Rejected: an extra tool and config for no
  benefit over plain `tsc` at this size.
- **A runtime loader (`tsx`/`ts-node`/`jiti`).** Rejected: a runtime dependency.

## Consequences

- `tsconfig.json` sets `erasableSyntaxOnly` so source stays compatible with
  Node's stripper; no `enum`, `namespace`, or parameter properties.
- Relative imports in source carry explicit `.ts` extensions. Combined with
  `allowImportingTsExtensions` + `rewriteRelativeImportExtensions`, `tsc` emits
  `.js` specifiers, so the same source runs under Node's stripper
  (`node src/main.ts`) and as compiled output (`dist/`). Verified on
  TypeScript 7.0.2 (the native compiler); the project tracks the 7.x line.
- The published tarball contains only `dist/` and `package.json`.
- Release must build before packing; the smoke test is `npm pack` →
  `npm install -g` into a temp prefix → run the CLI (verified working).
