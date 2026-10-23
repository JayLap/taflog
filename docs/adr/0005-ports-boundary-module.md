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
  adapters/      implementations; imports ports
  cli/           parsing + rendering; imports application/ports
  main.ts        composition root; imports everything
```

Imports point inward: `domain` imports nothing project-local; `application` is
the only core layer that imports `ports`; `adapters` import `ports`; `cli` and
`main.ts` wire everything. No DI framework.

## Considered Options

- **Ports under `domain/ports/`.** Rejected: the "pure" folder would hold
  I/O-shaped interfaces, and domain code would sit one import away from I/O
  concepts.
- **No explicit ports; use-case constructors take concrete adapters.**
  Rejected: tests would fake classes instead of roles, and there would be no
  single place naming the external seams.

## Consequences

- The dependency rule is a folder rule: review can verify that `domain` has no
  project-local imports.
- Ports may reference domain types (`EventLog.append(event: Event)`), so the
  arrow is `ports → domain`.
- Use cases return plain data; `cli` chooses the terminal or JSON presenter, so
  no `Output` port is needed in v1.
