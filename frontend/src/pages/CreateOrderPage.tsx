import { useState, type FormEvent } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft } from '@phosphor-icons/react';
import { Link, useNavigate } from 'react-router-dom';
import { createOrder, ordersQueryKeys } from '../features/orders/api';
import { Button } from '../shared/components/Button';
import { Field, Input, Select } from '../shared/components/FormControls';
import { PageHeader } from '../shared/components/PageHeader';
import type { SimulationScenario } from '../shared/types/api';
import { getErrorMessage } from '../shared/lib/format';

const scenarios: Array<{ value: SimulationScenario; description: string }> = [
  { value: 'SUCCESS', description: 'SUCCESS — completes on initial attempt.' },
  { value: 'FAIL_ONCE', description: 'FAIL ONCE — first attempt fails, then retry succeeds.' },
  { value: 'FAIL_TWICE', description: 'FAIL TWICE — first two attempts fail, then retry succeeds.' },
  { value: 'ALWAYS_FAIL', description: 'ALWAYS FAIL — all attempts fail and retries exhaust.' },
];

export function CreateOrderPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [amount, setAmount] = useState('15000');
  const [currency, setCurrency] = useState('CRC');
  const [simulationScenario, setScenario] = useState<SimulationScenario>('SUCCESS');
  const [error, setError] = useState<string>();
  const mutation = useMutation({ mutationFn: createOrder, onSuccess: (order) => { void queryClient.invalidateQueries({ queryKey: ordersQueryKeys.all }); navigate(`/orders/${order.id}`); } });
  function submit(event: FormEvent) {
    event.preventDefault();
    const parsedAmount = Number(amount);
    if (!Number.isInteger(parsedAmount) || parsedAmount < 1) { setError('Amount must be an integer of at least 1.'); return; }
    if (!/^[A-Z]{3}$/.test(currency)) { setError('Currency must contain three uppercase letters.'); return; }
    setError(undefined);
    mutation.mutate({ amount: parsedAmount, currency, simulationScenario });
  }
  return <div className="page-stack narrow-page">
    <PageHeader title="Create order" description="Submit payment order for asynchronous processing." backLink={<Link className="back-link" to="/orders"><ArrowLeft size={16} aria-hidden="true" />Back to orders</Link>} />
    <form className="form-card" onSubmit={submit} noValidate>
      <Field label="Amount" htmlFor="order-amount" hint="Whole number, minimum 1." error={error?.startsWith('Amount') ? error : undefined}><Input id="order-amount" type="number" min="1" step="1" required value={amount} disabled={mutation.isPending} onChange={(event) => setAmount(event.target.value)} aria-describedby={error?.startsWith('Amount') ? 'order-amount-error' : 'order-amount-hint'} aria-invalid={Boolean(error?.startsWith('Amount'))} /></Field>
      <Field label="Currency" htmlFor="order-currency" hint="Three uppercase letters." error={error?.startsWith('Currency') ? error : undefined}><Input id="order-currency" required maxLength={3} value={currency} disabled={mutation.isPending} onChange={(event) => setCurrency(event.target.value.toUpperCase())} aria-describedby={error?.startsWith('Currency') ? 'order-currency-error' : 'order-currency-hint'} aria-invalid={Boolean(error?.startsWith('Currency'))} /></Field>
      <Field label="Scenario" htmlFor="order-scenario" hint="Simulation behavior used by the order processor."><Select id="order-scenario" value={simulationScenario} disabled={mutation.isPending} onChange={(event) => setScenario(event.target.value as SimulationScenario)} aria-describedby="order-scenario-hint">{scenarios.map((scenario) => <option key={scenario.value} value={scenario.value}>{scenario.description}</option>)}</Select></Field>
      {mutation.isError ? <div className="inline-alert inline-alert-error" role="alert">{getErrorMessage(mutation.error)}</div> : null}
      <div className="form-actions"><Link className="button button-secondary" to="/orders">Cancel</Link><Button type="submit" loading={mutation.isPending}>{mutation.isPending ? 'Creating' : 'Create order'}</Button></div>
    </form>
  </div>;
}
