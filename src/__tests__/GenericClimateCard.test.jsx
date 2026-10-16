import { act, fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import GenericClimateCard from '../components/cards/GenericClimateCard';

vi.mock('../contexts', () => ({
  useConfig: () => ({ unitsMode: 'follow_ha' }),
  useHomeAssistantMeta: () => ({
    haConfig: {
      unit_system: {
        temperature: '°C',
      },
    },
  }),
}));

const baseProps = (entityOverrides = {}) => ({
  cardId: 'climate_card_1',
  entityId: 'climate.living_room',
  entity: {
    state: 'cool',
    attributes: {
      friendly_name: 'Living Room AC',
      temperature: 22,
      current_temperature: 24,
      hvac_action: 'cooling',
      fan_mode: 'auto',
      fan_modes: ['auto', 'low', 'medium', 'high'],
      ...entityOverrides,
    },
  },
  dragProps: {},
  controls: null,
  cardStyle: {},
  editMode: false,
  customNames: {},
  customIcons: {},
  onOpen: vi.fn(),
  onSetTemperature: vi.fn(),
  settings: { size: 'large' },
  t: (key) => key,
});

describe('GenericClimateCard', () => {
  it('shows AUTO text when fan mode is auto', () => {
    render(<GenericClimateCard {...baseProps({ fan_mode: 'auto' })} />);

    expect(screen.getByText('climate.fanAuto')).toBeInTheDocument();
  });

  it('does not show AUTO text for lowercase non-auto fan mode', () => {
    render(<GenericClimateCard {...baseProps({ fan_mode: 'medium' })} />);

    expect(screen.queryByText('climate.fanAuto')).not.toBeInTheDocument();
  });

  it('does not show AUTO text for dashed fan mode variants', () => {
    render(
      <GenericClimateCard
        {...baseProps({
          fan_mode: 'high-mid',
          fan_modes: ['auto', 'low', 'mid', 'high-mid', 'high'],
        })}
      />
    );

    expect(screen.queryByText('climate.fanAuto')).not.toBeInTheDocument();
  });

  it('hides the fan block on mobile large cards', () => {
    render(<GenericClimateCard {...baseProps({ fan_mode: 'auto' })} isMobile />);

    expect(screen.queryByText('climate.fanAuto')).not.toBeInTheDocument();
  });

  it('shows the climate as on when the integration has no hvac action', () => {
    const props = baseProps();
    props.entity = {
      state: 'heat',
      attributes: {
        friendly_name: 'Stora sovrummet',
        temperature: 15,
        current_temperature: 13.2,
        hvac_modes: ['heat', 'off'],
      },
    };

    render(<GenericClimateCard {...props} />);

    expect(screen.getByText('common.on')).toBeInTheDocument();
    expect(screen.queryByText('climate.action.idle')).not.toBeInTheDocument();
  });

  it('uses the temperature step reported by Home Assistant and updates immediately', () => {
    const onSetTemperature = vi.fn().mockResolvedValue(undefined);
    render(
      <GenericClimateCard
        {...baseProps({ temperature: 15, target_temp_step: 1, min_temp: 5, max_temp: 35 })}
        onSetTemperature={onSetTemperature}
        isMobile
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'climate.increaseTemperature' }));

    expect(onSetTemperature).toHaveBeenCalledWith(16);
    expect(screen.getByText('16°C')).toBeInTheDocument();
  });

  it('stacks quick temperature taps on the optimistic target', () => {
    const onSetTemperature = vi.fn().mockResolvedValue(undefined);
    render(
      <GenericClimateCard
        {...baseProps({ temperature: 15, target_temp_step: 1 })}
        onSetTemperature={onSetTemperature}
        isMobile
      />
    );

    const increase = screen.getByRole('button', { name: 'climate.increaseTemperature' });
    fireEvent.click(increase);
    fireEvent.click(increase);

    expect(onSetTemperature).toHaveBeenNthCalledWith(1, 16);
    expect(onSetTemperature).toHaveBeenNthCalledWith(2, 17);
    expect(screen.getByText('17°C')).toBeInTheDocument();
  });

  it('turns the climate off when decreasing at the minimum temperature', () => {
    const onSetTemperature = vi.fn().mockResolvedValue(undefined);
    const callService = vi.fn();
    const props = baseProps({
      temperature: 5,
      target_temp_step: 1,
      min_temp: 5,
      max_temp: 35,
      supported_features: 1,
      hvac_modes: ['off', 'heat'],
    });
    props.entity.entity_id = 'climate.living_room';
    render(
      <GenericClimateCard
        {...props}
        onSetTemperature={onSetTemperature}
        callService={callService}
        isMobile
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'climate.decreaseTemperature' }));

    expect(callService).toHaveBeenCalledWith('climate', 'set_hvac_mode', {
      entity_id: 'climate.living_room',
      hvac_mode: 'off',
    });
    expect(onSetTemperature).not.toHaveBeenCalled();
  });

  it('calls climate.turn_off when toggling power while active', () => {
    const callService = vi.fn();
    render(<GenericClimateCard {...baseProps()} callService={callService} />);

    const toggleBtn = screen.getByRole('button', { name: 'climate.togglePower' });
    fireEvent.click(toggleBtn);

    expect(callService).toHaveBeenCalledWith('climate', 'turn_off', {
      entity_id: 'climate.living_room',
    });
  });

  it('calls climate.turn_on when toggling power while off', () => {
    const callService = vi.fn();
    const props = baseProps();
    props.entity.state = 'off';
    render(<GenericClimateCard {...props} callService={callService} />);

    const toggleBtn = screen.getByRole('button', { name: 'climate.togglePower' });
    fireEvent.click(toggleBtn);

    expect(callService).toHaveBeenCalledWith('climate', 'turn_on', {
      entity_id: 'climate.living_room',
    });
  });

  it('opens modal on card click by default', () => {
    const onOpen = vi.fn();
    const { container } = render(<GenericClimateCard {...baseProps()} onOpen={onOpen} />);

    // Click card container
    fireEvent.click(container.firstChild);

    expect(onOpen).toHaveBeenCalled();
  });

  it('toggles power on card click when tapAction is toggle', () => {
    const onOpen = vi.fn();
    const callService = vi.fn();
    const props = baseProps();
    props.settings = { size: 'large', tapAction: 'toggle' };
    const { container } = render(
      <GenericClimateCard {...props} onOpen={onOpen} callService={callService} />
    );

    fireEvent.click(container.firstChild);

    expect(callService).toHaveBeenCalledWith('climate', 'turn_off', {
      entity_id: 'climate.living_room',
    });
    expect(onOpen).not.toHaveBeenCalled();
  });

  it('still opens modal when clicking temperature in tapAction toggle mode', () => {
    const onOpen = vi.fn();
    const callService = vi.fn();
    const props = baseProps();
    props.settings = { size: 'large', tapAction: 'toggle' };
    render(<GenericClimateCard {...props} onOpen={onOpen} callService={callService} />);

    const tempText = screen.getByText('24°C');
    fireEvent.click(tempText);

    expect(onOpen).toHaveBeenCalled();
    expect(callService).not.toHaveBeenCalled();
  });

  it.each(['small', 'large'])(
    'shows pending feedback until HA confirms power in %s layout',
    async (size) => {
      const props = baseProps();
      const callService = vi.fn().mockResolvedValue(undefined);
      const { rerender, container } = render(
        <GenericClimateCard
          {...props}
          settings={{ size, tapAction: 'toggle' }}
          callService={callService}
        />
      );
      const button = screen.getByRole('button', { name: 'climate.togglePower' });
      fireEvent.click(button);
      expect(button).toHaveAttribute('aria-busy', 'true');
      expect(button).toHaveAttribute('aria-pressed', 'false');
      expect(button).toBeDisabled();
      expect(button.querySelector('.animate-spin')).toBeInTheDocument();
      fireEvent.click(container.firstChild);
      expect(callService).toHaveBeenCalledTimes(1);
      await act(async () => {});
      expect(button).toHaveAttribute('aria-busy', 'true');
      rerender(
        <GenericClimateCard
          {...props}
          entity={{ ...props.entity, state: 'off' }}
          settings={{ size }}
          callService={callService}
        />
      );
      expect(button).toHaveAttribute('aria-busy', 'false');
      expect(button).toHaveAttribute('aria-pressed', 'false');
      expect(button).toHaveClass('text-[var(--cat-climate)]');
      expect(button).toBeEnabled();
    }
  );
  it('falls back to set_hvac_mode when the climate entity cannot be turned off directly', () => {
    const callService = vi.fn();
    const props = baseProps({ supported_features: 1, hvac_modes: ['off', 'cool'] });
    props.entity.entity_id = 'climate.living_room';
    render(<GenericClimateCard {...props} callService={callService} />);

    fireEvent.click(screen.getByRole('button', { name: 'climate.togglePower' }));

    expect(callService).toHaveBeenCalledWith('climate', 'set_hvac_mode', {
      entity_id: 'climate.living_room',
      hvac_mode: 'off',
    });
  });
});

describe('GenericClimateCard off state', () => {
  it('shows a turn-on action instead of the target stepper when off', () => {
    const callService = vi.fn();
    const props = baseProps({ hvac_action: 'off', temperature: 0 });
    props.entity.state = 'off';
    render(<GenericClimateCard {...props} callService={callService} isMobile />);

    expect(
      screen.queryByRole('button', { name: 'climate.increaseTemperature' })
    ).not.toBeInTheDocument();
    expect(screen.queryByText('0°C')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'climate.offTapToTurnOn' }));
    expect(callService).toHaveBeenCalledTimes(1);
  });
});
