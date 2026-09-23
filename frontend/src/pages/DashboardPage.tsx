import { useQuery } from '@tanstack/react-query';
import {
  ArrowRight,
  CheckCircle,
  Database,
  FileArrowUp,
  Gear,
  Package,
  Queue,
} from '@phosphor-icons/react';
import { Link } from 'react-router-dom';
import { contentsQueryKeys, listContents } from '../features/contents/api';
import { LoadingState, EmptyState, ErrorState } from '../shared/components/DataStates';
import { PageHeader } from '../shared/components/PageHeader';
import { StatusBadge } from '../shared/components/StatusBadge';
import { contentPreview, formatDateTime, getErrorMessage } from '../shared/lib/format';

const pipeline = [
  { label: 'Content API', detail: 'Accepts POST /contents', icon: FileArrowUp },
  { label: 'Transactional write', detail: 'PostgreSQL persistence', icon: Database },
  { label: 'Outbox', detail: 'Reliable publication record', icon: Package },
  { label: 'RabbitMQ', detail: 'Message transport', icon: Queue },
  { label: 'Moderation Worker', detail: 'Independent consumer', icon: Gear },
  { label: 'Decision', detail: 'Result and history', icon: CheckCircle },
] as const;

export function DashboardPage() {
  const recentQuery = useQuery({
    queryKey: contentsQueryKeys.list({ page: 1, limit: 5 }),
    queryFn: () => listContents({ page: 1, limit: 5 }),
  });

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Overview"
        title="Content Moderation Queue"
        description="Distributed moderation pipeline powered by transactional outbox and asynchronous message processing."
        action={
          <div className="page-actions">
            <Link className="button button-secondary" to="/contents">View content queue</Link>
            <Link className="button button-primary" to="/contents/new"><FileArrowUp size={18} aria-hidden="true" />Submit content</Link>
          </div>
        }
      />

      <section className="pipeline-card" aria-labelledby="pipeline-title">
        <div className="section-heading">
          <div>
            <h3 id="pipeline-title">Distributed processing path</h3>
            <p>Architecture reference, not live health telemetry.</p>
          </div>
          <span className="live-disclaimer">Explanatory</span>
        </div>
        <ol className="pipeline">
          {pipeline.map((stage, index) => {
            const Icon = stage.icon;
            return (
              <li key={stage.label} className="pipeline-stage">
                <div className="stage-node">
                  <span className="stage-icon"><Icon size={19} aria-hidden="true" /></span>
                  <div>
                    <h4>{stage.label}</h4>
                    <p>{stage.detail}</p>
                  </div>
                </div>
                {index < pipeline.length - 1 ? (
                  <ArrowRight className="pipeline-arrow" size={17} aria-hidden="true" />
                ) : null}
              </li>
            );
          })}
        </ol>
      </section>

      <section className="async-explainer" aria-labelledby="async-title">
        <div><span className="page-eyebrow">Architecture</span><h3 id="async-title">Why asynchronous?</h3></div>
        <ul>
          <li><strong>Decoupling</strong><span>API and moderation worker evolve independently.</span></li>
          <li><strong>Reliable publication</strong><span>Outbox records bridge persistence and messaging.</span></li>
          <li><strong>Independent processing</strong><span>Worker consumes without blocking submission.</span></li>
          <li><strong>Idempotency</strong><span>Consumer markers recognize previously processed events.</span></li>
        </ul>
      </section>

      <section className="data-section" aria-labelledby="recent-contents-title">
        <div className="section-heading section-heading-borderless">
          <div>
            <h3 id="recent-contents-title">Recent content</h3>
            <p>Latest records returned by the Contents API.</p>
          </div>
          <Link className="text-link" to="/contents">View all <ArrowRight size={15} aria-hidden="true" /></Link>
        </div>
        {recentQuery.isPending ? <LoadingState label="Loading recent content" rows={3} /> : null}
        {recentQuery.isError ? (
          <ErrorState message={getErrorMessage(recentQuery.error)} />
        ) : null}
        {recentQuery.data && recentQuery.data.items.length === 0 ? (
          <EmptyState
            title="No content yet"
            description="Submit the first content record to begin observing the queue."
            action={<Link className="button button-primary button-sm" to="/contents/new">Submit content</Link>}
          />
        ) : null}
        {recentQuery.data && recentQuery.data.items.length > 0 ? (
          <div className="recent-list">
            {recentQuery.data.items.map((content) => (
              <Link key={content.id} className="recent-item" to={`/contents/${content.id}`}>
                <div>
                  <strong>{contentPreview(content.body)}</strong>
                  <span>{formatDateTime(content.createdAt)}</span>
                </div>
                <StatusBadge status={content.status} />
              </Link>
            ))}
          </div>
        ) : null}
      </section>
    </div>
  );
}
