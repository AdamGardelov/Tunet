// Remote-control key codes per TV family. Samsung's integration expects its
// own KEY_* codes; Android TV / Google TV use the DPAD_* names.
const SAMSUNG_KEYS = {
  up: 'KEY_UP',
  down: 'KEY_DOWN',
  left: 'KEY_LEFT',
  right: 'KEY_RIGHT',
  ok: 'KEY_ENTER',
  back: 'KEY_RETURN',
};

const ANDROID_KEYS = {
  up: 'DPAD_UP',
  down: 'DPAD_DOWN',
  left: 'DPAD_LEFT',
  right: 'DPAD_RIGHT',
  ok: 'DPAD_CENTER',
  back: 'BACK',
};

const isSamsung = (...entities) =>
  entities.some((entity) => {
    if (!entity) return false;
    const text = `${entity.entity_id || ''} ${entity.attributes?.friendly_name || ''}`;
    return text.toLowerCase().includes('samsung');
  });

/**
 * Find the remote entity that belongs to a TV media player and the key codes
 * it understands. HA names the remote after the same device, so it shares the
 * media player's object id (media_player.x → remote.x). Returns null when the
 * TV has no remote we know how to drive.
 */
export function getTvRemote(mediaPlayerId, entities) {
  if (!mediaPlayerId || !entities) return null;
  const [domain, objectId] = String(mediaPlayerId).split('.');
  if (domain !== 'media_player' || !objectId) return null;

  const remoteId = `remote.${objectId}`;
  const remote = entities[remoteId];
  if (!remote || remote.state === 'unavailable') return null;

  const player = entities[mediaPlayerId];
  return {
    remoteId,
    keys: isSamsung(player, remote) ? SAMSUNG_KEYS : ANDROID_KEYS,
  };
}
