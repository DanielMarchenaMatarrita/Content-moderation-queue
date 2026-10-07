import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { CreateOrderPage } from './CreateOrderPage';

describe('CreateOrderPage', () => {
  it('uses native scenario radios, supports keyboard selection, posts exact DTO, then redirects', async () => {
    const fetchMock = vi.fn((..._args: [RequestInfo | URL, RequestInit?]) => Promise.resolve(new Response(JSON.stringify({ id: 'order-id', amount: 15000, currency: 'CRC', status: 'PENDING', simulationScenario: 'SUCCESS', retryCount: 0, lastError: null, createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z', submissionEventId: 'event-id' }), { status: 201, headers: { 'Content-Type': 'application/json' } })));
    vi.stubGlobal('fetch', fetchMock);
    const user = userEvent.setup();
    render(<QueryClientProvider client={new QueryClient({ defaultOptions: { mutations: { retry: false } } })}><MemoryRouter initialEntries={['/orders/new']}><Routes><Route path="/orders/new" element={<CreateOrderPage />} /><Route path="/orders/:id" element={<h1>Order destination</h1>} /></Routes></MemoryRouter></QueryClientProvider>);
    const success = screen.getByRole('radio', { name: /SUCCESS/i });
    const failOnce = screen.getByRole('radio', { name: /FAIL ONCE/i });
    expect(success).toBeChecked();
    expect(failOnce).not.toBeChecked();
    expect(screen.getByText('Initial processing is expected to succeed with zero retries.')).toBeInTheDocument();
    expect(screen.getByText(/Retry 3 exhausts retry capacity and the order reaches FAILED/)).toBeInTheDocument();
    success.focus();
    await user.keyboard('{ArrowDown}');
    expect(failOnce).toBeChecked();
    await user.click(screen.getByRole('button', { name: 'Create order' }));
    expect(await screen.findByRole('heading', { name: 'Order destination' })).toBeInTheDocument();
    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).toEqual({ amount: 15000, currency: 'CRC', simulationScenario: 'FAIL_ONCE' });
  });

  it('keeps amount validation from submitting an invalid order', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const user = userEvent.setup();
    render(<QueryClientProvider client={new QueryClient({ defaultOptions: { mutations: { retry: false } } })}><MemoryRouter><CreateOrderPage /></MemoryRouter></QueryClientProvider>);
    await user.clear(screen.getByLabelText('Amount'));
    await user.type(screen.getByLabelText('Amount'), '1.5');
    await user.click(screen.getByRole('button', { name: 'Create order' }));
    expect(await screen.findByText('Amount must be an integer of at least 1.')).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
