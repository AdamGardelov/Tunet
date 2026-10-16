import { memo, useEffect, useRef, useState } from 'react';
import { Minus, Plus, AirVent, Fan, RefreshCw, getIconComponent } from '../../icons';
import { useConfig, useHomeAssistantMeta } from '../../contexts';
import { formatKindValueForDisplay, getEffectiveUnitMode } from '../../utils';
import { usePowerToggle } from '../../hooks/usePowerToggle';
import { resolveSensorCardActionCall } from '../../utils/sensorCardConfig';

const isCoolingState = (entity) => {
  const action = entity?.attributes?.hvac_action;
  return action === 'cooling';
};

const isHeatingState = (entity) => {
  const action = entity?.attributes?.hvac_action;
  return action === 'heating';
};

const normalizeFanModeToken = (value) => {
  if (typeof value !== 'string') return '';
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
};

const isAutoFanMode = (value) => {
  const normalized = normalizeFanModeToken(value);
  return normalized === 'auto' || normalized === 'automatic';
};

const getFanSpeedLevel = (fanMode, fanModes) => {
  if (!Array.isArray(fanModes) || fanModes.length === 0) return 0;
  if (isAutoFanMode(fanMode)) return 0;

  const speedModes = fanModes.filter((mode) => !isAutoFanMode(mode));
  if (speedModes.length === 0) return 0;

  const target = normalizeFanModeToken(fanMode);
  if (!target) return 0;

  const matchedIndex = speedModes.findIndex((mode) => normalizeFanModeToken(mode) === target);
  if (matchedIndex === -1) return 0;

  const scaledLevel = Math.round(((matchedIndex + 1) / speedModes.length) * 5);
  return Math.max(1, Math.min(5, scaledLevel));
};

const GenericClimateCard = memo(
  /** @param {any} props */ function GenericClimateCard({
    cardId,
    entityId,
    entity,
    dragProps,
    controls,
    cardStyle,
    editMode,
    customNames,
    customIcons,
    onOpen,
    onSetTemperature,
    isMobile,
    settings,
    t,
    callService,
  }) {
    const { unitsMode } = useConfig();
    const { haConfig } = useHomeAssistantMeta();
    const isUnavailable = !entity || ['unavailable', 'unknown'].includes(entity.state);
    const isOn = !isUnavailable && entity.state !== 'off';
    const { isPending, optimisticIsOn, togglePower } = usePowerToggle({
      entityId,
      isOn,
      domain: 'climate',
      callService,
      buildCall: () => {
        try {
          return resolveSensorCardActionCall(
            { type: isOn ? 'turn_off' : 'turn_on', entityId },
            entity
          );
        } catch {
          return null;
        }
      },
    });

    const isSmall = settings?.size === 'small';
    const currentTemp = entity?.attributes?.current_temperature ?? '--';
    const targetTemp = entity?.attributes?.temperature ?? '--';
    const temperatureStep = Math.max(Number(entity?.attributes?.target_temp_step) || 0.5, 0.1);
    const minTemperature = Number(entity?.attributes?.min_temp);
    const maxTemperature = Number(entity?.attributes?.max_temp);
    const [optimisticTargetTemp, setOptimisticTargetTemp] = useState(null);
    const optimisticTargetTimeoutRef = useRef(null);

    useEffect(() => {
      if (optimisticTargetTemp === null) return;
      if (Number(targetTemp) === optimisticTargetTemp) {
        clearTimeout(optimisticTargetTimeoutRef.current);
        optimisticTargetTimeoutRef.current = null;
        setOptimisticTargetTemp(null);
      }
    }, [optimisticTargetTemp, targetTemp]);

    useEffect(
      () => () => {
        clearTimeout(optimisticTargetTimeoutRef.current);
      },
      []
    );

    const effectiveTargetTemp = optimisticTargetTemp ?? targetTemp;

    if (!entity || !entityId) return null;

    const sourceTempUnit =
      /** @type {any} */ (haConfig?.unit_system)?.temperature ||
      entity.attributes?.temperature_unit ||
      '°C';
    const effectiveUnitMode = getEffectiveUnitMode(unitsMode, haConfig);
    const displayCurrentTemp = formatKindValueForDisplay(currentTemp, {
      kind: 'temperature',
      fromUnit: sourceTempUnit,
      unitMode: effectiveUnitMode,
    });
    const displayTargetTemp = formatKindValueForDisplay(effectiveTargetTemp, {
      kind: 'temperature',
      fromUnit: sourceTempUnit,
      unitMode: effectiveUnitMode,
    });
    const fanMode = entity.attributes?.fan_mode ?? 'Auto';
    const fanModes = entity.attributes?.fan_modes || [];
    const showFan = Array.isArray(fanModes) && fanModes.length > 0;
    const fanSpeedLevel = getFanSpeedLevel(fanMode, fanModes);
    const isDenseMobile = isMobile && !isSmall;

    const name = customNames[cardId] || entity.attributes?.friendly_name || entityId;

    const climateIconName = customIcons[cardId] || entity?.attributes?.icon;
    const Icon = climateIconName ? getIconComponent(climateIconName) : null;

    const translate = t || ((key) => key);
    const isCooling = isCoolingState(entity);
    const isHeating = isHeatingState(entity);
    const clTheme = optimisticIsOn ? (isCooling ? 'blue' : isHeating ? 'orange' : 'gray') : 'gray';
    const hvacAction = optimisticIsOn ? entity.attributes?.hvac_action || null : 'off';
    const actionLabel =
      optimisticIsOn && !hvacAction
        ? translate('common.on')
        : translate('climate.action.' + hvacAction);
    const DisplayIcon = Icon || AirVent;

    const themeClasses = {
      blue: {
        iconBg: 'bg-blue-500/10 text-blue-400',
        badge: 'bg-blue-500/20 border-blue-500/30 text-blue-400',
        fanActive: 'bg-blue-400',
      },
      orange: {
        iconBg: 'bg-orange-500/10 text-orange-400',
        badge: 'bg-orange-500/10 border-orange-500/20 text-orange-400',
        fanActive: 'bg-orange-400',
      },
      gray: {
        iconBg: 'bg-[var(--glass-bg)] text-[var(--text-secondary)]',
        badge: 'bg-[var(--glass-bg)] border-[var(--glass-border)] text-[var(--text-secondary)]',
        fanActive: 'bg-[var(--text-primary)]',
      },
    };

    const activeTheme = themeClasses[clTheme];
    const categoryIconBg =
      'bg-[color-mix(in_srgb,var(--cat-climate)_14%,transparent)] text-[var(--cat-climate)]';
    const powerIconBg = optimisticIsOn && clTheme !== 'gray' ? activeTheme.iconBg : categoryIconBg;
    const isTapToggle = settings?.tapAction === 'toggle';

    const handleTogglePower = (e) => {
      if (e) e.stopPropagation();
      if (editMode || isUnavailable) return;
      togglePower();
    };

    const stepTemp = (direction) => {
      if (!onSetTemperature || isUnavailable) return;
      const currentTarget = Number(effectiveTargetTemp);
      const fallbackTarget = Number.isFinite(currentTarget) ? currentTarget : 21;
      if (
        direction < 0 &&
        optimisticIsOn &&
        Number.isFinite(minTemperature) &&
        fallbackTarget <= minTemperature + temperatureStep / 2 &&
        Array.isArray(entity.attributes?.hvac_modes) &&
        entity.attributes.hvac_modes.includes('off')
      ) {
        togglePower();
        return;
      }
      const unclamped = fallbackTarget + direction * temperatureStep;
      const clamped = Math.min(
        Number.isFinite(maxTemperature) ? maxTemperature : unclamped,
        Math.max(Number.isFinite(minTemperature) ? minTemperature : unclamped, unclamped)
      );
      const nextTarget = Number(clamped.toFixed(3));

      setOptimisticTargetTemp(nextTarget);
      clearTimeout(optimisticTargetTimeoutRef.current);
      optimisticTargetTimeoutRef.current = setTimeout(() => {
        setOptimisticTargetTemp(null);
        optimisticTargetTimeoutRef.current = null;
      }, 10000);

      Promise.resolve(onSetTemperature(nextTarget)).catch(() => {
        clearTimeout(optimisticTargetTimeoutRef.current);
        optimisticTargetTimeoutRef.current = null;
        setOptimisticTargetTemp(null);
      });
    };

    if (isSmall) {
      return (
        <div
          {...dragProps}
          onClick={(e) => {
            e.stopPropagation();
            if (editMode) return;
            if (isTapToggle) {
              handleTogglePower(e);
            } else if (onOpen) {
              onOpen();
            }
          }}
          className={`glass-texture touch-feedback group relative flex h-full items-center justify-between gap-4 overflow-hidden rounded-3xl border p-4 pl-5 font-sans transition-all duration-500 ${!editMode ? 'cursor-pointer active:scale-[0.98]' : 'cursor-move'}`}
          style={{ ...cardStyle, containerType: 'inline-size' }}
        >
          {controls}
          <div className="flex min-w-0 flex-1 items-center gap-4">
            <button
              type="button"
              onClick={handleTogglePower}
              disabled={editMode || isPending || isUnavailable}
              aria-busy={isPending}
              aria-pressed={optimisticIsOn}
              aria-label={translate('climate.togglePower')}
              className={`flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl transition-all duration-300 group-hover:scale-110 active:scale-90 ${powerIconBg}`}
            >
              {isPending ? (
                <RefreshCw className="h-6 w-6 animate-spin motion-reduce:animate-none" />
              ) : (
                <DisplayIcon className="h-6 w-6 stroke-[1.5px]" />
              )}
            </button>
            <div
              className="flex min-w-0 flex-col"
              onClick={
                isTapToggle
                  ? (e) => {
                      e.stopPropagation();
                      if (!editMode && onOpen) onOpen();
                    }
                  : undefined
              }
            >
              <p className="mb-1.5 text-sm leading-tight font-semibold break-words whitespace-normal text-[var(--text-primary)]">
                {name}
              </p>
              <div className="flex items-baseline gap-2">
                <span className="text-sm leading-none font-bold text-[var(--text-primary)]">
                  {displayCurrentTemp.text}
                </span>
                <span className="text-xs text-[var(--text-secondary)]">
                  {optimisticIsOn ? `→ ${displayTargetTemp.text}` : translate('climate.action.off')}
                </span>
              </div>
            </div>
          </div>
          {optimisticIsOn && (
            <div className="card-controls card-controls--temp invisible shrink-0 group-hover:visible">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  stepTemp(1);
                }}
                aria-label={translate('climate.increaseTemperature')}
                className="control-plus flex h-8 w-8 items-center justify-center rounded-xl bg-[var(--glass-bg)] text-[var(--text-secondary)] transition-colors hover:bg-[var(--glass-bg-hover)] hover:text-[var(--text-primary)] active:scale-90"
              >
                <Plus className="h-4 w-4" />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  stepTemp(-1);
                }}
                aria-label={translate('climate.decreaseTemperature')}
                className="control-minus flex h-8 w-8 items-center justify-center rounded-xl bg-[var(--glass-bg)] text-[var(--text-secondary)] transition-colors hover:bg-[var(--glass-bg-hover)] hover:text-[var(--text-primary)] active:scale-90"
              >
                <Minus className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>
      );
    }

    return (
      <div
        key="climate"
        {...dragProps}
        data-haptic={editMode ? undefined : 'card'}
        onClick={(e) => {
          e.stopPropagation();
          if (editMode) return;
          if (isTapToggle) {
            handleTogglePower(e);
          } else if (onOpen) {
            onOpen();
          }
        }}
        className={`glass-texture touch-feedback group relative flex h-full flex-col justify-between overflow-hidden rounded-3xl border font-sans transition-all duration-500 ${isDenseMobile ? 'p-5' : 'p-7'} ${!editMode ? 'cursor-pointer active:scale-98' : 'cursor-move'}`}
        style={cardStyle}
      >
        {controls}
        <div
          className={`flex items-start justify-between ${isDenseMobile ? 'mb-3 gap-3' : 'mb-4 gap-4'}`}
        >
          <button
            type="button"
            onClick={handleTogglePower}
            disabled={editMode || isPending || isUnavailable}
            aria-busy={isPending}
            aria-pressed={optimisticIsOn}
            aria-label={translate('climate.togglePower')}
            className={`flex-shrink-0 transition-all duration-300 group-hover:scale-110 active:scale-90 ${powerIconBg} ${isDenseMobile ? 'rounded-xl p-2.5' : 'rounded-2xl p-3'}`}
          >
            {isPending ? (
              <RefreshCw
                className={`${isDenseMobile ? 'h-4 w-4' : 'h-5 w-5'} animate-spin motion-reduce:animate-none`}
              />
            ) : (
              <DisplayIcon
                className={isDenseMobile ? 'h-4 w-4' : 'h-5 w-5'}
                style={{ strokeWidth: 1.5 }}
              />
            )}
          </button>
          <div
            className={`flex flex-shrink-0 items-center rounded-full border ${activeTheme.badge} ${isDenseMobile ? 'gap-1 px-2.5 py-1' : 'gap-1.5 px-3 py-1'}`}
          >
            <span className={`${isDenseMobile ? 'text-xs' : 'text-sm'} font-semibold`}>
              {actionLabel}
            </span>
          </div>
        </div>
        <div
          onClick={
            isTapToggle
              ? (e) => {
                  e.stopPropagation();
                  if (!editMode && onOpen) onOpen();
                }
              : undefined
          }
          className={isTapToggle ? 'cursor-pointer' : undefined}
        >
          <span
            className={`${isDenseMobile ? 'text-3xl' : 'text-4xl'} leading-none font-thin text-[var(--text-primary)]`}
          >
            {displayCurrentTemp.text}
          </span>
        </div>
        <div className={isDenseMobile ? 'mt-1.5' : 'mt-2'}>
          <div className={`flex items-center gap-2 ${isDenseMobile ? 'mb-2' : 'mb-3'}`}>
            <p
              className={`${isDenseMobile ? 'text-sm' : 'text-base'} leading-tight font-semibold text-[var(--text-primary)]`}
            >
              {name}
            </p>
          </div>
          {!optimisticIsOn ? (
            <button
              type="button"
              onClick={handleTogglePower}
              disabled={editMode || isPending || isUnavailable}
              className={`flex w-full items-center justify-center text-sm font-medium text-[var(--text-secondary)] transition-colors hover:bg-[var(--glass-bg-hover)] hover:text-[var(--text-primary)] ${isDenseMobile ? 'min-h-11 rounded-xl' : 'min-h-12 rounded-2xl'} bg-[var(--glass-bg)]`}
            >
              {translate('climate.offTapToTurnOn')}
            </button>
          ) : (
            <div className={`flex items-stretch ${isDenseMobile ? 'gap-2' : 'gap-3'}`}>
              <div
                className={`flex flex-1 items-center justify-between bg-[var(--glass-bg)] ${isDenseMobile ? 'rounded-xl p-0.5' : 'rounded-2xl p-1'}`}
              >
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    stepTemp(-1);
                  }}
                  aria-label={translate('climate.decreaseTemperature')}
                  className={`flex items-center justify-center text-[var(--text-secondary)] transition-colors hover:bg-[var(--glass-bg-hover)] hover:text-[var(--text-primary)] active:scale-90 ${isDenseMobile ? 'h-11 w-11 rounded-lg' : 'h-10 w-10 rounded-xl'}`}
                >
                  <Minus className="h-4 w-4" />
                </button>
                <div className="flex flex-col items-center">
                  <span
                    className={`${isDenseMobile ? 'text-lg' : 'text-xl'} leading-none font-medium text-[var(--text-primary)]`}
                  >
                    {displayTargetTemp.text}
                  </span>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    stepTemp(1);
                  }}
                  aria-label={translate('climate.increaseTemperature')}
                  className={`flex items-center justify-center text-[var(--text-secondary)] transition-colors hover:bg-[var(--glass-bg-hover)] hover:text-[var(--text-primary)] active:scale-90 ${isDenseMobile ? 'h-11 w-11 rounded-lg' : 'h-10 w-10 rounded-xl'}`}
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>
              {showFan && !isDenseMobile && (
                <div className="flex w-20 items-center justify-center gap-2 rounded-2xl bg-[var(--glass-bg)] pr-2">
                  <Fan className="h-4 w-4 text-[var(--text-secondary)]" />
                  {fanSpeedLevel === 0 ? (
                    <span className="text-[10px] font-bold tracking-wider text-[var(--text-secondary)]">
                      {translate('climate.fanAuto')}
                    </span>
                  ) : (
                    <div className="flex h-4 items-end gap-[2px]">
                      {[1, 2, 3, 4, 5].map((level) => (
                        <div
                          key={level}
                          className={`w-1 rounded-sm transition-all duration-300 ${
                            level <= fanSpeedLevel
                              ? activeTheme.fanActive
                              : 'bg-[var(--glass-bg-hover)]'
                          }`}
                          style={{ height: `${30 + level * 14}%` }}
                        />
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }
);

export default GenericClimateCard;
