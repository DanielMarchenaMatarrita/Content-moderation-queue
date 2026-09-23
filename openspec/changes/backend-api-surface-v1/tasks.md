## 1. U - Users API

- [x] 1.1 Create `backend/apps/api/src/users/**` module, controller, service, request/query DTOs, explicit public response models, and local Swagger metadata without editing `AppModule`.
- [x] 1.2 Implement `POST /users` validation for allowed fields, email/display-name normalization, password length 8-128, Argon2 hashing, explicit `USER` role persistence, and public-field-only response selection.
- [x] 1.3 Implement case-insensitive duplicate lookup and Prisma unique-conflict translation so existing and concurrent equivalent emails return `409 Conflict`.
- [x] 1.4 Implement `GET /users` pagination, exact role filtering, trimmed case-insensitive substring `q` search across email/display name, deterministic ordering, matching count query, and public projections.
- [x] 1.5 Implement UUID-validated `GET /users/:id` with explicit public projection and `404 Not Found` behavior.
- [x] 1.6 Add DTO and service tests covering normalization, Argon2 hash persistence, forced `USER` role, duplicate conflicts, pagination/filter/search/order, detail/404, and absence of `password`/`passwordHash`.
- [x] 1.7 Add standalone Users HTTP tests covering `201`, invalid password `400`, protected-field/role rejection `400`, duplicate `409`, list/detail contracts, UUID validation, and Swagger declarations.

## 2. M - Moderation Read API

- [x] 2.1 Create `backend/apps/api/src/moderation-read/**` module, controller, service, explicit response models, and local Swagger metadata without editing `AppModule`, `ContentService`, or existing Content files.
- [x] 2.2 Implement `GET /contents/:id/moderation-results` with UUID validation, prior Content existence check, `404`, scoped explicit projection, and `createdAt DESC, id DESC` ordering.
- [x] 2.3 Implement `GET /contents/:id/moderation-history` with UUID validation, prior Content existence check, `404`, scoped explicit projection, and `createdAt ASC, id ASC` ordering.
- [x] 2.4 Add service tests proving exact fields/order/filtering, empty arrays for existing Content, Content `404`, and absence of Prisma write calls.
- [x] 2.5 Add standalone HTTP/routing tests proving both nested paths reach moderation handlers, `/contents/:id` remains distinct, invalid UUIDs return `400`, and Swagger exposes both operations under `moderation`.

## 3. I - Internal Diagnostics API

- [x] 3.1 Create `backend/apps/api/src/internal/**` module, controller or controllers, service, query DTOs, explicit list/detail response models, and local Swagger metadata without editing `AppModule`.
- [x] 3.2 Implement paginated `GET /internal/outbox-events` with exact `eventType`, UUID `aggregateId`, strict boolean `published` filters, deterministic ordering, matching count query, and a projection that omits `payload`.
- [x] 3.3 Implement UUID-validated `GET /internal/outbox-events/:id` with `404` behavior and explicit detail projection including `payload`.
- [x] 3.4 Implement paginated `GET /internal/processed-messages` with UUID `eventId` and exact `consumerName` filters, deterministic ordering, matching count query, and four-field projection.
- [x] 3.5 Implement UUID-validated `GET /internal/processed-messages/:id` with four-field projection and `404` behavior.
- [x] 3.6 Add DTO and service tests covering pagination bounds/defaults, strict boolean parsing, all filters, ordering, detail/404, list payload omission, detail payload inclusion, and explicit processed-message fields.
- [x] 3.7 Add module/HTTP tests proving diagnostics import only Prisma, execute no writes, require no publisher/RabbitMQ/worker/idempotency providers, expose only the four GET operations, and document `400`/`404` contracts under `internal diagnostics`.

## 4. INT - Final Integration and Regression

- [x] 4.1 After U, M, and I complete, register `UsersModule`, `ModerationReadModule`, and `InternalDiagnosticsModule` once in `backend/apps/api/src/app.module.ts` and update module-wiring tests.
- [x] 4.2 Add assembled API routing tests for all 12 target endpoints, including proof that nested moderation routes are not intercepted by `GET /contents/:id` and that existing Content response contracts remain unchanged.
- [x] 4.3 Generate the assembled Swagger document in tests and verify all 12 paths/methods, four required tags, request/query/path parameters, response models, and applicable `400`, `404`, and `409` responses.
- [x] 4.4 Run focused Users, moderation-read, internal-diagnostics, Content, Outbox Publisher, worker, processor, and idempotency unit suites; fix only regressions within this change's allowed API files.
- [x] 4.5 Run API and worker builds plus type-aware lint, confirming no edits to Prisma schema/migrations, event contracts, publisher, RabbitMQ topology, worker, idempotent executor, or moderation processor.
- [x] 4.6 Run the existing PostgreSQL/RabbitMQ E2E flow and verify `POST /contents`, outbox publication, RabbitMQ delivery, worker moderation, history/result persistence, processed-message idempotency, and `GET /contents/:id` still pass end to end.
