import { describe, expect, it } from 'vitest';
import { buildIngressWebSocketUrl, createIngressAuth } from '../services/ingressAuth';

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
    expect(createIngressAuth(location)).toBeNull();
  });
});
