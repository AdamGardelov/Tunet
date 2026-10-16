import { act, fireEvent, render, renderHook, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import M3Slider from '../components/ui/M3Slider';
import useHeldValue from '../hooks/useHeldValue';
import {
  brightnessToStepPct,
  getWarmthPresets,
  nearestWarmthIndex,
  snapBrightnessPct,
} from '../utils/lightSteps';

describe('light steps', () => {
  it('snaps brightness to 10 % steps without ever reaching 0', () => {
    expect(snapBrightnessPct(0)).toBe(10);
    expect(snapBrightnessPct(44)).toBe(40);
    expect(snapBrightnessPct(46)).toBe(50);
    expect(snapBrightnessPct(120)).toBe(100);
    expect(brightnessToStepPct(64)).toBe(30);
    expect(brightnessToStepPct(255)).toBe(100);
    expect(brightnessToStepPct(undefined)).toBe(10);
  });

  it('keeps only the warmth presets a light can show', () => {
    expect(getWarmthPresets(2000, 6500).map((p) => p.kelvin)).toEqual([
      2200, 2700, 3500, 4500, 6500,
    ]);
    expect(getWarmthPresets(2700, 4000).map((p) => p.key)).toEqual(['warm', 'neutral']);
    expect(getWarmthPresets(3000, 3200)).toEqual([
      { key: 'warm', kelvin: 3000 },
      { key: 'cool', kelvin: 3200 },
    ]);
  });

  it('finds the closest preset for a reported colour temperature', () => {
    const presets = getWarmthPresets(2000, 6500);
    expect(nearestWarmthIndex(2136, presets)).toBe(0);
    expect(nearestWarmthIndex(3300, presets)).toBe(2);
    expect(nearestWarmthIndex(6000, presets)).toBe(4);
  });
});

describe('useHeldValue', () => {
  it('shows a sent value until the device reports it, then follows the device', () => {
    const { result, rerender } = renderHook(({ remote }) => useHeldValue(remote), {
      initialProps: { remote: 30 },
    });
    act(() => result.current[1](80));
    expect(result.current[0]).toBe(80);

    // A slow device reports an in-between value: the control does not jump back.
    rerender({ remote: 50 });
    expect(result.current[0]).toBe(80);

    rerender({ remote: 80 });
    expect(result.current[0]).toBe(80);
    rerender({ remote: 60 });
    expect(result.current[0]).toBe(60);
  });

  it('gives up holding after the timeout', () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useHeldValue(30, { holdMs: 1000 }));
    act(() => result.current[1](80));
    act(() => vi.advanceTimersByTime(1100));
    expect(result.current[0]).toBe(30);
    vi.useRealTimers();
  });
});

describe('M3Slider onCommit', () => {
  it('commits once per gesture with the released value', () => {
    const onCommit = vi.fn();
    render(
      <M3Slider min={10} max={100} step={10} value={30} onCommit={onCommit} ariaLabel="Ljus" />
    );
    const slider = screen.getByRole('slider', { name: 'Ljus' });

    fireEvent.pointerDown(slider);
    fireEvent.change(slider, { target: { value: '50' } });
    fireEvent.change(slider, { target: { value: '70' } });
    expect(onCommit).not.toHaveBeenCalled();

    fireEvent.pointerUp(slider);
    fireEvent.mouseUp(slider);
    fireEvent.touchEnd(slider);
    expect(onCommit).toHaveBeenCalledTimes(1);
    expect(onCommit).toHaveBeenCalledWith(70);
  });

  it('does not commit when the value was not changed', () => {
    const onCommit = vi.fn();
    render(
      <M3Slider min={10} max={100} step={10} value={30} onCommit={onCommit} ariaLabel="Ljus" />
    );
    fireEvent.pointerUp(screen.getByRole('slider', { name: 'Ljus' }));
    expect(onCommit).not.toHaveBeenCalled();
  });
});
