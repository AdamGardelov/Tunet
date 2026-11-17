/**
 * Stepped light controls. Brightness moves in 10 % steps, with finer steps
 * below 10 % (down to 1 %, as low as Home Assistant can ask a light to go) for
 * night lights; it never reaches 0 (turning a light off is the power button's
 * job). Warmth snaps to a few named presets. Fewer, larger steps mean one
 * command per change, which cloud-backed lights (Tuya) handle far better than
 * a stream of values.
 */

/** Allowed brightness values in percent, low to high. */
export const BRIGHTNESS_STEPS_PCT = [1, 5, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
export const MIN_BRIGHTNESS_PCT = BRIGHTNESS_STEPS_PCT[0];
export const MAX_BRIGHTNESS_PCT = BRIGHTNESS_STEPS_PCT[BRIGHTNESS_STEPS_PCT.length - 1];
/** Brightness sliders run over step positions 0…BRIGHTNESS_MAX_POSITION. */
export const BRIGHTNESS_MAX_POSITION = BRIGHTNESS_STEPS_PCT.length - 1;

/** Warm to cool. `key` maps to the `light.warmthPreset.<key>` translation. */
export const WARMTH_PRESETS = [
  { key: 'cozy', kelvin: 2200 },
  { key: 'warm', kelvin: 2700 },
  { key: 'neutral', kelvin: 3500 },
  { key: 'daylight', kelvin: 4500 },
  { key: 'cool', kelvin: 6500 },
];

const KELVIN_TOLERANCE = 100;

/** @param {number} value @param {number} min @param {number} max */
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

/** Snap any percentage to the nearest allowed brightness step. */
export function snapBrightnessPct(pct) {
  return BRIGHTNESS_STEPS_PCT[brightnessPctToPosition(pct)];
}

/** Slider position (index into BRIGHTNESS_STEPS_PCT) of the step nearest a percentage. */
export function brightnessPctToPosition(pct) {
  const value = Number(pct);
  if (!Number.isFinite(value)) return 0;
  let best = 0;
  BRIGHTNESS_STEPS_PCT.forEach((step, index) => {
    if (Math.abs(step - value) < Math.abs(BRIGHTNESS_STEPS_PCT[best] - value)) best = index;
  });
  return best;
}

/** Brightness in percent at a slider position. */
export function positionToBrightnessPct(position) {
  const index = clamp(Math.round(Number(position)) || 0, 0, BRIGHTNESS_MAX_POSITION);
  return BRIGHTNESS_STEPS_PCT[index];
}

/** How full a brightness bar is (0–100) for a percentage, matching the slider. */
export function brightnessFillPct(pct) {
  return (brightnessPctToPosition(pct) / BRIGHTNESS_MAX_POSITION) * 100;
}

/** Home Assistant brightness (0–255) as the nearest brightness step. */
export function brightnessToStepPct(brightness) {
  const value = Number(brightness);
  if (!Number.isFinite(value) || value <= 0) return MIN_BRIGHTNESS_PCT;
  return snapBrightnessPct((value / 255) * 100);
}

/**
 * The presets a light can actually show, from its colour temperature range.
 * Presets outside the range are skipped; a narrow range still gets its two ends.
 * @param {number} minKelvin
 * @param {number} maxKelvin
 */
export function getWarmthPresets(minKelvin, maxKelvin) {
  const min = Number(minKelvin) || 2000;
  const max = Number(maxKelvin) || 6500;
  const inRange = WARMTH_PRESETS.filter(
    ({ kelvin }) => kelvin >= min - KELVIN_TOLERANCE && kelvin <= max + KELVIN_TOLERANCE
  ).map((preset) => ({ ...preset, kelvin: clamp(preset.kelvin, min, max) }));
  if (inRange.length >= 2) return inRange;
  return [
    { key: 'warm', kelvin: min },
    { key: 'cool', kelvin: max },
  ];
}

/**
 * Index of the preset closest to a colour temperature.
 * @param {number} kelvin
 * @param {{ kelvin: number }[]} presets
 */
export function nearestWarmthIndex(kelvin, presets) {
  const value = Number(kelvin);
  if (!Number.isFinite(value) || presets.length === 0) return 0;
  let best = 0;
  presets.forEach((preset, index) => {
    if (Math.abs(preset.kelvin - value) < Math.abs(presets[best].kelvin - value)) best = index;
  });
  return best;
}

/** Current colour temperature of a light entity in kelvin, if it reports one. */
export function getEntityKelvin(attributes) {
  if (Number.isFinite(attributes?.color_temp_kelvin)) return attributes.color_temp_kelvin;
  if (Number.isFinite(attributes?.color_temp) && attributes.color_temp > 0) {
    return Math.round(1000000 / attributes.color_temp);
  }
  return null;
}

/** Colour temperature range of a light entity in kelvin. */
export function getEntityKelvinRange(attributes) {
  const min =
    attributes?.min_color_temp_kelvin ||
    (attributes?.max_mireds ? Math.round(1000000 / attributes.max_mireds) : 2000);
  const max =
    attributes?.max_color_temp_kelvin ||
    (attributes?.min_mireds ? Math.round(1000000 / attributes.min_mireds) : 6500);
  return { min, max };
}
