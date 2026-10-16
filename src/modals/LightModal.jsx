import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  AlertTriangle,
  Lightbulb,
  Utensils,
  Sofa,
  LampDesk,
  Palette,
  Thermometer,
  Sun,
  Power,
} from '../icons';
import M3Slider from '../components/ui/M3Slider';
import AccessibleModalShell from '../components/ui/AccessibleModalShell';
import ActionFeedbackIndicator from '../components/ui/ActionFeedbackIndicator';
import useActionFeedback from '../hooks/useActionFeedback';
import useHeldValue from '../hooks/useHeldValue';
import WarmthStepSlider from '../components/ui/WarmthStepSlider';
import {
  BRIGHTNESS_STEP_PCT,
  MAX_BRIGHTNESS_PCT,
  MIN_BRIGHTNESS_PCT,
  brightnessToStepPct,
  getEntityKelvin,
  getEntityKelvinRange,
  getWarmthPresets,
  nearestWarmthIndex,
} from '../utils/lightSteps';

// Interior marks for the 10 % brightness steps (10 → 100 % is nine steps).
const BRIGHTNESS_STEP_MARKS = Array.from(
  { length: (MAX_BRIGHTNESS_PCT - MIN_BRIGHTNESS_PCT) / BRIGHTNESS_STEP_PCT - 1 },
  (_, index) =>
    ((index + 1) * BRIGHTNESS_STEP_PCT * 100) / (MAX_BRIGHTNESS_PCT - MIN_BRIGHTNESS_PCT)
);
import { getIconComponent } from '../icons';

export default function LightModal({
  show,
  onClose,
  lightId,
  entities,
  callService,
  getA,
  optimisticLightBrightness,
  setOptimisticLightBrightness,
  customIcons,
  t,
}) {
  const { getStatus, runAction } = useActionFeedback();
  const activeLightId = String(lightId || '');

  const entity = entities[activeLightId];
  const isUnavailable = entity?.state === 'unavailable' || entity?.state === 'unknown' || !entity;
  const isOn = entity?.state === 'on';

  // --- Feature Detection ---
  const supportedColorModes = entity?.attributes?.supported_color_modes;
  const isDimmable = supportedColorModes
    ? !supportedColorModes.includes('onoff') || supportedColorModes.length > 1
    : (entity?.attributes?.supported_features & 1) === 1;

  const colorModes = entity?.attributes?.supported_color_modes || [];
  const supportsColorTemp =
    colorModes.includes('color_temp') || colorModes.includes('color_temp_kelvin');
  const supportsColor = colorModes.some((mode) => ['hs', 'rgb', 'xy'].includes(mode));
  const showPills = isDimmable && (supportsColorTemp || supportsColor);
  const groupedEntityIds = activeLightId ? getA(activeLightId, 'entity_id', []) : [];
  const showRightPanel = isDimmable || groupedEntityIds.length > 0;
  const modalTitleId = `light-modal-title-${activeLightId.replace(/[^a-zA-Z0-9_-]/g, '-')}`;

  // --- Icon ---
  let DefaultIcon = Lightbulb;
  if (activeLightId.includes('kjokken') || activeLightId.includes('kitchen'))
    DefaultIcon = Utensils;
  else if (activeLightId.includes('stova') || activeLightId.includes('living')) DefaultIcon = Sofa;
  else if (activeLightId.includes('studio') || activeLightId.includes('office'))
    DefaultIcon = LampDesk;
  const lightIconName = customIcons[activeLightId] || entities[activeLightId]?.attributes?.icon;
  const LightIcon = lightIconName ? getIconComponent(lightIconName) || DefaultIcon : DefaultIcon;

  // --- Values & Ranges ---
  // Brightness moves in 10 % steps and warmth in named presets; each change is
  // sent once, on release, and held on screen until the light reports it back.
  const kelvinRange = getEntityKelvinRange(entity?.attributes);
  const warmthPresets = getWarmthPresets(kelvinRange.min, kelvinRange.max);
  const remoteKelvin =
    getEntityKelvin(entity?.attributes) ?? Math.round((kelvinRange.min + kelvinRange.max) / 2);
  const [warmthIndex, holdWarmthIndex] = useHeldValue(
    nearestWarmthIndex(remoteKelvin, warmthPresets)
  );
  const [brightnessPct, holdBrightnessPct] = useHeldValue(
    brightnessToStepPct(getA(activeLightId, 'brightness'))
  );
  const [dragBrightnessPct, setDragBrightnessPct] = useState(null);
  const shownBrightnessPct = dragBrightnessPct ?? brightnessPct;
  const remoteHue = entity?.attributes?.hs_color?.[0] ?? 0;

  // --- Local State ---
  const [activeTab, setActiveTab] = useState('brightness');
  const [localHue, setLocalHue] = useState(remoteHue);
  const hueDirtyRef = useRef(false);

  // Reset tab on open
  useEffect(() => {
    if (show) setActiveTab('brightness');
  }, [show]);

  // Sync remote -> local when the hue isn't being changed
  useEffect(() => {
    if (!hueDirtyRef.current && remoteHue !== undefined) {
      setLocalHue(remoteHue);
    }
  }, [remoteHue]);

  // --- Handlers ---
  const commitBrightness = (pct) => {
    setDragBrightnessPct(null);
    if (!activeLightId || (pct === brightnessPct && isOn)) return;
    holdBrightnessPct(pct);
    callService('light', 'turn_on', { entity_id: activeLightId, brightness_pct: pct });
  };

  const commitWarmth = (index) => {
    if (!activeLightId || !warmthPresets[index]) return;
    if (index === warmthIndex && isOn) return;
    holdWarmthIndex(index);
    callService('light', 'turn_on', {
      entity_id: activeLightId,
      color_temp_kelvin: warmthPresets[index].kelvin,
    });
  };

  // Group members: one command per release, deduplicated across the
  // pointer/mouse/touch events a single gesture fires.
  const lastSubCommitRef = useRef({});
  const commitSubBrightness = (entityId, rawValue) => {
    const pct = parseInt(rawValue, 10);
    if (!Number.isFinite(pct) || lastSubCommitRef.current[entityId] === pct) return;
    const member = entities[entityId];
    if (member?.state === 'on' && brightnessToStepPct(member.attributes?.brightness) === pct)
      return;
    lastSubCommitRef.current[entityId] = pct;
    setTimeout(() => {
      if (lastSubCommitRef.current[entityId] === pct) delete lastSubCommitRef.current[entityId];
    }, 400);
    callService('light', 'turn_on', { entity_id: entityId, brightness_pct: pct });
  };

  const handleHueChange = (e) => {
    hueDirtyRef.current = true;
    setLocalHue(parseInt(e.target.value, 10));
  };

  const commitHue = () => {
    if (!activeLightId || !hueDirtyRef.current) return;
    hueDirtyRef.current = false;
    callService('light', 'turn_on', { entity_id: activeLightId, hs_color: [localHue, 100] });
  };

  // Determine glow color
  const getGlowColor = () => {
    if (!isOn) return 'transparent';
    if (activeTab === 'color' && supportsColor) {
      return `hsl(${localHue}, 100%, 50%)`;
    }
    if (activeTab === 'warmth' && supportsColorTemp) {
      const kelvin = warmthPresets[warmthIndex]?.kelvin ?? remoteKelvin;
      if (kelvin < 3000) return '#f59e0b'; // Warm/Orange
      if (kelvin > 5000) return '#93c5fd'; // Cool/Blue
      return '#fbbf24'; // Neutral
    }
    return '#fbbf24'; // Default amber
  };

  if (!show || !activeLightId) return null;

  return (
    <AccessibleModalShell
      open={show && !!activeLightId}
      onClose={onClose}
      titleId={modalTitleId}
      overlayClassName="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 md:p-6"
      overlayStyle={{ backdropFilter: 'blur(20px)', backgroundColor: 'rgba(0,0,0,0.3)' }}
      panelClassName={`w-full border ${showRightPanel ? 'max-w-5xl' : 'max-w-xl'} flex touch-pan-y flex-col overflow-x-hidden overflow-y-auto overscroll-contain rounded-3xl md:rounded-[3rem] ${showRightPanel ? 'lg:grid lg:grid-cols-5' : ''} popup-anim relative max-h-[calc(100dvh-1rem)] shadow-2xl sm:max-h-[90vh] backdrop-blur-xl md:min-h-[550px] lg:overflow-hidden`}
      panelStyle={{
        background: 'linear-gradient(135deg, var(--card-bg) 0%, var(--modal-bg) 100%)',
        borderColor: 'var(--glass-border)',
        color: 'var(--text-primary)',
      }}
    >
      {() => (
        <>
          {/* Close Button Row (Mobile & Desktop) */}
          <div className="absolute top-4 right-4 z-50 sm:top-6 sm:right-6 md:top-10 md:right-10">
            <button onClick={onClose} className="modal-close" aria-label={t('common.close')}>
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* LEFT PANEL: Visuals & Ambient (3 cols) */}
          <div
            className={`${showRightPanel ? 'border-b lg:col-span-3 lg:border-r lg:border-b-0' : 'h-full w-full flex-1'} relative flex shrink-0 flex-col justify-between overflow-hidden p-4 md:p-10`}
            style={{ borderColor: 'var(--glass-border)' }}
          >
            {/* Dynamic Ambient Glow - Subtler */}
            <div
              className="pointer-events-none absolute top-1/2 left-1/2 h-[120%] w-[120%] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-5 blur-[100px] transition-all duration-1000"
              style={{ backgroundColor: getGlowColor() }}
            />

            {/* Header */}
            <div className="relative z-10 mb-4 flex shrink-0 items-center gap-3 pr-12 sm:mb-6 sm:gap-4 sm:pr-0">
              <div
                className={`rounded-2xl p-3 transition-all duration-500 sm:p-4 ${isUnavailable ? 'bg-[var(--status-error-bg)] text-[var(--status-error-fg)]' : isOn ? 'bg-amber-500/15 text-amber-400' : 'bg-[var(--glass-bg)] text-[var(--text-secondary)]'}`}
              >
                <LightIcon className="h-6 w-6 sm:h-8 sm:w-8" />
              </div>
              <div className="min-w-0">
                <h2
                  id={modalTitleId}
                  className="truncate pr-1 text-xl leading-none font-light tracking-tight text-[var(--text-primary)] uppercase italic sm:text-2xl"
                >
                  {getA(activeLightId, 'friendly_name', t('common.light'))}
                </h2>
                <div
                  className={`mt-2 inline-flex items-center gap-2 rounded-full border px-3 py-1 ${isUnavailable ? 'border-[var(--status-error-border)] bg-[var(--status-error-bg)] text-[var(--status-error-fg)]' : 'border-[var(--glass-border)] bg-[var(--glass-bg)] text-[var(--text-secondary)]'}`}
                >
                  <div
                    className={`h-1.5 w-1.5 rounded-full ${isUnavailable ? 'bg-[var(--status-error-fg)]' : isOn ? 'bg-[var(--status-success-fg)] shadow-[0_0_6px_var(--status-success-fg)]' : 'bg-slate-600'}`}
                  />
                  <span className="text-[10px] font-bold tracking-widest uppercase italic">
                    {isUnavailable
                      ? t('status.unavailable')
                      : isOn
                        ? t('common.on')
                        : t('common.off')}
                  </span>
                  {isOn && (
                    <span className="border-l border-[var(--glass-border)] pl-2 text-[10px] font-bold tracking-widest text-[var(--text-muted)] uppercase italic">
                      {shownBrightnessPct}%
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Centerpiece Icon - Toggle Button */}
            <div className="relative z-10 my-4 flex min-h-[100px] flex-1 items-center justify-center md:my-0 md:min-h-0">
              <button
                type="button"
                onClick={() =>
                  !isUnavailable &&
                  getStatus(activeLightId) !== 'pending' &&
                  runAction(activeLightId, () =>
                    callService('light', 'toggle', { entity_id: activeLightId })
                  )
                }
                aria-label={t('light.toggle') || t('common.toggle')}
                aria-busy={getStatus(activeLightId) === 'pending'}
                disabled={isUnavailable}
                className={`relative flex h-24 w-24 items-center justify-center rounded-full transition-all duration-700 md:h-36 md:w-36 ${
                  isUnavailable
                    ? 'cursor-not-allowed bg-[var(--status-error-bg)] text-[var(--status-error-fg)]'
                    : isOn
                      ? 'cursor-pointer bg-[var(--glass-bg)] text-[var(--text-primary)] shadow-2xl active:scale-95'
                      : 'cursor-pointer bg-[var(--glass-bg)] text-[var(--text-secondary)] hover:bg-[var(--glass-bg-hover)] active:scale-95'
                } border border-[var(--glass-border)]`}
                style={{
                  // Dimmed glow behind icon (lower opacity on hex color or lower radius)
                  boxShadow: isOn ? `0 0 60px -10px ${getGlowColor()}15` : 'none',
                }}
              >
                {isUnavailable ? (
                  <AlertTriangle className="h-8 w-8 md:h-10 md:w-10" />
                ) : getStatus(activeLightId) !== 'idle' ? (
                  <ActionFeedbackIndicator
                    status={getStatus(activeLightId)}
                    className="h-10 w-10 md:h-16 md:w-16"
                  />
                ) : (
                  <Power className="h-10 w-10 stroke-[1.5px] md:h-16 md:w-16" />
                )}

                {/* Subtle inner ring */}
                {isOn && (
                  <div className="absolute inset-0 rounded-full border border-white/10 opacity-30" />
                )}
              </button>
            </div>

            {/* Tabs / Mode Switcher - Sleek Segmented Control */}
            <div className="relative z-10 mx-auto w-full max-w-sm shrink-0">
              {showPills && (
                <div className="flex w-full rounded-xl border border-[var(--glass-border)] bg-[var(--glass-bg)] p-1">
                  <button
                    onClick={() => setActiveTab('brightness')}
                    className={`flex flex-1 items-center justify-center gap-2 rounded-lg py-2 text-xs font-bold tracking-wider uppercase transition-all duration-300 ${activeTab === 'brightness' ? 'bg-[var(--glass-bg-hover)] text-[var(--text-primary)] shadow-sm' : 'text-[var(--text-secondary)] hover:bg-[var(--glass-bg-hover)] hover:text-[var(--text-primary)]'}`}
                  >
                    <Sun className="h-3.5 w-3.5" />
                    <span>{t('light.brightness')}</span>
                  </button>
                  {supportsColorTemp && (
                    <button
                      onClick={() => setActiveTab('warmth')}
                      className={`flex flex-1 items-center justify-center gap-2 rounded-lg py-2 text-xs font-bold tracking-wider uppercase transition-all duration-300 ${activeTab === 'warmth' ? 'bg-[var(--glass-bg-hover)] text-[var(--text-primary)] shadow-sm' : 'text-[var(--text-secondary)] hover:bg-[var(--glass-bg-hover)] hover:text-[var(--text-primary)]'}`}
                    >
                      <Thermometer className="h-3.5 w-3.5" />
                      <span>{t('light.warmth')}</span>
                    </button>
                  )}
                  {supportsColor && (
                    <button
                      onClick={() => setActiveTab('color')}
                      className={`flex flex-1 items-center justify-center gap-2 rounded-lg py-2 text-xs font-bold tracking-wider uppercase transition-all duration-300 ${activeTab === 'color' ? 'bg-[var(--glass-bg-hover)] text-[var(--text-primary)] shadow-sm' : 'text-[var(--text-secondary)] hover:bg-[var(--glass-bg-hover)] hover:text-[var(--text-primary)]'}`}
                    >
                      <Palette className="h-3.5 w-3.5" />
                      <span>{t('light.color')}</span>
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* RIGHT PANEL: Controls (2 cols) */}
          {showRightPanel && (
            <div className="flex min-h-0 flex-col lg:col-span-2 lg:h-full">
              <div className="custom-scrollbar flex-1 space-y-4 overflow-y-visible p-4 md:space-y-8 md:p-8 lg:overflow-y-auto lg:pt-16">
                {/* Dynamic Control Area - Simplified */}
                {isDimmable && (
                  <div className="flex min-h-[100px] flex-col justify-center md:min-h-[140px]">
                    {/* Brightness Slider */}
                    {activeTab === 'brightness' && (
                      <div className="space-y-2 md:space-y-4">
                        <div className="flex items-end justify-between px-1">
                          <label className="text-xs font-bold tracking-widest text-[var(--text-secondary)] uppercase">
                            {t('light.brightness')}
                          </label>
                          <span className="font-mono text-lg font-medium text-[var(--text-primary)]">
                            {shownBrightnessPct}%
                          </span>
                        </div>
                        <div className="h-10">
                          <M3Slider
                            min={MIN_BRIGHTNESS_PCT}
                            max={MAX_BRIGHTNESS_PCT}
                            step={BRIGHTNESS_STEP_PCT}
                            showSteps
                            value={brightnessPct}
                            disabled={isUnavailable}
                            onChange={(e) => setDragBrightnessPct(parseInt(e.target.value, 10))}
                            onCommit={commitBrightness}
                            ariaLabel={t('light.brightness')}
                            ariaValueText={`${shownBrightnessPct}%`}
                            colorClass="bg-amber-500"
                            variant="fat" // Keep fat for touch, but in smaller container
                          />
                        </div>
                      </div>
                    )}

                    {/* Warmth: named steps */}
                    {activeTab === 'warmth' && (
                      <WarmthStepSlider
                        presets={warmthPresets}
                        valueIndex={warmthIndex}
                        onCommit={commitWarmth}
                        disabled={isUnavailable}
                        label={t('light.colorTemperature')}
                        ariaLabel={t('light.colorTemperature')}
                        height="md"
                        t={t}
                      />
                    )}

                    {/* Color Slider - Re-styled */}
                    {activeTab === 'color' && (
                      <div className="space-y-2 md:space-y-4">
                        <div className="flex items-end justify-between px-1">
                          <label className="text-xs font-bold tracking-widest text-[var(--text-secondary)] uppercase">
                            {t('light.hue')}
                          </label>
                          {/* Color Preview Dot */}
                          <div
                            className="h-6 w-6 rounded-full border border-[var(--glass-border)] shadow-sm"
                            style={{ backgroundColor: `hsl(${localHue}, 100%, 50%)` }}
                          />
                        </div>
                        <div className="relative h-10 w-full touch-none overflow-hidden rounded-xl shadow-inner">
                          <input
                            type="range"
                            min={0}
                            max={360}
                            step={1}
                            value={localHue}
                            aria-label={t('light.hue')}
                            aria-valuetext={`${localHue} degrees`}
                            disabled={isUnavailable}
                            onChange={handleHueChange}
                            onPointerUp={commitHue}
                            onMouseUp={commitHue}
                            onTouchEnd={commitHue}
                            onKeyUp={commitHue}
                            className="absolute inset-0 z-20 h-full w-full cursor-pointer opacity-0"
                          />
                          <div
                            className="absolute inset-0"
                            style={{
                              background:
                                'linear-gradient(90deg, #ef4444 0%, #f59e0b 16%, #facc15 32%, #22c55e 48%, #06b6d4 64%, #6366f1 80%, #d946ef 100%)',
                            }}
                          />
                          {/* Thumb Indicator */}
                          <div
                            className="pointer-events-none absolute top-0 bottom-0 w-1.5 bg-white/80 shadow-sm backdrop-blur-sm transition-transform duration-75"
                            style={{
                              left: `${(localHue / 360) * 100}%`,
                              transform: 'translateX(-50%)', // Center the thin line
                            }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Sub Entities - Cleaner list */}
                {groupedEntityIds.length > 0 && (
                  <div className="border-t border-[var(--glass-border)] pt-4 md:pt-6">
                    <h3 className="mb-2 pl-1 text-xs font-bold tracking-[0.2em] text-[var(--text-secondary)] uppercase md:mb-4">
                      {t('light.roomLights')}
                    </h3>
                    <div className="space-y-2 md:space-y-3">
                      {groupedEntityIds.map((cid) => {
                        const subEnt = entities[cid];
                        const subName =
                          subEnt?.attributes?.friendly_name || cid.split('.')[1].replace(/_/g, ' ');
                        const subIsOn = subEnt?.state === 'on';
                        const subUnavail = subEnt?.state === 'unavailable';
                        const subBrightness =
                          optimisticLightBrightness[cid] ?? (subEnt?.attributes?.brightness || 0);

                        return (
                          <div key={cid} className="flex items-end gap-3">
                            <div className="min-w-0 flex-1">
                              <div className="mb-1 flex items-end justify-between px-1">
                                <span className="truncate text-xs font-bold text-[var(--text-secondary)] opacity-90">
                                  {subName}
                                </span>
                              </div>
                              <div className="relative h-8 w-full overflow-hidden rounded-xl border border-[var(--glass-border)] bg-[var(--glass-bg)]">
                                {/* Mini Progress Bar for Brightness */}
                                <div
                                  className={`absolute top-0 left-0 h-full transition-all duration-300 ${subIsOn ? 'bg-amber-500 opacity-80' : 'bg-black/20 opacity-30'}`}
                                  style={{
                                    width: `${
                                      subIsOn
                                        ? ((brightnessToStepPct(subBrightness) -
                                            MIN_BRIGHTNESS_PCT) /
                                            (MAX_BRIGHTNESS_PCT - MIN_BRIGHTNESS_PCT)) *
                                          100
                                        : 0
                                    }%`,
                                  }}
                                />
                                {BRIGHTNESS_STEP_MARKS.map((position) => (
                                  <span
                                    key={position}
                                    aria-hidden="true"
                                    className="pointer-events-none absolute top-0 bottom-0 w-0.5 -translate-x-1/2 bg-black/25"
                                    style={{ left: `${position}%` }}
                                  />
                                ))}
                                {/* Invisible stepped slider; sends once on release */}
                                <input
                                  type="range"
                                  min={MIN_BRIGHTNESS_PCT}
                                  max={MAX_BRIGHTNESS_PCT}
                                  step={BRIGHTNESS_STEP_PCT}
                                  value={brightnessToStepPct(subBrightness)}
                                  aria-label={`${subName} ${t('light.brightness')}`}
                                  aria-valuetext={`${brightnessToStepPct(subBrightness)}%`}
                                  disabled={subUnavail}
                                  onChange={(e) => {
                                    const pct = parseInt(e.target.value, 10);
                                    setOptimisticLightBrightness((prev) => ({
                                      ...prev,
                                      [cid]: Math.round((pct / 100) * 255),
                                    }));
                                  }}
                                  onPointerUp={(e) =>
                                    commitSubBrightness(cid, e.currentTarget.value)
                                  }
                                  onMouseUp={(e) => commitSubBrightness(cid, e.currentTarget.value)}
                                  onTouchEnd={(e) =>
                                    commitSubBrightness(cid, e.currentTarget.value)
                                  }
                                  onKeyUp={(e) => commitSubBrightness(cid, e.currentTarget.value)}
                                  className="absolute inset-0 z-10 h-full w-full cursor-pointer opacity-0"
                                />
                              </div>
                            </div>

                            {/* Toggle Button - Aligned to bottom (items-end on parent) */}
                            <button
                              type="button"
                              onClick={() =>
                                getStatus(cid) !== 'pending' &&
                                runAction(cid, () =>
                                  callService('light', 'toggle', { entity_id: cid })
                                )
                              }
                              aria-label={`${subName} ${t('common.toggle')}`}
                              aria-busy={getStatus(cid) === 'pending'}
                              role="switch"
                              aria-checked={subIsOn}
                              disabled={subUnavail}
                              className={`relative h-8 w-12 rounded-full border transition-all ${subUnavail ? 'cursor-not-allowed border-[var(--glass-border)] bg-[var(--glass-bg)] opacity-40' : subIsOn ? 'border-amber-500/30 bg-amber-500/25' : 'border-[var(--glass-border)] bg-[var(--glass-bg)] hover:bg-[var(--glass-bg-hover)]'}`}
                            >
                              <span
                                aria-hidden="true"
                                className={`absolute top-1 left-1 h-5 w-5 rounded-full border transition-all duration-200 ${subIsOn ? 'translate-x-5 bg-amber-400 shadow-[0_0_10px_rgba(251,191,36,0.3)]' : 'translate-x-0 border-[var(--glass-border)] bg-[var(--text-secondary)] opacity-70'}`}
                              />
                              {getStatus(cid) !== 'idle' && (
                                <span className="absolute inset-0 flex items-center justify-center">
                                  <ActionFeedbackIndicator
                                    status={getStatus(cid)}
                                    className="h-4 w-4"
                                  />
                                </span>
                              )}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* Quick Actions Footer (Right Column) - Removed redundant toggle */}
            </div>
          )}
        </>
      )}
    </AccessibleModalShell>
  );
}
