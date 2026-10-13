/**
 * Return the RGB triplet used for a light's soft active tint.
 * The format is suitable for rgb()/rgba(), for example "255, 183, 77".
 */
export function getLightColor(entity) {
  if (entity?.state !== 'on') return null;
  const attributes = entity.attributes || {};

  if (attributes.rgb_color) {
    const [red, green, blue] = attributes.rgb_color;
    return `${red}, ${green}, ${blue}`;
  }
  if (attributes.hs_color) {
    const [hue, saturation] = attributes.hs_color;
    return hsToRgbString(hue, saturation);
  }
  if (attributes.color_temp_kelvin) {
    const kelvin = attributes.color_temp_kelvin;
    if (kelvin <= 2700) return '255, 166, 60';
    if (kelvin <= 3500) return '255, 195, 110';
    if (kelvin <= 4500) return '255, 220, 170';
    return '210, 225, 255';
  }
  return '255, 183, 77';
}

function hsToRgbString(hue, saturation) {
  const normalizedSaturation = saturation / 100;
  const chroma = normalizedSaturation;
  const secondary = chroma * (1 - Math.abs(((hue / 60) % 2) - 1));
  const match = 1 - chroma;
  let red;
  let green;
  let blue;

  if (hue < 60) {
    red = chroma;
    green = secondary;
    blue = 0;
  } else if (hue < 120) {
    red = secondary;
    green = chroma;
    blue = 0;
  } else if (hue < 180) {
    red = 0;
    green = chroma;
    blue = secondary;
  } else if (hue < 240) {
    red = 0;
    green = secondary;
    blue = chroma;
  } else if (hue < 300) {
    red = secondary;
    green = 0;
    blue = chroma;
  } else {
    red = chroma;
    green = 0;
    blue = secondary;
  }

  return `${Math.round((red + match) * 255)}, ${Math.round((green + match) * 255)}, ${Math.round((blue + match) * 255)}`;
}
