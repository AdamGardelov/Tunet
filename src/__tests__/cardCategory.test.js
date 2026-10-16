import { describe, expect, it } from 'vitest';
import { applyCategoryTint, getCardCategory } from '../utils/cardCategory';

describe('getCardCategory', () => {
  it('maps card prefixes to categories', () => {
    expect(getCardCategory('climate_card_1')).toBe('climate');
    expect(getCardCategory('media_player.tv')).toBe('media');
    expect(getCardCategory('car')).toBe('car');
    expect(getCardCategory('spacer_card_1')).toBeNull();
  });

  it('treats quick controls made only of lights as light cards', () => {
    expect(getCardCategory('quick_controls_1', { entityIds: ['light.a', 'light.b'] })).toBe(
      'light'
    );
    expect(getCardCategory('quick_controls_1', { entityIds: ['light.a', 'climate.b'] })).toBeNull();
    expect(getCardCategory('quick_controls_1')).toBeNull();
  });
});

describe('applyCategoryTint', () => {
  it('tints outside edit mode and keeps edit styling otherwise', () => {
    const tinted = applyCategoryTint({ backgroundColor: 'x' }, 'light');
    expect(tinted['--card-accent']).toBe('var(--cat-light)');
    expect(tinted.backgroundColor).toContain('color-mix');
    expect(
      applyCategoryTint({ backgroundColor: 'x' }, 'light', { editMode: true }).backgroundColor
    ).toBe('x');
  });
});

describe('sensor card categories', () => {
  const entities = {
    'sensor.kok_temperatur': { attributes: { device_class: 'temperature' } },
    'binary_sensor.brandvarnare_rok': { attributes: { device_class: 'smoke' } },
    'switch.element_toa_uttag_1': { attributes: { friendly_name: 'Element toa uttag 1' } },
    'switch.kaffebryggare': { attributes: { friendly_name: 'Kaffebryggare' } },
  };
  const cat = (entityId) => getCardCategory('entity_card_1', { entityId }, entities);

  it('colours sensor cards by what they measure', () => {
    expect(cat('sensor.kok_temperatur')).toBe('climate');
    expect(cat('binary_sensor.brandvarnare_rok')).toBe('security');
  });

  it('treats heater-named switches as climate and leaves others neutral', () => {
    expect(cat('switch.element_toa_uttag_1')).toBe('climate');
    expect(cat('switch.kaffebryggare')).toBeNull();
  });
});
