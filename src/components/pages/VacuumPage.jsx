import { useEffect, useMemo, useState } from 'react';
import {
  Battery,
  Bed,
  Bot,
  Check,
  DoorOpen,
  Home,
  Laptop,
  MapPin,
  Pause,
  Play,
  RefreshCw,
  Sofa,
  Utensils,
} from '../../icons';

const roomIcon = (name = '') => {
  const value = name.toLowerCase();
  if (/kök|kitchen|matsal|dining/.test(value)) return Utensils;
  if (/sov|bed/.test(value)) return Bed;
  if (/vardags|living/.test(value)) return Sofa;
  if (/kontor|office/.test(value)) return Laptop;
  if (/hall|entr|korridor/.test(value)) return DoorOpen;
  return MapPin;
};

const stateLabel = (state) => {
  const value = String(state || '').toLowerCase();
  if (value === 'cleaning' || value === 'vacuuming') return 'Dammsuger';
  if (value === 'returning' || value === 'going_home') return 'På väg hem';
  if (value === 'docked') return 'Dockad';
  if (value === 'charging') return 'Laddar';
  if (value === 'paused') return 'Pausad';
  if (value === 'error') return 'Fel';
  return value ? value.charAt(0).toUpperCase() + value.slice(1) : 'Okänd';
};

export default function VacuumPage({ vacuumId, entities, conn, callService, getEntityImageUrl }) {
  const [areas, setAreas] = useState([]);
  const [selectedAreas, setSelectedAreas] = useState([]);
  const [refreshKey, setRefreshKey] = useState(Date.now());
  const [actionState, setActionState] = useState('idle');
  const vacuum = entities?.[vacuumId];
  const vacuumName = vacuumId?.split('.')[1]?.toLowerCase() || '';
  const friendlyName = vacuum?.attributes?.friendly_name || 'Dammsugare';
  const tokens = useMemo(
    () =>
      `${vacuumName} ${friendlyName}`
        .toLowerCase()
        .split(/[_\s-]+/)
        .filter((token) => token.length > 2 && !['vacuum', 'robot', 'dammsugare'].includes(token)),
    [friendlyName, vacuumName]
  );

  useEffect(() => {
    const timer = window.setInterval(() => setRefreshKey(Date.now()), 8000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const loadAreas = async () => {
      if (!conn || !vacuumId) return;
      try {
        const [entityRegistry, areaRegistry] = await Promise.all([
          conn.sendMessagePromise({ type: 'config/entity_registry/list' }),
          conn.sendMessagePromise({ type: 'config/area_registry/list' }),
        ]);
        if (cancelled) return;
        const entityList = Array.isArray(entityRegistry)
          ? entityRegistry
          : entityRegistry?.result || [];
        const areaList = Array.isArray(areaRegistry) ? areaRegistry : areaRegistry?.result || [];
        const entry = entityList.find((item) => item?.entity_id === vacuumId);
        const mapping = entry?.options?.vacuum?.area_mapping || {};
        const mappedIds = Object.keys(mapping);
        setAreas(areaList.filter((area) => mappedIds.includes(area.area_id)));
      } catch (error) {
        console.error('Unable to load vacuum areas', error);
        if (!cancelled) setAreas([]);
      }
    };
    void loadAreas();
    return () => {
      cancelled = true;
    };
  }, [conn, vacuumId]);

  const mapEntityId = useMemo(() => {
    const candidates = Object.keys(entities || {}).filter((entityId) => {
      const domain = entityId.split('.')[0];
      return domain === 'image' || domain === 'camera';
    });
    const related = candidates.find((entityId) => {
      const entity = entities[entityId];
      const haystack = `${entityId} ${entity?.attributes?.friendly_name || ''}`.toLowerCase();
      return haystack.includes(vacuumName) || tokens.some((token) => haystack.includes(token));
    });
    return (
      related ||
      candidates.find((entityId) => {
        const entity = entities[entityId];
        return /map|karta|kart/.test(
          `${entityId} ${entity?.attributes?.friendly_name || ''}`.toLowerCase()
        );
      }) ||
      null
    );
  }, [entities, tokens, vacuumName]);

  const mapUrl = useMemo(() => {
    const picture = entities?.[mapEntityId]?.attributes?.entity_picture;
    if (!picture || !getEntityImageUrl) return null;
    const url = getEntityImageUrl(picture);
    return `${url}${url.includes('?') ? '&' : '?'}t=${refreshKey}`;
  }, [entities, getEntityImageUrl, mapEntityId, refreshKey]);

  const run = async (action) => {
    setActionState('pending');
    try {
      await action();
      setActionState('success');
    } catch (error) {
      console.error('Vacuum action failed', error);
      setActionState('error');
    }
    window.setTimeout(() => setActionState('idle'), 1800);
  };

  const cleanSelected = () => {
    if (!selectedAreas.length) return;
    return run(async () => {
      if (conn) {
        await conn.sendMessagePromise({
          type: 'call_service',
          domain: 'vacuum',
          service: 'clean_area',
          target: { entity_id: vacuumId },
          service_data: { cleaning_area_id: selectedAreas },
        });
      } else {
        await callService('vacuum', 'clean_area', {
          entity_id: vacuumId,
          cleaning_area_id: selectedAreas,
        });
      }
      setSelectedAreas([]);
    });
  };

  if (!vacuum) return null;
  const isCleaning = ['cleaning', 'vacuuming'].includes(vacuum.state);
  const battery = vacuum.attributes?.battery_level;

  return (
    <div className="page-transition grid gap-4 font-sans lg:grid-cols-[minmax(0,1.35fr)_minmax(340px,0.65fr)]">
      <section className="overflow-hidden rounded-3xl border border-[var(--glass-border)] bg-[var(--card-bg)]">
        <div className="flex items-center justify-between gap-3 border-b border-[var(--glass-border)] px-5 py-4">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[var(--glass-bg-hover)] text-[var(--accent-color)]">
              <Bot className="h-6 w-6" />
            </span>
            <div className="min-w-0">
              <h2 className="truncate text-lg font-bold text-[var(--text-primary)]">
                {friendlyName}
              </h2>
              <p className="text-xs font-bold tracking-wide text-[var(--text-secondary)] uppercase">
                {stateLabel(vacuum.state)}
              </p>
            </div>
          </div>
          {battery !== undefined && (
            <span className="flex items-center gap-1.5 rounded-full bg-[var(--glass-bg)] px-3 py-2 text-xs font-bold text-[var(--text-secondary)]">
              <Battery className="h-4 w-4" /> {battery}%
            </span>
          )}
        </div>

        <div className="relative flex min-h-[310px] items-center justify-center bg-black/15 sm:min-h-[430px]">
          {mapUrl ? (
            <img
              src={mapUrl}
              alt="Dammsugarens livekarta"
              className="h-full max-h-[62vh] w-full object-contain"
            />
          ) : (
            <div className="flex flex-col items-center gap-3 px-6 text-center text-[var(--text-muted)]">
              <MapPin className="h-10 w-10" />
              <p className="text-sm font-semibold">Ingen karta hittades för dammsugaren</p>
            </div>
          )}
          <button
            type="button"
            onClick={() => setRefreshKey(Date.now())}
            className="absolute right-3 bottom-3 flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--glass-border)] bg-[var(--card-bg)] text-[var(--text-secondary)] active:scale-95"
            aria-label="Uppdatera kartan"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>
      </section>

      <section className="flex flex-col gap-4 rounded-3xl border border-[var(--glass-border)] bg-[var(--card-bg)] p-4 sm:p-5">
        <div>
          <h3 className="text-base font-bold text-[var(--text-primary)]">Välj rum</h3>
          <p className="mt-1 text-xs text-[var(--text-secondary)]">
            Markera ett eller flera rum som ska dammsugas.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-2">
          {areas.map((area) => {
            const selected = selectedAreas.includes(area.area_id);
            const Icon = roomIcon(area.name);
            return (
              <button
                key={area.area_id}
                type="button"
                onClick={() =>
                  setSelectedAreas((current) =>
                    selected
                      ? current.filter((id) => id !== area.area_id)
                      : [...current, area.area_id]
                  )
                }
                className={`relative flex min-h-24 flex-col items-center justify-center gap-2 rounded-2xl border p-3 transition-all active:scale-[0.98] ${
                  selected
                    ? 'border-[var(--accent-color)] bg-[var(--accent-color)] text-white'
                    : 'border-[var(--glass-border)] bg-[var(--glass-bg)] text-[var(--text-primary)]'
                }`}
              >
                {selected && <Check className="absolute top-2 right-2 h-4 w-4" />}
                <Icon className="h-6 w-6" />
                <span className="max-w-full truncate text-xs font-bold">{area.name}</span>
              </button>
            );
          })}
        </div>

        {areas.length === 0 && (
          <p className="rounded-2xl bg-[var(--glass-bg)] p-4 text-sm text-[var(--text-secondary)]">
            Inga mappade rum hittades.
          </p>
        )}

        <button
          type="button"
          disabled={!selectedAreas.length || actionState === 'pending'}
          onClick={cleanSelected}
          className="mt-auto flex min-h-14 items-center justify-center gap-2 rounded-2xl bg-[var(--accent-color)] px-4 text-sm font-bold text-white transition-all active:scale-[0.98] disabled:opacity-35"
        >
          {actionState === 'success' ? (
            <Check className="h-5 w-5" />
          ) : (
            <Play className="h-5 w-5 fill-current" />
          )}
          {actionState === 'success'
            ? 'Startat'
            : selectedAreas.length
              ? `Dammsug ${selectedAreas.length} rum`
              : 'Välj rum'}
        </button>

        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() =>
              run(() =>
                callService('vacuum', isCleaning ? 'pause' : 'start', { entity_id: vacuumId })
              )
            }
            className="flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-[var(--glass-border)] bg-[var(--glass-bg)] text-sm font-bold text-[var(--text-primary)] active:scale-[0.98]"
          >
            {isCleaning ? (
              <Pause className="h-4 w-4 fill-current" />
            ) : (
              <Play className="h-4 w-4 fill-current" />
            )}
            {isCleaning ? 'Pausa' : 'Starta allt'}
          </button>
          <button
            type="button"
            onClick={() =>
              run(() => callService('vacuum', 'return_to_base', { entity_id: vacuumId }))
            }
            className="flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-[var(--glass-border)] bg-[var(--glass-bg)] text-sm font-bold text-[var(--text-primary)] active:scale-[0.98]"
          >
            <Home className="h-4 w-4" /> Hem
          </button>
        </div>
      </section>
    </div>
  );
}
