import { memo, useState, useCallback, useRef, useMemo, useEffect } from 'react';
import {
  Lightbulb,
  Power,
  Search,
  ArrowUpDown,
  X,
  ChevronDown,
  AlertTriangle,
  Check,
  Eye,
  EyeOff,
  Thermometer,
} from '../../icons';
import { getIconComponent } from '../../icons';
import M3Slider from '../ui/M3Slider';
import ActionFeedbackIndicator from '../ui/ActionFeedbackIndicator';
import useActionFeedback from '../../hooks/useActionFeedback';
import useHeldValue from '../../hooks/useHeldValue';
import WarmthStepSlider from '../ui/WarmthStepSlider';
import {
  BRIGHTNESS_STEP_PCT,
  MAX_BRIGHTNESS_PCT,
  MIN_BRIGHTNESS_PCT,
  brightnessToStepPct,
  getEntityKelvin,
  getEntityKelvinRange,
  getWarmthPresets,
  nearestWarmthIndex,
} from '../../utils/lightSteps';
import { getAreas } from '../../services/haClient';
import { getLightColor } from '../../utils/lightColor';

const DEFAULT_COLLAPSED_LIGHT_AREAS = ['Hall'];
const WARMTH_DISABLED_LIGHT_NAMES = new Set(['Köksfönster']);
// Lights shown per area by default. A name may be a Hue zone or other light
// group (e.g. "Fönster" in Vardagsrum covers Fönster1 and Fönster2): it is
// then shown as one light and its members stay hidden.
const DEFAULT_AREA_LIGHT_ALLOWLIST = {
  Kontor: new Set(['Jordglob', 'Tak', 'Skrivbord']),
  Kök: new Set(['Köksfönster']),
  Matsal: new Set(['Tak']),
  Sovrum: new Set(['Adam sänglampa', 'Emma sänglampa', 'Tak']),
  Vardagsrum: new Set(['Tak', 'Fönster', 'LP']),
};

const SORT_OPTIONS = [
  { key: 'status', icon: '●' },
  { key: 'name-az', icon: 'A→Z' },
  { key: 'name-za', icon: 'Z→A' },
  { key: 'brightness', icon: '☀' },
  { key: 'area', icon: '⌂' },
  { key: 'unavailable', icon: '⚠' },
];

// ── Individual Light Tile ────────────────────────────────────────────────

const LightTile = memo(
  /** @param {{ entity: any, areaName?: string, onToggle: (entityId: string) => void, onBrightness: (entityId: string, pct: number) => void, onWarmth: (entityId: string, kelvin: number) => void, toggleStatus?: string, t: (key: string) => string }} props */
  function LightTile({
    entity,
    areaName,
    onToggle,
    onBrightness,
    onWarmth,
    toggleStatus = 'idle',
    t,
  }) {
    const [showWarmth, setShowWarmth] = useState(false);
    const { entity_id, state, attributes } = entity;
    const isOn = state === 'on';
    const isUnavailable = state === 'unavailable' || state === 'unknown';
    const name = attributes?.friendly_name || entity_id.split('.')[1];
    // Brightness in 10 % steps, warmth in named presets; each sent once on
    // release and held until the light reports it back.
    const [brightnessPct, holdBrightnessPct] = useHeldValue(
      brightnessToStepPct(attributes?.brightness)
    );
    const [dragBrightnessPct, setDragBrightnessPct] = useState(null);
    const brightnessPercent = dragBrightnessPct ?? brightnessPct;

    const supportedColorModes = attributes?.supported_color_modes;
    const isDimmable = supportedColorModes
      ? !supportedColorModes.includes('onoff') || supportedColorModes.length > 1
      : false;
    const supportsColorTemp =
      !WARMTH_DISABLED_LIGHT_NAMES.has(name) &&
      supportedColorModes?.some((mode) => ['color_temp', 'color_temp_kelvin'].includes(mode));
    const kelvinRange = getEntityKelvinRange(attributes);
    const warmthPresets = getWarmthPresets(kelvinRange.min, kelvinRange.max);
    const [warmthIndex, holdWarmthIndex] = useHeldValue(
      nearestWarmthIndex(
        getEntityKelvin(attributes) ?? Math.round((kelvinRange.min + kelvinRange.max) / 2),
        warmthPresets
      )
    );

    const commitBrightness = (pct) => {
      setDragBrightnessPct(null);
      if (pct === brightnessPct && isOn) return;
      holdBrightnessPct(pct);
      onBrightness(entity_id, pct);
    };

    const commitWarmth = (index) => {
      if (!warmthPresets[index] || (index === warmthIndex && isOn)) return;
      holdWarmthIndex(index);
      onWarmth(entity_id, warmthPresets[index].kelvin);
    };

    const lightColor = getLightColor(entity);
    const iconName = attributes?.icon;
    const Icon = iconName ? getIconComponent(iconName) || Lightbulb : Lightbulb;

    const subEntities = attributes?.entity_id;
    const isGroup = Array.isArray(subEntities) && subEntities.length > 0;

    return (
      <div
        className={`group relative overflow-hidden rounded-3xl border font-sans transition-all duration-500 ${isOn ? 'p-5' : 'px-5 py-3.5'} ${
          isUnavailable ? 'opacity-50' : ''
        }`}
        style={{
          background:
            isOn && lightColor
              ? `linear-gradient(135deg, rgba(${lightColor}, 0.10) 0%, var(--card-bg) 100%)`
              : 'var(--card-bg)',
          borderColor: isOn && lightColor ? `rgba(${lightColor}, 0.3)` : 'var(--glass-border)',
          boxShadow:
            isOn && lightColor
              ? `0 0 40px rgba(${lightColor}, 0.10), inset 0 1px 0 rgba(${lightColor}, 0.08)`
              : undefined,
        }}
      >
        {/* Name + toggle row */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <div
              className={`flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl transition-all duration-500 ${
                isOn
                  ? ''
                  : 'bg-[color-mix(in_srgb,var(--cat-light)_10%,transparent)] text-[color-mix(in_srgb,var(--cat-light)_70%,var(--text-muted))]'
              }`}
              style={
                isOn && lightColor
                  ? {
                      backgroundColor: `rgba(${lightColor}, 0.18)`,
                      color: `rgb(${lightColor})`,
                    }
                  : undefined
              }
            >
              <Icon
                className={`h-5 w-5 stroke-[1.5px] transition-transform duration-300 group-hover:scale-110`}
              />
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-[var(--text-primary)]">{name}</p>
              <p className="text-[11px] text-[var(--text-muted)]">
                {isUnavailable
                  ? t('status.unavailable') || 'Unavailable'
                  : isOn
                    ? isDimmable
                      ? `${brightnessPercent}%`
                      : t('common.on') || 'On'
                    : t('common.off') || 'Off'}
                {isGroup && ` · ${subEntities.length}`}
                {areaName && <span className="opacity-60"> · {areaName}</span>}
              </p>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            {supportsColorTemp && (
              <button
                type="button"
                onClick={() => setShowWarmth((visible) => !visible)}
                disabled={isUnavailable}
                className={`flex h-10 w-10 items-center justify-center rounded-full border transition-all active:scale-95 ${
                  showWarmth
                    ? 'border-amber-400/50 bg-amber-400/15 text-amber-300'
                    : 'border-[var(--glass-border)] bg-[var(--glass-bg)] text-[var(--text-muted)] hover:bg-[var(--glass-bg-hover)]'
                }`}
                aria-label={`${t('light.warmth') || 'Värme'} ${name}`}
                aria-expanded={showWarmth}
              >
                <Thermometer className="h-4 w-4" />
              </button>
            )}
            <button
              type="button"
              onClick={() => !isUnavailable && toggleStatus !== 'pending' && onToggle(entity_id)}
              disabled={isUnavailable}
              aria-busy={toggleStatus === 'pending'}
              className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full transition-all duration-300 ${
                isOn
                  ? 'hover:opacity-80'
                  : 'bg-[var(--glass-bg)] text-[var(--text-muted)] hover:bg-[var(--glass-bg-hover)]'
              }`}
              style={
                isOn && lightColor
                  ? {
                      backgroundColor: `rgba(${lightColor}, 0.22)`,
                      color: `rgb(${lightColor})`,
                    }
                  : undefined
              }
              aria-label={`${name}: ${isOn ? t('common.off') || 'Off' : t('common.on') || 'On'}`}
            >
              {toggleStatus === 'idle' ? (
                <Power className="h-4 w-4" />
              ) : (
                <ActionFeedbackIndicator status={toggleStatus} className="h-4 w-4" />
              )}
            </button>
          </div>
        </div>

        {/* Brightness slider */}
        {isDimmable && isOn && (
          <div className="mt-4">
            <M3Slider
              variant="thinLg"
              min={MIN_BRIGHTNESS_PCT}
              max={MAX_BRIGHTNESS_PCT}
              step={BRIGHTNESS_STEP_PCT}
              showSteps
              value={brightnessPct}
              disabled={isUnavailable}
              onChange={(e) => setDragBrightnessPct(parseInt(e.target.value, 10))}
              onCommit={commitBrightness}
              ariaValueText={`${brightnessPercent}%`}
              colorClass={isOn ? 'bg-amber-400' : 'bg-[var(--text-muted)]'}
              ariaLabel={t('light.brightness') || 'Brightness'}
            />
          </div>
        )}

        {supportsColorTemp && showWarmth && (
          <div className="mt-4 border-t border-[var(--glass-border)] pt-4">
            <WarmthStepSlider
              presets={warmthPresets}
              valueIndex={warmthIndex}
              onCommit={commitWarmth}
              disabled={isUnavailable}
              label={t('light.warmth') || 'Värme'}
              ariaLabel={`${t('light.warmth') || 'Värme'} ${name}`}
              t={t}
            />
          </div>
        )}
      </div>
    );
  }
);

// ── Confirm Button ───────────────────────────────────────────────────────

const ConfirmButton = memo(
  /** @param {{ label: string, confirmLabel: string, onConfirm: () => void, status?: string, t: (key: string) => string }} props */
  function ConfirmButton({ label, confirmLabel, onConfirm, status = 'idle', t }) {
    const [pending, setPending] = useState(false);
    const ref = useRef(null);
    const timerRef = useRef(null);

    useEffect(() => {
      if (!pending) return;
      const handleClick = (e) => {
        if (ref.current && !ref.current.contains(e.target)) setPending(false);
      };
      document.addEventListener('mousedown', handleClick);
      timerRef.current = setTimeout(() => setPending(false), 4000);
      return () => {
        document.removeEventListener('mousedown', handleClick);
        clearTimeout(timerRef.current);
      };
    }, [pending]);

    return (
      <div className="relative" ref={ref}>
        <button
          type="button"
          onClick={() => setPending(true)}
          disabled={status === 'pending'}
          aria-busy={status === 'pending'}
          className={`flex items-center gap-2 rounded-2xl border border-[var(--glass-border)] bg-[var(--glass-bg)] px-4 py-2.5 text-sm font-semibold text-[var(--text-secondary)] transition-all hover:bg-[var(--glass-bg-hover)] hover:text-[var(--text-primary)] active:scale-95 ${
            pending ? 'opacity-60' : ''
          }`}
        >
          {label}
          {status !== 'idle' && <ActionFeedbackIndicator status={status} className="h-4 w-4" />}
        </button>

        {pending && (
          <div
            className="absolute top-full right-0 z-50 mt-2 overflow-hidden rounded-2xl border shadow-2xl"
            style={{ backgroundColor: 'var(--modal-bg)', borderColor: 'var(--glass-border)' }}
          >
            <p className="px-5 pt-4 pb-2 text-xs font-medium text-[var(--text-secondary)]">
              {confirmLabel}
            </p>
            <div className="flex gap-2 px-4 pb-4">
              <button
                onClick={() => setPending(false)}
                className="flex-1 rounded-xl border border-[var(--glass-border)] bg-[var(--glass-bg)] px-3 py-2 text-sm font-semibold text-[var(--text-secondary)] transition-all hover:bg-[var(--glass-bg-hover)] active:scale-95"
              >
                {t('common.cancel') || 'Cancel'}
              </button>
              <button
                onClick={() => {
                  setPending(false);
                  onConfirm();
                }}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-[var(--accent-color)] px-3 py-2 text-sm font-semibold text-white transition-all hover:opacity-90 active:scale-95"
              >
                <Check className="h-3.5 w-3.5" />
                {t('common.confirm') || 'Confirm'}
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }
);

// ── Sort Dropdown ────────────────────────────────────────────────────────

const SortDropdown = memo(
  /** @param {{ sortMode: string, onSortChange: (mode: string) => void, t: (key: string) => string }} props */
  function SortDropdown({ sortMode, onSortChange, t }) {
    const [open, setOpen] = useState(false);
    const ref = useRef(null);

    useEffect(() => {
      if (!open) return;
      const handleClick = (e) => {
        if (ref.current && !ref.current.contains(e.target)) setOpen(false);
      };
      document.addEventListener('mousedown', handleClick);
      return () => document.removeEventListener('mousedown', handleClick);
    }, [open]);

    const current = SORT_OPTIONS.find((o) => o.key === sortMode) || SORT_OPTIONS[0];

    return (
      <div className="relative" ref={ref}>
        <button
          onClick={() => setOpen((o) => !o)}
          className="group popup-surface popup-surface-hover flex items-center gap-2 rounded-2xl px-4 py-2.5 transition-all active:scale-95"
        >
          <ArrowUpDown className="h-3.5 w-3.5 text-[var(--text-muted)] transition-colors group-hover:text-[var(--accent-color)]" />
          <span className="text-sm font-semibold text-[var(--text-secondary)]">
            {t(`lights.sort.${current.key}`) || current.key}
          </span>
          <ChevronDown
            className={`h-3.5 w-3.5 text-[var(--text-muted)] transition-transform duration-500 ${open ? 'rotate-180' : ''}`}
          />
        </button>

        {open && (
          <div
            className="absolute right-0 z-50 mt-2 min-w-[10rem] overflow-hidden rounded-2xl border shadow-2xl"
            style={{ backgroundColor: 'var(--modal-bg)', borderColor: 'var(--glass-border)' }}
          >
            {SORT_OPTIONS.map(({ key }) => {
              const active = key === sortMode;
              return (
                <button
                  key={key}
                  onClick={() => {
                    onSortChange(key);
                    setOpen(false);
                  }}
                  className={`w-full px-5 py-3 text-left text-sm font-medium transition-all ${
                    active
                      ? 'text-[var(--accent-color)]'
                      : 'text-[var(--text-secondary)] hover:bg-[var(--glass-bg-hover)] hover:text-[var(--text-primary)]'
                  }`}
                  style={{ backgroundColor: active ? 'var(--accent-bg)' : 'transparent' }}
                >
                  {t(`lights.sort.${key}`) || key}
                </button>
              );
            })}
          </div>
        )}
      </div>
    );
  }
);

// ── Main Lights Page ─────────────────────────────────────────────────────

function LightsPage({ entities, callService, conn, pageSettings, pageId, savePageSetting, t }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [isMobileSearchOpen, setIsMobileSearchOpen] = useState(false);
  const [sortMode, setSortMode] = useState(() => pageSettings?.[pageId]?.lightsSort || 'status');
  const [showGroups, setShowGroups] = useState(
    () => pageSettings?.[pageId]?.lightsShowGroups !== false
  );
  const [hideUnavailable, setHideUnavailable] = useState(
    () => pageSettings?.[pageId]?.lightsHideUnavailable === true
  );
  const [collapsedAreas, setCollapsedAreas] = useState(
    () => new Set(pageSettings?.[pageId]?.lightsCollapsedAreas || DEFAULT_COLLAPSED_LIGHT_AREAS)
  );
  const [areas, setAreas] = useState([]);

  // Fetch areas for grouping
  useEffect(() => {
    if (!conn) return;
    let cancelled = false;
    getAreas(conn)
      .then((result) => {
        if (!cancelled) setAreas(result);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [conn]);

  // Build area lookup from enriched entity attributes
  const areaMap = useMemo(() => {
    const map = new Map();
    areas.forEach((a) => map.set(a.area_id, a.name || a.area_id));
    return map;
  }, [areas]);

  // Persist sort preference
  const handleSortChange = useCallback(
    (mode) => {
      setSortMode(mode);
      if (savePageSetting && pageId) {
        savePageSetting(pageId, 'lightsSort', mode);
      }
    },
    [savePageSetting, pageId]
  );

  const handleToggleGroups = useCallback(() => {
    setShowGroups((prev) => {
      const next = !prev;
      if (savePageSetting && pageId) {
        savePageSetting(pageId, 'lightsShowGroups', next);
      }
      return next;
    });
  }, [savePageSetting, pageId]);

  const handleToggleUnavailable = useCallback(() => {
    setHideUnavailable((prev) => {
      const next = !prev;
      if (savePageSetting && pageId) {
        savePageSetting(pageId, 'lightsHideUnavailable', next);
      }
      return next;
    });
  }, [savePageSetting, pageId]);

  const handleToggleAreaCollapsed = useCallback(
    (areaName) => {
      setCollapsedAreas((previous) => {
        const next = new Set(previous);
        if (next.has(areaName)) next.delete(areaName);
        else next.add(areaName);
        if (savePageSetting && pageId) {
          savePageSetting(pageId, 'lightsCollapsedAreas', [...next]);
        }
        return next;
      });
    },
    [savePageSetting, pageId]
  );

  // Get area name for a light entity using enriched attributes
  const getAreaName = useCallback(
    (entity) => {
      const a = entity.attributes || {};
      // Enriched from entity/device registry
      if (a.area_id && areaMap.has(a.area_id)) return areaMap.get(a.area_id);
      if (a.area_name) return a.area_name;
      return null;
    },
    [areaMap]
  );

  // All light entities
  const allLights = useMemo(() => {
    return Object.values(entities).filter(
      (e) => e.entity_id.startsWith('light.') && e.state !== undefined
    );
  }, [entities]);

  // Separate groups and individual lights
  const { groups, individuals } = useMemo(() => {
    const grps = [];
    const indiv = [];
    allLights.forEach((e) => {
      const subEntities = e.attributes?.entity_id;
      if (Array.isArray(subEntities) && subEntities.length > 0) {
        grps.push(e);
      } else {
        indiv.push(e);
      }
    });
    return { groups: grps, individuals: indiv };
  }, [allLights]);

  // A group named in an area's allowlist (e.g. a Hue zone) stands in for its
  // member lamps, unless a member is already shown on its own under that name
  // (a zone "Tak" around the lamp "Tak" stays hidden).
  const isAllowlistedGroup = useCallback(
    (entity) => {
      const members = entity.attributes?.entity_id;
      if (!Array.isArray(members) || members.length === 0) return false;
      const allowed = DEFAULT_AREA_LIGHT_ALLOWLIST[getAreaName(entity)];
      if (!allowed?.has(entity.attributes?.friendly_name || entity.entity_id)) return false;
      return !members.some((memberId) => {
        const member = entities[memberId];
        const memberMembers = member?.attributes?.entity_id;
        const memberIsGroup = Array.isArray(memberMembers) && memberMembers.length > 0;
        return (
          member && !memberIsGroup && allowed.has(member.attributes?.friendly_name || memberId)
        );
      });
    },
    [entities, getAreaName]
  );

  const visibleBase = useMemo(
    () =>
      showGroups
        ? allLights
        : [...individuals, ...groups.filter((entity) => isAllowlistedGroup(entity))],
    [allLights, individuals, groups, showGroups, isAllowlistedGroup]
  );

  // Count unavailable before filtering
  const unavailableCount = useMemo(() => {
    const base = visibleBase;
    return base.filter((e) => e.state === 'unavailable' || e.state === 'unknown').length;
  }, [visibleBase]);

  // Filter by search + unavailable toggle
  const filteredLights = useMemo(() => {
    let base = visibleBase;
    if (hideUnavailable) {
      base = base.filter((e) => e.state !== 'unavailable' && e.state !== 'unknown');
    }
    if (!searchTerm.trim()) return base;
    const term = searchTerm.toLowerCase();
    return base.filter((e) => {
      const name = (e.attributes?.friendly_name || e.entity_id).toLowerCase();
      const area = (getAreaName(e) || '').toLowerCase();
      return name.includes(term) || area.includes(term) || e.entity_id.toLowerCase().includes(term);
    });
  }, [visibleBase, hideUnavailable, searchTerm, getAreaName]);

  // Sort lights
  const sortedLights = useMemo(() => {
    const list = [...filteredLights];
    const sorters = {
      status: (a, b) => {
        const aOn = a.state === 'on' ? 0 : 1;
        const bOn = b.state === 'on' ? 0 : 1;
        if (aOn !== bOn) return aOn - bOn;
        // Secondary: brightness desc
        const aBr = a.attributes?.brightness || 0;
        const bBr = b.attributes?.brightness || 0;
        if (aBr !== bBr) return bBr - aBr;
        const aName = a.attributes?.friendly_name || a.entity_id;
        const bName = b.attributes?.friendly_name || b.entity_id;
        return aName.localeCompare(bName);
      },
      'name-az': (a, b) => {
        const aName = a.attributes?.friendly_name || a.entity_id;
        const bName = b.attributes?.friendly_name || b.entity_id;
        return aName.localeCompare(bName);
      },
      'name-za': (a, b) => {
        const aName = a.attributes?.friendly_name || a.entity_id;
        const bName = b.attributes?.friendly_name || b.entity_id;
        return bName.localeCompare(aName);
      },
      brightness: (a, b) => {
        const aBr = a.state === 'on' ? a.attributes?.brightness || 0 : -1;
        const bBr = b.state === 'on' ? b.attributes?.brightness || 0 : -1;
        if (aBr !== bBr) return bBr - aBr;
        const aName = a.attributes?.friendly_name || a.entity_id;
        const bName = b.attributes?.friendly_name || b.entity_id;
        return aName.localeCompare(bName);
      },
      area: (a, b) => {
        const aArea = getAreaName(a) || '\uffff';
        const bArea = getAreaName(b) || '\uffff';
        if (aArea !== bArea) return aArea.localeCompare(bArea);
        const aOn = a.state === 'on' ? 0 : 1;
        const bOn = b.state === 'on' ? 0 : 1;
        if (aOn !== bOn) return aOn - bOn;
        const aName = a.attributes?.friendly_name || a.entity_id;
        const bName = b.attributes?.friendly_name || b.entity_id;
        return aName.localeCompare(bName);
      },
      unavailable: (a, b) => {
        const aUn = a.state === 'unavailable' || a.state === 'unknown' ? 0 : 1;
        const bUn = b.state === 'unavailable' || b.state === 'unknown' ? 0 : 1;
        if (aUn !== bUn) return aUn - bUn;
        const aName = a.attributes?.friendly_name || a.entity_id;
        const bName = b.attributes?.friendly_name || b.entity_id;
        return aName.localeCompare(bName);
      },
    };
    list.sort(sorters[sortMode] || sorters['status']);
    return list;
  }, [filteredLights, sortMode, getAreaName]);

  const findAreaGroup = useCallback((lights, areaName) => {
    const normalizedArea = areaName.trim().toLocaleLowerCase();
    return lights.find((entity) => {
      const members = entity.attributes?.entity_id;
      const name = entity.attributes?.friendly_name || entity.entity_id;
      return (
        Array.isArray(members) &&
        members.length > 0 &&
        name.trim().toLocaleLowerCase() === normalizedArea
      );
    });
  }, []);

  const collapsedEntityIds = useMemo(() => {
    const hidden = new Set();
    if (sortMode !== 'area' || searchTerm.trim()) return hidden;

    Object.entries(DEFAULT_AREA_LIGHT_ALLOWLIST).forEach(([areaName, allowedNames]) => {
      sortedLights.forEach((entity) => {
        if (getAreaName(entity) !== areaName) return;
        const name = entity.attributes?.friendly_name || entity.entity_id;
        const members = entity.attributes?.entity_id;
        const isGroup = Array.isArray(members) && members.length > 0;
        // Allowlisted lamps stay; groups only when they stand in for their members.
        if (isGroup ? !isAllowlistedGroup(entity) : !allowedNames.has(name)) {
          hidden.add(entity.entity_id);
        }
      });
    });

    collapsedAreas.forEach((areaName) => {
      if (Object.hasOwn(DEFAULT_AREA_LIGHT_ALLOWLIST, areaName)) return;
      const areaLights = sortedLights.filter((entity) => getAreaName(entity) === areaName);
      const areaGroup = findAreaGroup(areaLights, areaName);
      if (!areaGroup) return;
      areaLights.forEach((entity) => {
        if (entity.entity_id !== areaGroup.entity_id) hidden.add(entity.entity_id);
      });
    });
    return hidden;
  }, [
    collapsedAreas,
    sortedLights,
    getAreaName,
    findAreaGroup,
    isAllowlistedGroup,
    searchTerm,
    sortMode,
  ]);

  const displayedLights = useMemo(
    () => sortedLights.filter((entity) => !collapsedEntityIds.has(entity.entity_id)),
    [sortedLights, collapsedEntityIds]
  );

  // Group by area when sort mode is 'area'
  const areaGroups = useMemo(() => {
    if (sortMode !== 'area') return null;
    const groups = new Map();
    displayedLights.forEach((e) => {
      const area = getAreaName(e) || t('lights.noArea') || 'Other';
      if (!groups.has(area)) groups.set(area, []);
      groups.get(area).push(e);
    });
    return groups;
  }, [sortMode, displayedLights, getAreaName, t]);

  const onCount = displayedLights.filter((e) => e.state === 'on').length;
  const totalCount = displayedLights.length;

  const { getStatus, runAction } = useActionFeedback();

  const handleToggle = useCallback(
    (entityId) => {
      runAction(entityId, () => callService('light', 'toggle', { entity_id: entityId }));
    },
    [callService, runAction]
  );

  // Sliders call these once per release, with an already stepped value.
  const handleBrightness = useCallback(
    (entityId, pct) => {
      callService('light', 'turn_on', { entity_id: entityId, brightness_pct: pct });
    },
    [callService]
  );

  const handleWarmth = useCallback(
    (entityId, kelvin) => {
      callService('light', 'turn_on', { entity_id: entityId, color_temp_kelvin: kelvin });
    },
    [callService]
  );

  const handleAllOff = useCallback(() => {
    runAction('all-off', () =>
      Promise.all(
        displayedLights
          .filter((e) => e.state === 'on')
          .map((e) => callService('light', 'turn_off', { entity_id: e.entity_id }))
      )
    );
  }, [displayedLights, callService, runAction]);

  const handleAllOn = useCallback(() => {
    runAction('all-on', () =>
      Promise.all(
        displayedLights
          .filter((e) => e.state !== 'on' && e.state !== 'unavailable' && e.state !== 'unknown')
          .map((e) => callService('light', 'turn_on', { entity_id: e.entity_id }))
      )
    );
  }, [displayedLights, callService, runAction]);

  const renderTile = (entity) => (
    <LightTile
      key={entity.entity_id}
      entity={entity}
      areaName={getAreaName(entity)}
      onToggle={handleToggle}
      onBrightness={handleBrightness}
      onWarmth={handleWarmth}
      toggleStatus={getStatus(entity.entity_id)}
      t={t}
    />
  );

  const renderGrid = (lights) => (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {lights.map(renderTile)}
    </div>
  );

  return (
    <div className="animate-in fade-in zoom-in px-4 pb-8 duration-500">
      {/* ── Header ──────────────────────────────────────────────────── */}
      <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight text-[var(--text-primary)]">
            {t('lights.pageTitle') || t('addCard.type.light') || 'Lights'}
          </h2>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">
            {onCount} {(t('common.on') || 'On').toLowerCase()} · {totalCount}{' '}
            {t('lights.total') || 'total'}
          </p>
        </div>
        {totalCount > 0 && (
          <div className="flex gap-2">
            <ConfirmButton
              label={t('lights.allOn') || 'All on'}
              confirmLabel={t('lights.confirmAllOn') || 'Turn on all lights?'}
              onConfirm={handleAllOn}
              status={getStatus('all-on')}
              t={t}
            />
            <ConfirmButton
              label={t('lights.allOff') || 'All off'}
              confirmLabel={t('lights.confirmAllOff') || 'Turn off all lights?'}
              onConfirm={handleAllOff}
              status={getStatus('all-off')}
              t={t}
            />
          </div>
        )}
      </div>

      {/* ── Toolbar: search + sort + filters ────────────────────────── */}
      {allLights.length > 0 && (
        <div className="mb-5 flex flex-wrap items-center gap-3">
          {/* Search */}
          <div
            className={`relative min-w-0 ${isMobileSearchOpen ? 'order-first basis-full' : ''} sm:flex-1 sm:basis-auto`}
          >
            {!isMobileSearchOpen && (
              <button
                type="button"
                onClick={() => setIsMobileSearchOpen(true)}
                className="popup-surface flex h-[42px] w-[42px] items-center justify-center rounded-2xl text-[var(--text-secondary)] transition-all active:scale-95 sm:hidden"
                aria-label={t('lights.search') || 'Search lights'}
                title={t('lights.search') || 'Search lights'}
              >
                <Search className="h-4 w-4" />
              </button>
            )}
            <div className={`${isMobileSearchOpen ? 'block' : 'hidden'} relative sm:block`}>
              <Search className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]" />
              <input
                type="search"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder={t('lights.search') || 'Search lights...'}
                className="popup-surface w-full rounded-2xl py-2.5 pr-9 pl-10 text-sm text-[var(--text-primary)] transition-colors outline-none placeholder:text-[var(--text-muted)]"
                autoFocus={isMobileSearchOpen}
              />
              {(searchTerm || isMobileSearchOpen) && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchTerm('');
                    setIsMobileSearchOpen(false);
                  }}
                  className="absolute top-1/2 right-3 flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded-full bg-[var(--glass-bg)] text-[var(--text-muted)] transition-colors hover:bg-[var(--glass-bg-hover)] hover:text-[var(--text-primary)]"
                  aria-label={t('common.close') || 'Clear'}
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
          </div>

          {/* Sort dropdown */}
          <SortDropdown sortMode={sortMode} onSortChange={handleSortChange} t={t} />

          {/* Show/hide groups toggle */}
          {groups.length > 0 && (
            <button
              onClick={handleToggleGroups}
              className={`rounded-2xl border px-3 py-2.5 text-sm font-semibold transition-all active:scale-95 ${
                showGroups
                  ? 'border-[var(--accent-color)] bg-[var(--accent-bg)] text-[var(--accent-color)]'
                  : 'border-[var(--glass-border)] bg-[var(--glass-bg)] text-[var(--text-secondary)] hover:bg-[var(--glass-bg-hover)]'
              }`}
              title={t('lights.toggleGroups') || 'Show groups'}
            >
              {t('lights.groups') || 'Groups'} ({groups.length})
            </button>
          )}

          {/* Hide unavailable toggle */}
          {unavailableCount > 0 && (
            <button
              onClick={handleToggleUnavailable}
              className={`flex items-center gap-1.5 rounded-2xl border px-3 py-2.5 text-sm font-semibold transition-all active:scale-95 ${
                hideUnavailable
                  ? 'border-[var(--accent-color)] bg-[var(--accent-bg)] text-[var(--accent-color)]'
                  : 'border-[var(--glass-border)] bg-[var(--glass-bg)] text-[var(--text-secondary)] hover:bg-[var(--glass-bg-hover)]'
              }`}
              title={t('lights.toggleUnavailable') || 'Hide unavailable'}
            >
              <AlertTriangle className="h-3 w-3" />
              {hideUnavailable
                ? t('lights.hiddenUnavailable') || 'Hidden'
                : t('lights.unavailable') || 'Unavailable'}{' '}
              ({unavailableCount})
            </button>
          )}
        </div>
      )}

      {/* ── Content ─────────────────────────────────────────────────── */}
      {totalCount > 0 ? (
        areaGroups ? (
          // Area-grouped layout
          <div className="space-y-6">
            {[...areaGroups.entries()].map(([areaName, lights]) => {
              const fullAreaLights = sortedLights.filter(
                (entity) => getAreaName(entity) === areaName
              );
              const canCollapse =
                !Object.hasOwn(DEFAULT_AREA_LIGHT_ALLOWLIST, areaName) &&
                Boolean(findAreaGroup(fullAreaLights, areaName));
              const isCollapsed = collapsedAreas.has(areaName);

              return (
                <div key={areaName}>
                  <div className="mb-3 flex items-center gap-3">
                    <h3 className="text-sm font-semibold text-[var(--text-secondary)]">
                      {areaName}
                    </h3>
                    <div className="h-px flex-1 bg-[var(--glass-border)]" />
                    <span className="text-[11px] text-[var(--text-muted)]">
                      {lights.filter((e) => e.state === 'on').length}/{lights.length}
                    </span>
                    {canCollapse && (
                      <button
                        type="button"
                        onClick={() => handleToggleAreaCollapsed(areaName)}
                        className={`flex h-8 w-8 items-center justify-center rounded-xl border transition-all active:scale-95 ${
                          isCollapsed
                            ? 'border-[var(--accent-color)] bg-[var(--accent-bg)] text-[var(--accent-color)]'
                            : 'border-[var(--glass-border)] bg-[var(--glass-bg)] text-[var(--text-muted)] hover:bg-[var(--glass-bg-hover)]'
                        }`}
                        title={`${isCollapsed ? t('common.show') || 'Show' : t('common.hide') || 'Hide'} ${areaName}`}
                        aria-label={`${isCollapsed ? t('common.show') || 'Show' : t('common.hide') || 'Hide'} ${areaName}`}
                      >
                        {isCollapsed ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                      </button>
                    )}
                  </div>
                  {renderGrid(lights)}
                </div>
              );
            })}
          </div>
        ) : (
          renderGrid(displayedLights)
        )
      ) : searchTerm ? (
        <div className="flex min-h-[30vh] flex-col items-center justify-center text-center">
          <Search className="mb-4 h-10 w-10 text-[var(--text-muted)] opacity-40" />
          <p className="text-lg text-[var(--text-secondary)]">
            {t('lights.noResults') || 'No lights match your search'}
          </p>
        </div>
      ) : (
        <div className="flex min-h-[40vh] flex-col items-center justify-center text-center">
          <div className="mb-6 rounded-full border border-[var(--glass-border)] bg-[var(--glass-bg)] p-5 shadow-lg shadow-black/5">
            <Lightbulb className="h-12 w-12 text-[var(--text-primary)] opacity-60" />
          </div>
          <p className="text-lg text-[var(--text-secondary)]">
            {t('lights.noLights') || 'No lights found'}
          </p>
        </div>
      )}
    </div>
  );
}

export default memo(LightsPage);
