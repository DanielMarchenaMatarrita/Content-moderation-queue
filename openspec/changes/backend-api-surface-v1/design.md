## Context

See `proposal.md` for motivation. The NestJS API currently wires `ContentModule` and `OutboxPublisherModule`; Content creation atomically inserts the pending content, initial history, and outbox event. A standalone worker consumes the resulting RabbitMQ event and atomically records its idempotency marker and moderation effects. Prisma already models every resource needed by this change, and Argon2 is already installed and exercised by the development seed.

The change adds HTTP reads and user creation around that system. It must not move write ownership for moderation or infrastructure tables, alter existing Content contracts, or create dependencies from diagnostic controllers into messaging/runtime services.

## Goals / Non-Goals

**Goals:**

- Isolate Users, moderation reads, and internal diagnostics in independently implementable API modules.
- Make public response projections explicit so credentials and diagnostic payloads are not leaked accidentally.
- Preserve existing Content and distributed-processing behavior through regression tests.
- Keep parallel feature slices conflict-free, with one final integration owner.
- Produce complete Swagger contracts suitable for immediate frontend use.

**Non-Goals:**

- Introduce authentication, authorization, role management, or credential verification.
- Add any write path for moderation records, outbox records, or processed-message markers.
- Add operational controls such as replay, retry, DLQ, or RabbitMQ administration.
- Change Prisma schema, migrations, event contracts, publisher behavior, RabbitMQ topology, or worker behavior.
- Refactor existing Content services or extract shared infrastructure solely for code deduplication.

## Decisions

### 1. Use three independent feature modules and one integration step

`UsersModule`, `ModerationReadModule`, and `InternalDiagnosticsModule` will each import `PrismaModule` and own their controllers, services, DTOs, Swagger metadata, and focused tests. They will not import one another. Only the final INT slice will register all three modules in `AppModule` and add cross-module HTTP/Swagger regression tests.

This preserves clear ownership and allows U, M, and I to run in parallel without editing the same files. A shared API module was rejected because it would couple unrelated contracts and create merge conflicts. Premature shared pagination abstractions were also rejected; local DTOs are small and preserve slice independence.

### 2. Normalize credentials before persistence and project users explicitly

User creation will accept a dedicated request DTO containing only `email`, `displayName`, and `password`. Email and display name will be trimmed; email will be lowercased. Email will use normal email validation and respect the schema's 320-character limit; display name will be non-empty and respect its 120-character limit. Password validation will enforce 8 through 128 characters without trimming or otherwise changing the submitted secret.

The service will perform a case-insensitive duplicate lookup to detect any pre-existing mixed-case data, hash the password with Argon2, and call Prisma with an explicit data object containing `email`, `displayName`, `passwordHash`, and `role: USER`. It will also translate the database unique violation into `409 Conflict` so concurrent normalized duplicate requests cannot surface as a server error. Create, list, and detail operations will use explicit public selects for `id`, `email`, `displayName`, `role`, `createdAt`, and `updatedAt`.

Relying only on the Prisma role default was rejected because explicitly setting `USER` documents and enforces public-registration policy. Returning Prisma entities and deleting `passwordHash` afterward was rejected because omission by projection is safer than post-query redaction. Adding a case-insensitive database index was rejected because all new values normalize to lowercase, the existing unique index protects concurrent inserts, and database changes are prohibited.

### 3. Define stable list semantics locally

All paginated lists will use `page=1`, `limit=20`, bounds of 1 through 100, Prisma `skip/take`, a count query using the same filter, and `{ items, page, limit, total }` responses. Each service will issue list and count through a Prisma transaction, matching the existing Content list pattern.

User `q` will be trimmed, reject an explicitly blank value, and use case-insensitive substring matching with OR semantics across email and display name. User `role`, outbox `eventType`, processed-message `consumerName`, UUID filters, and IDs will be exact matches. The `published` query value will be parsed strictly as `true` or `false`; it maps to `publishedAt IS NOT NULL` or `publishedAt IS NULL` rather than JavaScript truthiness.

Cursor pagination was rejected because the target contract explicitly requires page and limit. Cross-slice pagination helpers were rejected to avoid unnecessary coupling.

### 4. Keep moderation reads separate from Content write/read ownership

`ModerationReadController` will own `GET /contents/:id/moderation-results` and `GET /contents/:id/moderation-history`. Its service will first perform an existence query for Content, return `404` when absent, and then issue a select-only query against the requested child model with the specified ordering and fields. It will not call or modify `ContentService`.

The controller will use full static route templates such as `@Get('contents/:id/moderation-results')`. Nest/Express exact route matching means the existing `GET /contents/:id` route cannot match a request containing the extra path segment; nevertheless, INT HTTP tests will exercise all three paths and assert correct handlers/contracts. Moving the endpoints into `ContentController` was rejected because it would expand Content ownership and force slice M to edit existing Content files.

### 5. Make diagnostics PostgreSQL-only by construction

`InternalDiagnosticsModule` will import only `PrismaModule`. Its service will access `outboxEvent` and `processedMessage` delegates directly and expose no write methods. It will not inject or import `OutboxPublisherService`, `MessagingModule`, worker modules, or idempotency services.

Outbox list projection will omit `payload`; outbox detail will include it. Processed-message list and detail will expose only the four specified fields. Separate controllers are acceptable if they improve local clarity, but both remain owned under `backend/apps/api/src/internal/**` and use the `internal diagnostics` Swagger tag.

Reusing publisher or idempotency services was rejected because those services own writes and runtime lifecycle behavior. Diagnostics need database state, not runtime commands.

### 6. Describe responses explicitly in Swagger

Each slice will define response DTOs or equivalent explicit Swagger models for frontend-visible shapes, including paginated wrappers. Controllers will document operation summaries, request bodies, path/query parameters, successful responses, and applicable `400`, `404`, and `409` responses. Tags will be exactly `users`, `moderation`, and `internal diagnostics`; existing Content operations remain under `contents`.

INT tests will generate a Swagger document from the assembled application and verify all 12 target paths and methods are present. Runtime snapshotting of the entire OpenAPI document was rejected because it creates noisy diffs; focused path/schema assertions provide stronger intent.

### 7. Preserve existing runtime through file and test boundaries

U, M, and I will create files only in their assigned directories. INT may edit `AppModule`, module-wiring tests, and global API/E2E tests. No task will edit Prisma schema or migrations, Outbox Publisher, messaging topology/constants, event contracts, worker services, idempotent executor, or moderation processor.

Existing focused tests for Content, publisher, consumer runtime, processor, and idempotency remain regression gates. The distributed E2E flow remains the authoritative verification of Content to Outbox to RabbitMQ to Worker persistence.

## Risks / Trade-offs

- [Case-insensitive lookup without a database case-insensitive index can scan user emails] -> Normalize every new email, keep the existing unique constraint as the concurrency guard, and defer index/schema changes outside this change.
- [A legacy mixed-case email could race with a normalized insert] -> Perform case-insensitive pre-check and convert all unique violations to `409`; document that full legacy normalization is outside scope.
- [Argon2 hashing consumes CPU under concurrent registrations] -> Enforce input limits and use the library's secure defaults; capacity tuning can follow measured load.
- [Nested moderation routes could regress during module registration] -> Use exact full path templates and integration tests proving nested routes and existing detail route all resolve correctly.
- [Internal diagnostics expose operational details without guards] -> Keep them under `/internal`, make them read-only, explicitly project fields, omit outbox payloads from lists, and defer access control to a later security change.
- [Page/offset pagination can shift under concurrent inserts] -> Preserve deterministic secondary ID ordering; cursor pagination is outside the fixed v1 contract.
- [New modules could accidentally initialize messaging] -> Import only `PrismaModule` in new modules and test that diagnostic service construction and calls require no publisher or RabbitMQ provider.
- [Swagger DTOs can drift from Prisma selects] -> Assert both service projections and focused generated OpenAPI paths/schemas.

## Migration Plan

1. Implement and test U, M, and I independently without changing global wiring.
2. Run INT after all three slices complete; register modules once in `AppModule` and add assembled HTTP/Swagger tests.
3. Run API unit tests, build/lint checks, existing publisher and worker suites, then the distributed E2E flow with PostgreSQL and RabbitMQ available.
4. Deploy the API using the existing database and broker configuration; no migration or broker operation is required.
5. Roll back by removing the three module imports and reverting new API files. Existing Content, publisher, RabbitMQ, and worker runtime remain deployable because this change does not alter them.
