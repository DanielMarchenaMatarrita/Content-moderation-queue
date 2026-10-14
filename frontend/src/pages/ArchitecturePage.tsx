import { ArrowLeft, ArrowSquareOut } from '@phosphor-icons/react';
import { Link } from 'react-router-dom';
import { PageHeader } from '../shared/components/PageHeader';

export function ArchitecturePage() {
  return <div className="page-stack architecture-page">
    <PageHeader eyebrow="System reference" title="PayGrid architecture" description="Explore how payment orders move through the asynchronous processing workflow." backLink={<Link className="back-link" to="/"><ArrowLeft size={16} aria-hidden="true" />Back to operations center</Link>} />
    <section className="architecture-canvas" aria-labelledby="architecture-diagram-title">
      <div className="architecture-canvas-copy"><span className="page-eyebrow">Diagram area</span><h2 id="architecture-diagram-title">Interactive architecture diagram</h2><p>Reserved responsive workspace for the detailed system diagram. It will be supplied separately.</p></div>
      <div className="architecture-canvas-placeholder" role="img" aria-label="Reserved area for the PayGrid architecture diagram"><span>PayGrid architecture diagram</span><small>Diagram pending</small></div>
    </section>
    <a className="text-link" href="/docs/architecture/diagrams/paygrid-high-level.architecture.html" target="_blank" rel="noreferrer">Open current detailed reference <ArrowSquareOut size={15} aria-hidden="true" /></a>
  </div>;
}
