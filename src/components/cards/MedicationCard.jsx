import { memo, useCallback, useMemo } from 'react';
import { Cat, Check } from '../../icons';
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

  const toggleDose = useCallback(
    async (event, entityId) => {
      event.stopPropagation();
      if (editMode || !entityId) return;
      const domain = entityId.split('.')[0];
      if (!['input_boolean', 'switch'].includes(domain)) return;

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
    },
    [callService, doses, editMode, entities, hasDoseValue, mapping.doseId]
  );

  const DoseButton = ({ entityId, label }) => {
    const done = entities[entityId]?.state === 'on';
    const unavailable =
      !entityId || !entities[entityId] || entities[entityId].state === 'unavailable';
    return (
      <button
        type="button"
        disabled={editMode || unavailable}
        onClick={(event) => toggleDose(event, entityId)}
        className={`touch-feedback flex h-11 min-w-0 items-center justify-center gap-2 rounded-2xl border px-3 text-xs font-bold transition-all active:scale-[0.97] ${
          done ? compactControlTone.success : compactControlTone.idle
        } ${unavailable ? 'opacity-45' : ''}`}
      >
        <span className="truncate">{label}</span>
        {done && <Check className="h-4 w-4 shrink-0" />}
      </button>
    );
  };

  return (
    <section
      key={cardId}
      {...dragProps}
      className={`group relative flex h-full items-center gap-2.5 overflow-hidden rounded-3xl border px-4 py-3 font-sans ${editMode ? 'cursor-move' : ''}`}
      style={cardStyle}
      aria-label={settings.title || 'Sparvens inhalator'}
    >
      {controls}
      <span className={compactIconTile}>
        <Cat className="h-6 w-6 stroke-[1.7px]" />
      </span>
      <div className="min-w-0 flex-1 overflow-hidden">
        <p className="line-clamp-2 text-sm leading-tight font-bold text-[var(--text-primary)]">
          {settings.title || 'Sparvens inhalator'}
        </p>
        {hasDoseValue ? (
          <div className="mt-1.5 min-w-0 leading-none">
            <p className="truncate text-[11px] font-extrabold text-[var(--text-primary)]">
              ca {days} dagar kvar
            </p>
            <p className="mt-1 truncate text-[9px] font-bold tracking-wide text-[var(--text-secondary)] uppercase">
              {doses} doser
            </p>
          </div>
        ) : (
          <p className="mt-1 text-[10px] font-bold tracking-wide text-[var(--text-secondary)] uppercase">
            Dosantal saknas
          </p>
        )}
      </div>
      <div className="grid min-w-[190px] grid-cols-2 gap-2 max-sm:min-w-[160px]">
        <DoseButton entityId={mapping.morningId} label="Morgon" />
        <DoseButton entityId={mapping.eveningId} label="Kväll" />
      </div>
    </section>
  );
};

export default memo(MedicationCard);
