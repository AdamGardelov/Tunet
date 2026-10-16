/**
 * Card categories give each kind of card a muted accent colour
 * (see CATEGORY_TOKENS_* in config/themes.js) so different card types are
 * easy to tell apart at a glance.
 */

const PREFIX_CATEGORIES = [
  ['climate_card_', 'climate'],
  ['fan.', 'climate'],
  ['light_', 'light'],
  ['light.', 'light'],
  ['media_player.', 'media'],
  ['media_group_', 'media'],
  ['sonos_group_', 'media'],
  ['androidtv_card_', 'media'],
  ['appletv_card_', 'media'],
  ['vacuum.', 'cleaning'],
  ['lawn_mower.', 'cleaning'],
  ['medication_card_', 'health'],
  ['car_card_', 'car'],
  ['camera_card_', 'security'],
  ['camera_presets_', 'security'],
  ['alarm_card_', 'security'],
  ['lock_card_', 'security'],
  ['lock.', 'security'],
];

/** @param {string} cardId @returns {string|null} */
export function getCardCategory(cardId) {
  if (typeof cardId !== 'string') return null;
  if (cardId === 'car') return 'car';
  for (const [prefix, category] of PREFIX_CATEGORIES) {
    if (cardId.startsWith(prefix)) return category;
  }
  return null;
}

/** CSS colour expression for a category accent. */
export function getCategoryColor(category) {
  return category ? `var(--cat-${category})` : 'var(--accent-color)';
}

/**
 * Applies a faint category tint to a card's base style. Leaves edit/drag
 * styling untouched so edit-mode affordances stay recognisable.
 * @param {Record<string, any>} style
 * @param {string|null} category
 * @param {{ editMode?: boolean, isDragging?: boolean }} [state]
 */
export function applyCategoryTint(style, category, { editMode = false, isDragging = false } = {}) {
  if (!category) return style;
  const color = getCategoryColor(category);
  /** @type {Record<string, any>} */
  const next = { ...style, '--card-accent': color };
  if (editMode || isDragging) return next;
  next.backgroundColor = `color-mix(in srgb, ${color} 6%, var(--card-bg))`;
  next.borderColor = `color-mix(in srgb, ${color} 22%, var(--card-border))`;
  return next;
}
