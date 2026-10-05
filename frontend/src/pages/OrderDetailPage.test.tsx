import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useNavigate } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { PaymentOrderDetail, SimulationScenario } from '../shared/types/api';
import { OrderDetailPage } from './OrderDetailPage';
import { ToastProvider } from '../app/providers/ToastProvider';

const id = '11111111-1111-4111-8111-111111111111';
const timestamp = '2026-01-01T00:00:00.000Z';
const attempt = (attemptNumber: number, status: 'SUCCESS' | 'ERROR', errorDescription: string | null = status === 'ERROR' ? 'Gateway timeout' : null) => ({ id: `attempt-${attemptNumber}`, orderId: id, attemptNumber, status, errorDescription, createdAt: timestamp });

function order(scenario: SimulationScenario, status: PaymentOrderDetail['status'], attempts: PaymentOrderDetail['attempts']): PaymentOrderDetail {
  return { id, amount: 15000, currency: 'CRC', simulationScenario: scenario, reprocessScenario: null, status, retryCount: Math.max(0, attempts.length - 1), lastError: [...attempts].reverse().find((value) => value.status === 'ERROR')?.errorDescription ?? null, createdAt: timestamp, updatedAt: timestamp, attempts };
}

function renderDetail(data: PaymentOrderDetail) {
  vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(new Response(JSON.stringify(data), { status: 200, headers: { 'Content-Type': 'application/json' } }))));
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(<QueryClientProvider client={client}><ToastProvider><MemoryRouter initialEntries={[`/orders/${id}`]}><Routes><Route path="/orders/:id" element={<OrderDetailPage />} /></Routes></MemoryRouter></ToastProvider></QueryClientProvider>);
  return client;
}

afterEach(() => vi.unstubAllGlobals());

describe('OrderDetailPage', () => {
  it.each([
    ['SUCCESS', 'SUCCESS', [attempt(1, 'SUCCESS')], ['Initial attempt', 'Terminal success']],
    ['FAIL_ONCE', 'SUCCESS', [attempt(1, 'ERROR'), attempt(2, 'SUCCESS')], ['Initial attempt', 'Retry 1', 'Terminal success']],
    ['FAIL_TWICE', 'SUCCESS', [attempt(1, 'ERROR'), attempt(2, 'ERROR'), attempt(3, 'SUCCESS')], ['Initial attempt', 'Retry 1', 'Retry 2', 'Terminal success']],
    ['ALWAYS_FAIL', 'FAILED', [attempt(1, 'ERROR'), attempt(2, 'ERROR'), attempt(3, 'ERROR'), attempt(4, 'ERROR')], ['Retry 3', 'Terminal failure']],
  ] as const)('renders %s journey and persisted evidence', async (scenario, status, attempts, labels) => {
    renderDetail(order(scenario, status, [...attempts]));
    expect(await screen.findByRole('heading', { name: 'Processing journey' })).toBeInTheDocument();
    labels.forEach((label) => expect(screen.getAllByText(label).length).toBeGreaterThan(0));
    expect(screen.getByRole('heading', { name: 'Processing attempts' })).toBeInTheDocument();
  });

  it('shows no-attempt evidence without creating an attempt or timestamp', async () => {
    renderDetail(order('FAIL_TWICE', 'PENDING', []));
    expect(await screen.findByText('No attempts recorded yet')).toBeInTheDocument();
    expect(screen.getByText('Current processing step')).toBeInTheDocument();
    expect(screen.queryByText(/Attempt 1 ·/)).not.toBeInTheDocument();
  });

  it('explains pending processing, persisted freshness, and auto-refresh without telemetry claims', async () => {
    renderDetail(order('FAIL_TWICE', 'PENDING', []));
    await screen.findByRole('heading', { name: 'Processing journey' });
    expect(screen.getByRole('status')).toHaveTextContent('Processing payment order');
    expect(screen.getByRole('status')).toHaveTextContent('Auto-refresh is active while this order is pending');
    expect(screen.getByRole('status')).toHaveTextContent('Last updated from persisted evidence');
    expect(screen.getByRole('status')).toHaveTextContent('Refresh interval: 1.5 seconds.');
    expect(screen.queryByText(/broker|queue|acknowledg|worker|latency/i)).not.toBeInTheDocument();
  });

  it('announces refresh state while retaining persisted freshness evidence', async () => {
    const pending = order('FAIL_TWICE', 'PENDING', []);
    let resolveRefresh: (response: Response) => void;
    const fetchMock = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify(pending), { status: 200, headers: { 'Content-Type': 'application/json' } })).mockImplementationOnce(() => new Promise<Response>((resolve) => { resolveRefresh = resolve; }));
    vi.stubGlobal('fetch', fetchMock);
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(<QueryClientProvider client={client}><ToastProvider><MemoryRouter initialEntries={[`/orders/${id}`]}><Routes><Route path="/orders/:id" element={<OrderDetailPage />} /></Routes></MemoryRouter></ToastProvider></QueryClientProvider>);
    await screen.findByRole('heading', { name: 'Processing journey' });
    fireEvent.click(screen.getByRole('button', { name: 'Manual refresh' }));
    expect(await screen.findByText('Refreshing persisted order evidence.', { exact: false })).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Last updated from persisted evidence');
    act(() => resolveRefresh!(new Response(JSON.stringify(pending), { status: 200, headers: { 'Content-Type': 'application/json' } })));
  });

  it('retains the persisted last error after a recovered success', async () => {
    const recoveredError = 'Transient gateway timeout';
    renderDetail(order('FAIL_ONCE', 'SUCCESS', [attempt(1, 'ERROR', recoveredError), attempt(2, 'SUCCESS')]));
    await screen.findByText('Succeeded after 1 retry');
    const lastError = screen.getByText('Last error').parentElement;
    expect(lastError).toHaveTextContent(recoveredError);
  });

  it('keeps a long persisted error in attempts and labels DLQ as explanatory', async () => {
    const longError = 'x'.repeat(240);
    renderDetail(order('ALWAYS_FAIL', 'FAILED', [attempt(1, 'ERROR', longError), attempt(2, 'ERROR'), attempt(3, 'ERROR'), attempt(4, 'ERROR')]));
    expect(await screen.findByText(longError)).toBeInTheDocument();
    expect(screen.getByText(/Dead-letter workflow is explanatory/i)).toBeInTheDocument();
    expect(screen.getByText('Retry limit exhausted after 3 retries')).toBeInTheDocument();
    expect(screen.queryByText(/Routed to dead-letter queue/i)).not.toBeInTheDocument();
  });

  it('notifies once for newly observed persisted evidence and never replays initial history', async () => {
    const initial = order('FAIL_ONCE', 'PENDING', []);
    const client = renderDetail(initial);
    await screen.findByRole('heading', { name: 'Processing journey' });
    expect(screen.queryByText('Initial attempt recorded')).not.toBeInTheDocument();
    const observedAttempt = order('FAIL_ONCE', 'PENDING', [attempt(1, 'ERROR')]);
    act(() => client.setQueryData(['orders', 'detail', id], observedAttempt));
    expect(await screen.findByText('Initial attempt recorded')).toBeInTheDocument();
    act(() => client.setQueryData(['orders', 'detail', id], observedAttempt));
    expect(screen.getAllByText('Initial attempt recorded')).toHaveLength(1);
    const terminal = order('FAIL_ONCE', 'SUCCESS', [attempt(1, 'ERROR'), attempt(2, 'SUCCESS')]);
    act(() => client.setQueryData(['orders', 'detail', id], terminal));
    expect(await screen.findByText('Order success')).toBeInTheDocument();
    act(() => client.setQueryData(['orders', 'detail', id], terminal));
    expect(screen.getAllByText('Order success')).toHaveLength(1);
  });

  it('resets notification baseline when route opens a terminal order with existing history', async () => {
    const otherId = '22222222-2222-4222-8222-222222222222';
    const initial = order('FAIL_ONCE', 'PENDING', []);
    const existingTerminalHistory: PaymentOrderDetail = {
      ...order('FAIL_ONCE', 'SUCCESS', [attempt(1, 'ERROR'), attempt(2, 'SUCCESS')]),
      id: otherId,
      attempts: [
        { ...attempt(1, 'ERROR'), id: 'other-attempt-1', orderId: otherId },
        { ...attempt(2, 'SUCCESS'), id: 'other-attempt-2', orderId: otherId },
      ],
    };
    vi.stubGlobal('fetch', vi.fn((input: RequestInfo | URL) => Promise.resolve(new Response(JSON.stringify(String(input).endsWith(otherId) ? existingTerminalHistory : initial), { status: 200, headers: { 'Content-Type': 'application/json' } }))));
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    function DetailRoute() {
      const navigate = useNavigate();
      return <><button type="button" onClick={() => navigate(`/orders/${otherId}`)}>Open existing terminal order</button><OrderDetailPage /></>;
    }
    render(<QueryClientProvider client={client}><ToastProvider><MemoryRouter initialEntries={[`/orders/${id}`]}><Routes><Route path="/orders/:id" element={<DetailRoute />} /></Routes></MemoryRouter></ToastProvider></QueryClientProvider>);
    await screen.findByRole('heading', { name: 'Processing journey' });
    fireEvent.click(screen.getByRole('button', { name: 'Open existing terminal order' }));
    expect(await screen.findByText(otherId)).toBeInTheDocument();
    expect(screen.queryByText('Initial attempt recorded')).not.toBeInTheDocument();
    expect(screen.queryByText('Retry 1 recorded')).not.toBeInTheDocument();
    expect(screen.queryByText('Order success')).not.toBeInTheDocument();
  });

  it('shows failed-only manual reprocess, refetches pending acceptance, then polls recovered success', async () => {
    vi.useFakeTimers();
    try {
    const failed = order('ALWAYS_FAIL', 'FAILED', [attempt(1, 'ERROR'), attempt(2, 'ERROR'), attempt(3, 'ERROR'), attempt(4, 'ERROR')]);
    const pending: PaymentOrderDetail = { ...failed, status: 'PENDING', reprocessScenario: 'SUCCESS' };
    const recovered: PaymentOrderDetail = {
      ...pending,
      status: 'SUCCESS',
      attempts: [...pending.attempts, attempt(5, 'SUCCESS')],
    };
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify(failed), { status: 200, headers: { 'Content-Type': 'application/json' } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ ...pending, reprocessEventId: 'event-5' }), { status: 201, headers: { 'Content-Type': 'application/json' } }))
      .mockResolvedValueOnce(new Response(JSON.stringify(pending), { status: 200, headers: { 'Content-Type': 'application/json' } }))
      .mockResolvedValueOnce(new Response(JSON.stringify(recovered), { status: 200, headers: { 'Content-Type': 'application/json' } }));
    vi.stubGlobal('fetch', fetchMock);
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(<QueryClientProvider client={client}><ToastProvider><MemoryRouter initialEntries={[`/orders/${id}`]}><Routes><Route path="/orders/:id" element={<OrderDetailPage />} /></Routes></MemoryRouter></ToastProvider></QueryClientProvider>);
    await vi.waitFor(() => expect(screen.getByRole('button', { name: 'Reprocess order' })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'Reprocess order' }));
    fireEvent.click(screen.getByRole('button', { name: 'Reprocess order' }));
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3));
    expect(fetchMock.mock.calls[1][0]).toBe(`/api/payment-orders/${id}/reprocess`);
    expect(fetchMock.mock.calls[1][1]).toEqual(expect.objectContaining({ method: 'POST', body: JSON.stringify({ scenario: 'SUCCESS' }) }));
    expect(screen.getByRole('status')).toHaveTextContent('Auto-refresh is active while this order is pending');
    await act(async () => { await vi.advanceTimersByTimeAsync(1_500); });
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(4));
    expect(screen.getByText('Recovery scenario')).toBeInTheDocument();
    expect(screen.getAllByText('Manual reprocess').length).toBeGreaterThan(0);
    expect(screen.queryByText('Retry 4')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Reprocess order' })).not.toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it('keeps failed order displayed and exposes reprocess API errors', async () => {
    const failed = order('ALWAYS_FAIL', 'FAILED', [attempt(1, 'ERROR'), attempt(2, 'ERROR'), attempt(3, 'ERROR'), attempt(4, 'ERROR')]);
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify(failed), { status: 200, headers: { 'Content-Type': 'application/json' } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ message: 'Order cannot be reprocessed' }), { status: 409, headers: { 'Content-Type': 'application/json' } }));
    vi.stubGlobal('fetch', fetchMock);
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(<QueryClientProvider client={client}><ToastProvider><MemoryRouter initialEntries={[`/orders/${id}`]}><Routes><Route path="/orders/:id" element={<OrderDetailPage />} /></Routes></MemoryRouter></ToastProvider></QueryClientProvider>);
    fireEvent.click(await screen.findByRole('button', { name: 'Reprocess order' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Order cannot be reprocessed');
    expect(screen.getByText('Retry limit exhausted after 3 retries')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reprocess order' })).toBeInTheDocument();
  });

  it('labels newly observed recovery attempt as manual reprocess without replaying terminal history', async () => {
    const failed = order('ALWAYS_FAIL', 'FAILED', [attempt(1, 'ERROR'), attempt(2, 'ERROR'), attempt(3, 'ERROR'), attempt(4, 'ERROR')]);
    const client = renderDetail(failed);
    await screen.findByRole('heading', { name: 'Processing journey' });
    const recovered: PaymentOrderDetail = { ...failed, status: 'SUCCESS', reprocessScenario: 'SUCCESS', attempts: [...failed.attempts, attempt(5, 'SUCCESS')] };
    act(() => client.setQueryData(['orders', 'detail', id], recovered));
    expect(await screen.findByText('Manual reprocess recorded')).toBeInTheDocument();
    expect(screen.queryByText('Retry 4 recorded')).not.toBeInTheDocument();
  });

  it('does not replay notifications for an initially loaded recovered terminal order', async () => {
    const recovered: PaymentOrderDetail = {
      ...order('ALWAYS_FAIL', 'SUCCESS', [attempt(1, 'ERROR'), attempt(2, 'ERROR'), attempt(3, 'ERROR'), attempt(4, 'ERROR'), attempt(5, 'SUCCESS')]),
      reprocessScenario: 'SUCCESS',
    };
    renderDetail(recovered);
    expect(await screen.findByText('Recovered outcome')).toBeInTheDocument();
    expect(screen.queryByText('Manual reprocess recorded')).not.toBeInTheDocument();
    expect(screen.queryByText('Order success')).not.toBeInTheDocument();
  });
});
