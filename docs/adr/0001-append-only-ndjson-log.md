# The Log is append-only NDJSON

**Status:** Accepted (2025-10-23)

## Context

taflog persists tracked time locally. The data must survive a mid-write crash,
be readable by agents and other services, be inspectable and editable by a
human, and tolerate more than one possible writer (the user and an agent). We
considered a single mutable JSON document rewritten on every change, a hybrid
document-plus-log, and a pure append-only event log.

## Decision

The source of truth is a single append-only file, `events.ndjson`, in the
per-user data directory. Each line is one self-describing JSON Event carrying
its own `v: 1`. A write is exactly one `appendFile` of
`JSON.stringify(event) + "\n"`. Entries, the Timer, and every Report are derived
by replaying the Log on read. There is no cache and no compaction in v1.

Event kinds (fields in [SPEC §4](../SPEC.md)):

```
{v,id,t:"start",  at, project, description?}
{v,id,t:"stop",   at, entry:<openId>, description?}
{v,id,t:"switch", at, from:<openId>, project, description?}
{v,id,t:"adjust", at, date, project, delta, note?}
{v,id,t:"delete", at, entry:<id>}
```

An Entry's id is the id of the `start`/`switch` event that opened it. `switch`
is a single event so the handoff from one task to another is one atomic append.

## Considered Options

- **Single mutable JSON document.** Rejected: every change rewrites the whole
  file (a crash can truncate it), two writers can lose each other's update, and
  a correction becomes a read-modify-write race.
- **Hybrid log plus cached state.** Rejected: the cache is a second source of
  truth that can drift from the Log, for no benefit at personal-timesheet scale.
- **`switch` as `stop` + `start`.** Rejected: two appends cannot be atomic, and
  a crash between them leaves a half-applied switch.

## Consequences

- The Log is greppable, streamable, and `jq`-friendly; `export` is a byte dump.
- Concurrency is best-effort: independent single-line appends are intact and
  order does not matter to the reducer, so no lock is required initially.
- Tolerant reads skip blank or unparsable lines and warn on stderr; `--strict`
  fails instead; `export` never parses, so nothing is unrecoverable.
- The file grows forever; yearly rotation or a `compact` command is deferred.
- Schema evolution uses the per-event `v`, so mixed-version logs stay readable.
