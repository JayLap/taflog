# ports/ is a sibling boundary module, not part of domain

**Status:** Accepted (2025-10-23)

## Context

Hexagonal architecture keeps policy inside and I/O outside. The question is
where the port interfaces (`Clock`, `EventLog`) live, and how to make the
dependency rule mechanically checkable.

## Decision

`ports/` is a sibling of `domain/`, `application/`, and `adapters/`:

```
src/
  domain/        pure: types, derive*, aggregations, formatting
  ports/         interfaces only: Clock, EventLog
  application/   use cases; imports domain + ports
  adapters/
    in/cli/      driving adapter: parsing + rendering
    out/clock/   SystemClock
    out/store/   JsonlEventLog
    out/config/  config resolver
  main.ts        composition root; imports everything
```

Imports point inward: `domain` imports nothing project-local; `application` is
the only core layer that imports `ports`; `adapters/out/**` implement `ports`;
`adapters/in/**` import `application` (+ `domain` for display helpers) but never
`ports` or `adapters/out/**`; `main.ts` is the only module that imports both
sides. No DI framework.

The split of `adapters/` into `in/` (driving) and `out/` (driven) is recorded
in ADR-0006.

## Considered Options

- **`adapters/cli/` (driving and driven shapes in one tree).** Rejected: the
  two directions differ (implement a port vs call the application) and have
  different tests, so one folder would blur which side of the hexagon it is.
- **Ports under `domain/ports/`.** Rejected: the domain never uses a port —
  its rules are pure functions over plain data (`deriveEntries(events)`) — so
  ports would live in a layer that does not depend on them. Use cases are what
  need `Clock`/`EventLog`. A port is also the application's contract with the
  *outside*, so it is pure but not domain policy.
- **Ports under `application/ports/`.** Defensible (the application owns them),
  but rejected: `adapters/out/**` would then import from `application/**`, and
  the seam would disappear inside a layer that is otherwise pure policy. A
  top-level `ports/` keeps the boundary a first-class folder.
- **No explicit ports; use-case constructors take concrete adapters.**
  Rejected: tests would fake classes instead of roles, and there would be no
  single place naming the external seams.

## Consequences

- The dependency rule is a folder rule: review can verify that `domain` has no
  project-local imports.
- Ports may reference domain types (`EventLog.append(event: Event)`), so the
  arrow is `ports → domain`.
- Use cases return plain data; `adapters/in/cli` chooses the terminal or JSON
  presenter, so no `Output` port is needed in v1.
