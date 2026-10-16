import { memo, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  Flame,
  Lightbulb,
  Minus,
  Plus,
  Power,
  ShieldCheck,
  Thermometer,
} from '../../icons';
import { useConfig, useHomeAssistantMeta } from '../../contexts';
import {
  formatKindValueForDisplay,
  getEffectiveRoomEntityIds,
  getEffectiveUnitMode,
} from '../../utils';
import useActionFeedback from '../../hooks/useActionFeedback';
import ActionFeedbackIndicator from '../ui/ActionFeedbackIndicator';

const TOGGLE_DOMAINS = new Set(['light', 'switch', 'fan', 'input_boolean']);
const UNAVAILABLE_STATES = new Set(['unavailable', 'unknown']);

const deviceClass = (entity) => entity?.attributes?.device_class;
const isUnavailable = (entity) => !entity || UNAVAILABLE_STATES.has(entity.state);

/**
 * Picks the room's pieces from its entity list: one temperature sensor, one
 * thermostat, any smoke detectors and the toggleable devices.
 * @param {string[]} entityIds
 * @param {Record<string, any>} entities
 * @param {any} settings
 */
export function resolveRoomControls(entityIds, entities, settings = {}) {
  const climateId =
    (settings.climateEntityId && entities[settings.climateEntityId] && settings.climateEntityId) ||
    entityIds.find((id) => id.startsWith('climate.')) ||
    null;
  const tempId =
    (settings.tempEntityId && entities[settings.tempEntityId] && settings.tempEntityId) ||
    entityIds.find(
      (id) => id.startsWith('sensor.') && deviceClass(entities[id]) === 'temperature'
    ) ||
    null;
  const smokeIds = entityIds.filter(
    (id) =>
      id.startsWith('binary_sensor.') &&
      ['smoke', 'gas', 'carbon_monoxide'].includes(deviceClass(entities[id]))
  );
  const deviceIds = entityIds.filter(
    (id) => TOGGLE_DOMAINS.has(id.split('.')[0]) && entities[id] !== undefined
  );
  return { climateId, tempId, smokeIds, deviceIds };
}

const DeviceButton = memo(function DeviceButton({ entityId, entity, name, onToggle, status, t }) {
  const domain = entityId.split('.')[0];
  const unavailable = isUnavailable(entity);
  const isOn = entity?.state === 'on';
  const category = domain === 'light' ? 'light' : 'climate';
  const accent = `var(--cat-${category})`;
  const Icon = domain === 'light' ? Lightbulb : Power;
  const stateLabel = unavailable
    ? t('status.unavailable')
    : isOn
      ? t('common.on')
      : t('common.off');

  return (
    <button
      type="button"
      disabled={unavailable || status === 'pending'}
      aria-pressed={unavailable ? undefined : isOn}
      onClick={(event) => {
        event.stopPropagation();
        onToggle(entityId, domain);
      }}
      data-testid={`room-device-${entityId}`}
      className={`touch-feedback flex min-h-14 min-w-0 items-center gap-2.5 rounded-2xl border px-3 py-2 text-left transition-all active:scale-[0.97] ${
        unavailable ? 'opacity-55' : ''
      }`}
      style={{
        backgroundColor: isOn
          ? `color-mix(in srgb, ${accent} 12%, transparent)`
          : 'var(--glass-bg)',
        borderColor: isOn
          ? `color-mix(in srgb, ${accent} 40%, transparent)`
          : 'var(--glass-border)',
      }}
    >
      <span
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl"
        style={{
          backgroundColor: `color-mix(in srgb, ${accent} ${isOn ? 22 : 8}%, transparent)`,
          color: isOn ? accent : `color-mix(in srgb, ${accent} 60%, var(--text-muted))`,
        }}
      >
        {status === 'idle' ? (
          <Icon className="h-4 w-4" aria-hidden="true" />
        ) : (
          <ActionFeedbackIndicator status={status} className="h-4 w-4" />
        )}
      </span>
      <span className="flex min-w-0 flex-col">
        <span className="truncate text-[13px] font-semibold text-[var(--text-primary)]">
          {name}
        </span>
        <span
          className="text-xs"
          style={{
            color: unavailable
              ? 'var(--status-warning-fg)'
              : isOn
                ? accent
                : 'var(--text-secondary)',
          }}
        >
          {stateLabel}
        </span>
      </span>
    </button>
  );
});

/**
 * Room card, "controls" layout: everything in one room on one card — room
 * temperature, the radiator/thermostat, and the room's lights and plugs.
 */
const RoomControlsCard = memo(
  /** @param {any} props */ function RoomControlsCard({
    cardId,
    settings,
    entities,
    callService,
    dragProps,
    controls,
    cardStyle,
    editMode,
    customNames,
    onOpen,
    t,
  }) {
    const { unitsMode } = useConfig();
    const { haConfig } = useHomeAssistantMeta();
    const unitMode = getEffectiveUnitMode(unitsMode, haConfig);
    const { getStatus, runAction } = useActionFeedback();

    const roomName = customNames?.[cardId] || settings?.areaName || t('room.defaultName');
    const entityIds = useMemo(() => getEffectiveRoomEntityIds(settings), [settings]);
    const { climateId, tempId, smokeIds, deviceIds } = useMemo(
      () => resolveRoomControls(entityIds, entities, settings),
      [entityIds, entities, settings]
    );

    const climate = climateId ? entities[climateId] : null;
    const tempEntity = tempId ? entities[tempId] : null;
    const tempUnit =
      tempEntity?.attributes?.unit_of_measurement ||
      /** @type {any} */ (haConfig?.unit_system)?.temperature ||
      '°C';
    const formatTemp = (value, fromUnit = tempUnit) =>
      formatKindValueForDisplay(value, { kind: 'temperature', fromUnit, unitMode }).text;

    const roomTempRaw = tempEntity
      ? Number.parseFloat(tempEntity.state)
      : Number(climate?.attributes?.current_temperature);
    const hasRoomTemp = Number.isFinite(roomTempRaw);

    // Thermostat
    const climateOn = climate && !isUnavailable(climate) && climate.state !== 'off';
    const step = Math.max(Number(climate?.attributes?.target_temp_step) || 0.5, 0.1);
    const minT = Number(climate?.attributes?.min_temp);
    const maxT = Number(climate?.attributes?.max_temp);
    const reportedTarget = Number(climate?.attributes?.temperature);
    const [optimisticTarget, setOptimisticTarget] = useState(null);
    const resetTimer = useRef(null);
    useEffect(() => {
      if (optimisticTarget !== null && reportedTarget === optimisticTarget) {
        setOptimisticTarget(null);
      }
    }, [optimisticTarget, reportedTarget]);
    useEffect(() => () => clearTimeout(resetTimer.current), []);
    const target = optimisticTarget ?? reportedTarget;
    const climateCurrent = Number(climate?.attributes?.current_temperature);
    const climateUnit =
      climate?.attributes?.temperature_unit ||
      /** @type {any} */ (haConfig?.unit_system)?.temperature ||
      '°C';
    const isHeating = climate?.attributes?.hvac_action === 'heating';

    const stepTarget = (event, direction) => {
      event.stopPropagation();
      if (!climateId || editMode || !Number.isFinite(target)) return;
      let next = target + direction * step;
      if (Number.isFinite(minT)) next = Math.max(minT, next);
      if (Number.isFinite(maxT)) next = Math.min(maxT, next);
      next = Number(next.toFixed(2));
      setOptimisticTarget(next);
      clearTimeout(resetTimer.current);
      resetTimer.current = setTimeout(() => setOptimisticTarget(null), 10000);
      callService('climate', 'set_temperature', { entity_id: climateId, temperature: next });
    };

    const turnClimateOn = (event) => {
      event.stopPropagation();
      if (!climateId || editMode) return;
      runAction(climateId, () => callService('climate', 'turn_on', { entity_id: climateId }));
    };

    const toggleDevice = (entityId, domain) => {
      if (editMode) return;
      runAction(entityId, () => callService(domain, 'toggle', { entity_id: entityId }));
    };

    const smokeAlarm = smokeIds.some((id) => entities[id]?.state === 'on');
    const smokeUnavailable = smokeIds.some((id) => isUnavailable(entities[id]));
    const devicesOn = deviceIds.filter((id) => entities[id]?.state === 'on').length;
    const unavailableCount = deviceIds.filter((id) => isUnavailable(entities[id])).length;

    const subtitleParts = [];
    if (deviceIds.length > 0) {
      subtitleParts.push(
        `${devicesOn}/${deviceIds.length} ${(t('common.on') || 'on').toLowerCase()}`
      );
    }
    if (unavailableCount > 0) {
      subtitleParts.push(`${unavailableCount} ${(t('status.unavailable') || '').toLowerCase()}`);
    }

    const shortName = (entityId) => {
      const raw = entities[entityId]?.attributes?.friendly_name || entityId.split('.')[1];
      // Drop a leading room name ("Vardagsrum fönster" → "fönster") — the card header says it.
      const trimmed = raw.replace(new RegExp(`^${roomName}\\s*`, 'i'), '').trim();
      const name = trimmed || raw;
      return name.charAt(0).toUpperCase() + name.slice(1);
    };

    return (
      <section
        {...dragProps}
        data-haptic={editMode ? undefined : 'card'}
        aria-label={roomName}
        onClick={(event) => {
          event.stopPropagation();
          if (onOpen) onOpen();
        }}
        className={`group relative flex h-full flex-col gap-3 overflow-hidden rounded-3xl border p-4 font-sans ${
          editMode ? 'cursor-move' : 'cursor-pointer'
        }`}
        style={cardStyle}
      >
        {controls}

        <div className="flex items-end justify-between gap-3">
          <div className="flex min-w-0 flex-col gap-0.5">
            <h3 className="truncate text-base font-semibold text-[var(--text-primary)]">
              {roomName}
            </h3>
            {subtitleParts.length > 0 && (
              <span className="text-xs text-[var(--text-secondary)]">
                {subtitleParts.join(' · ')}
              </span>
            )}
          </div>
          <div className="flex shrink-0 items-end gap-2">
            {smokeIds.length > 0 && (
              <span
                className={`flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold ${
                  smokeAlarm
                    ? 'border-[var(--status-error-border)] bg-[var(--status-error-bg)] text-[var(--status-error-fg)]'
                    : smokeUnavailable
                      ? 'border-[var(--status-warning-border)] bg-[var(--status-warning-bg)] text-[var(--status-warning-fg)]'
                      : 'border-[var(--status-success-border)] bg-[var(--status-success-bg)] text-[var(--status-success-fg)]'
                }`}
                data-testid="room-smoke-status"
              >
                {smokeAlarm || smokeUnavailable ? (
                  <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
                ) : (
                  <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
                )}
                {smokeAlarm
                  ? t('room.smoke.alarm')
                  : smokeUnavailable
                    ? t('status.unavailable')
                    : t('room.smoke.ok')}
              </span>
            )}
            {hasRoomTemp && (
              <span className="flex flex-col items-end">
                <span className="text-3xl leading-none font-light tracking-tight text-[var(--text-primary)] tabular-nums">
                  {formatTemp(roomTempRaw, tempEntity ? tempUnit : climateUnit)}
                </span>
                {tempEntity && climate && (
                  <span className="mt-1 text-[11px] text-[var(--text-secondary)]">
                    {t('room.sensorTemp')}
                  </span>
                )}
              </span>
            )}
          </div>
        </div>

        {climate && (
          <div
            className="flex items-center gap-2.5 rounded-2xl border py-2 pr-2 pl-3"
            style={{
              backgroundColor: 'color-mix(in srgb, var(--cat-climate) 8%, transparent)',
              borderColor: 'color-mix(in srgb, var(--cat-climate) 20%, transparent)',
            }}
            data-testid="room-thermostat"
          >
            {isHeating ? (
              <Flame className="h-5 w-5 shrink-0 text-[var(--cat-climate)]" aria-hidden="true" />
            ) : (
              <Thermometer
                className="h-5 w-5 shrink-0 text-[var(--cat-climate)]"
                aria-hidden="true"
              />
            )}
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="truncate text-[13px] font-semibold text-[var(--text-primary)]">
                {t('room.radiator')}
              </span>
              <span className="truncate text-xs text-[var(--text-secondary)]">
                {isUnavailable(climate)
                  ? t('status.unavailable')
                  : !climateOn
                    ? t('climate.action.off')
                    : `${isHeating ? t('climate.action.heating') : t('room.holding')}${
                        Number.isFinite(climateCurrent)
                          ? ` · ${formatTemp(climateCurrent, climateUnit)}`
                          : ''
                      }`}
              </span>
            </span>
            {climateOn ? (
              <>
                <button
                  type="button"
                  onClick={(event) => stepTarget(event, -1)}
                  aria-label={t('climate.decreaseTemperature')}
                  className="flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--glass-border)] bg-[var(--glass-bg)] text-[var(--text-secondary)] active:scale-95"
                >
                  <Minus className="h-4 w-4" />
                </button>
                <span className="min-w-12 text-center text-base font-semibold text-[var(--text-primary)] tabular-nums">
                  {Number.isFinite(target) ? formatTemp(target, climateUnit) : '--'}
                </span>
                <button
                  type="button"
                  onClick={(event) => stepTarget(event, 1)}
                  aria-label={t('climate.increaseTemperature')}
                  className="flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--glass-border)] bg-[var(--glass-bg)] text-[var(--text-secondary)] active:scale-95"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </>
            ) : (
              !isUnavailable(climate) && (
                <button
                  type="button"
                  onClick={turnClimateOn}
                  className="flex min-h-10 items-center rounded-xl border border-[var(--glass-border)] bg-[var(--glass-bg)] px-3 text-sm font-medium text-[var(--text-secondary)] active:scale-95"
                >
                  {getStatus(climateId) === 'idle' ? (
                    t('away.turnOn')
                  ) : (
                    <ActionFeedbackIndicator status={getStatus(climateId)} className="h-4 w-4" />
                  )}
                </button>
              )
            )}
          </div>
        )}

        {deviceIds.length > 0 && (
          <div className="grid grid-cols-2 gap-2" data-testid="room-devices">
            {deviceIds.map((entityId) => (
              <DeviceButton
                key={entityId}
                entityId={entityId}
                entity={entities[entityId]}
                name={shortName(entityId)}
                onToggle={toggleDevice}
                status={getStatus(entityId)}
                t={t}
              />
            ))}
          </div>
        )}
      </section>
    );
  }
);

export default RoomControlsCard;
