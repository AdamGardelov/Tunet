import { memo, useCallback } from 'react';
import { Camera, Check } from '../../icons';

const CameraPresetCard = ({
  cardId,
  settings,
  entities,
  callService,
  dragProps,
  controls,
  cardStyle,
  editMode,
}) => {
  const entityId = settings.entityId || settings.entityIds?.[0];
  const entity = entities[entityId];
  const availableOptions = Array.isArray(entity?.attributes?.options)
    ? entity.attributes.options
    : [];
  const configuredOptions = Array.isArray(settings.options) ? settings.options : [];
  const options = (configuredOptions.length > 0 ? configuredOptions : availableOptions).slice(0, 2);
  const unavailable = !entity || ['unavailable', 'unknown'].includes(entity.state);

  const selectPreset = useCallback(
    (event, option) => {
      event.stopPropagation();
      if (editMode || unavailable || !entityId) return;
      callService('select', 'select_option', { entity_id: entityId, option });
    },
    [callService, editMode, entityId, unavailable]
  );

  return (
    <section
      key={cardId}
      {...dragProps}
      className={`group relative flex h-full items-center gap-3 overflow-hidden rounded-3xl border px-4 py-3 font-sans ${editMode ? 'cursor-move' : ''}`}
      style={cardStyle}
      aria-label={settings.title || 'Kamerapositioner'}
    >
      {controls}
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-sky-400/12 text-sky-300">
        <Camera className="h-6 w-6 stroke-[1.7px]" />
      </span>
      <div className="grid min-w-0 flex-1 grid-cols-2 gap-2">
        {options.map((option) => {
          const active = entity?.state === option;
          return (
            <button
              key={option}
              type="button"
              disabled={editMode || unavailable}
              onClick={(event) => selectPreset(event, option)}
              className={`touch-feedback flex min-w-0 items-center justify-center gap-1.5 rounded-xl border px-2 py-2 text-xs font-bold transition-all active:scale-[0.97] ${
                active
                  ? 'border-sky-400/35 bg-sky-400/12 text-sky-300'
                  : 'border-[var(--glass-border)] bg-[var(--glass-bg)] text-[var(--text-primary)]'
              } ${unavailable ? 'opacity-45' : ''}`}
            >
              <span className="truncate">{option}</span>
              {active && <Check className="h-4 w-4 shrink-0" />}
            </button>
          );
        })}
      </div>
    </section>
  );
};

export default memo(CameraPresetCard);
