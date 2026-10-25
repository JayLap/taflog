# taflog

> Minimalist CLI time tracker for your job. *Taf* is French slang for work.

`taflog` tracks the time you spend on tasks at work: start a timer, stop it,
correct the record when you forget, and read back where the hours went.

- **Local-first** — your data stays on your machine, in a plain file.
- **Dependency-free** — plain Node.js at runtime; no daemon, no network.
- **Scriptable** — sane exit codes and a stable, versioned `--json` output.
- **Honest** — corrections adjust totals; they never fabricate intervals.

## Status

**v0.1.0 — feature complete.** `start`, `stop`, and `switch` manage the running
Timer; `status` reports it. `add`, `sub`, and `rm` correct the record with
dated, signed Adjustments and append-only tombstones. `log` and `report` read
it back: `log` lists Entries and Adjustments, and `report` summarizes by Project
or by day (`--by day`, `--details`), with `--today`, `--week`, `--month`,
`--project`, and `--from`/`--to` filters. `--json` has a frozen `version: 1`
shape, `--ids` shows identities, and `export` dumps the raw Log byte-for-byte.
Durations parse `90m`, `1h30m`, `1.5h`, and bare minutes; dates accept
`YYYY-MM-DD`, `today`, `yesterday`, and weekday names. Persistence is
append-only NDJSON with `--dir`, corrupt-line warnings, and `--strict`. `start`
while running and `stop` while idle are refused, and a forgotten Timer
(`maxTimerHours`, default 8) needs `--force` to close. Colour and glyphs follow
`NO_COLOR`, `--icons`, and the terminal. `config` and `set` read and write a
versioned per-OS config file; every key resolves as `--flag` > env > config file
> default, and `config` shows each value's source.

The design is settled in [`SPEC.md`](./SPEC.md), decisions are recorded in
[`docs/adr/`](./docs/adr), vocabulary follows [`GLOSSARY.md`](./GLOSSARY.md),
and [`PLAN.md`](./PLAN.md) tracks the build. `npm test` includes a
`npm pack` → `npm install -g` smoke test that runs the installed CLI.

## Install

```console
$ npm install -g @jlap/taflog
```

The package is scoped but the executable is still `taflog`. Requires Node.js
`>= 20`.

## Usage

```console
$ taflog start <project> [description]   # start a timer
$ taflog stop [description]             # stop the running timer
$ taflog switch <project> [description] # stop and start in one step
$ taflog status                         # what's running, and today's total
$ taflog log [filters]                  # entries and adjustments
$ taflog report [filters]               # time by project or by day
$ taflog add <project> <duration>       # add time (forgot to start?)
$ taflog sub <project> <duration>       # remove time
$ taflog rm [<id>]                      # remove an entry or adjustment
$ taflog config [<key>]                 # show effective configuration
$ taflog set <key> <value>              # change a preference
$ taflog export                         # raw event log for other tools
$ taflog help                           # usage and version
```

A session might look like:

```console
$ taflog start acme "new parser"
$ taflog switch beta "answering emails"
$ taflog stop
$ taflog report --details
```

Run `taflog` with no arguments for `status`; `--help` lists every command and
flag. Add `--json` to any read command for machine output.

## Data

Tracked time lives in an append-only NDJSON log; preferences live in a versioned
JSON file. Both are per-user, and their locations (and the override precedence)
are documented in [SPEC §5](./SPEC.md) and [SPEC §7](./SPEC.md). Nothing is sent
anywhere.

## Configuration

Every key is optional. See [SPEC §7](./SPEC.md) for the full table.

| Key | Default | Meaning |
|-----|---------|---------|
| `dir` | per-OS data dir | Where the log lives |
| `weekStart` | `monday` | First day of a report week |
| `maxTimerHours` | `8` | Forgotten-timer threshold |
| `color` | `auto` | Colour policy |
| `icons` | `auto` | Glyph profile (`auto`/`nerd`/`ascii`) |

```console
$ taflog set dir ~/logs/taflog
$ taflog set icons nerd
$ taflog config
```

## Development

Once dependencies are installed, these work:

```console
$ npm install
$ npm run build      # tsc -> dist/
$ npm test           # node --test
$ npm start -- --help
```

Contributors who want the no-build loop (`node src/main.ts`) need Node `>= 24`;
the published package supports Node `>= 20`.

## Releasing

Releases are published from CI by `.github/workflows/release.yml`. Bump
`version` in `package.json`, then push a matching tag:

```console
$ git tag v0.1.0
$ git push origin v0.1.0
```

The workflow checks that the tag matches `package.json`, runs `npm test` (also
gated locally by `prepublishOnly`), and publishes `@jlap/taflog` with a signed
provenance statement. Add an `NPM_TOKEN` repository secret (a granular token
with read/write access to the `@jlap` scope) for authentication; once the
package exists you can switch to
[npm trusted publishing](https://docs.npmjs.com/generating-provenance-statements)
and drop the token. `npm publish --dry-run` reproduces the release locally
without uploading.

## License

[MIT](./LICENSE)
