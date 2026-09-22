# Prisma persistence foundation

`DATABASE_URL` is the application connection string used by `PrismaService`.
`DIRECT_URL` is the direct PostgreSQL connection preferred by Prisma CLI operations.

No migration exists yet. The initial migration must add these PostgreSQL constraints and partial index manually:

```sql
ALTER TABLE "ModerationResult"
ADD CONSTRAINT "ModerationResult_score_check"
CHECK (
  "score" IS NULL
  OR ("score" >= 0 AND "score" <= 100)
);

ALTER TABLE "OutboxEvent"
ADD CONSTRAINT "OutboxEvent_eventVersion_check"
CHECK ("eventVersion" > 0);

ALTER TABLE "OutboxEvent"
ADD CONSTRAINT "OutboxEvent_retryCount_check"
CHECK ("retryCount" >= 0);

CREATE INDEX "OutboxEvent_pending_idx"
ON "OutboxEvent" ("nextAttemptAt", "createdAt")
WHERE "publishedAt" IS NULL;
```
