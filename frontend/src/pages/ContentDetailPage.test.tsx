import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { ActivityProvider } from '../app/providers/ActivityProvider';
import { ToastProvider } from '../app/providers/ToastProvider';
import { ContentDetailPage } from './ContentDetailPage';

const contentId = '22222222-2222-4222-8222-222222222222';
const now = '2026-01-01T00:00:00.000Z';

function renderDetail(status: 'PENDING' | 'APPROVED', withResult: boolean) {
  const responses: Record<string, unknown> = {
    [`/api/contents/${contentId}`]: { id: contentId, userId: '11111111-1111-4111-8111-111111111111', body: 'Inspect this content', status, createdAt: now, updatedAt: now, moderationResults: [], moderationHistory: [] },
    [`/api/contents/${contentId}/moderation-results`]: withResult ? [{ id: 'result-id', decision: 'APPROVED', score: 0.98, reasons: ['NO_POLICY_MATCH'], engineVersion: 'deterministic-v1', createdAt: now }] : [],
    [`/api/contents/${contentId}/moderation-history`]: withResult ? [{ id: 'history-id', fromStatus: 'PROCESSING', toStatus: 'APPROVED', source: 'MODERATION_WORKER', actorUserId: null, reason: 'NO_POLICY_MATCH', createdAt: now }] : [],
  };
  vi.stubGlobal('fetch', vi.fn((input: RequestInfo | URL) => Promise.resolve(new Response(JSON.stringify(responses[String(input)]), { status: 200, headers: { 'Content-Type': 'application/json' } }))));
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <ActivityProvider><ToastProvider>
        <MemoryRouter initialEntries={[`/contents/${contentId}`]}>
          <Routes><Route path="/contents/:id" element={<ContentDetailPage />} /></Routes>
        </MemoryRouter>
      </ToastProvider></ActivityProvider>
    </QueryClientProvider>,
  );
}

describe('ContentDetailPage', () => {
  it('shows pending and empty moderation states without treating them as errors', async () => {
    renderDetail('PENDING', false);
    expect(await screen.findByText('Waiting for moderation')).toBeInTheDocument();
    expect(await screen.findByText('Moderation result has not arrived yet')).toBeInTheDocument();
    expect(await screen.findByText('No moderation history')).toBeInTheDocument();
  });

  it('renders result and recorded history from dedicated endpoints', async () => {
    renderDetail('APPROVED', true);
    expect(await screen.findByText('Score 0.98')).toBeInTheDocument();
    expect(screen.getByText('deterministic-v1')).toBeInTheDocument();
    expect(screen.getByText('PROCESSING to APPROVED')).toBeInTheDocument();
    expect(screen.getByText('NO_POLICY_MATCH')).toBeInTheDocument();
  });
});
