export function formatDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

export function formatCompactId(value: string): string {
  return value.length > 16 ? `${value.slice(0, 8)}...${value.slice(-4)}` : value;
}

export function contentPreview(value: string, maxLength = 92): string {
  const normalized = value.replace(/\s+/g, ' ').trim();
  return normalized.length > maxLength
    ? `${normalized.slice(0, maxLength).trimEnd()}...`
    : normalized;
}

export function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Unexpected request error';
}
