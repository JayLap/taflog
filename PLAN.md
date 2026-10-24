# taflog v1 — Roadmap

The design is settled in [SPEC.md](./SPEC.md); decisions live in
[`docs/adr/`](./docs/adr). This file sequences the build. Each phase ends with a
definition of done (DoD); later phases must not invalidate earlier ones.

## Guiding constraints

- TypeScript → `tsc` → `dist/`; **zero runtime dependencies**; Node `>= 20` to
  install, Node `>= 24` for the no-build dev loop (ADR-0003).
- `domain` ← `ports` ← `application`/`adapters`; `cli`/`main.ts` compose
  (ADR-0005). Use cases return data; the CLI renders it.
- `events.ndjson` is the source of truth; every view is derived (ADR-0001).

## Phase 0 — Scaffold, docs, packaging

**Ships**
- Rewritten `README.md`, `GLOSSARY.md`, `SPEC.md`, `PLAN.md`, ADRs 0001–0005.
- `package.json`: `bin: dist/main.js`, `files: ["dist"]`, `engines >=20`, scripts
  `build`/`typecheck`/`test`/`start`/`prepare`, devDeps `typescript`,
  `@types/node`.
- `tsconfig.json` (`strict`, `erasableSyntaxOnly`, `module: NodeNext`).
- `src/{domain,ports,application}` and
  `src/adapters/{in/cli,out/clock,out/store,out/config}`, `tests/`; `.gitignore`
  cleanup (drop `.taflog/`, keep `dist/`).

**DoD**
- `npm run build`, `npm run typecheck`, `npm test` pass.
- `node dist/main.js --help` prints usage.
- `npm pack` tarball contains only `dist/` + `package.json`.
- No document contradicts `package.json` or the README.

## Phase 1 — Vertical slice (`start` / `stop` / `status`)

**Ships**
- Domain: `Event`/`Entry` types, `deriveEntries`, `deriveTimer`, duration
  formatting.
- Ports: `Clock { now() }`, `EventLog { append, readAll }`.
- Adapters: `SystemClock`, `JsonlEventLog` (single-line append, tolerant read).
- Application: `StartTask`, `StopTask`, `ShowStatus`.
- CLI: argument parsing, dispatch, `--dir`, `--json`, `status` presenter.

**DoD**
- A running Timer persists across process invocations.
- Each write is exactly one line; corrupt lines are skipped with a warning;
  `--strict` fails.
- Reducer and state-transition tests green.
- One end-to-end test runs the real CLI against a temp `TAFLOG_DIR`.

## Phase 2 — Timer UX (`switch` and invalid states)

**Ships**
- `SwitchTask` (single atomic event).
- `start` while running → exit 1; `stop` while idle → exit 1; `switch` while
  idle behaves like `start`.
- `stop [description]`.
- Forgotten-Timer gate: `maxTimerHours` (default 8), `--force`.

**DoD**
- Every row of SPEC §10's state table has a test.
- An over-age open Entry refuses to close without `--force`.

## Phase 3 — Corrections (`add` / `sub` / `rm`)

**Ships**
- `adjust` event; `AddAdjustment`, `SubAdjustment`, `RemoveEntry` (tombstones).
- Duration parser (`90m`, `1h30m`, `1.5h`, bare `50` = minutes).
- Date parser (`YYYY-MM-DD`, `today`, `yesterday`, weekday names).
- `--date`, `--note`; negative totals allowed; `rm` on the open Timer refused;
  bare `rm` removes the most recent Entry/Adjustment.
- Identity generation (8-char Crockford base32) and prefix resolution.

**DoD**
- Corrections covered by use-case tests.
- `log`/`report` reconcile `timed + adjusted = total`.
- Bad duration/date input → exit 2.

## Phase 4 — Read commands (`log` / `report`) and output

**Ships**
- `QueryLog`, `BuildReport`.
- Terminal presenters: `status`, `log`, report summary, `--by day` grid,
  `--details` grid, `--ids`, filters.
- Colour/TTY/`NO_COLOR`; `icons` profiles (`auto`/`nerd`/`ascii`); width-aware
  truncation; empty states.
- JSON presenters with frozen `version: 1`; `export` raw NDJSON.

**DoD**
- Every specimen in SPEC §9 reproduced by golden tests.
- `--json` snapshots locked; `export` round-trips through a JSONL parser.

## Phase 5 — Configuration

**Ships**
- Per-OS config resolver (`TAFLOG_CONFIG` override).
- Keys `dir`, `weekStart`, `maxTimerHours`, `color`, `icons`, `version`.
- `config` (effective values **with source**) and `set` (validate + merge).
- Strict precedence: `--flag` > env > config file > default.

**DoD**
- Precedence table tested for every key.
- `dir` from config relocates the Log.
- Unknown key or invalid value → exit 2; `config` prints sources.

## Phase 6 — Polish and publish

**Ships**
- Help/usage text, error and exit-code audit, ASCII/`nerd` fallback audit,
  finalized README, version `0.1.0`.

**DoD**
- `npm pack` → `npm install -g` into a temp prefix → `start`/`stop`/`status`/
  `report` run.
- README, SPEC, and CLI help agree.

## Test seams by phase

| Phase | Introduced |
|-------|-----------|
| 1 | `FakeClock`, `InMemoryEventLog`, pure reducer tests, CLI e2e via `TAFLOG_DIR` |
| 2 | State-transition table, forgotten-Timer fixtures |
| 3 | Duration/date parser tables, adjustment reconciliation |
| 4 | Golden renderings, `--json` snapshots |
| 5 | Config resolver + precedence table |

## Explicitly deferred (post-v1)

Yearly Log rotation, `compact`, tags, field-level `edit`, natural-language
dates, `--from`/`--to` month names, sync/multi-device, shell completions,
`init` wizard, localization.
