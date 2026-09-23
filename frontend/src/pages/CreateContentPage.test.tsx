import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { ActivityProvider } from '../app/providers/ActivityProvider';
import { ToastProvider } from '../app/providers/ToastProvider';
import { CreateContentPage } from './CreateContentPage';

const userId = '11111111-1111-4111-8111-111111111111';
const contentId = '22222222-2222-4222-8222-222222222222';

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

describe('CreateContentPage', () => {
  it('submits the real DTO shape and navigates to content detail', async () => {
    const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url === '/api/users?page=1&limit=100') {
        return Promise.resolve(jsonResponse({ items: [{ id: userId, email: 'ada@example.com', displayName: 'Ada', role: 'USER', createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' }], page: 1, limit: 100, total: 1 }));
      }
      if (url === '/api/contents' && init?.method === 'POST') {
        return Promise.resolve(jsonResponse({ id: contentId, userId, body: 'A real submission', status: 'PENDING', createdAt: '2026-01-01T00:00:00.000Z', submissionEventId: '33333333-3333-4333-8333-333333333333', correlationId: '44444444-4444-4444-8444-444444444444' }, 201));
      }
      return Promise.reject(new Error(`Unexpected request: ${url}`));
    });
    vi.stubGlobal('fetch', fetchMock);
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
    const user = userEvent.setup();

    render(
      <QueryClientProvider client={queryClient}>
        <ActivityProvider><ToastProvider>
          <MemoryRouter initialEntries={['/contents/new']}>
            <Routes>
              <Route path="/contents/new" element={<CreateContentPage />} />
              <Route path="/contents/:id" element={<h1>Content destination</h1>} />
            </Routes>
          </MemoryRouter>
        </ToastProvider></ActivityProvider>
      </QueryClientProvider>,
    );

    const userIdInput = screen.getByLabelText('User UUID');
    await waitFor(() => expect(userIdInput).toBeEnabled());
    await user.type(userIdInput, userId);
    await user.type(screen.getByLabelText('Content'), 'A real submission');
    await user.click(screen.getByRole('button', { name: 'Submit content' }));

    expect(await screen.findByRole('heading', { name: 'Content destination' })).toBeInTheDocument();
    const postCall = fetchMock.mock.calls.find(([, init]) => init?.method === 'POST');
    expect(JSON.parse(String(postCall?.[1]?.body))).toEqual({ userId, body: 'A real submission' });
  });
});
