import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import LightsPage from '../components/pages/LightsPage';
import { getAreas } from '../services/haClient';

vi.mock('../services/haClient', () => ({
  getAreas: vi.fn(),
}));

const hallLight = (entityId, name, extraAttributes = {}) => ({
  entity_id: entityId,
  state: 'on',
  attributes: {
    friendly_name: name,
    area_id: 'hall',
    brightness: 255,
    supported_color_modes: ['brightness'],
    ...extraAttributes,
  },
});

const bedroomLight = (entityId, name, extraAttributes = {}) => ({
  entity_id: entityId,
  state: 'off',
  attributes: {
    friendly_name: name,
    area_id: 'bedroom',
    supported_color_modes: ['brightness'],
    ...extraAttributes,
  },
});

describe('LightsPage', () => {
  it('shows only the Hall group by default and can reveal its members', async () => {
    getAreas.mockResolvedValue([{ area_id: 'hall', name: 'Hall' }]);
    const savePageSetting = vi.fn();

    render(
      <LightsPage
        entities={{
          'light.hall': hallLight('light.hall', 'Hall', {
            entity_id: ['light.tak1', 'light.tak2', 'light.tak3', 'light.tak4'],
          }),
          'light.tak1': hallLight('light.tak1', 'Tak1'),
          'light.tak2': hallLight('light.tak2', 'Tak2'),
          'light.tak3': hallLight('light.tak3', 'Tak3'),
          'light.tak4': hallLight('light.tak4', 'Tak4'),
        }}
        callService={vi.fn()}
        conn={{}}
        pageSettings={{ lights: { lightsSort: 'area' } }}
        pageId="lights"
        savePageSetting={savePageSetting}
        t={(key) =>
          ({
            'common.show': 'Visa',
            'common.hide': 'Dölj',
            'common.on': 'På',
            'lights.total': 'totalt',
          })[key] || key
        }
      />
    );

    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Visa Hall' })).toBeInTheDocument()
    );
    expect(screen.queryByText('Tak1')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Visa Hall' }));

    expect(await screen.findByText('Tak1')).toBeInTheDocument();
    expect(savePageSetting).toHaveBeenCalledWith('lights', 'lightsCollapsedAreas', []);
  });

  it('shows only the selected bedroom lights', async () => {
    getAreas.mockResolvedValue([{ area_id: 'bedroom', name: 'Sovrum' }]);

    render(
      <LightsPage
        entities={{
          'light.adam_bed': bedroomLight('light.adam_bed', 'Adam sänglampa'),
          'light.emma_bed': bedroomLight('light.emma_bed', 'Emma sänglampa'),
          'light.ceiling': bedroomLight('light.ceiling', 'Tak'),
          'light.bedroom': bedroomLight('light.bedroom', 'Sovrum', {
            entity_id: ['light.adam_bed', 'light.emma_bed', 'light.ceiling'],
          }),
          'light.camera_floodlight': bedroomLight(
            'light.camera_floodlight',
            'Walles kamera Floodlight (Timed)'
          ),
        }}
        callService={vi.fn()}
        conn={{}}
        pageSettings={{ lights: { lightsSort: 'area' } }}
        pageId="lights"
        savePageSetting={vi.fn()}
        t={(key) =>
          ({
            'common.on': 'På',
            'lights.total': 'totalt',
          })[key] || key
        }
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Adam sänglampa')).toBeInTheDocument();
      expect(screen.getByText('Emma sänglampa')).toBeInTheDocument();
      expect(screen.getByText('Tak')).toBeInTheDocument();
      expect(screen.queryByText('Walles kamera Floodlight (Timed)')).not.toBeInTheDocument();
      expect(screen.queryByText('Sovrum', { selector: 'p' })).not.toBeInTheDocument();
    });
  });

  it('shows the dining room ceiling light without its zone', async () => {
    getAreas.mockResolvedValue([{ area_id: 'dining_room', name: 'Matsal' }]);

    render(
      <LightsPage
        entities={{
          'light.dining_room': {
            entity_id: 'light.dining_room',
            state: 'on',
            attributes: {
              friendly_name: 'Matsal',
              area_id: 'dining_room',
              entity_id: ['light.dining_ceiling'],
            },
          },
          'light.dining_ceiling': {
            entity_id: 'light.dining_ceiling',
            state: 'on',
            attributes: {
              friendly_name: 'Tak',
              area_id: 'dining_room',
              brightness: 255,
              supported_color_modes: ['brightness'],
            },
          },
        }}
        callService={vi.fn()}
        conn={{}}
        pageSettings={{ lights: { lightsSort: 'area' } }}
        pageId="lights"
        savePageSetting={vi.fn()}
        t={(key) => key}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Tak')).toBeInTheDocument();
      expect(screen.queryByText('Matsal', { selector: 'p' })).not.toBeInTheDocument();
    });
  });

  it('shows only the living room ceiling and window lights', async () => {
    getAreas.mockResolvedValue([{ area_id: 'living_room', name: 'Vardagsrum' }]);

    const livingRoomLight = (entityId, name, state = 'off') => ({
      entity_id: entityId,
      state,
      attributes: {
        friendly_name: name,
        area_id: 'living_room',
        supported_color_modes: ['brightness'],
      },
    });

    render(
      <LightsPage
        entities={{
          'light.living_ceiling': livingRoomLight('light.living_ceiling', 'Tak'),
          'light.living_window': livingRoomLight('light.living_window', 'Fönster'),
          'light.desk': livingRoomLight('light.desk', 'Skrivbord'),
          'light.mushroom_1': livingRoomLight('light.mushroom_1', 'Svampen1', 'unavailable'),
          'light.mushroom_2': livingRoomLight('light.mushroom_2', 'Svampen2', 'unavailable'),
          'light.living_room': {
            ...livingRoomLight('light.living_room', 'Vardagsrum'),
            attributes: {
              friendly_name: 'Vardagsrum',
              area_id: 'living_room',
              entity_id: ['light.living_ceiling', 'light.living_window'],
            },
          },
        }}
        callService={vi.fn()}
        conn={{}}
        pageSettings={{ lights: { lightsSort: 'area' } }}
        pageId="lights"
        savePageSetting={vi.fn()}
        t={(key) => key}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Tak')).toBeInTheDocument();
      expect(screen.getByText('Fönster')).toBeInTheDocument();
      expect(screen.queryByText('Skrivbord')).not.toBeInTheDocument();
      expect(screen.queryByText('Svampen1')).not.toBeInTheDocument();
      expect(screen.queryByText('Svampen2')).not.toBeInTheDocument();
      expect(screen.queryByText('Vardagsrum', { selector: 'p' })).not.toBeInTheDocument();
    });
  });

  it('shows the kitchen window lamp without its zones', async () => {
    getAreas.mockResolvedValue([{ area_id: 'kitchen', name: 'Kök' }]);

    const kitchenLight = (entityId, name, members) => ({
      entity_id: entityId,
      state: 'off',
      attributes: {
        friendly_name: name,
        area_id: 'kitchen',
        supported_color_modes: ['brightness'],
        ...(members ? { entity_id: members } : {}),
      },
    });

    render(
      <LightsPage
        entities={{
          'light.kitchen': kitchenLight('light.kitchen', 'Kök', ['light.kitchen_window']),
          'light.kitchen_window_zone': kitchenLight('light.kitchen_window_zone', 'Kök: Fönster', [
            'light.kitchen_window',
          ]),
          'light.kitchen_window': kitchenLight('light.kitchen_window', 'Köksfönster'),
        }}
        callService={vi.fn()}
        conn={{}}
        pageSettings={{
          lights: { lightsSort: 'area', lightsCollapsedAreas: ['Kök'] },
        }}
        pageId="lights"
        savePageSetting={vi.fn()}
        t={(key) => key}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Köksfönster')).toBeInTheDocument();
      expect(screen.queryByText('Kök', { selector: 'p' })).not.toBeInTheDocument();
      expect(screen.queryByText('Kök: Fönster')).not.toBeInTheDocument();
      expect(
        screen.queryByRole('button', { name: /^(Visa|Dölj|common\.show|common\.hide) Kök$/ })
      ).not.toBeInTheDocument();
    });
  });

  it('shows only individual office lights and hides same-named zones', async () => {
    getAreas.mockResolvedValue([{ area_id: 'office', name: 'Kontor' }]);

    const officeLight = (entityId, name, members) => ({
      entity_id: entityId,
      state: 'off',
      attributes: {
        friendly_name: name,
        area_id: 'office',
        supported_color_modes: ['brightness'],
        ...(members ? { entity_id: members } : {}),
      },
    });

    render(
      <LightsPage
        entities={{
          'light.globe': officeLight('light.globe', 'Jordglob'),
          'light.ceiling': officeLight('light.ceiling', 'Tak'),
          'light.desk': officeLight('light.desk', 'Skrivbord'),
          'light.office': officeLight('light.office', 'Kontor', [
            'light.globe',
            'light.ceiling',
            'light.desk',
          ]),
          'light.ceiling_zone': officeLight('light.ceiling_zone', 'Tak', ['light.ceiling']),
          'light.desk_zone': officeLight('light.desk_zone', 'Skrivbord', ['light.desk']),
        }}
        callService={vi.fn()}
        conn={{}}
        pageSettings={{ lights: { lightsSort: 'area' } }}
        pageId="lights"
        savePageSetting={vi.fn()}
        t={(key) => key}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Jordglob')).toBeInTheDocument();
      expect(screen.getAllByText('Tak')).toHaveLength(1);
      expect(screen.getAllByText('Skrivbord')).toHaveLength(1);
      expect(screen.queryByText('Kontor', { selector: 'p' })).not.toBeInTheDocument();
    });
  });

  it('reveals an optional warmth control for compatible lights', async () => {
    getAreas.mockResolvedValue([{ area_id: 'test_room', name: 'Testrum' }]);
    const callService = vi.fn();

    render(
      <LightsPage
        entities={{
          'light.test': {
            entity_id: 'light.test',
            state: 'on',
            attributes: {
              friendly_name: 'Testlampa',
              area_id: 'test_room',
              brightness: 180,
              color_temp_kelvin: 2700,
              min_color_temp_kelvin: 2200,
              max_color_temp_kelvin: 6500,
              supported_color_modes: ['color_temp'],
            },
          },
        }}
        callService={callService}
        conn={{}}
        pageSettings={{ lights: { lightsSort: 'area' } }}
        pageId="lights"
        savePageSetting={vi.fn()}
        t={(key) => ({ 'light.warmth': 'Värme' })[key] || key}
      />
    );

    await screen.findByRole('heading', { name: 'Testrum' });
    const warmthButton = screen.getByRole('button', { name: 'Värme Testlampa' });
    expect(screen.queryByRole('slider', { name: 'Värme Testlampa' })).not.toBeInTheDocument();

    fireEvent.click(warmthButton);
    const slider = screen.getByRole('slider', { name: 'Värme Testlampa' });
    // Steps: Mysig 2200, Varm 2700, Neutral 3500, Dagsljus 4500, Kall 6500.
    fireEvent.change(slider, { target: { value: '2' } });
    expect(callService).not.toHaveBeenCalled();

    fireEvent.pointerUp(slider);
    expect(callService).toHaveBeenCalledTimes(1);
    expect(callService).toHaveBeenCalledWith('light', 'turn_on', {
      entity_id: 'light.test',
      color_temp_kelvin: 3500,
    });
  });

  it('never offers warmth for the kitchen window lamp', async () => {
    getAreas.mockResolvedValue([{ area_id: 'kitchen', name: 'Kök' }]);

    render(
      <LightsPage
        entities={{
          'light.kitchen_window': {
            entity_id: 'light.kitchen_window',
            state: 'on',
            attributes: {
              friendly_name: 'Köksfönster',
              area_id: 'kitchen',
              brightness: 180,
              color_temp_kelvin: 2700,
              supported_color_modes: ['color_temp'],
            },
          },
        }}
        callService={vi.fn()}
        conn={{}}
        pageSettings={{ lights: { lightsSort: 'area' } }}
        pageId="lights"
        savePageSetting={vi.fn()}
        t={(key) => ({ 'light.warmth': 'Värme' })[key] || key}
      />
    );

    await screen.findByRole('heading', { name: 'Kök' });
    expect(screen.queryByRole('button', { name: 'Värme Köksfönster' })).not.toBeInTheDocument();
  });
});

describe('LightsPage feedback and warmth', () => {
  const garageLight = {
    entity_id: 'light.garage',
    state: 'off',
    attributes: {
      friendly_name: 'Garage',
      area_id: 'garage',
      supported_color_modes: ['color_temp'],
      min_color_temp_kelvin: 2200,
      max_color_temp_kelvin: 6500,
    },
  };

  const renderPage = (callService) =>
    render(
      <LightsPage
        entities={{ 'light.garage': garageLight }}
        callService={callService}
        conn={{}}
        pageSettings={{ lights: { lightsSort: 'name-az' } }}
        pageId="lights"
        savePageSetting={vi.fn()}
        t={(key) => key}
      />
    );

  it('shows a spinner while a toggle is in flight', async () => {
    getAreas.mockResolvedValue([{ area_id: 'garage', name: 'Garage' }]);
    const callService = vi.fn(() => new Promise(() => {}));
    renderPage(callService);

    fireEvent.click(await screen.findByRole('button', { name: 'Garage: common.on' }));
    expect(callService).toHaveBeenCalledWith('light', 'toggle', { entity_id: 'light.garage' });
    expect(await screen.findByRole('status', { name: 'Skickar' })).toBeInTheDocument();
  });

  it('lets an off light pick its warmth, turning it on', async () => {
    getAreas.mockResolvedValue([{ area_id: 'garage', name: 'Garage' }]);
    const callService = vi.fn().mockResolvedValue(undefined);
    renderPage(callService);

    fireEvent.click(await screen.findByRole('button', { name: 'light.warmth Garage' }));
    const slider = screen.getByRole('slider', { name: 'light.warmth Garage' });
    fireEvent.change(slider, { target: { value: '1' } });
    fireEvent.pointerUp(slider);
    expect(callService).toHaveBeenCalledWith('light', 'turn_on', {
      entity_id: 'light.garage',
      color_temp_kelvin: 2700,
    });
  });
});

describe('LightsPage area zones', () => {
  it('shows a Hue zone named in the area allowlist instead of its member lamps', async () => {
    getAreas.mockResolvedValue([{ area_id: 'vardagsrum', name: 'Vardagsrum' }]);
    const lamp = (entityId, name, extra = {}) => ({
      entity_id: entityId,
      state: 'off',
      attributes: {
        friendly_name: name,
        area_id: 'vardagsrum',
        supported_color_modes: ['color_temp'],
        ...extra,
      },
    });

    render(
      <LightsPage
        entities={{
          'light.tak': lamp('light.tak', 'Tak'),
          'light.lp': lamp('light.lp', 'LP', { supported_color_modes: ['onoff'] }),
          'light.fonster1': lamp('light.fonster1', 'Fönster1'),
          'light.fonster2': lamp('light.fonster2', 'Fönster2'),
          'light.fonster_zone': lamp('light.fonster_zone', 'Fönster', {
            entity_id: ['light.fonster1', 'light.fonster2'],
          }),
          'light.vardagsrum_room': lamp('light.vardagsrum_room', 'Vardagsrum', {
            entity_id: ['light.tak', 'light.lp', 'light.fonster1', 'light.fonster2'],
          }),
        }}
        callService={vi.fn()}
        conn={{}}
        pageSettings={{ lights: { lightsSort: 'area', lightsShowGroups: false } }}
        pageId="lights"
        savePageSetting={vi.fn()}
        t={(key) => key}
      />
    );

    await screen.findByRole('heading', { name: 'Vardagsrum' });
    expect(screen.getByText('Tak')).toBeInTheDocument();
    expect(screen.getByText('LP')).toBeInTheDocument();
    expect(screen.getByText('Fönster')).toBeInTheDocument();
    expect(screen.queryByText('Fönster1')).not.toBeInTheDocument();
    expect(screen.queryByText('Fönster2')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Vardagsrum:/ })).not.toBeInTheDocument();
  });
});
