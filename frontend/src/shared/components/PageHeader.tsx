import type { ReactNode } from 'react';

interface PageHeaderProps {
  title: string;
  description: string;
  eyebrow?: string;
  action?: ReactNode;
  backLink?: ReactNode;
}

export function PageHeader({
  title,
  description,
  eyebrow,
  action,
  backLink,
}: PageHeaderProps) {
  return (
    <header className="page-header">
      <div>
        {backLink}
        {eyebrow ? <span className="page-eyebrow">{eyebrow}</span> : null}
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {action ? <div className="page-action">{action}</div> : null}
    </header>
  );
}

interface EndpointPanelProps {
  endpoint: string;
  title: string;
  description: string;
  children?: ReactNode;
}

export function EndpointPanel({
  endpoint,
  title,
  description,
  children,
}: EndpointPanelProps) {
  return (
    <section className="endpoint-panel">
      <div className="endpoint-copy">
        <code>{endpoint}</code>
        <h3>{title}</h3>
        <p>{description}</p>
      </div>
      {children ? <div className="endpoint-meta">{children}</div> : null}
    </section>
  );
}
