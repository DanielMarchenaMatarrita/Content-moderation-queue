import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { DashboardPage } from './DashboardPage';

describe('DashboardPage', () => {
  it('shows backend statistics and recent orders', async () => {
    vi.stubGlobal('fetch', vi.fn((input: RequestInfo | URL) => {
      const url = String(input);
      const body = url === '/api/orders/stats'
        ? { total: 8, pending: 2, successful: 4, failed: 1, retried: 3, totalAttempts: 11 }
        : { items: [{ id: 'order-12345678', amount: 15000, currency: 'CRC', status: 'SUCCESS', simulationScenario: 'SUCCESS', retryCount: 0, lastError: null, createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' }], page: 1, limit: 5, total: 1 };
      return Promise.resolve(new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } }));
    }));
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(<QueryClientProvider client={client}><MemoryRouter><DashboardPage /></MemoryRouter></QueryClientProvider>);
    expect(await screen.findByText('8')).toBeInTheDocument();
    expect(screen.getByText('4')).toBeInTheDocument();
    expect(await screen.findByRole('link', { name: /order-12345678/i })).toHaveAttribute('href', '/orders/order-12345678');
  });
});
