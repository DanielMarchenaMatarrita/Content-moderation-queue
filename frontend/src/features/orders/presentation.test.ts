import { describe, expect, it } from 'vitest';
import type { PaymentOrderDetail, SimulationScenario } from '../../shared/types/api';
import { deriveJourney } from './presentation';

const base = (scenario: SimulationScenario, attempts: PaymentOrderDetail['attempts'], status: PaymentOrderDetail['status'] = 'SUCCESS'): PaymentOrderDetail => ({ id: 'order-1', amount: 1500, currency: 'CRC', status, simulationScenario: scenario, reprocessScenario: null, retryCount: Math.max(0, attempts.length - 1), lastError: null, createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z', attempts });
const attempt = (attemptNumber: number, status: 'SUCCESS' | 'ERROR') => ({ id: `a-${attemptNumber}`, orderId: 'order-1', attemptNumber, status, errorDescription: status === 'ERROR' ? 'Gateway timeout' : null, createdAt: '2026-01-01T00:00:00.000Z' });

describe('deriveJourney', () => {
  it.each([
    ['SUCCESS', [attempt(1, 'SUCCESS')], ['completed', 'completed', 'terminal-success']],
    ['FAIL_ONCE', [attempt(1, 'ERROR'), attempt(2, 'SUCCESS')], ['completed', 'failed', 'completed', 'terminal-success']],
    ['FAIL_TWICE', [attempt(1, 'ERROR'), attempt(2, 'ERROR'), attempt(3, 'SUCCESS')], ['completed', 'failed', 'failed', 'completed', 'terminal-success']],
    ['ALWAYS_FAIL', [attempt(1, 'ERROR'), attempt(2, 'ERROR'), attempt(3, 'ERROR'), attempt(4, 'ERROR')], ['completed', 'failed', 'failed', 'failed', 'failed', 'terminal-failed']],
  ] as const)('derives persisted %s evidence without executing future retries', (scenario, attempts, states) => {
    expect(deriveJourney(base(scenario, [...attempts], scenario === 'ALWAYS_FAIL' ? 'FAILED' : 'SUCCESS')).map((step) => step.state)).toEqual(states);
  });

  it('uses current and unknown states for absent and partial pending evidence', () => {
    expect(deriveJourney(base('FAIL_TWICE', [], 'PENDING')).map((step) => step.state)).toEqual(['completed', 'current', 'unknown', 'unknown', 'unknown']);
    expect(deriveJourney(base('FAIL_TWICE', [attempt(1, 'ERROR')], 'PENDING')).map((step) => step.state)).toEqual(['completed', 'failed', 'current', 'unknown', 'unknown']);
  });

  it('groups exhausted original attempts and labels recovery truthfully', () => {
    const recovered = {
      ...base('ALWAYS_FAIL', [attempt(1, 'ERROR'), attempt(2, 'ERROR'), attempt(3, 'ERROR'), attempt(4, 'ERROR'), attempt(5, 'SUCCESS')]),
      reprocessScenario: 'SUCCESS' as const,
    };
    expect(deriveJourney(recovered).map((step) => `${step.label} — ${step.detail}`)).toEqual([
      'Created — Persisted order created',
      'Original outcome — FAILED',
      'Manual reprocess — SUCCESS',
      'Recovered outcome — SUCCESS',
    ]);
  });
});
