import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import MedicationCard from '../components/cards/MedicationCard';
import QuickControlsCard from '../components/cards/QuickControlsCard';

const t = (key) =>
  ({
    'common.on': 'På',
    'common.off': 'Av',
    'status.unavailable': 'Otillgänglig',
  })[key] || key;

describe('custom routine cards', () => {
  it('shows quick controls and toggles their entities directly', () => {
    const callService = vi.fn();
    render(
      <QuickControlsCard
        cardId="quick_controls_1"
        settings={{ entityIds: ['light.emma', 'climate.ac'] }}
        entities={{
          'light.emma': { state: 'off', attributes: { friendly_name: 'Emma sänglampa' } },
          'climate.ac': {
            state: 'cool',
            attributes: { friendly_name: 'Electrolux AC', current_temperature: 22 },
          },
        }}
        callService={callService}
        dragProps={{}}
        controls={null}
        cardStyle={{}}
        editMode={false}
        t={t}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /Emma sänglampa/i }));
    fireEvent.click(screen.getByRole('button', { name: /AC/i }));

    expect(callService).toHaveBeenNthCalledWith(1, 'light', 'toggle', {
      entity_id: 'light.emma',
    });
    expect(callService).toHaveBeenNthCalledWith(2, 'climate', 'turn_off', {
      entity_id: 'climate.ac',
    });
  });

  it('renders a single quick control as a standalone card without a group heading', () => {
    const { container } = render(
      <QuickControlsCard
        cardId="quick_controls_1"
        settings={{ entityIds: ['light.emma'] }}
        entities={{
          'light.emma': { state: 'off', attributes: { friendly_name: 'Emma sänglampa' } },
        }}
        callService={vi.fn()}
        dragProps={{}}
        controls={null}
        cardStyle={{}}
        editMode={false}
        isMobile
        t={t}
      />
    );

    expect(container.querySelector('.grid')).not.toBeInTheDocument();
    expect(screen.queryByText('Snabbkontroller')).not.toBeInTheDocument();
    expect(screen.getByText('Emma sänglampa')).toHaveClass('whitespace-normal');
  });

  it('shows remaining doses and decrements them when a dose is registered', async () => {
    const callService = vi.fn().mockResolvedValue(undefined);
    render(
      <MedicationCard
        cardId="medication_card_1"
        settings={{
          entityIds: [
            'input_number.sparven_doser',
            'input_boolean.sparven_morgon',
            'input_boolean.sparven_kvall',
          ],
        }}
        entities={{
          'input_number.sparven_doser': { state: '38', attributes: { min: 0, max: 60 } },
          'input_boolean.sparven_morgon': { state: 'off', attributes: {} },
          'input_boolean.sparven_kvall': { state: 'on', attributes: {} },
        }}
        callService={callService}
        dragProps={{}}
        controls={null}
        cardStyle={{}}
        editMode={false}
      />
    );

    expect(screen.getByText('38 doser kvar · ca 19 dagar')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Morgon/i }));
    expect(callService).toHaveBeenNthCalledWith(1, 'input_number', 'set_value', {
      entity_id: 'input_number.sparven_doser',
      value: 37,
    });
    await vi.waitFor(() => expect(callService).toHaveBeenCalledTimes(2));
    expect(callService).toHaveBeenNthCalledWith(2, 'input_boolean', 'toggle', {
      entity_id: 'input_boolean.sparven_morgon',
    });
  });

  it('restores a dose when a medication registration is undone', async () => {
    const callService = vi.fn().mockResolvedValue(undefined);
    render(
      <MedicationCard
        cardId="medication_card_1"
        settings={{
          entityIds: ['input_number.sparven_doser', 'input_boolean.sparven_morgon'],
        }}
        entities={{
          'input_number.sparven_doser': { state: '37', attributes: { min: 0, max: 60 } },
          'input_boolean.sparven_morgon': { state: 'on', attributes: {} },
        }}
        callService={callService}
        dragProps={{}}
        controls={null}
        cardStyle={{}}
        editMode={false}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /Morgon/i }));
    expect(callService).toHaveBeenNthCalledWith(1, 'input_number', 'set_value', {
      entity_id: 'input_number.sparven_doser',
      value: 38,
    });
    await vi.waitFor(() => expect(callService).toHaveBeenCalledTimes(2));
  });
});
