import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { CreateOrderPage } from './CreateOrderPage';

describe('CreateOrderPage', () => {
  it('posts exact order DTO then redirects to detail', async () => {
    const fetchMock = vi.fn((..._args: [RequestInfo | URL, RequestInit?]) => Promise.resolve(new Response(JSON.stringify({ id: 'order-id', amount: 15000, currency: 'CRC', status: 'PENDING', simulationScenario: 'SUCCESS', retryCount: 0, lastError: null, createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z', submissionEventId: 'event-id' }), { status: 201, headers: { 'Content-Type': 'application/json' } })));
    vi.stubGlobal('fetch', fetchMock);
    const user = userEvent.setup();
    render(<QueryClientProvider client={new QueryClient({ defaultOptions: { mutations: { retry: false } } })}><MemoryRouter initialEntries={['/orders/new']}><Routes><Route path="/orders/new" element={<CreateOrderPage />} /><Route path="/orders/:id" element={<h1>Order destination</h1>} /></Routes></MemoryRouter></QueryClientProvider>);
    await user.click(screen.getByRole('button', { name: 'Create order' }));
    expect(await screen.findByRole('heading', { name: 'Order destination' })).toBeInTheDocument();
    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).toEqual({ amount: 15000, currency: 'CRC', simulationScenario: 'SUCCESS' });
  });
});
