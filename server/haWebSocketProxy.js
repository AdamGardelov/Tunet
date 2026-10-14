import { WebSocket, WebSocketServer } from 'ws';
import { isTrustedSupervisorIngressRequest } from './haAuth.js';

const DEFAULT_UPSTREAM_URL = 'ws://supervisor/core/websocket';
const PROXY_PATH = '/api/ha-websocket';

const closeSocket = (socket, code = 1011, reason = 'Home Assistant connection closed') => {
  if (!socket || socket.readyState === WebSocket.CLOSED) return;

  try {
    socket.close(code, reason);
  } catch {
    try {
      socket.terminate?.();
    } catch {
      // Ignore shutdown errors.
    }
  }
};

export const getWebSocketProxyPath = (req) => {
  let requestPath = '/';

  try {
    requestPath = new URL(req.url || '/', 'http://localhost').pathname;
  } catch {
    return '/';
  }

  const ingressPath = req.headers?.['x-ingress-path'];
  if (typeof ingressPath === 'string' && requestPath.startsWith(ingressPath)) {
    requestPath = requestPath.slice(ingressPath.length) || '/';
  }

  return requestPath;
};

export const attachHomeAssistantWebSocketProxy = (
  server,
  {
    supervisorToken = process.env.SUPERVISOR_TOKEN,
    upstreamUrl = process.env.TUNET_INTERNAL_HA_WS_URL || DEFAULT_UPSTREAM_URL,
    createUpstreamSocket = (url, options) => new WebSocket(url, options),
  } = {}
) => {
  const webSocketServer = new WebSocketServer({ noServer: true });

  server.on('upgrade', (req, socket, head) => {
    if (getWebSocketProxyPath(req) !== PROXY_PATH) {
      socket.destroy();
      return;
    }

    if (!supervisorToken || !isTrustedSupervisorIngressRequest(req)) {
      socket.write('HTTP/1.1 401 Unauthorized\r\nConnection: close\r\n\r\n');
      socket.destroy();
      return;
    }

    webSocketServer.handleUpgrade(req, socket, head, (clientSocket) => {
      webSocketServer.emit('connection', clientSocket, req);
    });
  });

  webSocketServer.on('connection', (clientSocket) => {
    const upstreamSocket = createUpstreamSocket(upstreamUrl, {
      headers: { Authorization: `Bearer ${supervisorToken}` },
    });
    const queuedMessages = [];

    upstreamSocket.on('open', () => {
      upstreamSocket.send(
        JSON.stringify({
          type: 'auth',
          access_token: supervisorToken,
        })
      );

      queuedMessages.splice(0).forEach((message) => upstreamSocket.send(message));
    });

    clientSocket.on('message', (data, isBinary) => {
      if (isBinary) return;

      const message = data.toString();
      try {
        if (JSON.parse(message)?.type === 'auth') {
          // The browser authenticates to this endpoint through Supervisor
          // ingress. Never forward its placeholder token upstream.
          return;
        }
      } catch {
        closeSocket(clientSocket, 1003, 'Invalid Home Assistant message');
        return;
      }

      if (upstreamSocket.readyState === WebSocket.OPEN) {
        upstreamSocket.send(message);
      } else if (upstreamSocket.readyState === WebSocket.CONNECTING) {
        queuedMessages.push(message);
      }
    });

    upstreamSocket.on('message', (data, isBinary) => {
      if (clientSocket.readyState === WebSocket.OPEN) {
        clientSocket.send(data, { binary: isBinary });
      }
    });

    upstreamSocket.on('close', () => closeSocket(clientSocket));
    upstreamSocket.on('error', () => closeSocket(clientSocket));
    clientSocket.on('close', () => closeSocket(upstreamSocket, 1000, 'Client disconnected'));
    clientSocket.on('error', () => closeSocket(upstreamSocket, 1000, 'Client disconnected'));
  });

  return webSocketServer;
};
