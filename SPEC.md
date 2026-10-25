# taflog v1 — Specification

A minimalist, local-first CLI time tracker. Vocabulary follows
[GLOSSARY.md](./GLOSSARY.md) exactly. Decisions are recorded in
[`docs/adr/`](./docs/adr). The implementation order is in [PLAN.md](./PLAN.md).

## 1. Intent

Track the time you spend on tasks at work: start a timer, stop it, correct the
record when you forget, and read back where the hours went. Data stays on the
machine, in a plain append-only file another tool or agent can read. No daemon,
no network, no runtime dependencies.

Guarantees:

- **Local-first.** Nothing leaves the machine.
- **Dependency-free at runtime.** Plain Node.js.
- **Scriptable.** Sane exit codes and a stable, versioned `--json` output.
- **Honest.** Corrections adjust totals; they never fabricate intervals.

## 2. Stack and packaging

- TypeScript 7.x (native compiler), `strict` + `erasableSyntaxOnly`, compiled by `tsc` to `dist/`.
- Node `>= 20` to run the installed CLI; Node `>= 24` for the no-build dev loop.
- Zero runtime dependencies. Dev: `typescript`, `@types/node`.
- `bin: { "taflog": "dist/main.js" }`, `files: ["dist"]`, built from `prepare`.
- Package name `taflog`, MIT. See ADR-0003.

## 3. Architecture

Hexagonal, hand-wired composition root. See ADR-0005.

```
src/
  domain/        pure: Event/Entry types, deriveEntries, deriveTimer,
                 aggregations, duration and date formatting
  ports/         Clock { now() }, EventLog { append, readAll, readRaw }
  application/   one use case per command: StartTask, StopTask, SwitchTask,
                 ShowStatus, AddAdjustment, SubAdjustment, RemoveEntry,
                 QueryLog, BuildReport
  adapters/
    in/cli/      arg parsing, dispatch, terminal and JSON presenters
    out/clock/   SystemClock
    out/store/   JsonlEventLog
    out/config/  config resolver
  main.ts        composition root
```

Dependency rule: `domain` imports nothing project-local; `application` imports
`domain` + `ports`; `adapters/out/**` implement `ports`; `adapters/in/cli/**`
imports `application` (+ `domain` for display helpers) but never `ports` or
`adapters/out/**`; `main.ts` is the only module that imports both sides.

`adapters/in/cli/` is the **driving adapter** — the analogue of picava's `ui/`.
It turns `argv` into use-case calls and use-case results into terminal or JSON
output. Keeping it out of `application/` means the core never knows
`process.argv`, ANSI, or exit codes, so use cases stay testable with fakes and
can be driven by another adapter (an agent tool, a library API) later. Use
cases return plain data; the CLI renders it, so colour and JSON never cross a
port. The driving/driven split is ADR-0006.

## 4. Data model

### 4.1 Events

The Log is one JSON object per line, each carrying its own schema version.

```
{v,id,t:"start",  at, project, description?}
{v,id,t:"stop",   at, entry:<openId>, description?}
{v,id,t:"switch", at, from:<openId>, project, description?}
{v,id,t:"adjust", at, date, project, delta, note?}
{v,id,t:"delete", at, entry:<id>}
```

- `v` — schema version, integer, `1`.
- `id` — Event identity (see §4.4).
- `at` — ISO-8601 UTC instant of the event.
- `entry` / `from` — the id of the Entry being closed or amended.
- `date` — local calendar date (`YYYY-MM-DD`) an Adjustment counts toward.
- `delta` — signed duration in **seconds** (positive = `add`, negative = `sub`).

### 4.2 Derived views

- **Entry**: opened by a `start` or `switch`, closed by the matching `stop` or
  the next `switch` (which closes `from` and opens itself). `entry.start` is the
  opening event's `at`; `entry.end` is the closing event's `at`.
- **Timer**: the single open Entry, if any. There is at most one.
- **Adjustment**: derived from an `adjust` event. Not an Entry.
- **delete**: tombstones the referenced Entry or Adjustment; it disappears from
  every view. Tombstones are append-only, never removed.

Replay is deterministic: events are applied in file order; an `amend` does not
exist (ADR-0004).

### 4.3 Entry fields

```
Entry      = { id, project, description, start, end }
Adjustment = { id, project, date, delta, note }
```

An Entry's `id` is the id of the `start`/`switch` that opened it.

### 4.4 Identity

Entry and Adjustment ids are 8-character lowercase Crockford-base32 strings
derived from 40 bits of `crypto.randomBytes` (~1.1 × 10¹² values). `log --ids`
shows them; `rm` accepts a full id or an unambiguous prefix.

## 5. Persistence

- **Location**: per-user data directory (ADR-0002):
  `%APPDATA%\taflog\events.ndjson`,
  `~/Library/Application Support/taflog/events.ndjson`, or
  `${XDG_DATA_HOME:-~/.local/share}/taflog/events.ndjson`.
- **Override**: `--dir` > `TAFLOG_DIR` > config `dir` > default.
- **Write**: exactly one `appendFile` of `JSON.stringify(event) + "\n"`.
- **Concurrency**: no lock in v1; independent single-line appends survive and
  order does not matter to the reducer.
- **Corruption**: reads skip blank/unparsable lines, count them, and warn on
  stderr (`warning: skipped N unreadable lines`). `--strict` fails instead.
  `export` streams raw bytes and never parses, so nothing is unrecoverable.
- **Growth**: append-only forever in v1; yearly rotation and `compact` are
  deferred (PLAN).
- **Permissions**: the data file is created with owner-only access where the
  platform allows it.

## 6. Time

- **Storage**: UTC instants (`2025-10-23T13:05:00.000Z`).
- **Display**: rendered in the machine's local timezone (`TZ` respected).
- **Day boundary**: local midnight.
- **Week**: begins on `weekStart` (default `monday`).
- **Midnight-spanning Entry**: one Entry in `log`; a Report splits its duration
  across the local days it crosses.
- **Rounding**: none is stored. Durations render to the minute (`2h05m`);
  seconds appear only in `--json` (which is always seconds) or with `--seconds`.
- **Forgotten Timer**: an open Entry older than `maxTimerHours` (default `8`)
  is reported by `status`; `stop`/`switch` refuse to close it unless `--force`.

## 7. Configuration

Versioned JSON, every key optional, at the fixed per-OS config path (ADR-0002).
Overridable by `TAFLOG_CONFIG`.

| Key | Values | Default | Meaning |
|-----|--------|---------|---------|
| `version` | `1` | `1` | Schema version |
| `dir` | path | per-OS data dir | Where `events.ndjson` lives |
| `weekStart` | `monday` \| `sunday` | `monday` | First day of a Report week |
| `maxTimerHours` | positive number | `8` | Forgotten-Timer threshold |
| `color` | `auto` \| `always` \| `never` | `auto` | Colour policy |
| `icons` | `auto` \| `nerd` \| `ascii` | `auto` | Glyph profile (§9.4) |

Precedence for every key: `--flag` > env (`TAFLOG_DIR`, `TAFLOG_ICONS`) >
config file > default. Unknown keys and invalid values are usage errors (exit
2). `taflog config` prints the effective values **with their source**;
`taflog config <key>` prints one; `taflog set <key> <value>` validates and
merge-writes. For `--json`, `taflog config` emits
`{version:1, config:{<key>:{value, source}}}` and `taflog config <key>` emits
`{version:1, key, value, source}`; a source is one of `flag`, `env`, `file`,
`default`.

## 8. CLI

### 8.1 Commands

| Command | Purpose |
|---------|---------|
| `start <project> [description]` | Open a Timer |
| `stop [description]` | Close the Timer, optionally setting its Description |
| `switch <project> [description]` | Close and open atomically |
| `status` | Current snapshot; also the default with no arguments |
| `log [filters]` | List Entries and Adjustments |
| `report [filters]` | Aggregate Timed and Adjusted time |
| `add <project> <duration> [--date D] [--note N]` | Positive Adjustment |
| `sub <project> <duration> [--date D] [--note N]` | Negative Adjustment |
| `rm [<id>]` | Tombstone an Entry/Adjustment; no id removes the most recent |
| `config [<key>]` | Show effective configuration |
| `set <key> <value>` | Write configuration |
| `export` | Raw Log to stdout (byte-for-byte) |
| `help` / `--help`, `--version` | Usage and version |

### 8.2 Global flags

`--dir <path>`, `--json`, `--no-color`, `--icons auto|nerd|ascii`,
`--strict`, `-h/--help`, `-V/--version`. `--json` works on every read command
in either position (`taflog --json status`, `taflog status --json`).

### 8.3 Filters

- `log`: `--today`, `--week`, `--month`, `--project <p>`, `--from <date>`,
  `--to <date>`, `--limit <n>`, `--ids`.
- `report`: `--today`, `--week`, `--month`, `--project <p>`, `--from <date>`,
  `--to <date>`, `--by project|day`, `--details`.
- Defaults: `log` = today; `report` = this week.

### 8.4 Exit codes

`0` success · `1` runtime error · `2` usage error. Errors go to stderr prefixed
`taflog:`. Unknown command or flag is exit 2.

### 8.5 Parsing

- **Durations**: `90m`, `1h`, `1h30m`, `1.5h`; a bare number means minutes
  (`50` → `50m`). Anything else is a usage error.
- **Dates** (`--date`, `--from`, `--to`): `YYYY-MM-DD`, `today`, `yesterday`,
  and weekday names (`mon`…`sun`) within the current week.
- **Projects**: stored verbatim (trimmed); filtering is case-insensitive.
- **Descriptions**: the trailing argument(s), stored verbatim.

## 9. Output

### 9.1 `status`

```console
$ taflog status
● acme — working on the new parser
  running 24m (since 09:12) · today 2h14m

$ taflog status
○ idle · last acme 1h06m (ended 10:42) · today 1h30m
```

### 9.2 `log`

Default today, in chronological order; Adjustments follow the timed rows.
Adjustments carry no time range.

```console
$ taflog log
Today · Thu 2025-10-23 · 2h14m
  09:12 → 09:36    24m   acme   working on the new parser
  09:36 → 10:42   1h06m  acme   review
                   +50m  acme   adjustment · forgot to start
                   -30m  beta   adjustment
```

### 9.3 `report`

Default is the project summary; `--by day` is the grid; `--details` adds
Description sub-rows to the grid.

```console
$ taflog report
Week 43 · Mon 20 → Sun 26 Oct 2025 · 19h30m
  acme   16h45m    timed 17h15m · adjusted −30m
  beta    2h45m    timed  2h45m

$ taflog report --by day
             Mon     Tue     Wed     Thu     Fri    Total
  acme      2h00    3h30    4h00    3h15    4h00   16h45
  beta      0h30    0h15    1h00    0h30    0h30    2h45
  ──────────────────────────────────────────────────────
  Total     2h30    3h45    5h00    3h45    4h30   19h30

$ taflog report --details
Week 43 · Mon 20 → Sun 26 Oct 2025 · 19h30m
                Mon     Tue     Wed     Thu     Fri    Total
  acme         2h00    3h30    4h00    3h15    4h00   16h45
    new parser 1h00    1h30    2h00    1h45    2h15    8h30
    code review0h30    2h00    1h30    1h30    1h45    7h15
    standup    0h30            0h30                   1h00
  beta         0h30    0h15    1h00    0h30    0h30    2h45
    emails     0h30    0h15    1h00    0h30    0h30    2h45
  ───────────────────────────────────────────────────────────
  Total        2h30    3h45    5h00    3h45    4h30   19h30
```

`--details` rules: days are columns; a Description with no time on a day renders
**blank** (spaces), never `0h00`; Description rows sort by week total desc;
untitled time buckets as `(no description)`; a Project row equals **the sum of
its sub-rows**, so Adjustments appear as their own `adjustments` sub-row (only
when present); `Total` sums Project rows. Columns are the five weekdays in
`weekStart` order, with Saturday/Sunday appended only when that week has weekend
time.

### 9.4 Glyphs and colour

| Meaning | `nerd` | `auto` | `ascii` |
|---------|--------|--------|---------|
| running | `󰔛` | `●` | `*` |
| idle | `󰅶` | `○` | `o` |
| project | `󰉋` | `·` | `-` |
| adjustment +/− | `󰐕` / `󰍴` | `+` / `−` | `+` / `-` |
| date/week header | `󰃭` | `·` | `-` |

Colour is disabled by `--no-color`, `NO_COLOR`, `color: "never"`, or a
non-TTY. Project names are accented, durations right-aligned, metadata dim,
running green, `+` yellow, `−` red. Descriptions truncate with `…` to terminal
width and never wrap. Empty state prints a one-line hint.

### 9.5 `--json` (version 1)

Durations are always seconds; timestamps ISO-8601; camelCase; one object, no
pretty-printing unless `--pretty`; never coloured.

```jsonc
// taflog status --json
{ "version": 1, "now": "2025-10-23T13:05:00.000Z",
  "running": { "id": "7f3a2c19", "project": "acme", "description": "…",
               "start": "…", "elapsedSeconds": 1440 },   // or null
  "today": { "timedSeconds": 8040, "adjustedSeconds": 3000, "totalSeconds": 11040 } }

// taflog log --json
{ "version": 1, "query": { "from": "2025-10-23", "to": "2025-10-23", "project": null },
  "entries": [
    { "kind": "timed", "id": "…", "project": "acme", "description": "…",
      "start": "…", "end": "…", "durationSeconds": 1440 },
    { "kind": "adjust", "id": "…", "date": "2025-10-23", "project": "acme",
      "deltaSeconds": 3000, "note": "forgot to start" } ],
  "totals": { "timedSeconds": 8040, "adjustedSeconds": 3000, "totalSeconds": 11040 } }

// taflog report --json  (always contains both byProject and byDay)
{ "version": 1, "range": { "from": "2025-10-20", "to": "2025-10-26", "weekStart": "monday" },
  "byProject": [ { "project": "acme", "timedSeconds": 62100,
                   "adjustedSeconds": -1800, "totalSeconds": 60300,
                   "details": [ { "description": "new parser", "totalSeconds": 30600,
                                  "byDay": [ { "date": "2025-10-20", "timedSeconds": 3600 } ] } ] } ],
  "byDay": [ { "date": "2025-10-20", "totalSeconds": 9000,
               "projects": [ { "project": "acme", "totalSeconds": 7200 } ] } ] }
```

### 9.6 `export`

Raw NDJSON, one event object per line, exactly as stored, never wrapped and
never parsed. This is the machine API for the Log's source of truth.

## 10. Running-Timer semantics and edge cases

| Situation | Behaviour |
|-----------|-----------|
| `start` while idle | Opens a Timer |
| `start` while running | Error, exit 1: `already tracking "<project>" since HH:MM — use switch or stop` |
| `switch` while idle | Opens a Timer (same as `start`) |
| `switch` while running | Closes the open Entry and opens the new one at the same instant |
| `stop` while idle | Error, exit 1: `nothing is running` |
| `stop [description]` | Closes the Timer, optionally setting its Description |
| `add` / `sub` while running | Allowed; Adjustments are independent of the Timer |
| `sub` driving a day negative | Allowed; rendered negative, never clamped |
| `rm` on the open Timer | Refused: `that entry is running — stop it first` |
| Crash / orphan Timer | Never auto-closed; `status` shows it; over-age `stop`/`switch` require `--force` |

## 11. Testing

- Runner: `node --test`.
- Fakes: `FakeClock`, `InMemoryEventLog`.
- Domain: pure `derive*` and aggregation functions with fixtures.
- Adapters: `JsonlEventLog` (append/read/tolerant read), config resolver.
- Application: each use case against fakes; state-transition table covered.
- CLI: one end-to-end test drives the real entry point with `TAFLOG_DIR` and
  `TAFLOG_CONFIG` pointed at temp dirs.
- Rendering: golden tests for every specimen in §9; `--json` shape snapshots.

## 12. Non-goals and deferred

Yearly log rotation, `compact`, tags, field-level `edit`, natural-language
dates, `--from`/`--to` month names, sync/multi-device, shell completions,
`init` wizard, localization, and any Windows-specific incantations beyond the
per-OS directories in §5. Command surface is English-only in v1.
