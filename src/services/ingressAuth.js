const INGRESS_PATH_PATTERN = /(.*\/api\/hassio_ingress\/[^/]+)/;

export const buildIngressWebSocketUrl = (location = globalThis.window?.location) => {
  if (!location) return '';

  const ingressMatch = INGRESS_PATH_PATTERN.exec(location.pathname || '');
  if (!ingressMatch?.[1]) return '';

  const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${location.host}${ingressMatch[1]}/api/ha-websocket`;
};

export const createIngressAuth = (location = globalThis.window?.location) => {
  const wsUrl = buildIngressWebSocketUrl(location);
  if (!wsUrl) return null;

  return {
    wsUrl,
    // Authentication is performed by Home Assistant Supervisor before the
    // request reaches Tunet. The backend replaces this placeholder and never
    // exposes its Supervisor credential to the browser.
    accessToken: 'supervisor-ingress',
    expired: false,
    refreshAccessToken: async () => {},
    revoke: async () => {},
    data: {
      hassUrl: location.origin || `${location.protocol}//${location.host}`,
      clientId: null,
      expires: Number.MAX_SAFE_INTEGER,
      refresh_token: '',
      access_token: 'supervisor-ingress',
      expires_in: Number.MAX_SAFE_INTEGER,
    },
  };
};

export const fetchIngressSessionUser = async (fetchImpl = globalThis.fetch) => {
  if (typeof fetchImpl !== 'function') {
    throw new Error('Fetch is unavailable');
  }

  const response = await fetchImpl('./api/session', {
    credentials: 'same-origin',
    headers: { Accept: 'application/json' },
  });
  if (!response.ok) {
    throw new Error(`Ingress session lookup failed (${response.status})`);
  }

  const payload = await response.json();
  return payload?.user || null;
};
