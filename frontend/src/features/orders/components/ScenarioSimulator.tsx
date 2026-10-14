import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Play } from '@phosphor-icons/react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '../../../app/providers/ToastProvider';
import { createOrder, ordersQueryKeys } from '../api';
import { Button } from '../../../shared/components/Button';
import { getErrorMessage } from '../../../shared/lib/format';
import type { SimulationScenario } from '../../../shared/types/api';

const scenarios: Array<{ value: SimulationScenario; label: string; detail: string }> = [
  { value: 'SUCCESS', label: 'Success', detail: 'Completes on first attempt' },
  { value: 'FAIL_ONCE', label: 'Fail once', detail: 'Succeeds after one retry' },
  { value: 'FAIL_TWICE', label: 'Fail twice', detail: 'Succeeds after two retries' },
  { value: 'ALWAYS_FAIL', label: 'Always fail', detail: 'Exhausts retries to FAILED' },
];

export function ScenarioSimulator() {
  const [scenario, setScenario] = useState<SimulationScenario>('SUCCESS');
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const mutation = useMutation({
    mutationFn: createOrder,
    onSuccess: (order) => {
      void queryClient.invalidateQueries({ queryKey: ordersQueryKeys.all });
      showToast({ title: 'Scenario submitted', description: `Order ${order.id.slice(0, 8)} is processing.`, tone: 'success' });
      navigate(`/orders/${order.id}`);
    },
  });
  return <section className="ops-card scenario-simulator" aria-labelledby="scenario-simulator-title">
    <div className="ops-card-heading"><div><span className="section-kicker">Controlled input</span><h2 id="scenario-simulator-title">Scenario simulator</h2><p>Submit a real payment order using deterministic processing behavior.</p></div></div>
    <fieldset disabled={mutation.isPending} className="simulator-options"><legend className="sr-only">Simulation scenario</legend>{scenarios.map((item) => <label key={item.value} className={`simulator-option${scenario === item.value ? ' simulator-option-selected' : ''}`}><input type="radio" name="dashboard-scenario" value={item.value} checked={scenario === item.value} onChange={() => setScenario(item.value)} /><span><strong>{item.label}</strong><small>{item.detail}</small></span></label>)}</fieldset>
    {mutation.isError ? <p className="inline-alert inline-alert-error" role="alert">{getErrorMessage(mutation.error)}</p> : null}
    <div className="simulator-footer"><span>Creates a 15,000 CRC order</span><Button loading={mutation.isPending} onClick={() => mutation.mutate({ amount: 15000, currency: 'CRC', simulationScenario: scenario })}><Play size={16} aria-hidden="true" />Run scenario</Button></div>
  </section>;
}
