import { useRef, useState } from 'react';

const WARMTH_GRADIENT =
  'linear-gradient(90deg, #ff9f43 0%, #ffe5b4 35%, #fffdf5 58%, #a9c7ff 100%)';

/**
 * Warmth as a few named steps. Dragging only moves the marker; the chosen
 * step is sent once, when the user lets go (or presses a key).
 *
 * @param {{
 *   presets: { key: string, kelvin: number }[],
 *   valueIndex: number,
 *   onCommit: (index: number) => void,
 *   disabled?: boolean,
 *   label: string,
 *   ariaLabel: string,
 *   t: (key: string) => string,
 *   height?: 'md' | 'lg',
 * }} props
 */
export default function WarmthStepSlider({
  presets,
  valueIndex,
  onCommit,
  disabled = false,
  label,
  ariaLabel,
  t,
  height = 'md',
}) {
  const [dragIndex, setDragIndex] = useState(/** @type {number | null} */ (null));
  const dirtyRef = useRef(false);
  const pendingIndexRef = useRef(valueIndex);
  const lastIndex = Math.max(presets.length - 1, 1);
  const shownIndex = Math.min(Math.max(dragIndex ?? valueIndex, 0), presets.length - 1);
  const shown = presets[shownIndex];
  const position = (shownIndex / lastIndex) * 100;

  const commit = () => {
    if (!dirtyRef.current) return;
    dirtyRef.current = false;
    setDragIndex(null);
    onCommit(pendingIndexRef.current);
  };

  return (
    <div>
      <div className="mb-2 flex items-center justify-between text-xs font-medium text-[var(--text-secondary)]">
        <span>{label}</span>
        <span className="text-[var(--text-primary)]">
          {shown ? `${t(`light.warmthPreset.${shown.key}`)} · ${shown.kelvin} K` : ''}
        </span>
      </div>
      <div
        className={`relative overflow-hidden rounded-2xl border border-white/10 shadow-inner ${
          height === 'lg' ? 'h-12 md:h-16' : 'h-10'
        } ${disabled ? 'opacity-50' : ''}`}
      >
        <div className="absolute inset-0" style={{ background: WARMTH_GRADIENT }} />
        <div className="pointer-events-none absolute inset-0 flex items-center justify-between px-3">
          {presets.map((preset) => (
            <span key={preset.key} className="h-1.5 w-1.5 rounded-full bg-black/25" />
          ))}
        </div>
        <div
          className="pointer-events-none absolute top-1/2 z-10 h-7 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white shadow-[0_1px_8px_rgba(0,0,0,0.55)] transition-[left] duration-150"
          style={{ left: `calc(12px + (100% - 24px) * ${position / 100})` }}
        />
        <input
          type="range"
          min={0}
          max={presets.length - 1}
          step={1}
          value={shownIndex}
          disabled={disabled}
          onChange={(event) => {
            const index = parseInt(event.target.value, 10);
            dirtyRef.current = true;
            pendingIndexRef.current = index;
            setDragIndex(index);
          }}
          onPointerUp={commit}
          onMouseUp={commit}
          onTouchEnd={commit}
          onKeyUp={commit}
          onClick={(event) => event.stopPropagation()}
          className="absolute inset-0 z-20 h-full w-full cursor-pointer opacity-0"
          style={{ touchAction: 'pan-y' }}
          aria-label={ariaLabel}
          aria-valuetext={shown ? `${t(`light.warmthPreset.${shown.key}`)}, ${shown.kelvin} K` : ''}
        />
      </div>
    </div>
  );
}
