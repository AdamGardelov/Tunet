import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import MedicationCard from '../components/cards/MedicationCard';

const entities = {
  'input_number.inhalator_doser_kvar': { state: '21', attributes: { min: 0, max: 125 } },
  'input_boolean.sparven_medicin_morgon': { state: 'on', attributes: {} },
  'input_boolean.sparven_medicin_kvall': { state: 'off', attributes: {} },
};

const renderCard = (settings = {}, callService = vi.fn().mockResolvedValue(undefined)) => {
  render(
    <MedicationCard
      cardId="medication_card_1"
      settings={{ entityIds: Object.keys(entities), ...settings }}
      entities={entities}
      callService={callService}
      dragProps={{}}
      controls={null}
      cardStyle={{}}
      editMode={false}
    />
  );
  return callService;
};

describe('MedicationCard refill menu', () => {
  it('keeps "Ny inhalator" hidden until the cat menu is opened', () => {
    renderCard();
    expect(screen.queryByTestId('medication-refill-confirm')).toBeNull();
    expect(screen.getByText(/dagar kvar/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Fler val för medicinen' }));
    // The menu only offers the action; nothing is reset yet.
    expect(screen.queryByTestId('medication-refill-confirm')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Ny inhalator köpt' }));
    expect(
      screen.getByRole('button', { name: 'Ja, sätt räknaren till 120 doser' })
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Avbryt' }));
    expect(screen.queryByTestId('medication-refill-confirm')).toBeNull();
    expect(screen.getByText(/dagar kvar/)).toBeInTheDocument();
  });

  it('resets the counter after confirming', async () => {
    const callService = renderCard();
    fireEvent.click(screen.getByRole('button', { name: 'Fler val för medicinen' }));
    fireEvent.click(screen.getByTestId('medication-refill-start'));
    expect(callService).not.toHaveBeenCalled();
    fireEvent.click(screen.getByTestId('medication-refill-confirm'));
    expect(callService).toHaveBeenCalledWith('input_number', 'set_value', {
      entity_id: 'input_number.inhalator_doser_kvar',
      value: 120,
    });
    await waitFor(() => expect(screen.queryByTestId('medication-refill-confirm')).toBeNull());
  });

  it('runs the configured refill script instead when there is one', () => {
    const callService = renderCard({ refillScriptId: 'script.sparven_ny_inhalator' });
    fireEvent.click(screen.getByRole('button', { name: 'Fler val för medicinen' }));
    fireEvent.click(screen.getByTestId('medication-refill-start'));
    expect(callService).not.toHaveBeenCalled();
    fireEvent.click(screen.getByTestId('medication-refill-confirm'));
    expect(callService).toHaveBeenCalledWith('script', 'turn_on', {
      entity_id: 'script.sparven_ny_inhalator',
    });
  });
});
