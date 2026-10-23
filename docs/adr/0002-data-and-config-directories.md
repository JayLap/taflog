# Data lives in a per-user data dir; config lives in a fixed per-OS config dir

**Status:** Accepted (2025-10-23)

## Context

A taflog log is "my workday across every project", not "time inside one
repository", so storage must not be repo-local. At the same time, users need to
relocate the data and set a handful of preferences — and one preference (`dir`)
moves the data directory.

## Decision

The Log lives under a per-user data directory:

| OS | Data file |
|----|-----------|
| Windows | `%APPDATA%\taflog\events.ndjson` |
| macOS | `~/Library/Application Support/taflog/events.ndjson` |
| Linux/other | `${XDG_DATA_HOME:-~/.local/share}/taflog/events.ndjson` |

Configuration lives in a **separate, fixed** per-OS config directory, so `dir`
can point elsewhere without making the config self-referential:

| OS | Config file |
|----|-------------|
| Windows | `%APPDATA%\taflog\config.json` |
| macOS | `~/Library/Application Support/taflog/config.json` |
| Linux/other | `${XDG_CONFIG_HOME:-~/.config}/taflog/config.json` |

Overrides, highest first, are the same for every key:
`--flag` > environment (`TAFLOG_DIR`, `TAFLOG_CONFIG`, `TAFLOG_ICONS`) >
config file > documented default.

## Considered Options

- **Repo-local `<repo>/.taflog/`.** Rejected: fragments a timesheet across
  repos and leaks tracked time into work repositories.
- **Config beside the data.** Rejected: `dir` is a config key, so the config
  would have to move with the data it configures.
- **A dependency (`env-paths`/`xdg`).** Rejected: a handful of branches does
  not justify a dependency, and inlining keeps the exact paths visible.

## Consequences

- The README's original "no config files" goal is retired; config is versioned,
  validated, and its precedence is documented and tested.
- `TAFLOG_CONFIG` exists mainly so tests and agents can redirect config safely.
- No migration shim from any earlier location; pre-1.0.
