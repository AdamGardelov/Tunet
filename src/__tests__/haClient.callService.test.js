import { describe, expect, it, vi } from 'vitest';
import { callService } from '../services/haClient';

describe('haClient.callService', () => {
  it('sends entity ids as a Home Assistant target', async () => {
    const sendMessagePromise = vi.fn().mockResolvedValue(undefined);

    await callService({ sendMessagePromise }, 'climate', 'set_temperature', {
      entity_id: 'climate.stora_sovrummet',
      temperature: 16,
    });

    expect(sendMessagePromise).toHaveBeenCalledWith({
      type: 'call_service',
      domain: 'climate',
      service: 'set_temperature',
      target: { entity_id: 'climate.stora_sovrummet' },
      service_data: { temperature: 16 },
    });
  });

  it('keeps an explicit target and removes legacy entity_id data', async () => {
    const sendMessagePromise = vi.fn().mockResolvedValue(undefined);

    await callService({ sendMessagePromise }, 'light', 'turn_on', {
      target: { area_id: 'kitchen' },
      entity_id: 'light.legacy',
      brightness_pct: 40,
    });

    expect(sendMessagePromise).toHaveBeenCalledWith({
      type: 'call_service',
      domain: 'light',
      service: 'turn_on',
      target: { area_id: 'kitchen' },
      service_data: { brightness_pct: 40 },
    });
  });

  it('keeps data-only service calls unchanged', async () => {
    const sendMessagePromise = vi.fn().mockResolvedValue(undefined);

    await callService({ sendMessagePromise }, 'notify', 'mobile_app', { message: 'Hello' });

    expect(sendMessagePromise).toHaveBeenCalledWith({
      type: 'call_service',
      domain: 'notify',
      service: 'mobile_app',
      service_data: { message: 'Hello' },
    });
  });
});
