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
import { compactControlTone, compactIconTile } from '../ui/compactControlStyles';

const fallbackIcons = [MapPin, Navigation, Eye, Star];
const gridColumns = {
  1: 'grid-cols-1',
  2: 'grid-cols-2',
  3: 'grid-cols-3',
  4: 'grid-cols-4',
};

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

  const actionCount = options.length + (showLiveButton ? 1 : 0);

  return (
    <section
      key={cardId}
      {...dragProps}
      className={`group relative flex h-full items-center gap-3 overflow-hidden rounded-3xl border px-5 py-3 font-sans ${editMode ? 'cursor-move' : ''}`}
      style={cardStyle}
      aria-label={settings.title || 'Kamerapositioner'}
    >
      {controls}
      {privacyEntity ? (
        <button
          type="button"
          disabled={editMode || privacyUnavailable || getStatus('privacy') === 'pending'}
          onClick={togglePrivacy}
          aria-label={privacyEnabled ? 'Stäng av integritetsläge' : 'Slå på integritetsläge'}
          aria-pressed={privacyEnabled}
          title={privacyEnabled ? 'Integritetsläge på' : 'Integritetsläge av'}
          className={`touch-feedback relative flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border transition-all duration-200 active:scale-[0.94] disabled:opacity-45 ${
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
              <MdCameraOutdoor className="h-6 w-6" data-testid="camera-surveillance-icon" />
            )
          ) : (
            <ActionFeedbackIndicator status={getStatus('privacy')} />
          )}
        </button>
      ) : (
        <span className={compactIconTile}>
          <MdCameraOutdoor className="h-6 w-6" data-testid="camera-surveillance-icon" />
        </span>
      )}
      <div className={`grid min-w-0 flex-1 gap-2 ${gridColumns[actionCount] || 'grid-cols-1'}`}>
        {showLiveButton && (
          <button
            type="button"
            disabled={editMode || privacyEnabled || cameraEntity?.state === 'unavailable'}
            onClick={openLiveStream}
            aria-label="Live"
            title="Live"
            className={`touch-feedback relative flex h-11 min-w-0 items-center justify-center rounded-2xl border px-2 transition-all duration-200 active:scale-[0.94] disabled:opacity-45 ${compactControlTone.idle}`}
          >
            <Video className="h-5 w-5 stroke-[1.7px]" />
            <span className="sr-only">Live</span>
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
              className={`touch-feedback relative flex h-11 min-w-0 items-center justify-center rounded-2xl border px-2 transition-all duration-200 active:scale-[0.94] ${
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
              <span className="sr-only">{option}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
};

export default memo(CameraPresetCard);
