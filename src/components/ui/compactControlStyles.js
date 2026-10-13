export const compactControlTone = {
  idle:
    'border-[var(--glass-border)] bg-[var(--glass-bg)] text-[var(--text-muted)] hover:bg-[var(--glass-bg-hover)]',
  active: 'border-transparent bg-[var(--accent-color)] text-white shadow-lg shadow-black/20',
  success:
    'border-transparent bg-[var(--status-success-fg)] text-white shadow-lg shadow-black/20',
  error:
    'border-[var(--status-error-border)] bg-[var(--status-error-bg)] text-[var(--status-error-fg)]',
};

export const compactIconTile =
  'flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[var(--glass-bg-hover)] text-[var(--text-muted)]';
