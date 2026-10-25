import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { Cat, Check, EllipsisVertical } from '../../icons';
import useActionFeedback from '../../hooks/useActionFeedback';
import ActionFeedbackIndicator from '../ui/ActionFeedbackIndicator';
import { compactControlTone, compactIconTile } from '../ui/compactControlStyles';

const DEFAULT_REFILL_DOSES = 120;
// Matches the Home Assistant reminder to buy a new inhaler (14 days = 28 doses).
const DEFAULT_LOW_SUPPLY_DAYS = 14;

const scriptSetting = (value) =>
  typeof value === 'string' && value.startsWith('script.') ? value : null;

const menuButtonClass =
  'touch-feedback flex h-11 min-w-0 flex-1 items-center justify-center gap-1.5 rounded-2xl border px-2 text-[12px] font-bold active:scale-[0.97] disabled:opacity-50';

const findEntity = (entityIds, pattern, fallbackDomains, entities, used = new Set()) =>
  entityIds.find((id) => !used.has(id) && pattern.test(id)) ||
  entityIds.find(
    (id) => !used.has(id) && fallbackDomains.includes(id.split('.')[0]) && entities[id]
  );

const MedicationCard = ({
  cardId,
  settings,
  entities,
  callService,
  dragProps,
  controls,
  cardStyle,
  editMode,
}) => {
  const mapping = useMemo(() => {
    const entityIds = Array.isArray(settings.entityIds) ? settings.entityIds : [];
    const used = new Set();
    const doseId =
      settings.doseEntityId ||
      findEntity(entityIds, /dos|dose|inhal/i, ['input_number', 'sensor'], entities, used);
    if (doseId) used.add(doseId);
    const morningId =
      settings.morningEntityId ||
      findEntity(entityIds, /morgon|morning/i, ['input_boolean', 'switch'], entities, used);
    if (morningId) used.add(morningId);
    const eveningId =
      settings.eveningEntityId ||
      findEntity(entityIds, /kv[aä]ll|evening/i, ['input_boolean', 'switch'], entities, used);
    return { doseId, morningId, eveningId };
  }, [
    entities,
    settings.entityIds,
    settings.doseEntityId,
    settings.eveningEntityId,
    settings.morningEntityId,
  ]);

  const doses = Number.parseFloat(entities[mapping.doseId]?.state);
  const hasDoseValue = Number.isFinite(doses);
  const days = hasDoseValue ? Math.ceil(doses / 2) : null;
  // Days left only matter once it's time to buy a new inhaler; until then the
  // card just shows its title.
  const lowSupplyDays =
    Number(settings.lowSupplyDays) > 0 ? Number(settings.lowSupplyDays) : DEFAULT_LOW_SUPPLY_DAYS;
  const showSupply = !hasDoseValue || days <= lowSupplyDays;
  const { getStatus, runAction } = useActionFeedback();

  // "Ny inhalator köpt" sits behind the cat icon so it can't be hit by mistake:
  // tap the icon, then confirm. Resets via a script when one is configured
  // (it can also clear reminders), otherwise sets the dose counter directly.
  // null = normal row, 'menu' = the choices, 'extra' = how many extra doses,
  // 'confirm' = asks before resetting the counter.
  const [refillStep, setRefillStep] = useState(
    /** @type {null | 'menu' | 'extra' | 'confirm'} */ (null)
  );
  const refillOpen = refillStep !== null;
  const refillDoses =
    Number(settings.refillDoses) > 0 ? Number(settings.refillDoses) : DEFAULT_REFILL_DOSES;
  const refillScriptId =
    typeof settings.refillScriptId === 'string' && settings.refillScriptId.startsWith('script.')
      ? settings.refillScriptId
      : null;
  const canRefill = Boolean(refillScriptId) || Boolean(mapping.doseId?.startsWith('input_number.'));
  const refillStatus = getStatus('refill');

  // Extra doses (the cat pulled away or wouldn't breathe in): recorded by a
  // Home Assistant script that lowers the dose counter, counts them for the
  // morning or evening and logs them; shown as "+N" on that dose button.
  const extraDoseScriptId = scriptSetting(settings.extraDoseScriptId);
  const undoExtraDoseScriptId = scriptSetting(settings.undoExtraDoseScriptId);
  const extraMorning = Number.parseInt(entities[settings.extraMorningEntityId]?.state, 10) || 0;
  const extraEvening = Number.parseInt(entities[settings.extraEveningEntityId]?.state, 10) || 0;
  const canExtra = Boolean(extraDoseScriptId);
  const canUndoExtra = Boolean(undoExtraDoseScriptId) && extraMorning + extraEvening > 0;
  const hasMenu = canRefill || canExtra;

  // Both doses given: the card steps back to one quiet "done for today" line.
  // Tapping it brings the two dose buttons back (to undo a mistaken tap).
  const morningDone = entities[mapping.morningId]?.state === 'on';
  const eveningDone = entities[mapping.eveningId]?.state === 'on';
  const dayDone = Boolean(mapping.morningId && mapping.eveningId) && morningDone && eveningDone;
  const [showDoseButtons, setShowDoseButtons] = useState(false);
  useEffect(() => {
    if (!dayDone) setShowDoseButtons(false);
  }, [dayDone]);
  const collapsed = dayDone && !showDoseButtons && !editMode;
  const extraToday = extraMorning + extraEvening;

  const runMenuScript = useCallback(
    async (event, key, scriptId, variables = undefined) => {
      event.stopPropagation();
      if (editMode || !scriptId) return;
      const ok = await runAction(key, () =>
        callService('script', 'turn_on', {
          entity_id: scriptId,
          ...(variables ? { variables } : {}),
        })
      );
      if (ok) setRefillStep(null);
    },
    [callService, editMode, runAction]
  );

  const confirmRefill = useCallback(
    async (event) => {
      event.stopPropagation();
      if (editMode || !canRefill) return;
      const ok = await runAction('refill', () =>
        refillScriptId
          ? callService('script', 'turn_on', { entity_id: refillScriptId })
          : callService('input_number', 'set_value', {
              entity_id: mapping.doseId,
              value: refillDoses,
            })
      );
      if (ok) setRefillStep(null);
    },
    [callService, canRefill, editMode, mapping.doseId, refillDoses, refillScriptId, runAction]
  );

  const toggleDose = useCallback(
    (event, entityId) => {
      event.stopPropagation();
      if (editMode || !entityId) return;
      const domain = entityId.split('.')[0];
      if (!['input_boolean', 'switch'].includes(domain)) return;

      runAction(entityId, async () => {
        const wasDone = entities[entityId]?.state === 'on';
        if (hasDoseValue && mapping.doseId?.startsWith('input_number.')) {
          const doseEntity = entities[mapping.doseId];
          const minimum = Number.parseFloat(doseEntity?.attributes?.min);
          const maximum = Number.parseFloat(doseEntity?.attributes?.max);
          let nextDoses = doses + (wasDone ? 1 : -1);
          if (Number.isFinite(minimum)) nextDoses = Math.max(minimum, nextDoses);
          else nextDoses = Math.max(0, nextDoses);
          if (Number.isFinite(maximum)) nextDoses = Math.min(maximum, nextDoses);

          await callService('input_number', 'set_value', {
            entity_id: mapping.doseId,
            value: nextDoses,
          });
        }

        await callService(domain, 'toggle', { entity_id: entityId });
      });
    },
    [callService, doses, editMode, entities, hasDoseValue, mapping.doseId, runAction]
  );

  const DoseButton = ({ entityId, label, extra = 0 }) => {
    const done = entities[entityId]?.state === 'on';
    const actionStatus = getStatus(entityId);
    const pending = actionStatus === 'pending';
    const unavailable =
      !entityId || !entities[entityId] || entities[entityId].state === 'unavailable';
    const tone =
      actionStatus === 'error'
        ? compactControlTone.error
        : actionStatus === 'success' || done
          ? compactControlTone.success
          : compactControlTone.idle;
    return (
      <button
        type="button"
        role="checkbox"
        disabled={editMode || unavailable || pending}
        onClick={(event) => toggleDose(event, entityId)}
        aria-checked={unavailable ? undefined : done}
        aria-label={`${label} ${done ? 'tagen' : 'inte tagen'}${extra > 0 ? `, ${extra} extra` : ''}`}
        data-testid={`medication-dose-control-${entityId}`}
        className={`touch-feedback relative flex h-11 min-w-0 items-center justify-center rounded-2xl border px-2 text-[11px] font-bold transition-all duration-200 active:scale-[0.97] ${tone} ${unavailable ? 'opacity-45' : ''}`}
      >
        <span className="flex min-w-0 items-center justify-center gap-1.5">
          <span className="truncate">{label}</span>
          {extra > 0 && (
            <span className="shrink-0 tabular-nums" data-testid={`medication-extra-${entityId}`}>
              +{extra}
            </span>
          )}
          {(done || actionStatus !== 'idle') && (
            <span
              className="flex h-4 w-4 shrink-0 items-center justify-center"
              data-testid={`medication-dose-indicator-${entityId}`}
            >
              {actionStatus === 'idle' ? (
                <Check aria-hidden="true" className="h-4 w-4" />
              ) : (
                <ActionFeedbackIndicator status={actionStatus} className="h-4 w-4" />
              )}
            </span>
          )}
        </span>
      </button>
    );
  };

  return (
    <section
      key={cardId}
      {...dragProps}
      className={`group relative flex h-full items-center gap-3 overflow-hidden rounded-3xl border px-5 py-3 font-sans transition-colors duration-500 ${editMode ? 'cursor-move' : ''}`}
      style={
        collapsed
          ? /** @type {any} */ ({
              ...cardStyle,
              '--card-accent': 'var(--text-muted)',
              backgroundColor: 'var(--card-bg)',
              borderColor: 'var(--card-border)',
            })
          : cardStyle
      }
      aria-label={settings.title || 'Sparvens inhalator'}
      data-day-done={collapsed ? 'true' : undefined}
    >
      {controls}
      {refillOpen && hasDoseValue && !editMode ? (
        // In the ⋮ menu the icon tile shows how many doses are left.
        <span
          className={`${compactIconTile} flex-col gap-0 leading-none`}
          role="img"
          aria-label={`${doses} doser kvar, räcker ca ${days} dagar`}
          data-testid="medication-doses-left"
        >
          <span className="text-[15px] font-bold tabular-nums">{doses}</span>
          <span className="text-[9px] font-semibold">doser</span>
        </span>
      ) : (
        <span className={compactIconTile}>
          <Cat className="h-6 w-6 stroke-[1.7px]" />
        </span>
      )}
      {refillOpen && !editMode ? (
        <div className="flex min-w-0 flex-1 gap-2" data-testid="medication-refill-actions">
          {refillStep === 'menu' && (
            <>
              {canExtra && (
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    setRefillStep('extra');
                  }}
                  data-testid="medication-extra-start"
                  className={`${menuButtonClass} ${compactControlTone.idle}`}
                >
                  Extra dos
                </button>
              )}
              {canUndoExtra && (
                <button
                  type="button"
                  onClick={(event) => runMenuScript(event, 'undo', undoExtraDoseScriptId)}
                  disabled={getStatus('undo') === 'pending'}
                  aria-label="Ångra extra dos"
                  data-testid="medication-extra-undo"
                  className={`${menuButtonClass} ${getStatus('undo') === 'error' ? compactControlTone.error : compactControlTone.idle}`}
                >
                  {getStatus('undo') !== 'idle' && (
                    <ActionFeedbackIndicator status={getStatus('undo')} className="h-4 w-4" />
                  )}
                  Ångra
                </button>
              )}
              {canRefill && (
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    setRefillStep('confirm');
                  }}
                  aria-label="Ny inhalator köpt"
                  data-testid="medication-refill-start"
                  className={`${menuButtonClass} ${compactControlTone.idle}`}
                >
                  <span className="truncate">
                    {canExtra || canUndoExtra ? 'Ny inhalator' : 'Ny inhalator köpt'}
                  </span>
                </button>
              )}
            </>
          )}
          {refillStep === 'extra' && (
            <>
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  setRefillStep(null);
                }}
                className={`${menuButtonClass} ${compactControlTone.idle}`}
              >
                Avbryt
              </button>
              {[1, 2].map((count) => (
                <button
                  key={count}
                  type="button"
                  onClick={(event) =>
                    runMenuScript(event, `extra-${count}`, extraDoseScriptId, { antal: count })
                  }
                  disabled={getStatus(`extra-${count}`) === 'pending'}
                  aria-label={count === 1 ? 'Registrera 1 extra dos' : 'Registrera 2 extra doser'}
                  data-testid={`medication-extra-${count}`}
                  className={`${menuButtonClass} ${
                    getStatus(`extra-${count}`) === 'error'
                      ? compactControlTone.error
                      : compactControlTone.success
                  }`}
                >
                  {getStatus(`extra-${count}`) !== 'idle' && (
                    <ActionFeedbackIndicator
                      status={getStatus(`extra-${count}`)}
                      className="h-4 w-4"
                    />
                  )}
                  +{count} {count === 1 ? 'dos' : 'doser'}
                </button>
              ))}
            </>
          )}
          {refillStep === 'confirm' && (
            <>
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  setRefillStep(null);
                }}
                className={`${menuButtonClass} ${compactControlTone.idle}`}
              >
                Avbryt
              </button>
              <button
                type="button"
                onClick={confirmRefill}
                disabled={refillStatus === 'pending'}
                aria-busy={refillStatus === 'pending'}
                aria-label={`Ja, sätt räknaren till ${refillDoses} doser`}
                data-testid="medication-refill-confirm"
                className={`${menuButtonClass} ${
                  refillStatus === 'error' ? compactControlTone.error : compactControlTone.success
                }`}
              >
                {refillStatus !== 'idle' && (
                  <ActionFeedbackIndicator status={refillStatus} className="h-4 w-4" />
                )}
                <span className="truncate">Ja, {refillDoses} doser</span>
              </button>
            </>
          )}
        </div>
      ) : (
        <>
          {/* Text only when it says something: low supply, or the quiet "done" state. */}
          {(showSupply || collapsed) && (
            <div className="min-w-0 flex-1">
              {showSupply ? (
                <>
                  <p
                    className={`line-clamp-2 text-[13px] leading-tight font-bold ${
                      hasDoseValue
                        ? 'text-[var(--status-warning-fg)]'
                        : 'text-[var(--text-primary)]'
                    }`}
                    data-testid="medication-supply"
                  >
                    {hasDoseValue
                      ? `${doses % 2 === 0 ? days : `ca ${days}`} dagar kvar`
                      : 'Dosantal saknas'}
                  </p>
                  {hasDoseValue && (
                    <p className="mt-1 truncate text-[11px] font-medium text-[var(--text-secondary)]">
                      {doses} doser
                    </p>
                  )}
                </>
              ) : (
                <p
                  className={`line-clamp-2 text-[13px] leading-tight font-bold ${
                    collapsed ? 'text-[var(--text-secondary)]' : 'text-[var(--text-primary)]'
                  }`}
                >
                  {settings.title || 'Sparvens inhalator'}
                </p>
              )}
            </div>
          )}
          {collapsed ? (
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                setShowDoseButtons(true);
              }}
              aria-label={`Dagens doser givna${extraToday > 0 ? `, ${extraToday} extra` : ''}. Visa doserna`}
              data-testid="medication-day-done"
              className="flex h-11 shrink-0 items-center gap-1.5 rounded-2xl px-2 text-[12px] font-semibold text-[var(--status-success-fg)] transition-colors hover:bg-[var(--glass-bg-hover)] active:scale-[0.97]"
            >
              <Check className="h-4 w-4" aria-hidden="true" />
              <span>Klart idag</span>
              {extraToday > 0 && (
                <span className="font-medium text-[var(--text-secondary)] tabular-nums">
                  +{extraToday}
                </span>
              )}
            </button>
          ) : (
            <div
              className={`grid grid-cols-2 gap-2 ${showSupply ? 'min-w-[164px]' : 'min-w-0 flex-1'}`}
              data-testid="medication-dose-actions"
            >
              <DoseButton entityId={mapping.morningId} label="Morgon" extra={extraMorning} />
              <DoseButton entityId={mapping.eveningId} label="Kväll" extra={extraEvening} />
            </div>
          )}
        </>
      )}
      {hasMenu && !editMode && (
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            setRefillStep((step) => (step ? null : 'menu'));
          }}
          aria-expanded={refillOpen}
          aria-label="Fler val för medicinen"
          data-testid="medication-menu-button"
          className="-mr-2 flex h-11 w-8 shrink-0 items-center justify-center rounded-xl text-[var(--text-secondary)] transition-colors hover:bg-[var(--glass-bg-hover)] hover:text-[var(--text-primary)] active:scale-95"
        >
          <EllipsisVertical className="h-5 w-5" aria-hidden="true" />
        </button>
      )}
    </section>
  );
};

export default memo(MedicationCard);
