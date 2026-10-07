import type { PaymentOrderDetail, ProcessingAttempt } from '../../shared/types/api';

export type EvidenceCategory = 'persisted' | 'derived' | 'explanatory';
export type JourneyState = 'completed' | 'failed' | 'current' | 'unknown' | 'terminal-success' | 'terminal-failed';

export interface JourneyStep {
  key: string;
  label: string;
  detail: string;
  state: JourneyState;
  category: EvidenceCategory;
}

export const orderPresentation = {
  persistedAttempts: 'Persisted attempts returned with this order. Times and errors appear only when supplied.',
  explanatoryDeadLetter: 'Dead-letter workflow is explanatory: this page does not confirm a broker event or timestamp.',
} as const;

export function attemptLabel(number: number): string {
  return number === 1 ? 'Initial attempt' : `Retry ${number - 1}`;
}

export function expectedAttemptCount(scenario: PaymentOrderDetail['simulationScenario']): number {
  return scenario === 'SUCCESS' ? 1 : scenario === 'FAIL_ONCE' ? 2 : scenario === 'FAIL_TWICE' ? 3 : 4;
}

export function orderAttemptLabel(order: PaymentOrderDetail, number: number): string {
  if (order.reprocessScenario && number > expectedAttemptCount(order.simulationScenario)) {
    return number === expectedAttemptCount(order.simulationScenario) + 1
      ? 'Manual reprocess'
      : `Manual reprocess attempt ${number - expectedAttemptCount(order.simulationScenario)}`;
  }
  return attemptLabel(number);
}

function attemptStep(attempt: ProcessingAttempt | undefined, number: number, currentNumber: number | null): JourneyStep {
  if (attempt) return { key: `attempt-${number}`, label: attemptLabel(number), detail: `Attempt ${number} · ${attempt.status.toLowerCase()}`, state: attempt.status === 'SUCCESS' ? 'completed' : 'failed', category: 'persisted' };
  return { key: `attempt-${number}`, label: attemptLabel(number), detail: currentNumber === number ? 'Current processing step' : 'Not recorded', state: currentNumber === number ? 'current' : 'unknown', category: 'derived' };
}

export function deriveJourney(order: PaymentOrderDetail): JourneyStep[] {
  const attemptsByNumber = new Map(order.attempts.map((attempt) => [attempt.attemptNumber, attempt]));
  const expectedCount = expectedAttemptCount(order.simulationScenario);
  const recoveryAttempts = order.reprocessScenario
    ? order.attempts.filter((attempt) => attempt.attemptNumber > expectedCount)
    : [];
  if (order.reprocessScenario && recoveryAttempts.length > 0) {
    const originalAttempts = order.attempts.filter((attempt) => attempt.attemptNumber <= expectedCount);
    const originalFailed = originalAttempts.some((attempt) => attempt.status === 'ERROR');
    const steps: JourneyStep[] = [{ key: 'created', label: 'Created', detail: 'Persisted order created', state: 'completed', category: 'persisted' }, {
      key: 'original-outcome', label: 'Original outcome', detail: originalFailed ? 'FAILED' : 'Original outcome not fully recorded', state: originalFailed ? 'terminal-failed' : 'unknown', category: originalFailed ? 'persisted' : 'derived',
    }];
    recoveryAttempts.forEach((attempt, index) => {
      steps.push({ key: `reprocess-${attempt.id}`, label: index === 0 ? 'Manual reprocess' : `Manual reprocess attempt ${index + 1}`, detail: attempt.status, state: attempt.status === 'SUCCESS' ? 'completed' : 'failed', category: 'persisted' });
    });
    steps.push({ key: 'recovered-outcome', label: 'Recovered outcome', detail: order.status === 'SUCCESS' ? 'SUCCESS' : 'Recovery outcome not recorded', state: order.status === 'SUCCESS' ? 'terminal-success' : 'unknown', category: order.status === 'SUCCESS' ? 'persisted' : 'derived' });
    return steps;
  }
  const recordedNumbers = [...attemptsByNumber.keys()];
  const highestRecorded = recordedNumbers.length ? Math.max(...recordedNumbers) : 0;
  const hasSuccessfulAttempt = order.attempts.some((attempt) => attempt.status === 'SUCCESS');
  const active = order.status === 'PENDING' || order.status === 'PROCESSING';
  const currentNumber = active && !hasSuccessfulAttempt && highestRecorded < expectedCount ? highestRecorded + 1 : null;
  const visibleAttempts = Math.max(expectedCount, highestRecorded);
  const steps: JourneyStep[] = [{ key: 'created', label: 'Created', detail: 'Persisted order created', state: 'completed', category: 'persisted' }];
  for (let number = 1; number <= visibleAttempts; number += 1) steps.push(attemptStep(attemptsByNumber.get(number), number, currentNumber));
  const terminalState: JourneyState = order.status === 'SUCCESS' ? 'terminal-success' : order.status === 'FAILED' ? 'terminal-failed' : hasSuccessfulAttempt ? 'current' : 'unknown';
  steps.push({ key: 'terminal', label: 'Processing outcome', detail: order.status === 'SUCCESS' ? 'Terminal success' : order.status === 'FAILED' ? 'Terminal failure' : 'Outcome not recorded', state: terminalState, category: order.status === 'SUCCESS' || order.status === 'FAILED' ? 'persisted' : 'derived' });
  return steps;
}

export function processingOutcome(order: PaymentOrderDetail): string {
  if (order.reprocessScenario && order.status === 'SUCCESS') return 'Recovered by manual reprocess';
  if (order.status === 'SUCCESS') return order.retryCount > 0 ? `Succeeded after ${order.retryCount} ${order.retryCount === 1 ? 'retry' : 'retries'}` : 'Succeeded on initial attempt';
  if (order.status === 'FAILED') return `Failed after ${order.retryCount} ${order.retryCount === 1 ? 'retry' : 'retries'}`;
  return 'Processing outcome pending';
}
