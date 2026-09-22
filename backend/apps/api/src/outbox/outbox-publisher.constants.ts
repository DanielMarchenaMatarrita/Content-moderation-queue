export const OUTBOX_PUBLISHER_CONFIG = {
  batchSize: 25,
  claimTtlMs: 60_000,
  pollIntervalMs: 1_000,
  publishTimeoutMs: 10_000,
  retryBaseMs: 5_000,
  retryMaxMs: 300_000,
  lastErrorMaxLength: 1_000,
} as const;
