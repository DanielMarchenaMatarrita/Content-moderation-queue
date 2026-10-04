import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { OrdersPage } from './OrdersPage';

const order = {
  id: '550e8400-e29b-41d4-a716-446655440000', amount: 15000, currency: 'CRC', status: 'FAILED' as const,
  simulationScenario: 'ALWAYS_FAIL' as const, retryCount: 3,
  lastError: 'Processor rejected the payment because a deliberately long persisted error must remain fully readable in every order representation.',
  createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:02:00.000Z',
};

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}><MemoryRouter><OrdersPage /></MemoryRouter></QueryClientProvider>);
}

describe('OrdersPage', () => {
  it('keeps filtering, refresh, pagination, and detail navigation', async () => {
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const url = String(input);
      const page = url.includes('page=2') ? 2 : 1;
      return Promise.resolve(new Response(JSON.stringify({ items: [order], page, limit: 20, total: 40 }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
    });
    vi.stubGlobal('fetch', fetchMock);
    renderPage();
    expect((await screen.findAllByRole('link', { name: `View order ${order.id}` }))[0]).toHaveAttribute('href', `/orders/${order.id}`);

    fireEvent.click(screen.getByRole('button', { name: 'Failed' }));
    await waitFor(() => expect(fetchMock.mock.calls.some(([url]) => String(url) === '/api/orders?page=1&limit=20&status=FAILED')).toBe(true));
    expect(fetchMock.mock.calls.some(([url]) => String(url) === '/api/orders?page=1&limit=20&status=FAILED')).toBe(true);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Next' })).not.toBeDisabled());

    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    await screen.findByText('Page 2 of 2');
    expect(fetchMock.mock.calls.some(([url]) => String(url) === '/api/orders?page=2&limit=20&status=FAILED')).toBe(true);

    fireEvent.click(screen.getByRole('button', { name: 'Refresh' }));
    expect(fetchMock.mock.calls.filter(([url]) => String(url).includes('status=FAILED')).length).toBeGreaterThanOrEqual(3);
  });

  it('shows accessible retry, complete error, and matching card evidence', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(new Response(JSON.stringify({ items: [order], page: 1, limit: 20, total: 1 }), { status: 200, headers: { 'Content-Type': 'application/json' } }))));
    renderPage();
    expect((await screen.findAllByLabelText('3 of 3 retries recorded'))[0]).toHaveTextContent('3 / 3');
    expect(screen.getAllByText(order.lastError)).toHaveLength(2);
    expect(screen.getAllByText('ALWAYS FAIL')).toHaveLength(2);
    expect(screen.getAllByText(/15\s?000 CRC/)).toHaveLength(2);
    expect(screen.getAllByText('failed')).toHaveLength(2);
  });
});
