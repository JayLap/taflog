# AGENTS.md

Guidance for AI coding agents working in this repository.

## Read first

- [`docs/SPEC.md`](./docs/SPEC.md) — the implementation spec and source of
  truth: data model, CLI surface, output shapes, and edge cases.
- [`docs/GLOSSARY.md`](./docs/GLOSSARY.md) — required vocabulary. Use these
  words, in these senses, in code, comments, and docs.
- [`docs/adr/`](./docs/adr) — recorded architecture decisions. Do not
  contradict an accepted ADR; supersede it with a new one instead.

## Ground rules

- TypeScript compiled by `tsc` to `dist/`; zero runtime dependencies; Node
  `>= 20` for consumers (ADR-0003).
- Respect the dependency rule: `domain` ← `ports` ←
  `application`/`adapters`; `cli` and `main.ts` compose (ADR-0005, ADR-0006).
- `events.ndjson` is the source of truth; every view is derived (ADR-0001).
- Corrections are dated signed adjustments, never edited intervals (ADR-0004).
- Keep `README.md`, `docs/SPEC.md` §8, and `--help` in agreement.

## Before finishing

```console
$ npm run typecheck
$ npm test
```
