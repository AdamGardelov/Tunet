import { memo, useCallback } from 'react';
import { MdOutlineStroller } from 'react-icons/md';
import {
  Baby,
  Bed,
  Camera,
  Check,
  Eye,
  Home,
  MapPin,
  Navigation,
  Sofa,
  Star,
  Utensils,
} from '../../icons';
import useActionFeedback from '../../hooks/useActionFeedback';
import ActionFeedbackIndicator from '../ui/ActionFeedbackIndicator';

const fallbackIcons = [MapPin, Navigation, Eye, Star];
const gridColumns = {
  1: 'grid-cols-1',
  2: 'grid-cols-2',
  3: 'grid-cols-3',
  4: 'grid-cols-4',
};

const getPresetIcon = (option, index) => {
  const name = String(option).toLowerCase();
  if (/walter|barn|baby|child/.test(name)) return Baby;
  if (/vagn|stroller|pram/.test(name)) return MdOutlineStroller;
  if (/säng|bed/.test(name)) return Bed;
  if (/vardag|living|soffa/.test(name)) return Sofa;
  if (/kök|kitchen/.test(name)) return Utensils;
  if (/hem|home/.test(name)) return Home;
  return fallbackIcons[index] || MapPin;
};

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
  const options = (configuredOptions.length > 0 ? configuredOptions : availableOptions).slice(0, 4);
  // Tapo's momentary "Move to Preset" select deliberately rests in `unknown`.
  // Its options and select_option service still work, so only a genuinely
  // unavailable/missing entity should disable these buttons.
  const unavailable = !entity || entity.state === 'unavailable';
  const { getStatus, runAction } = useActionFeedback();

  const selectPreset = useCallback(
    (event, option) => {
      event.stopPropagation();
      if (editMode || unavailable || !entityId) return;
      runAction(option, () =>
        callService('select', 'select_option', { entity_id: entityId, option })
      );
    },
    [callService, editMode, entityId, runAction, unavailable]
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
      <div className={`grid min-w-0 flex-1 gap-2 ${gridColumns[options.length] || 'grid-cols-1'}`}>
        {options.map((option, index) => {
          const active = entity?.state === option;
          const actionStatus = getStatus(option);
          const pending = actionStatus === 'pending';
          const PresetIcon = getPresetIcon(option, index);
          return (
            <button
              key={option}
              type="button"
              disabled={editMode || unavailable || pending}
              onClick={(event) => selectPreset(event, option)}
              aria-label={option}
              title={option}
              className={`touch-feedback relative flex min-w-0 items-center justify-center rounded-xl border px-2 py-2 transition-all duration-200 active:scale-[0.94] ${
                actionStatus === 'success'
                  ? 'border-[var(--status-success-border)] bg-[var(--status-success-bg)] text-[var(--status-success-fg)] shadow-[0_0_0_2px_var(--status-success-bg)]'
                  : actionStatus === 'error'
                    ? 'border-[var(--status-error-border)] bg-[var(--status-error-bg)] text-[var(--status-error-fg)]'
                    : active
                      ? 'border-sky-400/35 bg-sky-400/12 text-sky-300'
                      : 'border-[var(--glass-border)] bg-[var(--glass-bg)] text-[var(--text-primary)]'
              } ${unavailable ? 'opacity-45' : ''}`}
            >
              {actionStatus === 'idle' ? (
                <PresetIcon className="h-5 w-5 stroke-[1.7px]" />
              ) : (
                <ActionFeedbackIndicator status={actionStatus} />
              )}
              <span className="sr-only">{option}</span>
              {active && actionStatus === 'idle' && (
                <Check className="absolute top-1 right-1 h-3 w-3" />
              )}
            </button>
          );
        })}
      </div>
    </section>
  );
};

export default memo(CameraPresetCard);
