## Purpose

Defines read-only PostgreSQL diagnostics for transactional outbox records and idempotent consumer markers without exposing infrastructure control operations.

## ADDED Requirements

### Requirement: List outbox events
The system SHALL expose `GET /internal/outbox-events` with page-based pagination, optional `eventType`, UUID `aggregateId`, and boolean `published` filters, ordered by `createdAt` descending and then `id` descending.

#### Scenario: List outbox events with defaults
- **WHEN** a client requests the outbox list without query parameters
- **THEN** the response contains `items`, `page`, `limit`, and `total`
- **AND** `page` is 1 and `limit` is 20
- **AND** items are ordered by `createdAt DESC, id DESC`
- **AND** no item contains `payload`

#### Scenario: Filter outbox events
- **WHEN** a client supplies valid `eventType`, `aggregateId`, or `published` filters
- **THEN** the response contains only matching outbox events
- **AND** `published=true` matches events with a non-null `publishedAt`
- **AND** `published=false` matches events with a null `publishedAt`

#### Scenario: Invalid outbox list query
- **WHEN** `page` is below 1, `limit` is outside 1 through 100, `aggregateId` is malformed, or `published` is not a valid boolean
- **THEN** the system returns `400 Bad Request`

### Requirement: Get an outbox event by ID
The system SHALL expose `GET /internal/outbox-events/:id`, treat `id` as `OutboxEvent.id`, validate it as a UUID, and include the event payload in a successful detail response.

#### Scenario: Existing outbox event detail
- **WHEN** a client requests an existing outbox event UUID
- **THEN** the system returns `200 OK` with `id`, `eventId`, `eventType`, `eventVersion`, `aggregateType`, `aggregateId`, `payload`, `correlationId`, `occurredAt`, `publishedAt`, `claimedAt`, `claimedBy`, `retryCount`, `nextAttemptAt`, `lastError`, and `createdAt`

#### Scenario: Missing outbox event
- **WHEN** a client requests a valid UUID that does not identify an outbox event
- **THEN** the system returns `404 Not Found`

#### Scenario: Invalid outbox event UUID
- **WHEN** a client requests a malformed outbox event ID
- **THEN** the system returns `400 Bad Request`

### Requirement: List processed messages
The system SHALL expose `GET /internal/processed-messages` with page-based pagination and optional UUID `eventId` and `consumerName` filters, ordered by `processedAt` descending and then `id` descending.

#### Scenario: List processed messages with defaults
- **WHEN** a client requests the processed-message list without query parameters
- **THEN** the response contains `items`, `page`, `limit`, and `total`
- **AND** `page` is 1 and `limit` is 20
- **AND** each item contains only `id`, `eventId`, `consumerName`, and `processedAt`

#### Scenario: Filter processed messages
- **WHEN** a client supplies a valid `eventId` or `consumerName`
- **THEN** the response contains only matching processed-message records
- **AND** ordering remains `processedAt DESC, id DESC`

#### Scenario: Invalid processed-message list query
- **WHEN** pagination is invalid or `eventId` is malformed
- **THEN** the system returns `400 Bad Request`

### Requirement: Get a processed message by ID
The system SHALL expose `GET /internal/processed-messages/:id`, validate the ID as a UUID, and return only `id`, `eventId`, `consumerName`, and `processedAt`.

#### Scenario: Existing processed-message detail
- **WHEN** a client requests an existing processed-message UUID
- **THEN** the system returns `200 OK` with the processed-message fields

#### Scenario: Missing processed message
- **WHEN** a client requests a valid UUID that does not identify a processed message
- **THEN** the system returns `404 Not Found`

#### Scenario: Invalid processed-message UUID
- **WHEN** a client requests a malformed processed-message ID
- **THEN** the system returns `400 Bad Request`

### Requirement: Diagnostics remain database-only and read-only
Diagnostic endpoints SHALL query PostgreSQL only, SHALL perform no database writes, and MUST NOT invoke the Outbox Publisher, RabbitMQ, moderation worker, or idempotent executor.

#### Scenario: Read diagnostics
- **WHEN** any internal diagnostic endpoint is called
- **THEN** no outbox record or processed-message marker is created, updated, or deleted
- **AND** no message is published, consumed, retried, replayed, or dead-lettered

### Requirement: Internal diagnostics expose no control operations
The system MUST NOT expose HTTP operations for outbox or processed-message creation, update, deletion, replay, retry, RabbitMQ administration, or DLQ administration.

#### Scenario: Inspect available diagnostic operations
- **WHEN** a client inspects the internal diagnostics API contract
- **THEN** only the four specified GET operations are available

### Requirement: Document internal diagnostics
The system SHALL expose all four diagnostics operations, filters, pagination parameters, response fields, and applicable `400` and `404` responses in Swagger under the `internal diagnostics` tag.

#### Scenario: Inspect diagnostics Swagger documentation
- **WHEN** a client opens `/docs`
- **THEN** all four diagnostics operations and their contracts are visible under `internal diagnostics`
