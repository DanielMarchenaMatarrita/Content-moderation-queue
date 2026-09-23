## Purpose

Defines secure public user creation and stable paginated user reads for frontend consumers without introducing authentication or role administration.

## ADDED Requirements

### Requirement: Create a user safely
The system SHALL expose `POST /users` accepting only `email`, `displayName`, and `password`. It SHALL trim and lowercase the email before persistence, require a password length from 8 through 128 characters, hash the password with Argon2, persist only the resulting password hash, and create the user with role `USER`.

#### Scenario: Valid user creation
- **WHEN** a client submits valid `email`, `displayName`, and `password` values
- **THEN** the system returns `201 Created` with the created user's public fields
- **AND** the persisted email is trimmed and lowercase
- **AND** the persisted role is `USER`
- **AND** only an Argon2 password hash is persisted for the credential

#### Scenario: Invalid password length
- **WHEN** a client submits a password shorter than 8 characters or longer than 128 characters
- **THEN** the system returns `400 Bad Request`
- **AND** no user is created

#### Scenario: Client attempts to set protected fields
- **WHEN** a client includes `role`, `passwordHash`, `id`, `createdAt`, or `updatedAt` in the create request
- **THEN** the system returns `400 Bad Request`
- **AND** no user is created

### Requirement: Reject equivalent email addresses
The system SHALL treat email addresses as duplicates without regard to surrounding whitespace or letter case and SHALL return `409 Conflict` when an equivalent email already exists.

#### Scenario: Case-insensitive duplicate
- **WHEN** an existing user has email `person@example.com` and a client submits ` Person@Example.com `
- **THEN** the system returns `409 Conflict`
- **AND** no additional user is created

#### Scenario: Concurrent normalized duplicate
- **WHEN** concurrent create requests normalize to the same email value
- **THEN** at most one user is created
- **AND** each losing request returns `409 Conflict`

### Requirement: User credentials remain private
The system MUST exclude `password` and `passwordHash` from every Users API response, including create, list, detail, and error responses.

#### Scenario: Inspect user responses
- **WHEN** a client receives any successful Users API response
- **THEN** neither `password` nor `passwordHash` is present at any nesting level

### Requirement: List users
The system SHALL expose `GET /users` with page-based pagination, optional exact `role` filtering, and optional trimmed `q` search using case-insensitive substring matching across email and display name. Results SHALL be ordered by `createdAt` descending and then `id` descending.

#### Scenario: List with defaults
- **WHEN** a client requests `GET /users` without query parameters
- **THEN** the response contains `items`, `page`, `limit`, and `total`
- **AND** `page` is 1 and `limit` is 20
- **AND** items contain only public user fields

#### Scenario: Filter and search users
- **WHEN** a client supplies a valid `role` and `q`
- **THEN** the response includes only users matching the role and whose email or display name matches the search
- **AND** ordering remains `createdAt DESC, id DESC`

#### Scenario: Invalid pagination or role
- **WHEN** `page` is below 1, `limit` is outside 1 through 100, or `role` is invalid
- **THEN** the system returns `400 Bad Request`

### Requirement: Get a user by ID
The system SHALL expose `GET /users/:id`, validate `id` as a UUID, and return only public user fields.

#### Scenario: Existing user detail
- **WHEN** a client requests an existing user UUID
- **THEN** the system returns `200 OK` with that user's public fields
- **AND** no credential field is present

#### Scenario: Missing user detail
- **WHEN** a client requests a valid UUID that does not identify a user
- **THEN** the system returns `404 Not Found`

#### Scenario: Invalid user UUID
- **WHEN** a client requests a malformed user ID
- **THEN** the system returns `400 Bad Request`

### Requirement: Document the Users API
The system SHALL expose Users API operations, request fields, query filters, principal responses, and applicable `400`, `404`, and `409` responses in Swagger under the `users` tag.

#### Scenario: Inspect Swagger documentation
- **WHEN** a client opens `/docs`
- **THEN** all three Users API operations and their contracts are visible under `users`
