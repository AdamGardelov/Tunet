export const compactControlTone = {
  idle: 'border-[var(--glass-border)] bg-[var(--glass-bg)] text-[var(--text-muted)] hover:bg-[var(--glass-bg-hover)]',
  // Accent border makes "on" readable at a glance, not just a faint tint.
  active:
    'border-[color-mix(in_srgb,var(--accent-color)_45%,transparent)] bg-[var(--accent-bg)] text-[var(--accent-color)]',
  success:
    'border-[var(--status-success-border)] bg-[var(--status-success-bg)] text-[var(--status-success-fg)]',
  error:
    'border-[var(--status-error-border)] bg-[var(--status-error-bg)] text-[var(--status-error-fg)]',
};

// Tinted with the card's category accent (--card-accent, set by the card
// renderer) so card types are easy to tell apart; neutral when uncategorised.
export const compactIconTile =
  'flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[color-mix(in_srgb,var(--card-accent,var(--text-muted))_16%,transparent)] text-[var(--card-accent,var(--text-secondary))]';
