import {
  CheckCircle,
  ClockCountdown,
  Info,
  SpinnerGap,
  Warning,
  XCircle,
} from '@phosphor-icons/react';

type StatusTone = 'neutral' | 'active' | 'success' | 'warning' | 'danger';

const toneByStatus: Record<string, StatusTone> = {
  PENDING: 'warning',
  PROCESSING: 'active',
  APPROVED: 'success',
  REVIEW_REQUIRED: 'warning',
  REJECTED: 'danger',
  FAILED: 'danger',
  USER: 'neutral',
  MODERATOR: 'active',
  ADMIN: 'success',
};

export function StatusBadge({ status }: { status: string }) {
  const tone = toneByStatus[status] ?? 'neutral';
  const label = status.replaceAll('_', ' ').toLowerCase();
  const Icon =
    status === 'APPROVED'
      ? CheckCircle
      : status === 'REJECTED' || status === 'FAILED'
        ? XCircle
        : status === 'PROCESSING'
          ? SpinnerGap
          : status === 'PENDING'
            ? ClockCountdown
            : status === 'REVIEW_REQUIRED'
              ? Warning
              : Info;

  return (
    <span className={`status-badge status-${tone}`}>
      <Icon
        size={13}
        weight="fill"
        className={status === 'PROCESSING' ? 'spin' : undefined}
        aria-hidden="true"
      />
      <span>{label}</span>
    </span>
  );
}
