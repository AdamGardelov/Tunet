import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import RoomCard from '../components/cards/RoomCard';
import { resolveRoomControls } from '../components/cards/RoomControlsCard';

vi.mock('../contexts', () => ({
  useConfig: () => ({ unitsMode: 'follow_ha' }),
  useHomeAssistantMeta: () => ({ haConfig: { unit_system: { temperature: '°C' } } }),
}));

const entities = {
  'sensor.vardagsrum_temperatur': {
    state: '13.1',
    attributes: { device_class: 'temperature', unit_of_measurement: '°C' },
  },
  'climate.vardagsrum': {
    state: 'heat',
    attributes: { current_temperature: 18.9, temperature: 20, hvac_action: 'heating' },
  },
  'light.vardagsrum_fonster': { state: 'off', attributes: { friendly_name: 'Vardagsrum fönster' } },
  'light.sofflampa': { state: 'on', attributes: { friendly_name: 'Sofflampa' } },
  'light.dorrlampa': { state: 'unavailable', attributes: { friendly_name: 'Dörrlampa' } },
  'binary_sensor.brandvarnare': { state: 'off', attributes: { device_class: 'smoke' } },
};

const settings = {
  layout: 'controls',
  areaName: 'Vardagsrum',
  entityIds: Object.keys(entities),
};

const renderCard = (overrides = {}) =>
  render(
    <RoomCard
      cardId="room_card_1"
      settings={settings}
      entities={entities}
      conn={{}}
      callService={vi.fn()}
      dragProps={{}}
      controls={null}
      cardStyle={{}}
      editMode={false}
      customNames={{}}
      customIcons={{}}
      isMobile
      onOpen={vi.fn()}
      t={(key) => key}
      {...overrides}
    />
  );

describe('resolveRoomControls', () => {
  it('splits a room into temperature sensor, thermostat, smoke and devices', () => {
    const result = resolveRoomControls(Object.keys(entities), entities);
    expect(result.tempId).toBe('sensor.vardagsrum_temperatur');
    expect(result.climateId).toBe('climate.vardagsrum');
    expect(result.smokeIds).toEqual(['binary_sensor.brandvarnare']);
    expect(result.deviceIds).toEqual([
      'light.vardagsrum_fonster',
      'light.sofflampa',
      'light.dorrlampa',
    ]);
  });
});

describe('RoomCard controls layout', () => {
  it('shows room temperature, thermostat and device buttons', () => {
    renderCard();
    expect(screen.getByRole('heading', { name: 'Vardagsrum' })).toBeInTheDocument();
    expect(screen.getByTestId('room-thermostat')).toBeInTheDocument();
    expect(screen.getByTestId('room-smoke-status')).toHaveTextContent('room.smoke.ok');
    // Room name prefix is dropped from device names.
    expect(screen.getByText('Fönster')).toBeInTheDocument();
    expect(screen.getByTestId('room-device-light.dorrlampa')).toBeDisabled();
  });

  it('toggles a device and steps the thermostat target', () => {
    const callService = vi.fn().mockResolvedValue(undefined);
    renderCard({ callService });

    fireEvent.click(screen.getByTestId('room-device-light.sofflampa'));
    expect(callService).toHaveBeenCalledWith('light', 'toggle', { entity_id: 'light.sofflampa' });

    fireEvent.click(screen.getByRole('button', { name: 'climate.increaseTemperature' }));
    expect(callService).toHaveBeenCalledWith('climate', 'set_temperature', {
      entity_id: 'climate.vardagsrum',
      temperature: 20.5,
    });
  });
});

describe('RoomCard controls layout light adjustment', () => {
  it('offers brightness and warmth for adjustable lights only', () => {
    const onOpenLight = vi.fn();
    const adjustableEntities = {
      ...entities,
      'light.sofflampa': {
        state: 'off',
        attributes: { friendly_name: 'Sofflampa', supported_color_modes: ['color_temp'] },
      },
    };
    renderCard({ entities: adjustableEntities, onOpenLight });

    fireEvent.click(screen.getByTestId('room-device-adjust-light.sofflampa'));
    expect(onOpenLight).toHaveBeenCalledWith('light.sofflampa');
    expect(screen.queryByTestId('room-device-adjust-light.vardagsrum_fonster')).toBeNull();
    expect(screen.queryByTestId('room-device-adjust-light.dorrlampa')).toBeNull();
  });
});
