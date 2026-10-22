import { act, fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import MedicationCard from '../components/cards/MedicationCard';
import QuickControlsCard from '../components/cards/QuickControlsCard';
import CameraPresetCard from '../components/cards/CameraPresetCard';

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
        settings={{
          entityIds: ['light.emma', 'climate.ac'],
          title: 'Snabbkontroller',
        }}
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

    expect(screen.getByRole('button', { name: /Emma sänglampa/i })).toHaveAttribute(
      'aria-pressed',
      'false'
    );
    expect(screen.getByRole('button', { name: /AC/i })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTestId('quick-control-power-light.emma')).toHaveClass(
      'text-[var(--text-muted)]'
    );
    expect(screen.getByTestId('quick-control-power-climate.ac')).toHaveClass(
      'bg-[var(--accent-bg)]',
      'text-[var(--accent-color)]'
    );

    fireEvent.click(screen.getByRole('button', { name: /Emma sänglampa/i }));
    fireEvent.click(screen.getByRole('button', { name: /AC/i }));

    expect(callService).toHaveBeenNthCalledWith(1, 'light', 'toggle', {
      entity_id: 'light.emma',
    });
    expect(callService).toHaveBeenNthCalledWith(2, 'climate', 'turn_off', {
      entity_id: 'climate.ac',
    });
    expect(screen.queryByText('Snabbkontroller')).not.toBeInTheDocument();
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

  it('uses the active light color for a calm lamp-style power control', () => {
    render(
      <QuickControlsCard
        cardId="quick_controls_1"
        settings={{ entityIds: ['light.adam'] }}
        entities={{
          'light.adam': {
            state: 'on',
            attributes: { friendly_name: 'Adam sänglampa', color_temp_kelvin: 2700 },
          },
        }}
        callService={vi.fn()}
        dragProps={{}}
        controls={null}
        cardStyle={{}}
        editMode={false}
        t={t}
      />
    );

    expect(screen.getByTestId('quick-control-power-light.adam')).toHaveStyle({
      backgroundColor: 'rgba(255, 166, 60, 0.22)',
      borderColor: 'rgba(255, 166, 60, 0.28)',
      color: 'rgb(255, 166, 60)',
    });
  });

  it('uses one shared leading icon when a row contains only lights', () => {
    render(
      <QuickControlsCard
        cardId="quick_controls_1"
        settings={{ entityIds: ['light.adam', 'light.emma'] }}
        entities={{
          'light.adam': { state: 'on', attributes: { friendly_name: 'Adam sänglampa' } },
          'light.emma': { state: 'off', attributes: { friendly_name: 'Emma sänglampa' } },
        }}
        callService={vi.fn()}
        dragProps={{}}
        controls={null}
        cardStyle={{}}
        editMode={false}
        t={t}
      />
    );

    expect(screen.getByTestId('quick-controls-shared-light-icon')).toBeInTheDocument();
    expect(screen.queryByTestId('quick-control-entity-icon-light.adam')).not.toBeInTheDocument();
    expect(screen.queryByTestId('quick-control-entity-icon-light.emma')).not.toBeInTheDocument();
    expect(screen.queryByTestId('quick-control-power-light.adam')).not.toBeInTheDocument();
    expect(screen.queryByTestId('quick-control-power-light.emma')).not.toBeInTheDocument();
    expect(screen.getByTestId('quick-control-tile-light.adam')).toHaveClass(
      'h-14',
      'rounded-2xl',
      'border'
    );
    expect(screen.getByTestId('quick-control-tile-light.adam')).toHaveStyle({
      backgroundColor: 'rgba(255, 183, 77, 0.18)',
      borderColor: 'rgba(255, 183, 77, 0.32)',
    });
    expect(screen.getByTestId('quick-control-tile-light.emma')).toHaveClass(
      'bg-[var(--glass-bg)]',
      'text-[var(--text-muted)]'
    );
    expect(screen.getByTestId('quick-control-tile-light.adam')).toHaveAttribute(
      'aria-pressed',
      'true'
    );
    expect(screen.getByTestId('quick-control-tile-light.emma')).toHaveAttribute(
      'aria-pressed',
      'false'
    );
    expect(screen.getAllByText('På')).toHaveLength(1);
    expect(screen.getAllByText('Av')).toHaveLength(1);
    expect(screen.getByRole('region', { name: 'Snabbkontroller' })).toHaveClass('px-5', 'py-3');
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
          'input_number.sparven_doser': { state: '28', attributes: { min: 0, max: 60 } },
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

    expect(screen.getByText('14 dagar kvar')).toBeInTheDocument();
    expect(screen.getByText('28 doser')).toBeInTheDocument();
    expect(screen.queryByText('Sparvens inhalator')).not.toBeInTheDocument();
    expect(screen.queryByText(/2\/dag/i)).not.toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Sparvens inhalator' })).toHaveClass(
      'items-center',
      'gap-3',
      'px-5'
    );
    expect(screen.getByTestId('medication-dose-actions')).toHaveClass(
      'min-w-[164px]',
      'grid-cols-2',
      'gap-2'
    );
    expect(screen.getByRole('checkbox', { name: 'Morgon inte tagen' })).toHaveAttribute(
      'aria-checked',
      'false'
    );
    expect(screen.getByTestId('medication-dose-control-input_boolean.sparven_morgon')).toHaveClass(
      'rounded-2xl',
      'bg-[var(--glass-bg)]'
    );
    expect(screen.getByRole('checkbox', { name: 'Kväll tagen' })).toHaveAttribute(
      'aria-checked',
      'true'
    );
    expect(screen.getByTestId('medication-dose-control-input_boolean.sparven_kvall')).toHaveClass(
      'rounded-2xl',
      'bg-[var(--status-success-bg)]',
      'text-[var(--status-success-fg)]'
    );
    expect(screen.getByTestId('medication-dose-indicator-input_boolean.sparven_kvall')).toHaveClass(
      'flex',
      'h-4',
      'w-4',
      'items-center',
      'justify-center'
    );
    expect(
      screen.getByTestId('medication-dose-indicator-input_boolean.sparven_kvall')
    ).not.toHaveClass('absolute');
    fireEvent.click(screen.getByRole('checkbox', { name: 'Morgon inte tagen' }));
    expect(callService).toHaveBeenNthCalledWith(1, 'input_number', 'set_value', {
      entity_id: 'input_number.sparven_doser',
      value: 27,
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
          'input_number.sparven_doser': { state: '27', attributes: { min: 0, max: 60 } },
          'input_boolean.sparven_morgon': { state: 'on', attributes: {} },
        }}
        callService={callService}
        dragProps={{}}
        controls={null}
        cardStyle={{}}
        editMode={false}
      />
    );

    expect(screen.getByText('ca 14 dagar kvar')).toBeInTheDocument();
    expect(screen.getByText('27 doser')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('checkbox', { name: 'Morgon tagen' }));
    expect(callService).toHaveBeenNthCalledWith(1, 'input_number', 'set_value', {
      entity_id: 'input_number.sparven_doser',
      value: 28,
    });
    await vi.waitFor(() => expect(callService).toHaveBeenCalledTimes(2));
  });

  it('shows two camera presets on one row and selects the tapped position', () => {
    const callService = vi.fn();
    const { container } = render(
      <CameraPresetCard
        cardId="camera_presets_1"
        settings={{ entityId: 'select.walles_kamera_move_to_preset' }}
        entities={{
          'select.walles_kamera_move_to_preset': {
            state: 'unknown',
            attributes: { options: ['Våran säng', 'Walters säng'] },
          },
        }}
        callService={callService}
        dragProps={{}}
        controls={null}
        cardStyle={{}}
        editMode={false}
      />
    );

    expect(container.querySelector('.grid')).toHaveClass('grid-cols-2');
    expect(screen.getByRole('button', { name: /Walters säng/i })).toBeEnabled();
    fireEvent.click(screen.getByRole('button', { name: /Walters säng/i }));
    expect(callService).toHaveBeenCalledWith('select', 'select_option', {
      entity_id: 'select.walles_kamera_move_to_preset',
      option: 'Walters säng',
    });
  });

  it('shows pending and success feedback while a camera preset is sent', async () => {
    let resolveAction;
    const callService = vi.fn(
      () =>
        new Promise((resolve) => {
          resolveAction = resolve;
        })
    );
    render(
      <CameraPresetCard
        cardId="camera_presets_1"
        settings={{ entityId: 'select.camera_preset' }}
        entities={{
          'select.camera_preset': {
            state: 'unknown',
            attributes: { options: ['Walters säng'] },
          },
        }}
        callService={callService}
        dragProps={{}}
        controls={null}
        cardStyle={{}}
        editMode={false}
      />
    );

    const button = screen.getByRole('button', { name: /Walters säng/i });
    fireEvent.click(button);

    expect(screen.getByRole('status', { name: 'Skickar' })).toBeInTheDocument();
    expect(button).toBeDisabled();

    await act(async () => resolveAction());
    expect(await screen.findByRole('status', { name: 'Klart' })).toBeInTheDocument();
    expect(button).toBeEnabled();
  });

  it('uses a shared helper to show and update the active camera preset', async () => {
    const callService = vi.fn().mockResolvedValue(undefined);
    render(
      <CameraPresetCard
        cardId="camera_presets_1"
        settings={{ entityId: 'select.walles_kamera_move_to_preset' }}
        entities={{
          'select.walles_kamera_move_to_preset': {
            state: 'unknown',
            attributes: { options: ['Våran säng', 'Walters säng', 'Vagn'] },
          },
          'input_select.walles_kameraposition': {
            state: 'Våran säng',
            attributes: {
              friendly_name: 'Walles kameraposition',
              options: ['Våran säng', 'Walters säng', 'Vagn'],
            },
          },
        }}
        callService={callService}
        dragProps={{}}
        controls={null}
        cardStyle={{}}
        editMode={false}
      />
    );

    expect(screen.getByRole('button', { name: 'Våran säng' })).toHaveAttribute(
      'aria-pressed',
      'true'
    );
    expect(screen.getByRole('button', { name: 'Walters säng' })).toHaveAttribute(
      'aria-pressed',
      'false'
    );
    expect(screen.getByRole('button', { name: 'Våran säng' })).toHaveClass(
      'rounded-2xl',
      'bg-[var(--accent-bg)]',
      'text-[var(--accent-color)]'
    );
    expect(screen.getByRole('button', { name: 'Walters säng' })).toHaveClass(
      'rounded-2xl',
      'bg-[var(--glass-bg)]'
    );

    fireEvent.click(screen.getByRole('button', { name: 'Walters säng' }));

    await vi.waitFor(() => expect(callService).toHaveBeenCalledTimes(2));
    expect(callService).toHaveBeenNthCalledWith(1, 'select', 'select_option', {
      entity_id: 'select.walles_kamera_move_to_preset',
      option: 'Walters säng',
    });
    expect(callService).toHaveBeenNthCalledWith(2, 'input_select', 'select_option', {
      entity_id: 'input_select.walles_kameraposition',
      option: 'Walters säng',
    });
  });

  it('shows error feedback when a quick control action fails', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    const callService = vi.fn().mockRejectedValue(new Error('Disconnected'));
    render(
      <QuickControlsCard
        cardId="quick_controls_1"
        settings={{ entityIds: ['light.emma'] }}
        entities={{
          'light.emma': { state: 'off', attributes: { friendly_name: 'Emma sänglampa' } },
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

    expect(await screen.findByRole('status', { name: 'Misslyckades' })).toBeInTheDocument();
    consoleError.mockRestore();
  });

  it('adapts camera preset columns from one through four icon buttons', () => {
    const { rerender, container } = render(
      <CameraPresetCard
        cardId="camera_presets_1"
        settings={{ entityId: 'select.camera_preset' }}
        entities={{
          'select.camera_preset': {
            state: 'Preset 1',
            attributes: { options: ['Preset 1'] },
          },
        }}
        callService={vi.fn()}
        dragProps={{}}
        controls={null}
        cardStyle={{}}
        editMode={false}
      />
    );

    expect(container.querySelector('.grid')).toHaveClass('grid-cols-1');

    rerender(
      <CameraPresetCard
        cardId="camera_presets_1"
        settings={{ entityId: 'select.camera_preset' }}
        entities={{
          'select.camera_preset': {
            state: 'Preset 1',
            attributes: { options: ['Preset 1', 'Preset 2', 'Preset 3', 'Preset 4', 'Preset 5'] },
          },
        }}
        callService={vi.fn()}
        dragProps={{}}
        controls={null}
        cardStyle={{}}
        editMode={false}
      />
    );

    expect(container.querySelector('.grid')).toHaveClass('grid-cols-4');
    expect(screen.getAllByRole('button')).toHaveLength(4);
    expect(screen.queryByText('Preset 1', { selector: ':not(.sr-only)' })).not.toBeInTheDocument();
  });

  it('places Walters bed before the shared bed in the default Tapo option order', () => {
    render(
      <CameraPresetCard
        cardId="camera_presets_1"
        settings={{ entityId: 'select.camera_preset' }}
        entities={{
          'select.camera_preset': {
            state: 'unknown',
            attributes: { options: ['Våran säng', 'Walters säng', 'Vagn'] },
          },
        }}
        callService={vi.fn()}
        dragProps={{}}
        controls={null}
        cardStyle={{}}
        editMode={false}
      />
    );

    expect(
      screen.getAllByRole('button').map((button) => button.getAttribute('aria-label'))
    ).toEqual(['Walters säng', 'Våran säng', 'Vagn']);
  });

  it('places a live camera action before three presets and uses a surveillance icon', () => {
    const onOpenCamera = vi.fn();
    render(
      <CameraPresetCard
        cardId="camera_presets_1"
        settings={{ entityId: 'select.walles_kamera_move_to_preset' }}
        entities={{
          'select.walles_kamera_move_to_preset': {
            state: 'unknown',
            attributes: { options: ['Våran säng', 'Walters säng', 'Vagn'] },
          },
          'camera.walles_kamera_hd_stream': {
            state: 'streaming',
            attributes: { friendly_name: 'Walles kamera HD stream' },
          },
        }}
        callService={vi.fn()}
        dragProps={{}}
        controls={null}
        cardStyle={{}}
        editMode={false}
        onOpenCamera={onOpenCamera}
      />
    );

    expect(screen.getByTestId('camera-surveillance-icon')).toBeInTheDocument();
    expect(
      screen.getAllByRole('button').map((button) => button.getAttribute('aria-label'))
    ).toEqual(['Live', 'Walters säng', 'Våran säng', 'Vagn']);

    fireEvent.click(screen.getByRole('button', { name: 'Live' }));
    expect(onOpenCamera).toHaveBeenCalledWith('camera.walles_kamera_hd_stream');
  });

  it('uses the camera tile as a privacy control and disables camera actions while privacy is on', () => {
    const callService = vi.fn().mockResolvedValue(undefined);
    const onOpenCamera = vi.fn();
    render(
      <CameraPresetCard
        cardId="camera_presets_1"
        settings={{ entityId: 'select.walles_kamera_move_to_preset' }}
        entities={{
          'select.walles_kamera_move_to_preset': {
            state: 'unknown',
            attributes: { options: ['Walters säng', 'Våran säng', 'Vagn'] },
          },
          'camera.walles_kamera_hd_stream': {
            state: 'unavailable',
            attributes: { friendly_name: 'Walles kamera HD stream' },
          },
          'switch.walles_kamera_privacy': {
            state: 'on',
            attributes: { friendly_name: 'Privacy' },
          },
        }}
        callService={callService}
        dragProps={{}}
        controls={null}
        cardStyle={{}}
        editMode={false}
        onOpenCamera={onOpenCamera}
      />
    );

    const privacyButton = screen.getByRole('button', { name: 'Stäng av integritetsläge' });
    expect(privacyButton).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTestId('camera-privacy-icon')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Live' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Walters säng' })).toBeDisabled();

    fireEvent.click(privacyButton);
    expect(callService).toHaveBeenCalledWith('switch', 'turn_off', {
      entity_id: 'switch.walles_kamera_privacy',
    });
  });

  it('can enable camera privacy while normal camera actions remain available', () => {
    const callService = vi.fn().mockResolvedValue(undefined);
    render(
      <CameraPresetCard
        cardId="camera_presets_1"
        settings={{ entityId: 'select.walles_kamera_move_to_preset' }}
        entities={{
          'select.walles_kamera_move_to_preset': {
            state: 'unknown',
            attributes: { options: ['Walters säng'] },
          },
          'switch.walles_kamera_privacy': {
            state: 'off',
            attributes: { friendly_name: 'Privacy' },
          },
        }}
        callService={callService}
        dragProps={{}}
        controls={null}
        cardStyle={{}}
        editMode={false}
      />
    );

    expect(screen.getByRole('button', { name: 'Walters säng' })).toBeEnabled();
    const privacyButton = screen.getByRole('button', { name: 'Slå på integritetsläge' });
    expect(privacyButton).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByTestId('camera-surveillance-icon')).toBeInTheDocument();

    fireEvent.click(privacyButton);
    expect(callService).toHaveBeenCalledWith('switch', 'turn_on', {
      entity_id: 'switch.walles_kamera_privacy',
    });
  });
});
