import { memo, useCallback } from 'react';
import { AirVent, Lightbulb, Power } from '../../icons';

const toggleDomains = new Set(['light', 'switch', 'input_boolean', 'fan']);

const getCompactName = (entityId, entity) => {
  const name = entity?.attributes?.friendly_name || entityId;
  if (entityId.startsWith('climate.') && /electrolux|air conditioner|klimat/i.test(name)) {
    return 'AC';
  }
  return name;
};

const QuickControlsCard = ({
  cardId,
  settings,
  entities,
  callService,
  dragProps,
  controls,
  cardStyle,
  editMode,
  t,
}) => {
  const entityIds = Array.isArray(settings.entityIds) ? settings.entityIds : [];

  const handleToggle = useCallback(
    (event, entityId) => {
      event.stopPropagation();
      if (editMode) return;
      const entity = entities[entityId];
      if (!entity || ['unavailable', 'unknown'].includes(entity.state)) return;
      const domain = entityId.split('.')[0];
      if (domain === 'climate') {
        callService('climate', entity.state === 'off' ? 'turn_on' : 'turn_off', {
          entity_id: entityId,
        });
      } else if (toggleDomains.has(domain)) {
        callService(domain, 'toggle', { entity_id: entityId });
      }
    },
    [callService, editMode, entities]
  );

  return (
    <section
      key={cardId}
      {...dragProps}
      className={`group relative flex h-full flex-col rounded-3xl border p-3 font-sans ${editMode ? 'cursor-move' : ''}`}
      style={cardStyle}
      aria-label={settings.title || 'Snabbkontroller'}
    >
      {controls}
      <p className="mb-2 px-1 text-[10px] font-bold tracking-[0.18em] text-[var(--text-secondary)] uppercase opacity-60">
        {settings.title || 'Snabbkontroller'}
      </p>
      <div className="grid min-h-0 flex-1 grid-cols-2 gap-2">
        {entityIds.map((entityId) => {
          const entity = entities[entityId];
          const domain = entityId.split('.')[0];
          const unavailable = !entity || ['unavailable', 'unknown'].includes(entity.state);
          const active = !unavailable && entity.state !== 'off';
          const Icon = domain === 'climate' ? AirVent : domain === 'light' ? Lightbulb : Power;
          const temperature = entity?.attributes?.current_temperature;
          const stateLabel = unavailable
            ? t('status.unavailable')
            : domain === 'climate' && active && temperature !== undefined
              ? `${t('common.on')} · ${temperature}°`
              : active
                ? t('common.on')
                : t('common.off');

          return (
            <button
              key={entityId}
              type="button"
              disabled={unavailable || editMode}
              onClick={(event) => handleToggle(event, entityId)}
              className={`touch-feedback flex min-w-0 items-center gap-3 rounded-2xl border px-3 text-left transition-all active:scale-[0.98] ${
                active
                  ? 'border-[var(--accent-color)]/25 bg-[var(--accent-bg)]'
                  : 'border-[var(--glass-border)] bg-[var(--glass-bg)]'
              } ${unavailable ? 'opacity-55' : ''}`}
            >
              <span
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
                  active
                    ? 'bg-[var(--accent-bg)] text-[var(--accent-color)]'
                    : 'bg-[var(--glass-bg-hover)] text-[var(--text-muted)]'
                }`}
              >
                <Icon className="h-5 w-5 stroke-[1.7px]" />
              </span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-bold text-[var(--text-primary)]">
                  {getCompactName(entityId, entity)}
                </span>
                <span className="mt-0.5 block truncate text-[10px] font-bold tracking-wide text-[var(--text-secondary)] uppercase">
                  {stateLabel}
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
};

export default memo(QuickControlsCard);
