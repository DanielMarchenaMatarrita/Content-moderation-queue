## Why

The backend already supports asynchronous content moderation, but its HTTP surface does not expose user creation, focused moderation reads, or database-backed operational diagnostics. Completing this REST v1 contract now provides the stable API needed to begin frontend development without changing the distributed moderation runtime.

## What Changes

- Add a Users API for secure public user creation and paginated user reads.
- Normalize user emails, reject case-insensitive duplicates, hash accepted passwords with Argon2, force the `USER` role, and exclude credentials from every response.
- Add read-only nested endpoints for a content item's moderation results and moderation history.
- Add read-only internal diagnostics for outbox events and processed-message markers, including pagination and filters.
- Document all new operations, parameters, validation errors, not-found responses, and user-conflict responses in Swagger.
- Preserve the existing Content API contracts and transactional Content, ModerationHistory, and OutboxEvent creation.
- Preserve all Outbox Publisher, RabbitMQ, worker, event-contract, retry/DLQ, and idempotency behavior.
- Add focused API tests plus distributed-flow regression coverage.

## Capabilities

### New Capabilities

- `users-api`: Public user creation and paginated/detail user reads with safe credential handling.
- `moderation-read-api`: Read-only moderation result and history endpoints scoped to existing content.
- `internal-diagnostics-api`: Read-only PostgreSQL diagnostics for outbox events and processed messages.

### Modified Capabilities

None.

## Impact

- Adds API modules under `backend/apps/api/src/users/`, `backend/apps/api/src/moderation-read/`, and `backend/apps/api/src/internal/`.
- Updates `AppModule` wiring and API-level tests only after the three feature slices are complete.
- Reuses NestJS validation, Swagger, Prisma, and the installed Argon2 dependency.
- Adds nine endpoints while preserving the three existing Content endpoints, yielding a 12-endpoint target surface.
- Does not change Prisma schema, migrations, RabbitMQ topology, event contracts, Outbox Publisher, worker, or moderation/idempotency writers.
