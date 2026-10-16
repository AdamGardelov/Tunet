/**
 * Away mode ("bortaläge"): a household-wide switch, usually an input_boolean
 * that Home Assistant automations listen to, that pauses things which don't
 * need to run while everyone is travelling.
 */

const AWAY_DOMAINS = ['input_boolean', 'switch'];
const AWAY_NAME_PATTERN = /(away|borta|bortal[aä]ge|bortarest|semester|vacation|holiday|ferie)/i;

const isAwayCandidate = (entityId) =>
  typeof entityId === 'string' && AWAY_DOMAINS.includes(entityId.split('.')[0]);

/** Entities that could plausibly be the away-mode switch, best matches first. */
export function listAwayModeCandidates(entities = {}) {
  return Object.keys(entities)
    .filter(isAwayCandidate)
    .map((entityId) => {
      const name = `${entityId} ${entities[entityId]?.attributes?.friendly_name || ''}`;
      return { entityId, matches: AWAY_NAME_PATTERN.test(name) };
    })
    .sort((a, b) => Number(b.matches) - Number(a.matches) || a.entityId.localeCompare(b.entityId))
    .map(({ entityId }) => entityId);
}

/**
 * The configured away-mode entity if it exists; otherwise the single
 * input_boolean/switch whose id or name looks like an away switch.
 * Returns null rather than guessing between several matches.
 */
export function resolveAwayModeEntityId(entities = {}, configuredEntityId) {
  if (configuredEntityId) {
    return entities[configuredEntityId] ? configuredEntityId : null;
  }
  const matches = Object.keys(entities).filter((entityId) => {
    if (!isAwayCandidate(entityId) || !entityId.startsWith('input_boolean.')) return false;
    const name = `${entityId} ${entities[entityId]?.attributes?.friendly_name || ''}`;
    return AWAY_NAME_PATTERN.test(name);
  });
  return matches.length === 1 ? matches[0] : null;
}
