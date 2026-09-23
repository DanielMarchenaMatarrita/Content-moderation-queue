import { Link } from 'react-router-dom';

export function NotFoundPage() {
  return (
    <section className="not-found">
      <span>404 / ROUTE_NOT_FOUND</span>
      <h2>This observation point does not exist.</h2>
      <p>Return to the system map and continue from a known route.</p>
      <Link className="button button-primary" to="/">
        Open dashboard
      </Link>
    </section>
  );
}
