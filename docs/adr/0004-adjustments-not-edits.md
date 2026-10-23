# Corrections are dated signed adjustments, not entry edits

**Status:** Accepted (2025-10-23)

## Context

Forgetting to start the timer is the failure mode that kills a time tracker, so
manual correction is in v1. The correction unit had to be decided. Early drafts
had a general `amend` event with field changes and an `add <project> <start>
<end>` command that fabricated an interval.

## Decision

A correction is a **dated signed adjustment** against a Project:

```
{v,id,t:"adjust", at, date:"YYYY-MM-DD", project, delta:<signed seconds>, note?}
```

`taflog add <project> <duration>` writes a positive `delta`; `taflog sub
<project> <duration>` writes a negative one; both default `date` to today.
Adjustments are not Entries and never carry a start or end instant. The
correction surface is exactly `add`, `sub`, and `rm <id>`; `edit` and `amend` do
not exist. Reports show `timed`, `adjusted`, and `total` separately; negative
totals are allowed and rendered, never clamped.

## Considered Options

- **General `amend` with field changes.** Rejected: more surface than v1 needs,
  and it reopens interval semantics for corrections.
- **Synthetic intervals (`start = now − duration, end = now`).** Rejected: it
  invents wall-clock time the user never worked, betraying the tracker's one
  guarantee.
- **Manual Entries with a duration and date.** Near-equivalent, but folding
  corrections into Entry muddies `timed` vs `adjusted` in Reports.

## Consequences

- A correction is honest: it changes a total, not a history.
- To fix a wrong project or duration, `sub` the difference and `add` the right
  one, or `rm` the adjustment.
- `add`/`sub` are allowed while a Timer is running (they are independent).
- `rm` on the open Timer is refused, so a running interval is never destroyed
  without the user seeing its duration first.
