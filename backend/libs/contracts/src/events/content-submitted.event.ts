import type { IntegrationEvent } from './integration-event.js';

export const CONTENT_SUBMITTED_EVENT = {
  type: 'content.submitted',
  version: 1,
  routingKey: 'content.submitted',
} as const;

export interface ContentSubmittedPayload {
  contentId: string;
}

export type ContentSubmittedEvent =
  IntegrationEvent<ContentSubmittedPayload>;
