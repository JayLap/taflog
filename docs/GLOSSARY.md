# taflog — Glossary

Vocabulary for taflog v1. Every document, ADR, issue, and line of code uses
these words in these senses.

## Recording

**Event**:
A single append-only line in the Log — one of `start`, `stop`, `switch`,
`adjust`, or `delete`. Events are the source of truth; every other view is
derived from them.
_Avoid_: record, action, mutation

**Entry**:
A completed interval of work, opened by a `start` or `switch` and closed by a
`stop` or `switch`. An Entry has a Project, an optional Description, a start
instant, and an end instant.
_Avoid_: session, record, item, task

**Timer**:
The single open Entry — a `start` or `switch` with no closing `stop`/`switch`.
There is at most one Timer at a time.
_Avoid_: running task, active session

**Project**:
The required grouping label of a Timer, Entry, or Adjustment. Freeform, stored
verbatim, matched case-insensitively when filtering.
_Avoid_: client, category, tag

**Description**:
The optional freeform text on a Timer or Entry describing what was done.
_Avoid_: note (a Note belongs to an Adjustment), comment

**Adjustment**:
A dated, signed duration correction against a Project, produced by `add` or
`sub`. An Adjustment has a Project, a signed duration, a date, and an optional
Note. It is not an Entry and never carries a start or end instant.
_Avoid_: edit, correction entry, manual entry

**Note**:
The optional freeform explanation attached to an Adjustment.
_Avoid_: description, comment

## Storage and views

**Log**:
The append-only `events.ndjson` file — the single source of truth. It is never
rewritten, only appended to.
_Avoid_: database, journal, history

**Report**:
An aggregation of Timed time and Adjusted time over a date range, grouped by
project or by day.
_Avoid_: summary, stats

**Status**:
A snapshot of the current Timer (or the idle state) plus the day's totals.
_Avoid_: state, info

**Export**:
A raw dump of the Log, byte-for-byte, for other tools and services.
_Avoid_: backup, dump

## Time

**Timed time**:
Duration derived from Entries (end − start).
_Avoid_: worked time, actual time

**Adjusted time**:
The signed sum of Adjustments in a range.
_Avoid_: correction time

**Total time**:
Timed time + Adjusted time.
_Avoid_: net time

**Explicit time**:
The optional local wall-clock time given to `stop` or `switch` (`15h44`,
`9:00`). It resolves on today's local date and becomes the Event's `at`, so it
closes the Entry and, for `switch`, opens the next Timer at that instant.
_Avoid_: backdate, fake time, manual timestamp

**Week**:
The report window beginning on `weekStart` (ISO Monday by default).
_Avoid_: period
