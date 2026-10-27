# Stop and switch may take an explicit effective time

**Status:** Accepted (2026-10-27)

## Context

Forgetting to stop a Timer, or to switch Projects, is common. Before this
decision the only correction surface was `add`, `sub`, and `rm` (ADR-0004). That
is enough to fix a total, but it cannot close the currently open Entry at the
instant the work actually ended. Users wanted to say “stop at 15:44” or
“switch to beta at 13:15” without fabricating an Adjustment.

## Decision

`stop` and `switch` accept an optional local wall-clock time:

```
taflog stop [<time>] [description]
taflog switch <project> [<time>] [description]
```

Accepted forms are `9:00`, `09:00`, `15h44`, `15h`, and `9h`; minutes default
to `00`. The time always resolves on today's local date. `--date` is not
supported by these commands.

The explicit time becomes the Event's `at`, so it is also:

- the closed Entry's `end` for `stop` and `switch`;
- the next Timer's `start` for `switch`.

There is no schema change and no new Event kind. The Log is still append-only,
but an Event's `at` may be earlier than the moment its line was appended.

Validation:

- a future time is a usage error;
- a time before the open Timer's opening instant is a usage error;
- `switch` with a time while idle is refused;
- the Forgotten-Timer threshold is measured against the effective `at`, with
  `--force` still required when the resulting Entry is over the limit.

Already-closed Entries remain uneditable. Fixing them still uses `add`, `sub`,
or `rm`.

## Considered Options

- **Add an `end` field to `stop`/`switch`.** Rejected: it complicates the Event
  schema and the reducer for no v1 benefit; the Event's effective instant is
  what every derived view needs.
- **Synthetic Adjustments (`sub`/`add`) instead.** Rejected: it cannot close the
  open Entry, so `status` and `log` stay wrong until the user stops it.
- **A general `edit`/`amend` surface.** Rejected as in ADR-0004: too much
  surface and it reopens interval rewriting.
- **Supporting `--date` now.** Deferred: the requested use case is same-day
  corrections, and a date flag would add another parsing/precedence surface.

## Consequences

- A forgotten Timer can be corrected directly while keeping `timed` and
  `adjusted` honest.
- `switch` keeps its identity as the atomic handoff command, now with an
  explicit handoff instant.
- Event `at` no longer necessarily matches append order in the file. The
  reducer already applies Events in file order and uses `at` as the effective
  instant, so views remain deterministic.
- Backdated corrections that overlap already-closed Entries are out of scope;
  they are not detected or rewritten.
- Cross-midnight or yesterday corrections require a future `--date` decision.
