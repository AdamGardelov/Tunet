import { memo } from 'react';
import { getIconComponent } from '../../icons';
import { Edit2, Trash2, User } from '../../icons';

const PersonStatus = ({
  id,
  entities,
  editMode,
  customNames,
  customIcons,
  cardSettings,
  getCardSettingsKey,
  getEntityImageUrl,
  getS,
  onOpenPerson,
  onEditCard,
  onRemoveCard,
  t: _t,
}) => {
  const entity = entities[id];
  if (!entity && !editMode) return null;

  const isHome = entity?.state === 'home';
  const statusText = getS(id);
  const name = customNames[id] || entity?.attributes?.friendly_name || id;
  const picture = getEntityImageUrl(entity?.attributes?.entity_picture);
  const headerSettingsKey = getCardSettingsKey(id, 'header');
  const headerSettings = cardSettings[headerSettingsKey] || {};
  const personDisplay = headerSettings.personDisplay || 'photo';
  const showName = headerSettings.showName !== false;
  const showState = headerSettings.showState !== false;
  const showZoneBadgeIcon = headerSettings.showZoneBadgeIcon !== false;
  const avatarOnly = !showName && !showState;
  const useIcon = personDisplay === 'icon';
  const personIconName = customIcons[id] || entity?.attributes?.icon;
  const PersonIcon = personIconName ? getIconComponent(personIconName) || User : User;

  const normalizeZoneValue = (value) =>
    String(value || '')
      .trim()
      .toLowerCase()
      .replace(/[\s-]+/g, '_');

  const stateValue = normalizeZoneValue(entity?.state);
  const zoneEntries = Object.entries(entities || {}).filter(([entityId]) =>
    entityId.startsWith('zone.')
  );
  const matchedZoneEntity = (() => {
    if (!stateValue) return null;
    if (stateValue === 'home' && entities?.['zone.home']) return entities['zone.home'];
    const matchedEntry = zoneEntries.find(([zoneId, zone]) => {
      const objectId = normalizeZoneValue(zoneId.split('.')[1]);
      const friendlyName = normalizeZoneValue(zone?.attributes?.friendly_name);
      return objectId === stateValue || friendlyName === stateValue;
    });
    return matchedEntry?.[1] || null;
  })();
  const zoneIconName = matchedZoneEntity?.attributes?.icon;
  const ZoneIcon = zoneIconName ? getIconComponent(zoneIconName) : null;

  return (
    <div
      key={id}
      onClick={(e) => {
        if (!editMode) {
          e.stopPropagation();
          onOpenPerson(id);
        }
      }}
      className={`group relative flex items-center rounded-full transition-all duration-500 hover:bg-[var(--glass-bg)] ${avatarOnly ? 'gap-1 py-1 pr-1.5 pl-1' : 'gap-2.5 py-1.5 pr-4 pl-1.5 sm:gap-3 sm:pr-5'}`}
      style={{
        backgroundColor: 'rgba(255, 255, 255, 0.02)',
        boxShadow: isHome ? '0 0 20px rgba(34, 197, 94, 0.05)' : 'none',
        cursor: editMode ? 'default' : 'pointer',
      }}
    >
      {editMode && (
        <div className="absolute -top-2 -right-2 z-50 flex gap-1">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onEditCard(id, headerSettingsKey);
            }}
            className="rounded-full bg-[var(--accent-color)] p-1 text-white shadow-sm"
          >
            <Edit2 className="h-3 w-3" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onRemoveCard(id, 'header');
            }}
            className="rounded-full bg-red-500/60 p-1 text-white shadow-sm"
          >
            <Trash2 className="h-3 w-3" />
          </button>
        </div>
      )}

      <div className="relative">
        <div
          className="h-9 w-9 overflow-hidden rounded-full bg-gray-800 transition-all duration-500 sm:h-10 sm:w-10"
          style={{ filter: isHome ? 'grayscale(0%)' : 'grayscale(100%) opacity(0.7)' }}
        >
          {useIcon ? (
            <div className="flex h-full w-full items-center justify-center text-[var(--text-secondary)]">
              <PersonIcon className="h-5 w-5" />
            </div>
          ) : picture ? (
            <img src={picture} alt={name} className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-xs font-bold text-[var(--text-muted)]">
              {name.substring(0, 1)}
            </div>
          )}
        </div>

        {showZoneBadgeIcon && ZoneIcon && (
          <div
            className="absolute -top-2 -right-2 z-10 flex h-6 w-6 items-center justify-center rounded-full border-2 border-[var(--card-bg)] text-[var(--text-primary)] shadow-[0_6px_14px_rgba(0,0,0,0.35)]"
            style={{ background: 'color-mix(in srgb, var(--card-bg) 88%, var(--glass-bg) 12%)' }}
            title={String(statusText)}
          >
            <ZoneIcon className="h-3.5 w-3.5" />
          </div>
        )}

        <div
          className="absolute right-0 bottom-0 h-3 w-3 rounded-full border-2 border-[var(--card-bg)] transition-colors duration-500"
          style={{ backgroundColor: isHome ? 'var(--status-success-fg)' : '#52525b' }}
        />
      </div>

      {(showName || showState) && (
        <div className="flex min-w-0 flex-col justify-center">
          {showName && (
            <div className="flex items-center gap-2">
              <span className="max-w-24 truncate text-sm leading-tight font-bold tracking-normal text-[var(--text-primary)] sm:max-w-none sm:tracking-wide">
                {name}
              </span>
            </div>
          )}
          {showState && (
            <span
              className={`max-w-24 truncate text-[11px] leading-tight font-semibold transition-colors duration-300 sm:max-w-none sm:text-xs ${showName ? 'mt-0.5' : ''}`}
              style={{ color: isHome ? 'var(--status-success-fg)' : 'var(--text-secondary)' }}
            >
              {String(statusText)}
            </span>
          )}
        </div>
      )}
    </div>
  );
};

export default memo(PersonStatus);
