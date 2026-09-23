import type { JsonValue } from '../types/api';

export function JsonView({ value }: { value: JsonValue }) {
  return (
    <pre className="json-view" tabIndex={0}>
      <code>{JSON.stringify(value, null, 2)}</code>
    </pre>
  );
}
