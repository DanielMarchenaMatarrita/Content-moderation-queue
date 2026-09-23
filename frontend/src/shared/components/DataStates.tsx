import { WarningCircle } from '@phosphor-icons/react';
import type { ReactNode } from 'react';

export function LoadingState({
  label = 'Loading data',
  rows = 4,
}: {
  label?: string;
  rows?: number;
}) {
  return (
    <div className="state-panel" role="status" aria-live="polite">
      <span className="sr-only">{label}</span>
      <div className="skeleton-table" aria-hidden="true">
        {Array.from({ length: rows }, (_, index) => (
          <div key={index} className="skeleton-row">
            <span />
            <span />
            <span />
          </div>
        ))}
      </div>
    </div>
  );
}

interface EmptyStateProps {
  title: string;
  description: string;
  action?: ReactNode;
}

export function EmptyState({ title, description, action }: EmptyStateProps) {
  return (
    <div className="state-panel">
      <span className="state-code" aria-hidden="true">00</span>
      <h3>{title}</h3>
      <p>{description}</p>
      {action}
    </div>
  );
}

export function ErrorState({
  title = 'Data could not be loaded',
  message,
}: {
  title?: string;
  message: string;
}) {
  return (
    <div className="state-panel state-error" role="alert">
      <WarningCircle size={24} weight="fill" aria-hidden="true" />
      <h3>{title}</h3>
      <p>{message}</p>
    </div>
  );
}
