import { describe, expect, it, vi } from 'vitest';
import {
  buildIngressWebSocketUrl,
  createIngressAuth,
  fetchIngressSessionUser,
  isIngressLocation,
} from '../services/ingressAuth';

describe('ingress authentication', () => {
  it('builds a same-origin websocket URL through the current ingress session', () => {
    const location = {
      protocol: 'https:',
      host: 'example.ui.nabu.casa',
      pathname: '/api/hassio_ingress/session-token/#/page/home',
    };

    expect(buildIngressWebSocketUrl(location)).toBe(
      'wss://example.ui.nabu.casa/api/hassio_ingress/session-token/api/ha-websocket'
    );
    expect(isIngressLocation(location)).toBe(true);
    expect(createIngressAuth(location)).toMatchObject({
      accessToken: 'supervisor-ingress',
      expired: false,
    });
  });

  it('does not create ingress credentials outside an ingress route', () => {
    const location = {
      protocol: 'http:',
      host: 'homeassistant.local:8123',
      pathname: '/dashboard-test/0',
    };

    expect(buildIngressWebSocketUrl(location)).toBe('');
    expect(isIngressLocation(location)).toBe(false);
    expect(createIngressAuth(location)).toBeNull();
  });

  it('loads the human Home Assistant user from the authenticated ingress session', async () => {
    const user = { id: 'adam-user', name: 'Adam', is_admin: true };
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ user }),
    });

    await expect(fetchIngressSessionUser(fetchImpl)).resolves.toEqual(user);
    expect(fetchImpl).toHaveBeenCalledWith('./api/session', {
      credentials: 'same-origin',
      headers: { Accept: 'application/json' },
    });
  });

  it('rejects a failed ingress session lookup', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: false, status: 401 });
    await expect(fetchIngressSessionUser(fetchImpl)).rejects.toThrow(
      'Ingress session lookup failed (401)'
    );
  });
});
