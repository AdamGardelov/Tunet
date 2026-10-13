import { Check, RefreshCw, X } from '../../icons';

const presentation = {
  pending: {
    Icon: RefreshCw,
    label: 'Skickar',
    className: 'animate-spin text-[var(--accent-color)]',
  },
  success: {
    Icon: Check,
    label: 'Klart',
    className: 'text-[var(--status-success-fg)]',
  },
  error: {
    Icon: X,
    label: 'Misslyckades',
    className: 'text-[var(--status-error-fg)]',
  },
};

export default function ActionFeedbackIndicator({ status, className = 'h-5 w-5' }) {
  const state = presentation[status];
  if (!state) return null;

  const { Icon, label, className: toneClassName } = state;
  return (
    <span
      role="status"
      aria-label={label}
      className="inline-flex shrink-0 items-center justify-center"
    >
      <Icon aria-hidden="true" className={`${className} ${toneClassName}`} />
      <span className="sr-only">{label}</span>
    </span>
  );
}
