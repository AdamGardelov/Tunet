import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import CarCard from '../components/cards/CarCard';

vi.mock('../contexts', () => ({
  useConfig: () => ({ unitsMode: 'follow_ha' }),
  useHomeAssistantMeta: () => ({
    haConfig: { unit_system: { length: 'km' } },
  }),
}));

const baseProps = ({ size = 'small', entities } = {}) => ({
  cardId: 'car_card_ceed',
  dragProps: {},
  controls: null,
  cardStyle: {},
  entities:
    entities || {
      'sensor.ceed_battery': { state: '94', attributes: { unit_of_measurement: '%' } },
      'sensor.ceed_range': { state: '420', attributes: { unit_of_measurement: 'km' } },
    },
  editMode: false,
  cardSettings: {
    'home::car_card_ceed': {
      size,
      batteryId: 'sensor.ceed_battery',
      rangeId: 'sensor.ceed_range',
    },
  },
  settingsKey: 'home::car_card_ceed',
  customNames: { car_card_ceed: 'Ceed' },
  customIcons: {},
  getS: vi.fn(),
  getEntityImageUrl: vi.fn(),
  onOpen: vi.fn(),
  isMobile: true,
  t: (key) => ({ 'status.unavailable': 'Otillgänglig', 'car.defaultName': 'Bil' })[key] || key,
});

describe('CarCard availability', () => {
  it('keeps an unavailable car visible but prevents opening its controls', () => {
    const props = baseProps({
      entities: {
        'sensor.ceed_battery': { state: 'unavailable', attributes: {} },
        'sensor.ceed_range': { state: 'unavailable', attributes: {} },
      },
    });
    render(<CarCard {...props} />);

    const card = screen.getByRole('button', { name: /Ceed.*Otillgänglig/i });
    expect(card).toHaveAttribute('aria-disabled', 'true');
    expect(card).toHaveAttribute('tabindex', '-1');
    fireEvent.click(card);
    expect(props.onOpen).not.toHaveBeenCalled();
  });

  it('opens the car controls when at least one mapped entity is available', () => {
    const props = baseProps();
    render(<CarCard {...props} />);

    const card = screen.getByRole('button', { name: /Ceed.*94%/i });
    fireEvent.click(card);
    expect(props.onOpen).toHaveBeenCalledOnce();
  });
});
