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
import { getAreas } from '../../services/haClient';

const SLIDER_DEBOUNCE_MS = 200;
const DEFAULT_COLLAPSED_LIGHT_AREAS = ['Hall'];
const WARMTH_DISABLED_LIGHT_NAMES = new Set(['Köksfönster']);
const DEFAULT_AREA_LIGHT_ALLOWLIST = {
  Kontor: new Set(['Jordglob', 'Tak', 'Skrivbord']),
  Kök: new Set(['Köksfönster']),
  Matsal: new Set(['Tak']),
  Sovrum: new Set(['Adam sänglampa', 'Emma sänglampa', 'Tak']),
  Vardagsrum: new Set(['Tak', 'Fönster']),
};

const SORT_OPTIONS = [
  { key: 'status', icon: '●' },
  { key: 'name-az', icon: 'A→Z' },
  { key: 'name-za', icon: 'Z→A' },
  { key: 'brightness', icon: '☀' },
  { key: 'area', icon: '⌂' },
  { key: 'unavailable', icon: '⚠' },
];

/**
 * Get an RGB string for the visual glow of a light entity.
 * Returns e.g. "255, 180, 80" or null if off.
 */
function getLightColor(entity) {
  if (entity.state !== 'on') return null;
  const a = entity.attributes || {};
  if (a.rgb_color) {
    const [r, g, b] = a.rgb_color;
    return `${r}, ${g}, ${b}`;
  }
  if (a.hs_color) {
    const [h, s] = a.hs_color;
    return hsToRgbString(h, s);
  }
  if (a.color_temp_kelvin) {
    const k = a.color_temp_kelvin;
    if (k <= 2700) return '255, 166, 60';
    if (k <= 3500) return '255, 195, 110';
    if (k <= 4500) return '255, 220, 170';
    return '210, 225, 255';
  }
  return '255, 183, 77'; // default warm amber
}

/** Convert HS to "r, g, b" string (HA uses hue 0-360, sat 0-100). */
function hsToRgbString(h, s) {
  const sat = s / 100;
  const c = sat;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = 1 - c;
  let r, g, b;
  if (h < 60) {
    r = c;
    g = x;
    b = 0;
  } else if (h < 120) {
    r = x;
    g = c;
    b = 0;
  } else if (h < 180) {
    r = 0;
    g = c;
    b = x;
  } else if (h < 240) {
    r = 0;
    g = x;
    b = c;
  } else if (h < 300) {
    r = x;
    g = 0;
    b = c;
  } else {
    r = c;
    g = 0;
    b = x;
  }
  return `${Math.round((r + m) * 255)}, ${Math.round((g + m) * 255)}, ${Math.round((b + m) * 255)}`;
}

// ── Individual Light Tile ────────────────────────────────────────────────

const LightTile = memo(
  /** @param {{ entity: any, areaName?: string, onToggle: (entityId: string) => void, onBrightness: (entityId: string, value: number) => void, onWarmth: (entityId: string, value: number) => void, optimisticBrightness?: number, optimisticKelvin?: number, t: (key: string) => string }} props */
  function LightTile({
    entity,
    areaName,
    onToggle,
    onBrightness,
    onWarmth,
    optimisticBrightness,
    optimisticKelvin,
    t,
  }) {
    const [showWarmth, setShowWarmth] = useState(false);
    const { entity_id, state, attributes } = entity;
    const isOn = state === 'on';
    const isUnavailable = state === 'unavailable' || state === 'unknown';
    const name = attributes?.friendly_name || entity_id.split('.')[1];
    const brightness = attributes?.brightness || 0;
    const brightnessPercent = Math.round(((optimisticBrightness ?? brightness) / 255) * 100);

    const supportedColorModes = attributes?.supported_color_modes;
    const isDimmable = supportedColorModes
      ? !supportedColorModes.includes('onoff') || supportedColorModes.length > 1
      : false;
    const supportsColorTemp =
      !WARMTH_DISABLED_LIGHT_NAMES.has(name) &&
      supportedColorModes?.some((mode) => ['color_temp', 'color_temp_kelvin'].includes(mode));
    const minKelvin =
      attributes?.min_color_temp_kelvin ||
      (attributes?.max_mireds ? Math.round(1000000 / attributes.max_mireds) : 2000);
    const maxKelvin =
      attributes?.max_color_temp_kelvin ||
      (attributes?.min_mireds ? Math.round(1000000 / attributes.min_mireds) : 6500);
    const currentKelvin =
      optimisticKelvin ??
      attributes?.color_temp_kelvin ??
      (attributes?.color_temp
        ? Math.round(1000000 / attributes.color_temp)
        : Math.round((minKelvin + maxKelvin) / 2));
    const warmthPosition = ((currentKelvin - minKelvin) / (maxKelvin - minKelvin)) * 100;

    const lightColor = getLightColor(entity);
    const iconName = attributes?.icon;
    const Icon = iconName ? getIconComponent(iconName) || Lightbulb : Lightbulb;

    const subEntities = attributes?.entity_id;
    const isGroup = Array.isArray(subEntities) && subEntities.length > 0;

    return (
      <div
        className={`group relative overflow-hidden rounded-3xl border p-5 font-sans transition-all duration-500 ${
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
                isOn ? '' : 'bg-[var(--glass-bg)] text-[var(--text-muted)]'
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
              onClick={() => !isUnavailable && onToggle(entity_id)}
              disabled={isUnavailable}
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
              <Power className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Brightness slider */}
        {isDimmable && (
          <div className="mt-4">
            <M3Slider
              variant="thinLg"
              min={0}
              max={255}
              step={1}
              value={optimisticBrightness ?? brightness}
              disabled={isUnavailable}
              onChange={(e) => onBrightness(entity_id, parseInt(e.target.value))}
              colorClass={isOn ? 'bg-amber-400' : 'bg-[var(--text-muted)]'}
              ariaLabel={t('light.brightness') || 'Brightness'}
            />
          </div>
        )}

        {supportsColorTemp && showWarmth && (
          <div className="mt-4 border-t border-[var(--glass-border)] pt-4">
            <div className="mb-2 flex items-center justify-between text-[11px] font-semibold tracking-wider text-[var(--text-muted)] uppercase">
              <span>{t('light.warmth') || 'Värme'}</span>
              <span className="font-mono tracking-normal text-[var(--text-secondary)] normal-case">
                {currentKelvin} K
              </span>
            </div>
            <div className="relative h-10 overflow-hidden rounded-2xl border border-white/10 shadow-inner">
              <div
                className="absolute inset-0"
                style={{
                  background:
                    'linear-gradient(90deg, #ff9f43 0%, #ffe5b4 35%, #fffdf5 58%, #a9c7ff 100%)',
                }}
              />
              <div
                className="pointer-events-none absolute top-1/2 z-10 h-7 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white shadow-[0_1px_8px_rgba(0,0,0,0.55)]"
                style={{ left: `${Math.min(100, Math.max(0, warmthPosition))}%` }}
              />
              <input
                type="range"
                min={minKelvin}
                max={maxKelvin}
                step={50}
                value={currentKelvin}
                disabled={isUnavailable}
                onChange={(event) => onWarmth(entity_id, parseInt(event.target.value, 10))}
                className="absolute inset-0 z-20 h-full w-full cursor-pointer opacity-0"
                aria-label={`${t('light.warmth') || 'Värme'} ${name}`}
                aria-valuetext={`${currentKelvin} K`}
              />
            </div>
          </div>
        )}
      </div>
    );
  }
);

// ── Confirm Button ───────────────────────────────────────────────────────

const ConfirmButton = memo(
  /** @param {{ label: string, confirmLabel: string, onConfirm: () => void, t: (key: string) => string }} props */
  function ConfirmButton({ label, confirmLabel, onConfirm, t }) {
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
          onClick={() => setPending(true)}
          className={`rounded-2xl border border-[var(--glass-border)] bg-[var(--glass-bg)] px-4 py-2.5 text-[11px] font-bold tracking-widest text-[var(--text-secondary)] uppercase transition-all hover:bg-[var(--glass-bg-hover)] hover:text-[var(--text-primary)] active:scale-95 ${
            pending ? 'opacity-60' : ''
          }`}
        >
          {label}
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
                className="flex-1 rounded-xl border border-[var(--glass-border)] bg-[var(--glass-bg)] px-3 py-2 text-[11px] font-bold tracking-wider text-[var(--text-secondary)] uppercase transition-all hover:bg-[var(--glass-bg-hover)] active:scale-95"
              >
                {t('common.cancel') || 'Cancel'}
              </button>
              <button
                onClick={() => {
                  setPending(false);
                  onConfirm();
                }}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-[var(--accent-color)] px-3 py-2 text-[11px] font-bold tracking-wider text-white uppercase transition-all hover:opacity-90 active:scale-95"
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
          <span className="text-xs font-bold tracking-widest text-[var(--text-secondary)] uppercase italic">
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
                  className={`w-full px-5 py-3 text-left text-xs font-bold tracking-widest uppercase transition-all ${
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

  // Count unavailable before filtering
  const unavailableCount = useMemo(() => {
    const base = showGroups ? allLights : individuals;
    return base.filter((e) => e.state === 'unavailable' || e.state === 'unknown').length;
  }, [allLights, individuals, showGroups]);

  // Filter by search + unavailable toggle
  const filteredLights = useMemo(() => {
    let base = showGroups ? allLights : individuals;
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
  }, [allLights, individuals, showGroups, hideUnavailable, searchTerm, getAreaName]);

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
        if (!allowedNames.has(name) || isGroup) hidden.add(entity.entity_id);
      });
    });

    collapsedAreas.forEach((areaName) => {
      const areaLights = sortedLights.filter((entity) => getAreaName(entity) === areaName);
      const areaGroup = findAreaGroup(areaLights, areaName);
      if (!areaGroup) return;
      areaLights.forEach((entity) => {
        if (entity.entity_id !== areaGroup.entity_id) hidden.add(entity.entity_id);
      });
    });
    return hidden;
  }, [collapsedAreas, sortedLights, getAreaName, findAreaGroup, searchTerm, sortMode]);

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

  // Debounce state for brightness
  const [optimistic, setOptimistic] = useState({});
  const [optimisticKelvin, setOptimisticKelvin] = useState({});
  const debounceRefs = useRef({});

  const handleToggle = useCallback(
    (entityId) => {
      callService('light', 'toggle', { entity_id: entityId });
    },
    [callService]
  );

  const handleBrightness = useCallback(
    (entityId, val) => {
      setOptimistic((prev) => ({ ...prev, [entityId]: val }));
      clearTimeout(debounceRefs.current[entityId]);
      debounceRefs.current[entityId] = setTimeout(() => {
        callService('light', 'turn_on', { entity_id: entityId, brightness: val });
      }, SLIDER_DEBOUNCE_MS);
    },
    [callService]
  );

  const handleWarmth = useCallback(
    (entityId, val) => {
      setOptimisticKelvin((prev) => ({ ...prev, [entityId]: val }));
      const debounceKey = `${entityId}:warmth`;
      clearTimeout(debounceRefs.current[debounceKey]);
      debounceRefs.current[debounceKey] = setTimeout(() => {
        callService('light', 'turn_on', {
          entity_id: entityId,
          color_temp_kelvin: val,
        });
      }, SLIDER_DEBOUNCE_MS);
    },
    [callService]
  );

  const handleAllOff = useCallback(() => {
    displayedLights
      .filter((e) => e.state === 'on')
      .forEach((e) => callService('light', 'turn_off', { entity_id: e.entity_id }));
  }, [displayedLights, callService]);

  const handleAllOn = useCallback(() => {
    displayedLights
      .filter((e) => e.state !== 'on' && e.state !== 'unavailable' && e.state !== 'unknown')
      .forEach((e) => callService('light', 'turn_on', { entity_id: e.entity_id }));
  }, [displayedLights, callService]);

  const renderTile = (entity) => (
    <LightTile
      key={entity.entity_id}
      entity={entity}
      areaName={getAreaName(entity)}
      onToggle={handleToggle}
      onBrightness={handleBrightness}
      onWarmth={handleWarmth}
      optimisticBrightness={optimistic[entity.entity_id]}
      optimisticKelvin={optimisticKelvin[entity.entity_id]}
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
          <h2 className="text-2xl font-light tracking-widest text-[var(--text-primary)] uppercase">
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
              t={t}
            />
            <ConfirmButton
              label={t('lights.allOff') || 'All off'}
              confirmLabel={t('lights.confirmAllOff') || 'Turn off all lights?'}
              onConfirm={handleAllOff}
              t={t}
            />
          </div>
        )}
      </div>

      {/* ── Toolbar: search + sort + filters ────────────────────────── */}
      {allLights.length > 0 && (
        <div className="mb-5 flex flex-wrap items-center gap-3">
          {/* Search */}
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder={t('lights.search') || 'Search lights...'}
              className="popup-surface w-full rounded-2xl py-2.5 pr-9 pl-10 text-sm text-[var(--text-primary)] transition-colors outline-none placeholder:text-[var(--text-muted)]"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute top-1/2 right-3 flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded-full bg-[var(--glass-bg)] text-[var(--text-muted)] transition-colors hover:bg-[var(--glass-bg-hover)] hover:text-[var(--text-primary)]"
                aria-label={t('common.close') || 'Clear'}
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>

          {/* Sort dropdown */}
          <SortDropdown sortMode={sortMode} onSortChange={handleSortChange} t={t} />

          {/* Show/hide groups toggle */}
          {groups.length > 0 && (
            <button
              onClick={handleToggleGroups}
              className={`rounded-2xl border px-3 py-2.5 text-[11px] font-bold tracking-widest uppercase transition-all active:scale-95 ${
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
              className={`flex items-center gap-1.5 rounded-2xl border px-3 py-2.5 text-[11px] font-bold tracking-widest uppercase transition-all active:scale-95 ${
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
              const canCollapse = Boolean(findAreaGroup(fullAreaLights, areaName));
              const isCollapsed = collapsedAreas.has(areaName);

              return (
                <div key={areaName}>
                  <div className="mb-3 flex items-center gap-3">
                    <h3 className="text-xs font-bold tracking-widest text-[var(--text-muted)] uppercase">
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
