import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { listAwayModeCandidates, resolveAwayModeEntityId } from '../utils/awayMode';
import { AwayModeBanner, AwayModeChip } from '../components/ui/AwayModeControl';

const t = (key) => key;

describe('resolveAwayModeEntityId', () => {
  it('prefers the configured entity and ignores missing ones', () => {
    const entities = { 'input_boolean.trip': { state: 'off' } };
    expect(resolveAwayModeEntityId(entities, 'input_boolean.trip')).toBe('input_boolean.trip');
    expect(resolveAwayModeEntityId(entities, 'input_boolean.gone')).toBeNull();
  });

  it('auto-detects a single away-like input_boolean', () => {
    const entities = {
      'input_boolean.bortalage': { state: 'off' },
      'input_boolean.sparven_morgon': { state: 'on' },
    };
    expect(resolveAwayModeEntityId(entities)).toBe('input_boolean.bortalage');
  });

  it('does not guess between several matches', () => {
    const entities = {
      'input_boolean.away': { state: 'off' },
      'input_boolean.semester': { state: 'off' },
    };
    expect(resolveAwayModeEntityId(entities)).toBeNull();
    expect(listAwayModeCandidates(entities)).toEqual([
      'input_boolean.away',
      'input_boolean.semester',
    ]);
  });
});

describe('AwayModeChip', () => {
  it('asks for confirmation before turning away mode on', () => {
    const callService = vi.fn().mockResolvedValue(undefined);
    render(
      <AwayModeChip
        entityId="input_boolean.bortalage"
        entity={{ state: 'off' }}
        callService={callService}
        t={t}
      />
    );

    fireEvent.click(screen.getByTestId('away-mode-chip'));
    expect(callService).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'away.turnOn' }));
    expect(callService).toHaveBeenCalledWith('input_boolean', 'turn_on', {
      entity_id: 'input_boolean.bortalage',
    });
  });

  it('turns away mode off with one tap', () => {
    const callService = vi.fn().mockResolvedValue(undefined);
    render(
      <AwayModeChip
        entityId="input_boolean.bortalage"
        entity={{ state: 'on' }}
        callService={callService}
        t={t}
      />
    );

    const chip = screen.getByTestId('away-mode-chip');
    expect(chip).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(chip);
    expect(callService).toHaveBeenCalledWith('input_boolean', 'turn_off', {
      entity_id: 'input_boolean.bortalage',
    });
  });
});

describe('AwayModeBanner', () => {
  it('only shows while away mode is on', () => {
    const { rerender } = render(
      <AwayModeBanner entityId="input_boolean.bortalage" entity={{ state: 'off' }} t={t} />
    );
    expect(screen.queryByTestId('away-mode-banner')).not.toBeInTheDocument();

    rerender(<AwayModeBanner entityId="input_boolean.bortalage" entity={{ state: 'on' }} t={t} />);
    expect(screen.getByTestId('away-mode-banner')).toBeInTheDocument();
  });
});
