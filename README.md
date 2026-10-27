# taflog

> Minimalist, local-first CLI time tracker for work. *Taf* is French slang for work.

`taflog` records the time you spend on tasks: start a timer, stop it, correct
the record when you forget, and read back where the hours went.

- **Local-first** — your data stays on your machine, in a plain append-only file.
- **Dependency-free** — plain Node.js at runtime; no daemon, no network.
- **Scriptable** — sane exit codes and a stable, versioned `--json` output.
- **Honest** — corrections adjust totals; they never fabricate intervals.

## Install

```console
$ npm install -g @jlap/taflog
```

Requires Node.js `>= 20`. The package is scoped, but the command is `taflog`.

## Quick start

```console
$ taflog start acme "new parser"
$ taflog switch beta "answering emails"
$ taflog stop
$ taflog report --details
```

Running `taflog` with no arguments prints `status`. `taflog --help` lists every
command and flag.

## Commands

| Command | Purpose |
|---------|---------|
| `start <project> [description]` | Open a timer |
| `stop [description]` | Close the running timer |
| `switch <project> [description]` | Close and open a new timer in one step |
| `status` | What's running, plus today's total |
| `log [filters]` | List entries and adjustments |
| `report [filters]` | Time by project or by day |
| `add <project> <duration> [--date D] [--note N]` | Add time you forgot to track |
| `sub <project> <duration> [--date D] [--note N]` | Remove time |
| `rm [<id>]` | Remove an entry or adjustment; no id removes the most recent |
| `config [<key>]` | Show effective configuration |
| `set <key> <value>` | Change a preference |
| `export` | Dump the raw event log for other tools |
| `help`, `--help`, `--version` | Usage and version |

### Filters

`log` and `report` accept `--today`, `--week`, `--month`, `--project <p>`,
`--from <date>`, and `--to <date>`. `log` defaults to today and adds
`--limit <n>` and `--ids`; `report` defaults to this week and adds
`--by project|day` and `--details`.

Durations parse `90m`, `1h`, `1h30m`, `1.5h`, and a bare number of minutes
(`50` → `50m`). Dates accept `YYYY-MM-DD`, `today`, `yesterday`, and weekday
names (`mon`…`sun`) within the current week.

### Interactive commands

Running `taflog start`, `taflog switch`, `taflog add`, or `taflog sub` with no
arguments in an interactive terminal prompts for the required values:

- `start` and `switch`: Project, then an optional Description.
- `add` and `sub`: Project, then Duration. `--date` and `--note` still work.

Press Tab while typing to cycle through Project and Description candidates from
the Log. Duration is freeform and has no completion candidates:

```console
$ taflog start
Project: ac<Tab>
Description (optional): new p<Tab>

$ taflog switch
Project: be<Tab>
Description (optional): review<Tab>

$ taflog add
Project: ac<Tab>
Duration: 30m
```

Outside a terminal (for example in a script or agent), these commands still
require their operands and exit with a usage error. Pressing Ctrl+C cancels the
prompt without writing an event.

### Output

Every read command accepts `--json` (add `--pretty` to indent it) and emits a
stable, versioned `version: 1` shape. Timestamps are ISO-8601 and durations are
seconds, so `jq` and scripts can rely on it. `export` writes the raw NDJSON log
byte-for-byte, never parsed.

## Configuration

Every key is optional and stored in a versioned JSON config file.

| Key | Values | Default | Meaning |
|-----|--------|---------|---------|
| `version` | `1` | `1` | Config schema version |
| `dir` | path | per-OS data dir | Where the log lives |
| `weekStart` | `monday` \| `sunday` | `monday` | First day of a report week |
| `maxTimerHours` | positive number | `8` | Forgotten-timer threshold |
| `color` | `auto` \| `always` \| `never` | `auto` | Colour policy |
| `icons` | `auto` \| `nerd` \| `ascii` | `auto` | Glyph profile |

```console
$ taflog set dir ~/logs/taflog
$ taflog set icons nerd
$ taflog config
```

Each key resolves as `--flag` > environment (`TAFLOG_DIR`, `TAFLOG_CONFIG`,
`TAFLOG_ICONS`) > config file > default. `taflog config` shows each effective
value and where it came from.

## Data

Tracked time lives in an append-only NDJSON file, one event per line. It is
never rewritten or sent anywhere; `export` dumps it and `--strict` fails the
read instead of skipping an unreadable line.

| OS | Log file | Config file |
|----|----------|-------------|
| Windows | `%APPDATA%\taflog\events.ndjson` | `%APPDATA%\taflog\config.json` |
| macOS | `~/Library/Application Support/taflog/events.ndjson` | `~/Library/Application Support/taflog/config.json` |
| Linux/other | `${XDG_DATA_HOME:-~/.local/share}/taflog/events.ndjson` | `${XDG_CONFIG_HOME:-~/.config}/taflog/config.json` |

Relocate the log from the command line with `--dir`, the `TAFLOG_DIR`
environment variable, or the `dir` config key.

## Development

```console
$ npm install
$ npm run build      # tsc -> dist/
$ npm test           # node --test (includes a pack + global-install smoke test)
$ npm start -- --help
```

Contributors who want the no-build loop (`node src/main.ts`) need Node `>= 24`;
the published package supports Node `>= 20`.

## Releasing

Releases are built and staged from CI by
[`.github/workflows/release.yml`](./.github/workflows/release.yml) using
[npm trusted publishing](https://docs.npmjs.com/trusted-publishers). Bump
`version` in `package.json`, push a matching tag, and the workflow runs the
tests and stages `@jlap/taflog`; a maintainer approves it with 2FA before it
goes live. The full checklist is in [`docs/RELEASING.md`](./docs/RELEASING.md).

## Documentation

- [`docs/SPEC.md`](./docs/SPEC.md) — the implementation spec and source of truth.
- [`docs/GLOSSARY.md`](./docs/GLOSSARY.md) — the vocabulary used throughout.
- [`docs/adr/`](./docs/adr) — architecture decision records.

## License

[MIT](./LICENSE)
