# Stop and switch accept an explicit date with their time

**Status:** Accepted (2026-10-27)

## Context

ADR-0007 introduced explicit stop/switch times but deferred `--date`, limiting
corrections to today. Forgetting to stop or switch yesterday is a realistic
case, and the CLI already has a single date grammar used by `add`, `sub`, `log`,
and `report`.

## Decision

`stop` and `switch` accept `--date` together with their explicit time:

```
taflog stop [<time>] [description] [--date D]
taflog switch <project> [<time>] [description] [--date D]
```

- `--date` uses the existing date grammar unchanged: `YYYY-MM-DD`, `today`,
  `yesterday`, and weekday names (`mon`…`sun`) within the current week.
- Without `--date`, the time resolves on today's local date.
- `--date` without a `<time>` is a usage error on both commands.
- The resolved local date and time become the Event's `at`; all validation from
  ADR-0007 still applies, including future/pre-start rejection and the
  forgotten-timer check against the effective end.
- `switch` with a time while idle remains refused, with or without `--date`.

This supersedes only the `--date` deferral in ADR-0007; the rest of that
decision is unchanged.

## Considered Options

- **Keep `--date` deferred.** Rejected: it leaves yesterday's forgotten timers
  uncorrectable and makes the time feature incomplete.
- **Invent a stop/switch-specific date grammar.** Rejected: the existing parser
  already covers the useful forms and consistency is more valuable.
- **Allow `--date` without a time.** Rejected: it would silently choose the
  current wall-clock time on another day, which is exactly the kind of
  ambiguity this feature is meant to remove.

## Consequences

- `stop` and `switch` now share the date grammar of the rest of the CLI.
- No Event schema, reducer, or reporting changes are needed.
- Cross-midnight and yesterday corrections are supported.
- Weekday names can resolve to a future date; the existing future-instant
  check rejects the command.
