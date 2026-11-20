# Normalization is a derived Report view, never stored

**Status:** Accepted (2026-10-28)

## Context

Timesheets often have to add up to a fixed daily total (for example 7h30m)
while the tracked time rarely does. Users want `report --details` to show the
tracked tasks scaled proportionally to that total, rounded to a practical unit.

ADR-0001 makes the Log the single source of truth and every view derived;
ADR-0004 forbids editing recorded intervals and uses signed Adjustments for
corrections.

## Decision

`report --normalize` is a pure, read-only transformation of a Report:

- Per completed day, every (Project, Description) bucket of Timed time is scaled
  by one ratio and rounded to `reportStep` (default `5m`) with the
  largest-remainder method, so the day's Total time equals its Day target
  exactly.
- Day targets are configuration (`dayTargets.<weekday>`, Mon–Thu `7h30m`, Fri
  `5h30m`, weekend `off` by default). `off` leaves that weekday unscaled.
- Adjustments are fixed and count toward the target; Timed buckets share
  `target − adjusted`.
- The result is never written to the Log. No Entry is edited and no Adjustment
  is generated.
- `--json` keeps the version-1 shape; values are the normalized ones and an
  added `normalization` object records the step and each rescaled day's target,
  original and normalized totals.

## Considered Options

- **Write the difference as Adjustments.** Rejected: it would persist a
  presentation choice, make `log` disagree with the tracked reality, and must be
  undone whenever the target changes.
- **Scale per Project instead of per Description.** Rejected: the request is to
  round each task, and Project rows already equal the sum of their sub-rows.
- **Scale Adjustments too.** Rejected: an Adjustment is a deliberate correction
  of an exact duration; scaling it would blur what the user asked for.
- **Include today and a running Timer.** Rejected: an incomplete day cannot be
  scaled to a total yet.
- **A flat `dayTargets` JSON blob, set as a whole.** Rejected in favour of
  dotted `dayTargets.<weekday>` keys, which fit `config <key>` and `set <key>
  <value>` and let one weekday be turned `off` independently.

## Consequences

- The Log, `log`, `status`, and the reducer are unchanged.
- The Report's `byProject`/`byDay` stay mutually consistent after scaling
  because by-day totals are recomputed from the scaled sub-rows.
- The config schema gains `reportStep` and seven `dayTargets.*` keys.
- Projects filtered with `--project` still scale against the whole day.
- Scaled values are not real tracked time; the terminal header says so.
