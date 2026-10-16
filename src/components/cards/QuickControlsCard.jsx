import { memo, useCallback } from 'react';
import { AirVent, Lightbulb, Power } from '../../icons';
import useActionFeedback from '../../hooks/useActionFeedback';
import ActionFeedbackIndicator from '../ui/ActionFeedbackIndicator';
import { compactControlTone, compactIconTile } from '../ui/compactControlStyles';
import { getLightColor } from '../../utils/lightColor';

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
  const singleControl = entityIds.length === 1;
  const sharedLightIcon =
    entityIds.length > 1 && entityIds.every((entityId) => entityId.startsWith('light.'));
  const configuredTitle = typeof settings.title === 'string' ? settings.title.trim() : '';
  const title =
    configuredTitle.toLocaleLowerCase('sv-SE') === 'snabbkontroller' ? '' : configuredTitle;
  const { getStatus, runAction } = useActionFeedback();

  const handleToggle = useCallback(
    (event, entityId) => {
      event.stopPropagation();
      if (editMode) return;
      const entity = entities[entityId];
      if (!entity || ['unavailable', 'unknown'].includes(entity.state)) return;
      const domain = entityId.split('.')[0];
      if (domain === 'climate') {
        runAction(entityId, () =>
          callService('climate', entity.state === 'off' ? 'turn_on' : 'turn_off', {
            entity_id: entityId,
          })
        );
      } else if (toggleDomains.has(domain)) {
        runAction(entityId, () => callService(domain, 'toggle', { entity_id: entityId }));
      }
    },
    [callService, editMode, entities, runAction]
  );

  const renderControl = (
    entityId,
    standalone = false,
    showEntityIcon = true,
    useFullTile = false
  ) => {
    const entity = entities[entityId];
    const domain = entityId.split('.')[0];
    const unavailable = !entity || ['unavailable', 'unknown'].includes(entity.state);
    const active = !unavailable && entity.state !== 'off';
    const actionStatus = getStatus(entityId);
    const pending = actionStatus === 'pending';
    const lightColor = domain === 'light' ? getLightColor(entity) : null;
    const Icon = domain === 'climate' ? AirVent : domain === 'light' ? Lightbulb : Power;
    const temperature = entity?.attributes?.current_temperature;
    const stateLabel = unavailable
      ? t('status.unavailable')
      : domain === 'climate' && active && temperature !== undefined
        ? `${t('common.on')} · ${temperature}°`
        : active
          ? t('common.on')
          : t('common.off');
    const tileFeedbackTone =
      actionStatus === 'success'
        ? compactControlTone.success
        : actionStatus === 'error'
          ? compactControlTone.error
          : active
            ? 'border-transparent text-[var(--text-primary)] shadow-sm'
            : compactControlTone.idle;
    const tileStyle =
      useFullTile && active && actionStatus === 'idle' && lightColor
        ? {
            backgroundColor: `rgba(${lightColor}, 0.18)`,
            borderColor: `rgba(${lightColor}, 0.32)`,
            boxShadow: `inset 0 0 0 1px rgba(${lightColor}, 0.05)`,
          }
        : undefined;

    return (
      <button
        key={entityId}
        type="button"
        disabled={unavailable || editMode || pending}
        onClick={(event) => handleToggle(event, entityId)}
        aria-pressed={unavailable ? undefined : active}
        data-testid={useFullTile ? `quick-control-tile-${entityId}` : undefined}
        className={`touch-feedback flex min-h-0 min-w-0 flex-1 items-center transition-all duration-200 active:scale-[0.96] ${
          useFullTile
            ? `relative h-14 justify-center gap-1 rounded-2xl border px-2 text-center ${tileFeedbackTone}`
            : `${standalone ? 'w-full' : 'rounded-xl py-1'} gap-3 text-left`
        } ${unavailable ? 'opacity-55' : ''} ${!useFullTile && actionStatus === 'success' ? 'text-[var(--status-success-fg)]' : !useFullTile && actionStatus === 'error' ? 'text-[var(--status-error-fg)]' : ''}`}
        style={tileStyle}
      >
        {showEntityIcon && (
          <span className={compactIconTile} data-testid={`quick-control-entity-icon-${entityId}`}>
            <Icon className="h-[22px] w-[22px] stroke-[1.7px]" />
          </span>
        )}
        <span className={`min-w-0 ${useFullTile ? '' : 'flex-1'}`}>
          <span
            className={`block leading-tight font-bold text-[var(--text-primary)] ${useFullTile ? 'text-[13px] whitespace-normal' : `text-[15px] ${standalone ? 'whitespace-normal' : 'truncate'}`}`}
          >
            {getCompactName(entityId, entity)}
          </span>
          <span className="mt-0.5 flex min-h-4 items-center justify-center gap-1 text-xs font-medium text-[var(--text-secondary)]">
            <span className="truncate">{stateLabel}</span>
            {useFullTile && !unavailable && actionStatus !== 'idle' && (
              <ActionFeedbackIndicator status={actionStatus} className="h-3.5 w-3.5" />
            )}
          </span>
        </span>
        {!useFullTile && !unavailable && actionStatus !== 'idle' ? (
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--glass-bg-hover)]">
            <ActionFeedbackIndicator status={actionStatus} className="h-4 w-4" />
          </span>
        ) : !useFullTile && !unavailable ? (
          <span
            data-testid={`quick-control-power-${entityId}`}
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full border transition-all duration-300 ${active ? (lightColor ? 'shadow-sm' : compactControlTone.active) : compactControlTone.idle}`}
            style={
              active && lightColor
                ? {
                    backgroundColor: `rgba(${lightColor}, 0.22)`,
                    borderColor: `rgba(${lightColor}, 0.28)`,
                    color: `rgb(${lightColor})`,
                  }
                : undefined
            }
            aria-hidden="true"
          >
            <Power className="h-4 w-4" />
          </span>
        ) : null}
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
        className={`group relative flex h-full items-center overflow-hidden rounded-3xl border px-5 py-3 font-sans ${editMode ? 'cursor-move' : ''}`}
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
      className={`group relative flex h-full flex-col overflow-hidden rounded-3xl border px-5 py-3 font-sans ${editMode ? 'cursor-move' : ''}`}
      style={cardStyle}
      aria-label={title || 'Snabbkontroller'}
    >
      {controls}
      {title && (
        <p className="mb-1 px-1 text-[10px] font-bold tracking-[0.18em] text-[var(--text-secondary)] uppercase opacity-60">
          {title}
        </p>
      )}
      <div className={`flex min-h-0 flex-1 items-center ${sharedLightIcon ? 'gap-3' : ''}`}>
        {sharedLightIcon && (
          <span className={compactIconTile} data-testid="quick-controls-shared-light-icon">
            <Lightbulb className="h-[22px] w-[22px] stroke-[1.7px]" />
          </span>
        )}
        <div className="grid min-w-0 flex-1 grid-cols-2 gap-2">
          {entityIds.map((entityId) =>
            renderControl(entityId, false, !sharedLightIcon, sharedLightIcon)
          )}
        </div>
      </div>
    </section>
  );
};

export default memo(QuickControlsCard);
