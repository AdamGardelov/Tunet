import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import VacuumPage from '../components/pages/VacuumPage';

describe('VacuumPage', () => {
  it('shows the live map and starts cleaning selected rooms', async () => {
    const sendMessagePromise = vi
      .fn()
      .mockResolvedValueOnce([
        {
          entity_id: 'vacuum.dammit',
          options: { vacuum: { area_mapping: { kitchen: 16, bedroom: 17 } } },
        },
      ])
      .mockResolvedValueOnce([
        { area_id: 'kitchen', name: 'Kök' },
        { area_id: 'bedroom', name: 'Sovrum' },
      ])
      .mockResolvedValueOnce({});

    render(
      <VacuumPage
        vacuumId="vacuum.dammit"
        entities={{
          'vacuum.dammit': {
            state: 'docked',
            attributes: { friendly_name: 'Dammit', battery_level: 92 },
          },
          'image.dammit_map': {
            state: '2026-10-13T10:00:00',
            attributes: { friendly_name: 'Dammit map', entity_picture: '/api/map' },
          },
        }}
        conn={{ sendMessagePromise }}
        callService={vi.fn()}
        getEntityImageUrl={(url) => `http://ha.local${url}`}
      />
    );

    expect(screen.getByAltText('Dammsugarens livekarta')).toHaveAttribute(
      'src',
      expect.stringContaining('http://ha.local/api/map')
    );

    await waitFor(() => expect(screen.getByRole('button', { name: 'Kök' })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'Kök' }));
    fireEvent.click(screen.getByRole('button', { name: 'Dammsug 1 rum' }));

    await waitFor(() =>
      expect(sendMessagePromise).toHaveBeenLastCalledWith(
        expect.objectContaining({
          type: 'call_service',
          domain: 'vacuum',
          service: 'clean_area',
          target: { entity_id: 'vacuum.dammit' },
          service_data: { cleaning_area_id: ['kitchen'] },
        })
      )
    );
  });

  it('sends the vacuum to the bin without starting the notification script', async () => {
    const sendMessagePromise = vi.fn().mockResolvedValue([]);
    const callService = vi.fn().mockResolvedValue({});

    render(
      <VacuumPage
        vacuumId="vacuum.dammit"
        entities={{
          'vacuum.dammit': {
            state: 'docked',
            attributes: { friendly_name: 'Dammit', battery_level: 92 },
          },
        }}
        conn={{ sendMessagePromise }}
        callService={callService}
        getEntityImageUrl={(url) => url}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Till sopskåpet' }));

    await waitFor(() =>
      expect(callService).toHaveBeenCalledWith('script', 'turn_on', {
        entity_id: 'script.dammit_till_sopskapet_utan_notis',
      })
    );
    expect(screen.getByRole('button', { name: 'På väg' })).toBeInTheDocument();
  });
});
