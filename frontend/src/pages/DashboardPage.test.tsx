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
    expect(await screen.findByRole('link', { name: 'View order order-12345678' })).toHaveAttribute('href', '/orders/order-12345678');
    expect(screen.getByRole('heading', { name: 'System flow' })).toBeInTheDocument();
    expect(screen.getByText('Explanatory architecture, not live system telemetry.')).toBeInTheDocument();
    expect(screen.getByText('Transactional Outbox')).toBeInTheDocument();
    expect(screen.getByText('Exhausted failure / DLQ')).toBeInTheDocument();
    expect(screen.getByText('Order Processor branches to one outcome')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'More about Transactional Outbox' })).toHaveAttribute('aria-describedby', 'flow-tip-transactional-outbox');
    expect(screen.getByRole('button', { name: 'More about Retry' })).toHaveAttribute('aria-describedby', 'flow-tip-retry');
    expect(screen.getByRole('button', { name: 'More about Exhausted failure / DLQ' })).toHaveAttribute('aria-describedby', 'flow-tip-exhausted-failure-dlq');
    expect(screen.getAllByRole('tooltip')).toHaveLength(3);
  });

  it('keeps recent-order loading, error, and empty states', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    vi.stubGlobal('fetch', vi.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url === '/api/orders/stats') return Promise.resolve(new Response(JSON.stringify({ total: 0, pending: 0, successful: 0, failed: 0, retried: 0, totalAttempts: 0 }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
      return Promise.resolve(new Response(JSON.stringify({ message: 'Recent orders unavailable' }), { status: 500, headers: { 'Content-Type': 'application/json' } }));
    }));
    render(<QueryClientProvider client={client}><MemoryRouter><DashboardPage /></MemoryRouter></QueryClientProvider>);
    expect(screen.getByText('Loading recent orders')).toBeInTheDocument();
    expect(await screen.findByText('Recent orders unavailable')).toBeInTheDocument();

    client.clear();
    vi.stubGlobal('fetch', vi.fn((input: RequestInfo | URL) => {
      const url = String(input);
      const body = url === '/api/orders/stats'
        ? { total: 0, pending: 0, successful: 0, failed: 0, retried: 0, totalAttempts: 0 }
        : { items: [], page: 1, limit: 5, total: 0 };
      return Promise.resolve(new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } }));
    }));
    const emptyClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(<QueryClientProvider client={emptyClient}><MemoryRouter><DashboardPage /></MemoryRouter></QueryClientProvider>);
    expect(await screen.findByText('No orders yet')).toBeInTheDocument();
  });
});
