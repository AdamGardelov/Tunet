import { memo, useCallback, useMemo } from 'react';
import { Cat, Check } from '../../icons';
import useActionFeedback from '../../hooks/useActionFeedback';
import ActionFeedbackIndicator from '../ui/ActionFeedbackIndicator';
import { compactControlTone, compactIconTile } from '../ui/compactControlStyles';

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
  const { getStatus, runAction } = useActionFeedback();

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

  const DoseButton = ({ entityId, label }) => {
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
        aria-label={`${label} ${done ? 'tagen' : 'inte tagen'}`}
        data-testid={`medication-dose-control-${entityId}`}
        className={`touch-feedback relative flex h-11 min-w-0 items-center justify-center rounded-2xl border px-3 text-[13px] font-bold transition-all duration-200 active:scale-[0.97] ${tone} ${unavailable ? 'opacity-45' : ''}`}
      >
        <span className="truncate">{label}</span>
        <span className="absolute right-3 flex items-center justify-center">
          {actionStatus === 'idle' ? (
            done && <Check aria-hidden="true" className="h-4 w-4 shrink-0" />
          ) : (
            <ActionFeedbackIndicator status={actionStatus} className="h-4 w-4" />
          )}
        </span>
      </button>
    );
  };

  return (
    <section
      key={cardId}
      {...dragProps}
      className={`group relative flex h-full flex-col gap-2.5 overflow-hidden rounded-3xl border px-5 py-3 font-sans ${editMode ? 'cursor-move' : ''}`}
      style={cardStyle}
      aria-label={settings.title || 'Sparvens inhalator'}
    >
      {controls}
      <div className="flex w-full min-w-0 items-center gap-3">
        <span className={compactIconTile}>
          <Cat className="h-6 w-6 stroke-[1.7px]" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm leading-tight font-extrabold text-[var(--text-primary)]">
            {hasDoseValue
              ? `${doses % 2 === 0 ? days : `ca ${days}`} dagar kvar`
              : 'Dosantal saknas'}
          </p>
          {hasDoseValue && (
            <p className="mt-1 truncate text-[10px] font-bold tracking-wide text-[var(--text-secondary)] uppercase">
              {doses} doser
            </p>
          )}
        </div>
      </div>
      <div
        className="grid w-full grid-cols-2 gap-2"
        data-testid="medication-dose-actions"
      >
        <DoseButton entityId={mapping.morningId} label="Morgon" />
        <DoseButton entityId={mapping.eveningId} label="Kväll" />
      </div>
    </section>
  );
};

export default memo(MedicationCard);
