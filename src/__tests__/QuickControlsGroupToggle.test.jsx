import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import QuickControlsCard from '../components/cards/QuickControlsCard';

const renderCard = (states, callService = vi.fn().mockResolvedValue(undefined)) => {
  render(
    <QuickControlsCard
      cardId="quick_controls_1"
      settings={{ entityIds: ['light.adam', 'light.emma'] }}
      entities={{
        'light.adam': { state: states[0], attributes: { friendly_name: 'Adam sänglampa' } },
        'light.emma': { state: states[1], attributes: { friendly_name: 'Emma sänglampa' } },
      }}
      callService={callService}
      dragProps={{}}
      controls={null}
      cardStyle={{}}
      editMode={false}
      t={(key) => key}
    />
  );
  return callService;
};

describe('QuickControlsCard lamp group button', () => {
  it('shows a crossed-out bulb and turns every lamp on when all are off', () => {
    const callService = renderCard(['off', 'off']);
    expect(screen.getByTestId('quick-controls-lights-off-icon')).toBeInTheDocument();
    const button = screen.getByRole('button', { name: 'quickControls.allLightsOn' });
    expect(button).toHaveAttribute('aria-pressed', 'false');

    fireEvent.click(button);
    expect(callService).toHaveBeenCalledWith('light', 'turn_on', {
      entity_id: ['light.adam', 'light.emma'],
    });
  });

  it('shows a lit bulb and turns every lamp off when any is on', () => {
    const callService = renderCard(['on', 'off']);
    expect(screen.getByTestId('quick-controls-lights-on-icon')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'quickControls.allLightsOff' }));
    expect(callService).toHaveBeenCalledWith('light', 'turn_off', {
      entity_id: ['light.adam', 'light.emma'],
    });
  });

  it('leaves unavailable lamps out and disables the button when none can respond', () => {
    renderCard(['unavailable', 'unavailable']);
    expect(screen.getByTestId('quick-controls-shared-light-icon')).toBeDisabled();
  });
});

describe('QuickControlsCard run buttons and short names', () => {
  const renderWithScript = (callService = vi.fn().mockResolvedValue(undefined)) => {
    render(
      <QuickControlsCard
        cardId="quick_controls_2"
        settings={{
          entityIds: ['light.adam', 'light.emma', 'script.kvall'],
          names: { 'light.adam': 'Adam', 'light.emma': 'Emma' },
        }}
        entities={{
          'light.adam': { state: 'on', attributes: { friendly_name: 'Adam sänglampa' } },
          'light.emma': { state: 'off', attributes: { friendly_name: 'Emma sänglampa' } },
          'script.kvall': { state: 'off', attributes: { friendly_name: 'Kväll' } },
        }}
        callService={callService}
        dragProps={{}}
        controls={null}
        cardStyle={{}}
        editMode={false}
        t={(key) => key}
      />
    );
    return callService;
  };

  it('shows the short names from the card settings', () => {
    renderWithScript();
    expect(screen.getByText('Adam')).toBeInTheDocument();
    expect(screen.getByText('Emma')).toBeInTheDocument();
    expect(screen.queryByText('Adam sänglampa')).toBeNull();
  });

  it('runs the script on tap instead of toggling it', () => {
    const callService = renderWithScript();
    fireEvent.click(screen.getByTestId('quick-control-tile-script.kvall'));
    expect(callService).toHaveBeenCalledWith('script', 'turn_on', { entity_id: 'script.kvall' });
  });

  it('keeps the shared lamp button for the lamps only', () => {
    const callService = renderWithScript();
    fireEvent.click(screen.getByRole('button', { name: 'quickControls.allLightsOff' }));
    expect(callService).toHaveBeenCalledWith('light', 'turn_off', {
      entity_id: ['light.adam', 'light.emma'],
    });
  });
});
