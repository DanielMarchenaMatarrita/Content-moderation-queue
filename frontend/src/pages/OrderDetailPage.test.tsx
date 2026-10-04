import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { OrderDetailPage } from './OrderDetailPage';

const id = '11111111-1111-4111-8111-111111111111';
const baseOrder = { id, amount: 15000, currency: 'CRC', simulationScenario: 'FAIL_TWICE', retryCount: 2, lastError: 'Gateway timeout', createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' };
function renderDetail(status: 'SUCCESS' | 'FAILED') {
  vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(new Response(JSON.stringify({ ...baseOrder, status, attempts: [{ id: 'a1', orderId: id, attemptNumber: 1, status: 'ERROR', errorDescription: 'Gateway timeout', createdAt: baseOrder.createdAt }, { id: 'a2', orderId: id, attemptNumber: 2, status: 'ERROR', errorDescription: 'Gateway timeout', createdAt: baseOrder.createdAt }, { id: 'a3', orderId: id, attemptNumber: 3, status: 'SUCCESS', errorDescription: null, createdAt: baseOrder.createdAt }] }), { status: 200, headers: { 'Content-Type': 'application/json' } }))));
  render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><MemoryRouter initialEntries={[`/orders/${id}`]}><Routes><Route path="/orders/:id" element={<OrderDetailPage />} /></Routes></MemoryRouter></QueryClientProvider>);
}

describe('OrderDetailPage', () => {
  it('renders persisted retries, last error, and bounded attempt labels', async () => {
    renderDetail('SUCCESS');
    expect(await screen.findByText('Initial attempt')).toBeInTheDocument();
    expect(screen.getByText('Retry 1')).toBeInTheDocument();
    expect(screen.getByText('Retry 2')).toBeInTheDocument();
    expect(screen.queryByText('Retry 4')).not.toBeInTheDocument();
    expect(screen.getAllByText('Gateway timeout').length).toBeGreaterThan(0);
    expect(screen.getAllByText('error').length).toBeGreaterThan(0);
  });

  it('makes exhausted failure clear without inventing DLQ state', async () => {
    renderDetail('FAILED');
    expect(await screen.findByText('Processing failed after retries exhausted')).toBeInTheDocument();
    expect(screen.getByText(/Retry limit exhausted\. Routed to dead-letter queue workflow/i)).toBeInTheDocument();
  });
});
