import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import ActionButtonCard from '../components/cards/ActionButtonCard';
import { isCardHiddenByLogic } from '../utils/cardUtils';
import { sortCardPlacements } from '../rendering/DashboardGrid';

const renderCard = (entities, settings = {}, props = {}) => {
  const callService = vi.fn(() => Promise.resolve());
  render(
    <ActionButtonCard
      cardId="action_button_1"
      settings={{ entityId: 'light.kok_kaffebryggare', title: 'Kaffe?', ...settings }}
      entities={entities}
      callService={callService}
      dragProps={{}}
      controls={null}
      cardStyle={{}}
      editMode={false}
      {...props}
    />
  );
  return callService;
};

describe('action button card', () => {
  it('starts the coffee maker when it is off', () => {
    const callService = renderCard({ 'light.kok_kaffebryggare': { state: 'off', attributes: {} } });

    expect(screen.getByText('Kaffe?')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Starta' }));

    expect(callService).toHaveBeenCalledWith('light', 'turn_on', {
      entity_id: 'light.kok_kaffebryggare',
    });
  });

  it('offers to switch it off again once it is on', () => {
    const callService = renderCard(
      { 'light.kok_kaffebryggare': { state: 'on', attributes: {} } },
      { onText: 'Bryggaren är på' }
    );

    expect(screen.getByTestId('action-button-subtitle')).toHaveTextContent('Bryggaren är på');
    const button = screen.getByRole('button', { name: 'Stäng av' });
    expect(button).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(button);

    expect(callService).toHaveBeenCalledWith('light', 'turn_off', {
      entity_id: 'light.kok_kaffebryggare',
    });
  });

  it('runs a script instead of toggling it', () => {
    const callService = renderCard(
      { 'script.brygg_kaffe': { state: 'off', attributes: {} } },
      { entityId: 'script.brygg_kaffe' }
    );

    const button = screen.getByRole('button', { name: 'Starta' });
    expect(button).not.toHaveAttribute('aria-pressed');
    fireEvent.click(button);

    expect(callService).toHaveBeenCalledWith('script', 'turn_on', {
      entity_id: 'script.brygg_kaffe',
    });
  });

  it('does nothing while the device is unavailable or the dashboard is being edited', () => {
    const callService = renderCard({
      'light.kok_kaffebryggare': { state: 'unavailable', attributes: {} },
    });
    expect(screen.getByText('Inte tillgänglig')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Starta' })).toBeDisabled();
    expect(callService).not.toHaveBeenCalled();
  });

  it('is shown only while its visibility helper is on', () => {
    const settings = {
      entityId: 'light.kok_kaffebryggare',
      visibilityCondition: {
        entityId: 'binary_sensor.kaffetid',
        enabled: true,
        rules: [{ type: 'state', states: ['on'] }],
      },
    };
    const ctx = (kaffetid) => ({
      activePage: 'home',
      getCardSettingsKey: (id) => `home::${id}`,
      cardSettings: { 'home::action_button_1': settings },
      entities: {
        'light.kok_kaffebryggare': { state: 'off', attributes: {} },
        'binary_sensor.kaffetid': { state: kaffetid, attributes: {} },
      },
    });

    expect(isCardHiddenByLogic('action_button_1', ctx('on'))).toBe(false);
    expect(isCardHiddenByLogic('action_button_1', ctx('off'))).toBe(true);
  });

  it('sits first on the phone, above the camera card', () => {
    const items = [
      { id: 'camera_presets_1', placement: { row: 1, col: 1 } },
      { id: 'action_button_1', placement: { row: 5, col: 1 } },
      { id: 'quick_controls_1', placement: { row: 2, col: 1 } },
    ];
    expect(sortCardPlacements(items, true).map((item) => item.id)).toEqual([
      'action_button_1',
      'camera_presets_1',
      'quick_controls_1',
    ]);
  });
});
