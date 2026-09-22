-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('USER', 'MODERATOR', 'ADMIN');

-- CreateEnum
CREATE TYPE "ContentStatus" AS ENUM ('PENDING', 'PROCESSING', 'APPROVED', 'REVIEW_REQUIRED', 'REJECTED', 'FAILED');

-- CreateEnum
CREATE TYPE "ModerationDecision" AS ENUM ('APPROVED', 'REVIEW_REQUIRED', 'REJECTED');

-- CreateEnum
CREATE TYPE "ModerationSource" AS ENUM ('SYSTEM', 'MODERATION_WORKER', 'MODERATOR', 'ADMIN');

-- CreateTable
CREATE TABLE "User" (
    "id" UUID NOT NULL,
    "email" VARCHAR(320) NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "displayName" VARCHAR(120) NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'USER',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Content" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "body" TEXT NOT NULL,
    "status" "ContentStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Content_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ModerationResult" (
    "id" UUID NOT NULL,
    "contentId" UUID NOT NULL,
    "decision" "ModerationDecision" NOT NULL,
    "score" INTEGER,
    "reasons" JSONB,
    "engineVersion" VARCHAR(30) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ModerationResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ModerationHistory" (
    "id" UUID NOT NULL,
    "contentId" UUID NOT NULL,
    "fromStatus" "ContentStatus",
    "toStatus" "ContentStatus" NOT NULL,
    "source" "ModerationSource" NOT NULL,
    "actorUserId" UUID,
    "reason" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ModerationHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProcessedMessage" (
    "id" UUID NOT NULL,
    "eventId" UUID NOT NULL,
    "consumerName" VARCHAR(100) NOT NULL,
    "processedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProcessedMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OutboxEvent" (
    "id" UUID NOT NULL,
    "eventId" UUID NOT NULL,
    "eventType" VARCHAR(100) NOT NULL,
    "eventVersion" INTEGER NOT NULL DEFAULT 1,
    "aggregateType" VARCHAR(100) NOT NULL,
    "aggregateId" UUID NOT NULL,
    "payload" JSONB NOT NULL,
    "correlationId" UUID NOT NULL,
    "occurredAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "publishedAt" TIMESTAMPTZ(3),
    "claimedAt" TIMESTAMPTZ(3),
    "claimedBy" VARCHAR(100),
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "nextAttemptAt" TIMESTAMPTZ(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OutboxEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "Content_userId_createdAt_idx" ON "Content"("userId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "Content_status_createdAt_idx" ON "Content"("status", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "ModerationResult_contentId_createdAt_idx" ON "ModerationResult"("contentId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "ModerationHistory_contentId_createdAt_idx" ON "ModerationHistory"("contentId", "createdAt" ASC);

-- CreateIndex
CREATE INDEX "ModerationHistory_actorUserId_idx" ON "ModerationHistory"("actorUserId");

-- CreateIndex
CREATE UNIQUE INDEX "ProcessedMessage_eventId_consumerName_key" ON "ProcessedMessage"("eventId", "consumerName");

-- CreateIndex
CREATE UNIQUE INDEX "OutboxEvent_eventId_key" ON "OutboxEvent"("eventId");

-- CreateIndex
CREATE INDEX "OutboxEvent_publishedAt_nextAttemptAt_createdAt_idx" ON "OutboxEvent"("publishedAt", "nextAttemptAt", "createdAt" ASC);

-- AddForeignKey
ALTER TABLE "Content" ADD CONSTRAINT "Content_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ModerationResult" ADD CONSTRAINT "ModerationResult_contentId_fkey" FOREIGN KEY ("contentId") REFERENCES "Content"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ModerationHistory" ADD CONSTRAINT "ModerationHistory_contentId_fkey" FOREIGN KEY ("contentId") REFERENCES "Content"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ModerationHistory" ADD CONSTRAINT "ModerationHistory_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Domain integrity constraints

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

-- Optimized index for unpublished outbox events

CREATE INDEX "OutboxEvent_pending_idx"
ON "OutboxEvent" ("nextAttemptAt", "createdAt")
WHERE "publishedAt" IS NULL;