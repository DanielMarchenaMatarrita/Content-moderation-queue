## Purpose

Defines focused, read-only access to moderation outcomes and transition history for an existing content item while preserving worker ownership of all writes.

## ADDED Requirements

### Requirement: List moderation results for content
The system SHALL expose `GET /contents/:id/moderation-results`, validate the content ID as a UUID, verify that the content exists, and return only moderation results belonging to that content ordered by `createdAt` descending and then `id` descending.

#### Scenario: Existing content results
- **WHEN** a client requests moderation results for an existing content UUID
- **THEN** the system returns `200 OK` with an array ordered by `createdAt DESC, id DESC`
- **AND** each item contains only `id`, `decision`, `score`, `reasons`, `engineVersion`, and `createdAt`

#### Scenario: Existing content without results
- **WHEN** a client requests moderation results for existing content that has no result
- **THEN** the system returns `200 OK` with an empty array

#### Scenario: Missing content results
- **WHEN** a client requests moderation results for a valid UUID that does not identify content
- **THEN** the system returns `404 Not Found`

#### Scenario: Invalid content UUID for results
- **WHEN** a client supplies a malformed content ID
- **THEN** the system returns `400 Bad Request`

### Requirement: List moderation history for content
The system SHALL expose `GET /contents/:id/moderation-history`, validate the content ID as a UUID, verify that the content exists, and return only history entries belonging to that content ordered by `createdAt` ascending and then `id` ascending.

#### Scenario: Existing content history
- **WHEN** a client requests moderation history for an existing content UUID
- **THEN** the system returns `200 OK` with an array ordered by `createdAt ASC, id ASC`
- **AND** each item contains only `id`, `fromStatus`, `toStatus`, `source`, `actorUserId`, `reason`, and `createdAt`

#### Scenario: Existing content without history
- **WHEN** a client requests moderation history for existing content that has no history entry
- **THEN** the system returns `200 OK` with an empty array

#### Scenario: Missing content history
- **WHEN** a client requests moderation history for a valid UUID that does not identify content
- **THEN** the system returns `404 Not Found`

#### Scenario: Invalid content UUID for history
- **WHEN** a client supplies a malformed content ID
- **THEN** the system returns `400 Bad Request`

### Requirement: Moderation HTTP access is read-only
The system MUST NOT expose HTTP methods that create, replace, update, or delete moderation results or moderation history, and read requests MUST NOT mutate database state.

#### Scenario: Read moderation data
- **WHEN** either moderation read endpoint is called
- **THEN** the system performs no database write
- **AND** existing content, results, and history remain unchanged

### Requirement: Nested moderation routes are unambiguous
The system SHALL route the two nested moderation paths to their moderation read handlers rather than treating `moderation-results` or `moderation-history` as a content identifier, while preserving `GET /contents/:id` behavior.

#### Scenario: Route moderation results
- **WHEN** a client requests `/contents/{valid-id}/moderation-results`
- **THEN** the moderation results handler receives the request
- **AND** the content detail handler does not receive it

#### Scenario: Route moderation history
- **WHEN** a client requests `/contents/{valid-id}/moderation-history`
- **THEN** the moderation history handler receives the request
- **AND** the content detail handler does not receive it

#### Scenario: Route content detail
- **WHEN** a client requests `/contents/{valid-id}`
- **THEN** the existing content detail contract remains unchanged, including embedded `moderationResults` and `moderationHistory`

### Requirement: Document moderation reads
The system SHALL expose both moderation read operations, path parameters, response fields, and applicable `400` and `404` responses in Swagger under the `moderation` tag.

#### Scenario: Inspect moderation Swagger documentation
- **WHEN** a client opens `/docs`
- **THEN** both nested moderation read operations and their contracts are visible under `moderation`
