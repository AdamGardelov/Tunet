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
  isMobile,
  t,
}) => {
  const entityIds = Array.isArray(settings.entityIds) ? settings.entityIds : [];
  const singleControl = entityIds.length === 1;
  const title = typeof settings.title === 'string' ? settings.title.trim() : '';

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

  const renderControl = (entityId, standalone = false) => {
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
        className={`touch-feedback flex min-h-0 min-w-0 flex-1 items-center gap-3 text-left transition-all active:scale-[0.98] ${standalone ? 'w-full' : 'rounded-xl px-1 py-1'} ${unavailable ? 'opacity-55' : ''}`}
      >
        <span
          className={`flex shrink-0 items-center justify-center bg-[var(--glass-bg-hover)] ${standalone ? 'h-11 w-11 rounded-2xl' : 'h-10 w-10 rounded-xl'} ${active ? 'text-[var(--accent-color)]' : 'text-[var(--text-muted)]'}`}
        >
          <Icon className="h-[22px] w-[22px] stroke-[1.7px]" />
        </span>
        <span className="min-w-0 flex-1">
          <span
            className={`block text-[15px] leading-tight font-bold text-[var(--text-primary)] ${standalone ? 'whitespace-normal' : 'truncate'}`}
          >
            {getCompactName(entityId, entity)}
          </span>
          <span className="mt-0.5 block truncate text-[10px] font-bold tracking-wide text-[var(--text-secondary)] uppercase">
            {stateLabel}
          </span>
        </span>
        {!unavailable && (
          <span
            className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${
              active ? 'bg-[var(--accent-color)]' : 'bg-[var(--glass-bg-hover)]'
            }`}
            aria-hidden="true"
          >
            <span
              className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${
                active ? 'translate-x-[18px]' : 'translate-x-0.5'
              }`}
            />
          </span>
        )}
      </button>
    );
  };

  if (singleControl) {
    const entityId = entityIds[0];
    const entity = entities[entityId];
    return (
      <section
        key={cardId}
        {...dragProps}
        className={`group relative flex h-full items-center overflow-hidden rounded-3xl border px-4 py-3 font-sans ${editMode ? 'cursor-move' : ''}`}
        style={cardStyle}
        aria-label={getCompactName(entityId, entity)}
      >
        {controls}
        {renderControl(entityId, true)}
      </section>
    );
  }

  return (
    <section
      key={cardId}
      {...dragProps}
      className={`group relative flex h-full flex-col overflow-hidden rounded-3xl border font-sans ${isMobile ? 'px-4 py-3' : 'p-3'} ${editMode ? 'cursor-move' : ''}`}
      style={cardStyle}
      aria-label={title || 'Snabbkontroller'}
    >
      {controls}
      {title && (
        <p className="mb-1 px-1 text-[10px] font-bold tracking-[0.18em] text-[var(--text-secondary)] uppercase opacity-60">
          {title}
        </p>
      )}
      <div className="grid min-h-0 flex-1 grid-cols-2 gap-2">
        {entityIds.map((entityId) => renderControl(entityId))}
      </div>
    </section>
  );
};

export default memo(QuickControlsCard);
