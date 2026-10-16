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

const SENSOR_CLASS_CATEGORIES = {
  temperature: 'climate',
  humidity: 'climate',
  heat: 'climate',
  cold: 'climate',
  smoke: 'security',
  gas: 'security',
  carbon_monoxide: 'security',
  door: 'security',
  window: 'security',
  garage_door: 'security',
  opening: 'security',
  lock: 'security',
  motion: 'security',
  occupancy: 'security',
  moisture: 'security',
};

const DOMAIN_CATEGORIES = {
  light: 'light',
  climate: 'climate',
  fan: 'climate',
  water_heater: 'climate',
  media_player: 'media',
  vacuum: 'cleaning',
  lawn_mower: 'cleaning',
  lock: 'security',
  alarm_control_panel: 'security',
  camera: 'security',
};

const HEATING_NAME = /(element|radiator|värme|varme|heater|heating|golvvärme|ovn|omn)/i;

/**
 * Category for a generic sensor/toggle card, from what its entity is:
 * its domain, its device_class, or (for plain switches) a heater-like name.
 * @param {any} entity
 * @param {string} [entityId]
 */
export function getEntityCategory(entity, entityId) {
  const id = entityId || entity?.entity_id || '';
  const domain = id.split('.')[0];
  if (DOMAIN_CATEGORIES[domain]) return DOMAIN_CATEGORIES[domain];
  const deviceClass = entity?.attributes?.device_class;
  if (deviceClass && SENSOR_CLASS_CATEGORIES[deviceClass]) {
    return SENSOR_CLASS_CATEGORIES[deviceClass];
  }
  if (['switch', 'input_boolean'].includes(domain)) {
    const name = `${id} ${entity?.attributes?.friendly_name || ''}`;
    if (HEATING_NAME.test(name)) return 'climate';
  }
  return null;
}

/**
 * @param {string} cardId
 * @param {Record<string, any>} [settings] card settings, for cards whose type depends on content
 * @param {Record<string, any>} [entities] entity map, for generic sensor cards
 * @returns {string|null}
 */
export function getCardCategory(cardId, settings, entities) {
  if (typeof cardId !== 'string') return null;
  if (cardId === 'car') return 'car';
  if (cardId.startsWith('entity_card_') || cardId.startsWith('automation.')) {
    const entityId = settings?.entityId || (cardId.startsWith('automation.') ? cardId : null);
    if (!entityId || !entities) return null;
    return getEntityCategory(entities[entityId], entityId);
  }
  if (cardId.startsWith('quick_controls_')) {
    const ids = Array.isArray(settings?.entityIds) ? settings.entityIds : [];
    if (ids.length > 0 && ids.every((id) => String(id).startsWith('light.'))) return 'light';
    return null;
  }
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
  next.backgroundColor = `color-mix(in srgb, ${color} 10%, var(--card-bg))`;
  next.borderColor = `color-mix(in srgb, ${color} 30%, var(--card-border))`;
  return next;
}
