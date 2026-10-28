import { memo, useCallback } from 'react';
import { Coffee, getIconComponent } from '../../icons';
import useActionFeedback from '../../hooks/useActionFeedback';
import ActionFeedbackIndicator from '../ui/ActionFeedbackIndicator';
import { compactControlTone, compactIconTile } from '../ui/compactControlStyles';

// Domains that stay on and can be switched back off; anything else (script,
// scene, button) is a one-shot "run" action.
const TOGGLE_DOMAINS = ['light', 'switch', 'input_boolean', 'fan'];

/**
 * One-tap action row, e.g. "Kaffe?" to start the coffee maker in the morning.
 * When to show it is left to the card's visibility condition (a Home
 * Assistant helper such as binary_sensor.kaffetid), so the hours can change
 * without a new release.
 */
const ActionButtonCard = ({
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
  const domain = entityId ? entityId.split('.')[0] : null;
  const canToggle = TOGGLE_DOMAINS.includes(domain);
  const isOn = canToggle && entity?.state === 'on';
  const unavailable = !entity || entity.state === 'unavailable';
  const title = settings.title || entity?.attributes?.friendly_name || entityId || '';
  const Icon = (settings.icon && getIconComponent(settings.icon)) || Coffee;
  const { getStatus, runAction } = useActionFeedback();
  const status = getStatus('action');

  const runPrimary = useCallback(
    (event) => {
      event.stopPropagation();
      if (editMode || unavailable || !entityId) return;
      runAction('action', () => {
        if (canToggle)
          return callService(domain, isOn ? 'turn_off' : 'turn_on', { entity_id: entityId });
        if (domain === 'button') return callService('button', 'press', { entity_id: entityId });
        return callService(domain, 'turn_on', { entity_id: entityId });
      });
    },
    [callService, canToggle, domain, editMode, entityId, isOn, runAction, unavailable]
  );

  const subtitle = unavailable
    ? 'Inte tillgänglig'
    : isOn
      ? settings.onText || 'Är på'
      : settings.offText || '';
  const buttonLabel = isOn ? settings.offLabel || 'Stäng av' : settings.onLabel || 'Starta';
  const tone =
    status === 'error'
      ? compactControlTone.error
      : status === 'success'
        ? compactControlTone.success
        : isOn
          ? compactControlTone.idle
          : compactControlTone.active;

  return (
    <section
      key={cardId}
      {...dragProps}
      className={`group relative flex h-full items-center gap-3 overflow-hidden rounded-3xl border px-5 py-3 font-sans ${editMode ? 'cursor-move' : ''}`}
      style={cardStyle}
      aria-label={title}
      data-on={isOn ? 'true' : undefined}
    >
      {controls}
      <span className={compactIconTile}>
        <Icon className="h-6 w-6 stroke-[1.7px]" aria-hidden="true" />
      </span>
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-sm font-semibold text-[var(--text-primary)]">{title}</span>
        {subtitle && (
          <span
            className="truncate text-xs text-[var(--text-muted)]"
            data-testid="action-button-subtitle"
          >
            {subtitle}
          </span>
        )}
      </div>
      <button
        type="button"
        onClick={runPrimary}
        disabled={editMode || unavailable || status === 'pending'}
        aria-pressed={canToggle ? isOn : undefined}
        data-testid="action-button-primary"
        className={`touch-feedback flex h-11 shrink-0 items-center justify-center gap-1.5 rounded-2xl border px-4 text-[12px] font-bold transition-all duration-200 active:scale-[0.97] disabled:opacity-50 ${tone}`}
      >
        {status !== 'idle' && <ActionFeedbackIndicator status={status} className="h-4 w-4" />}
        {buttonLabel}
      </button>
    </section>
  );
};

export default memo(ActionButtonCard);
