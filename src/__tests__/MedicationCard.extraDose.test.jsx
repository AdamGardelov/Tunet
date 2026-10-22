import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import MedicationCard from '../components/cards/MedicationCard';

const baseEntities = {
  'input_number.inhalator_doser_kvar': { state: '19', attributes: { min: 0, max: 125 } },
  'input_boolean.sparven_medicin_morgon': { state: 'on', attributes: {} },
  'input_boolean.sparven_medicin_kvall': { state: 'off', attributes: {} },
  'input_number.sparven_extra_doser_morgon': { state: '0', attributes: {} },
  'input_number.sparven_extra_doser_kvall': { state: '0', attributes: {} },
};

const settings = {
  entityIds: [
    'input_number.inhalator_doser_kvar',
    'input_boolean.sparven_medicin_kvall',
    'input_boolean.sparven_medicin_morgon',
  ],
  refillScriptId: 'script.sparven_ny_inhalator',
  extraDoseScriptId: 'script.sparven_extra_dos',
  undoExtraDoseScriptId: 'script.sparven_angra_extra_dos',
  extraMorningEntityId: 'input_number.sparven_extra_doser_morgon',
  extraEveningEntityId: 'input_number.sparven_extra_doser_kvall',
};

const renderCard = (entityOverrides = {}, callService = vi.fn().mockResolvedValue(undefined)) => {
  render(
    <MedicationCard
      cardId="medication_card_1"
      settings={settings}
      entities={{ ...baseEntities, ...entityOverrides }}
      callService={callService}
      dragProps={{}}
      controls={null}
      cardStyle={{}}
      editMode={false}
    />
  );
  return callService;
};

describe('MedicationCard extra doses', () => {
  it('records extra doses from the menu through the script', async () => {
    const callService = renderCard();
    expect(screen.queryByTestId('medication-extra-start')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Fler val för medicinen' }));
    fireEvent.click(screen.getByTestId('medication-extra-start'));
    expect(callService).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Registrera 2 extra doser' }));
    expect(callService).toHaveBeenCalledWith('script', 'turn_on', {
      entity_id: 'script.sparven_extra_dos',
      variables: { antal: 2 },
    });
    await waitFor(() => expect(screen.getByText(/dagar kvar/)).toBeInTheDocument());
  });

  it('shows the extra doses on the dose button and lets you undo one', () => {
    const callService = renderCard({
      'input_number.sparven_extra_doser_morgon': { state: '1', attributes: {} },
    });
    expect(
      screen.getByTestId('medication-extra-input_boolean.sparven_medicin_morgon')
    ).toHaveTextContent('+1');
    expect(screen.getByRole('checkbox', { name: 'Morgon tagen, 1 extra' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Fler val för medicinen' }));
    fireEvent.click(screen.getByRole('button', { name: 'Ångra extra dos' }));
    expect(callService).toHaveBeenCalledWith('script', 'turn_on', {
      entity_id: 'script.sparven_angra_extra_dos',
    });
  });

  it('only offers undo when an extra dose is registered today', () => {
    renderCard();
    fireEvent.click(screen.getByRole('button', { name: 'Fler val för medicinen' }));
    expect(screen.queryByRole('button', { name: 'Ångra extra dos' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Ny inhalator köpt' })).toBeInTheDocument();
  });
});
