import type { ReactNode } from 'react';
import { Info } from '@phosphor-icons/react';

export function ConceptTip({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children?: ReactNode;
}) {
  return (
    <aside className="concept-tip" aria-label={title}>
      <Info size={18} aria-hidden="true" />
      <div>
        <strong>{title}</strong>
        <p>{description}</p>
        {children ? <div className="concept-tip-extra">{children}</div> : null}
      </div>
    </aside>
  );
}
