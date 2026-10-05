import { describe, expect, it, vi } from 'vitest';
import { reprocessOrder } from './api';

describe('reprocessOrder', () => {
  it('posts the frozen manual SUCCESS recovery contract', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ id: 'order-1', reprocessEventId: 'event-1' }), { status: 201, headers: { 'Content-Type': 'application/json' } }));
    vi.stubGlobal('fetch', fetchMock);

    await reprocessOrder('order/id', { scenario: 'SUCCESS' });

    expect(fetchMock).toHaveBeenCalledWith('/api/payment-orders/order%2Fid/reprocess', expect.objectContaining({ method: 'POST', body: JSON.stringify({ scenario: 'SUCCESS' }) }));
  });
});
