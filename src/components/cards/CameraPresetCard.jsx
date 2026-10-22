import { memo, useCallback } from 'react';
import { MdCameraOutdoor, MdOutlineStroller } from 'react-icons/md';
import {
  Baby,
  Bed,
  Eye,
  EyeOff,
  Home,
  MapPin,
  Navigation,
  Sofa,
  Star,
  Utensils,
  Video,
} from '../../icons';
import useActionFeedback from '../../hooks/useActionFeedback';
import ActionFeedbackIndicator from '../ui/ActionFeedbackIndicator';
import { compactControlTone } from '../ui/compactControlStyles';

const fallbackIcons = [MapPin, Navigation, Eye, Star];

const getHouseholdPresetRank = (option) => {
  const name = String(option).toLowerCase();
  if (/walter/.test(name)) return 0;
  if (/våran säng|our bed/.test(name)) return 1;
  if (/vagn|stroller|pram/.test(name)) return 2;
  return 3;
};

const orderDefaultPresets = (options) =>
  options
    .map((option, index) => ({ option, index, rank: getHouseholdPresetRank(option) }))
    .sort((a, b) => a.rank - b.rank || a.index - b.index)
    .map(({ option }) => option);

export const resolvePresetCameraId = (selectEntityId, entities, configuredCameraId) => {
  if (configuredCameraId && entities[configuredCameraId]) return configuredCameraId;
  const selectorName = String(selectEntityId || '').replace(/^select\./, '');
  const cameraStem = selectorName.replace(/_(?:move_to_)?preset.*$/i, '');
  if (!cameraStem) return null;
  return (
    Object.keys(entities).find(
      (candidateId) => candidateId.startsWith('camera.') && candidateId.includes(cameraStem)
    ) || null
  );
};

export const resolvePrivacySwitchId = (selectEntityId, entities, configuredPrivacyEntityId) => {
  if (configuredPrivacyEntityId && entities[configuredPrivacyEntityId]) {
    return configuredPrivacyEntityId;
  }

  const cameraStem = String(selectEntityId || '')
    .replace(/^select\./, '')
    .replace(/_(?:move_to_)?preset.*$/i, '');
  const privacyCandidates = Object.entries(entities).filter(([candidateId, candidate]) => {
    if (!candidateId.startsWith('switch.')) return false;
    const haystack = `${candidateId} ${candidate?.attributes?.friendly_name || ''}`.toLowerCase();
    return /privacy|integritet/.test(haystack);
  });

  return (
    privacyCandidates.find(([candidateId, candidate]) => {
      const haystack = `${candidateId} ${candidate?.attributes?.friendly_name || ''}`.toLowerCase();
      return cameraStem && haystack.includes(cameraStem);
    })?.[0] || (privacyCandidates.length === 1 ? privacyCandidates[0][0] : null)
  );
};

export const resolvePresetStateEntityId = (
  selectEntityId,
  entities,
  configuredStateEntityId,
  presetOptions = []
) => {
  if (configuredStateEntityId && entities[configuredStateEntityId]) {
    return configuredStateEntityId;
  }

  const normalizedOptions = new Set(presetOptions.map((option) => String(option).toLowerCase()));
  const cameraStem = String(selectEntityId || '')
    .replace(/^select\./, '')
    .replace(/_(?:move_to_)?preset.*$/i, '');

  const candidates = Object.entries(entities).filter(([candidateId, candidate]) => {
    if (!candidateId.startsWith('input_select.')) return false;
    const options = Array.isArray(candidate?.attributes?.options)
      ? candidate.attributes.options
      : [];
    return options.some((option) => normalizedOptions.has(String(option).toLowerCase()));
  });

  return (
    candidates.find(([candidateId, candidate]) => {
      const haystack = `${candidateId} ${candidate?.attributes?.friendly_name || ''}`.toLowerCase();
      return (
        /kamera.*position|camera.*position/.test(haystack) ||
        (cameraStem && haystack.includes(cameraStem))
      );
    })?.[0] || null
  );
};

// Short tile labels, as in the design; the full preset name stays the accessible name.
const getPresetLabel = (option) => {
  const name = String(option);
  if (/walter/i.test(name)) return 'Walter';
  if (/våran säng|vår säng|our bed/i.test(name)) return 'Vår säng';
  if (/vagn|stroller|pram/i.test(name)) return 'Vagn';
  return name;
};

const tileClass =
  'touch-feedback relative flex h-16 min-w-0 flex-col items-center justify-center gap-1.5 rounded-[14px] border px-1 text-[11px] font-semibold transition-all duration-200 active:scale-[0.96] disabled:opacity-45';

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
  onOpenCamera,
}) => {
  const entityId = settings.entityId || settings.entityIds?.[0];
  const entity = entities[entityId];
  const cameraId = resolvePresetCameraId(entityId, entities, settings.cameraId);
  const cameraEntity = cameraId ? entities[cameraId] : null;
  const privacyEntityId = resolvePrivacySwitchId(entityId, entities, settings.privacyEntityId);
  const privacyEntity = privacyEntityId ? entities[privacyEntityId] : null;
  const privacyEnabled = privacyEntity?.state === 'on';
  const privacyUnavailable = !privacyEntity || privacyEntity.state === 'unavailable';
  const showLiveButton = Boolean(onOpenCamera && cameraEntity);
  const availableOptions = Array.isArray(entity?.attributes?.options)
    ? entity.attributes.options
    : [];
  const configuredOptions = Array.isArray(settings.options) ? settings.options : [];
  const options = (
    configuredOptions.length > 0 ? configuredOptions : orderDefaultPresets(availableOptions)
  ).slice(0, showLiveButton ? 3 : 4);
  const stateEntityId = resolvePresetStateEntityId(
    entityId,
    entities,
    settings.stateEntityId,
    options
  );
  const stateEntity = stateEntityId ? entities[stateEntityId] : null;
  // Tapo's momentary "Move to Preset" select deliberately rests in `unknown`.
  // Its options and select_option service still work, so only a genuinely
  // unavailable/missing entity should disable these buttons.
  const unavailable = !entity || entity.state === 'unavailable';
  const { getStatus, runAction } = useActionFeedback();

  const togglePrivacy = useCallback(
    (event) => {
      event.stopPropagation();
      if (editMode || privacyUnavailable || !privacyEntityId) return;
      runAction('privacy', () =>
        callService('switch', privacyEnabled ? 'turn_off' : 'turn_on', {
          entity_id: privacyEntityId,
        })
      );
    },
    [callService, editMode, privacyEnabled, privacyEntityId, privacyUnavailable, runAction]
  );

  const selectPreset = useCallback(
    (event, option) => {
      event.stopPropagation();
      if (editMode || unavailable || privacyEnabled || !entityId) return;
      runAction(option, async () => {
        await callService('select', 'select_option', { entity_id: entityId, option });
        if (stateEntityId) {
          await callService('input_select', 'select_option', {
            entity_id: stateEntityId,
            option,
          });
        }
      });
    },
    [callService, editMode, entityId, privacyEnabled, runAction, stateEntityId, unavailable]
  );

  const openLiveStream = useCallback(
    (event) => {
      event.stopPropagation();
      if (editMode || privacyEnabled || !cameraId || cameraEntity?.state === 'unavailable') return;
      onOpenCamera(cameraId);
    },
    [cameraEntity?.state, cameraId, editMode, onOpenCamera, privacyEnabled]
  );

  const tileCount = options.length + (showLiveButton ? 1 : 0) + 1;
  const activeOption = options.find((option) => (stateEntity?.state || entity?.state) === option);
  const statusText = privacyEnabled
    ? 'Privat läge på'
    : activeOption
      ? `Visar ${getPresetLabel(activeOption)}`
      : '';

  return (
    <section
      key={cardId}
      {...dragProps}
      className={`group relative flex flex-col gap-2.5 overflow-hidden rounded-3xl border p-3 font-sans ${editMode ? 'cursor-move' : ''}`}
      style={cardStyle}
      aria-label={settings.title || 'Kamera'}
    >
      {controls}
      <div className="flex items-center gap-2 px-1">
        <Video
          className="h-4 w-4 shrink-0 stroke-[1.8px] text-[var(--card-accent,var(--accent-color))]"
          aria-hidden="true"
        />
        <h2 className="m-0 truncate text-[13px] font-semibold text-[var(--text-secondary)]">
          {settings.title || 'Kamera'}
        </h2>
        {statusText && (
          <span
            className="ml-auto shrink-0 text-xs text-[var(--text-muted)]"
            data-testid="camera-status-text"
          >
            {statusText}
          </span>
        )}
      </div>
      <div
        className="grid min-w-0 gap-1.5"
        style={{ gridTemplateColumns: `repeat(${tileCount}, minmax(0, 1fr))` }}
      >
        {privacyEntity ? (
          <button
            type="button"
            disabled={editMode || privacyUnavailable || getStatus('privacy') === 'pending'}
            onClick={togglePrivacy}
            aria-label={privacyEnabled ? 'Stäng av integritetsläge' : 'Slå på integritetsläge'}
            aria-pressed={privacyEnabled}
            title={privacyEnabled ? 'Integritetsläge på' : 'Integritetsläge av'}
            className={`${tileClass} ${
              getStatus('privacy') === 'success'
                ? compactControlTone.success
                : getStatus('privacy') === 'error'
                  ? compactControlTone.error
                  : privacyEnabled
                    ? compactControlTone.active
                    : compactControlTone.idle
            }`}
          >
            {getStatus('privacy') === 'idle' ? (
              privacyEnabled ? (
                <EyeOff className="h-5 w-5 stroke-[1.7px]" data-testid="camera-privacy-icon" />
              ) : (
                <MdCameraOutdoor className="h-5 w-5" data-testid="camera-surveillance-icon" />
              )
            ) : (
              <ActionFeedbackIndicator status={getStatus('privacy')} />
            )}
            <span aria-hidden="true">Privat</span>
          </button>
        ) : (
          <span className={`${tileClass} ${compactControlTone.idle}`}>
            <MdCameraOutdoor className="h-5 w-5" data-testid="camera-surveillance-icon" />
            <span aria-hidden="true">Kamera</span>
          </span>
        )}
        {showLiveButton && (
          <button
            type="button"
            disabled={editMode || privacyEnabled || cameraEntity?.state === 'unavailable'}
            onClick={openLiveStream}
            aria-label="Live"
            title="Live"
            className={`${tileClass} ${compactControlTone.idle}`}
          >
            <Video className="h-5 w-5 stroke-[1.7px]" />
            <span aria-hidden="true">Live</span>
          </button>
        )}
        {options.map((option, index) => {
          const active = (stateEntity?.state || entity?.state) === option;
          const actionStatus = getStatus(option);
          const pending = actionStatus === 'pending';
          const PresetIcon = getPresetIcon(option, index);
          return (
            <button
              key={option}
              type="button"
              disabled={editMode || unavailable || privacyEnabled || pending}
              onClick={(event) => selectPreset(event, option)}
              aria-label={option}
              aria-pressed={active}
              title={option}
              className={`${tileClass} ${
                actionStatus === 'success'
                  ? compactControlTone.success
                  : actionStatus === 'error'
                    ? compactControlTone.error
                    : active
                      ? compactControlTone.active
                      : compactControlTone.idle
              } ${unavailable || privacyEnabled ? 'opacity-45' : ''}`}
            >
              {actionStatus === 'idle' ? (
                <PresetIcon className="h-5 w-5 stroke-[1.7px]" />
              ) : (
                <ActionFeedbackIndicator status={actionStatus} />
              )}
              <span aria-hidden="true" className="max-w-full truncate">
                {getPresetLabel(option)}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
};

export default memo(CameraPresetCard);
