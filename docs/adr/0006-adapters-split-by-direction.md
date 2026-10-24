# Adapters are split by direction: adapters/in (driving) and adapters/out (driven)

**Status:** Accepted (2025-10-23)

## Context

Hexagonal architecture has two kinds of adapter. **Driving** (primary) adapters
call into the application — the CLI, an HTTP controller, a test harness.
**Driven** (secondary) adapters implement a port and are called by the core —
the filesystem, the clock, an external API. ADR-0005 settled that ports are a
sibling boundary module, but left open whether the two directions share one
`adapters/` tree or are separated.

## Decision

`adapters/` is split by direction:

```
src/
  adapters/
    in/
      cli/          driving adapter: argument parsing + presenters
    out/
      clock/        SystemClock
      store/        JsonlEventLog
      config/       config resolver
```

`adapters/in/**` imports `application` (+ `domain` for display helpers) and
never `ports` or `adapters/out/**`. `adapters/out/**` implement `ports/`. The
composition root, `src/main.ts`, is the only module that imports both sides.

## Considered Options

- **A single `adapters/` tree with `adapters/cli/` beside `adapters/fs/`.**
  Rejected: the two directions point opposite ways (call the application vs be
  called by it) and have different tests, so one folder blurs which side of the
  hexagon a file is on.
- **A top-level `cli/` beside `application/`, driven code under `adapters/`.**
  Rejected: it names the driving side as something other than an adapter, and
  it does not scale to a second driver (`mcp/`, a library) without inventing new
  top-level folders.
- **`adapters/in/` + `adapters/out/`.** Chosen: the folder names state the
  direction, every driver or driven implementation has an obvious home, and the
  import rules stay mechanical.

## Consequences

- `adapters/out/` is the only home for code that implements `ports/`.
- A future driver (`adapters/in/mcp/`) is a sibling of `adapters/in/cli/` with
  no restructuring.
- ADR-0005's layout diagram is updated to this split; its decision (ports as a
  boundary module) is unchanged.
