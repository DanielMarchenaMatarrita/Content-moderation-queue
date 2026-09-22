/**
 * Shared transport envelope for integration events.
 *
 * eventType identifies the logical event. eventVersion identifies its contract
 * version and must increase for incompatible changes. eventId identifies one
 * event instance, while correlationId provides distributed trace continuity.
 */
export interface IntegrationEvent<TPayload> {
  eventId: string;
  eventType: string;
  eventVersion: number;
  occurredAt: string;
  correlationId: string;
  payload: TPayload;
}
