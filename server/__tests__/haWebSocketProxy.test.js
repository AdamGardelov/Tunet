// @vitest-environment node

import { createServer } from 'node:http';
import { once } from 'node:events';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { WebSocket, WebSocketServer } from 'ws';
import { attachHomeAssistantWebSocketProxy, getWebSocketProxyPath } from '../haWebSocketProxy.js';

const servers = [];

const listen = async (server) => {
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  servers.push(server);
  return server.address().port;
};

const waitForJson = (socket, predicate) =>
  new Promise((resolve, reject) => {
    const timeout = setTimeout(
      () => reject(new Error('Timed out waiting for websocket message')),
      2000
    );
    const handleMessage = (data) => {
      const message = JSON.parse(data.toString());
      if (!predicate(message)) return;
      clearTimeout(timeout);
      socket.off('message', handleMessage);
      resolve(message);
    };
    socket.on('message', handleMessage);
  });

beforeEach(() => {
  process.env.TUNET_TRUST_SUPERVISOR_INGRESS = '1';
});

afterEach(async () => {
  delete process.env.TUNET_TRUST_SUPERVISOR_INGRESS;
  while (servers.length) {
    const server = servers.pop();
    await new Promise((resolve) => server.close(resolve));
  }
});

describe('Home Assistant websocket proxy', () => {
  it('normalizes websocket paths behind Supervisor ingress', () => {
    expect(
      getWebSocketProxyPath({
        url: '/api/hassio_ingress/session/api/ha-websocket?cache=1',
        headers: { 'x-ingress-path': '/api/hassio_ingress/session' },
      })
    ).toBe('/api/ha-websocket');
  });

  it('authenticates upstream with the Supervisor token and never forwards the placeholder', async () => {
    const upstreamHttp = createServer();
    const upstreamWss = new WebSocketServer({ noServer: true });
    const receivedMessages = [];

    upstreamHttp.on('upgrade', (req, socket, head) => {
      expect(req.headers.authorization).toBe('Bearer supervisor-secret');
      upstreamWss.handleUpgrade(req, socket, head, (ws) => upstreamWss.emit('connection', ws));
    });
    upstreamWss.on('connection', (ws) => {
      ws.send(JSON.stringify({ type: 'auth_required', ha_version: '2026.10.0' }));
      ws.on('message', (data) => {
        const message = JSON.parse(data.toString());
        receivedMessages.push(message);
        if (message.type === 'auth') {
          ws.send(JSON.stringify({ type: 'auth_ok', ha_version: '2026.10.0' }));
        } else {
          ws.send(JSON.stringify({ id: message.id, type: 'result', success: true, result: {} }));
        }
      });
    });
    const upstreamPort = await listen(upstreamHttp);

    const proxyHttp = createServer((_req, res) => res.end('ok'));
    attachHomeAssistantWebSocketProxy(proxyHttp, {
      supervisorToken: 'supervisor-secret',
      upstreamUrl: `ws://127.0.0.1:${upstreamPort}/core/websocket`,
    });
    const proxyPort = await listen(proxyHttp);

    const client = new WebSocket(`ws://127.0.0.1:${proxyPort}/api/ha-websocket`, {
      headers: {
        'x-ingress-path': '/api/hassio_ingress/session',
        'x-remote-user-id': 'user-123',
      },
    });
    await once(client, 'open');
    client.send(JSON.stringify({ type: 'auth', access_token: 'supervisor-ingress' }));
    await waitForJson(client, (message) => message.type === 'auth_ok');
    client.send(JSON.stringify({ id: 1, type: 'get_states' }));
    await expect(waitForJson(client, (message) => message.id === 1)).resolves.toMatchObject({
      success: true,
    });

    expect(receivedMessages).toContainEqual({
      type: 'auth',
      access_token: 'supervisor-secret',
    });
    expect(receivedMessages).not.toContainEqual({
      type: 'auth',
      access_token: 'supervisor-ingress',
    });

    client.close();
    upstreamWss.close();
  });
});
