import { useSyncExternalStore } from 'react';

export type PresenceUser = {
  id: string;
  name: string;
  email: string;
  image: string | null;
  joinedAt: number;
  isActive: boolean;
};

type PresenceState = {
  users: PresenceUser[];
  isConnected: boolean;
  error: string | null;
};

type ServerMessage =
  | { type: 'presence'; users: PresenceUser[] }
  | { type: 'user_joined'; user: PresenceUser }
  | { type: 'user_left'; userId: string }
  | { type: 'user_active'; userId: string; isActive: boolean }
  | { type: 'pong' };

// Module-level state
const stateByPromptId = new Map<string, PresenceState>();
const socketByPromptId = new Map<string, WebSocket>();
const subscribersByPromptId = new Map<string, Set<() => void>>();
const reconnectTimeoutByPromptId = new Map<
  string,
  ReturnType<typeof setTimeout>
>();

const DEFAULT_STATE: PresenceState = {
  users: [],
  isConnected: false,
  error: null,
};

const getState = (promptId: string): PresenceState => {
  return stateByPromptId.get(promptId) ?? DEFAULT_STATE;
};

const setState = (promptId: string, state: PresenceState): void => {
  stateByPromptId.set(promptId, state);
  const subscribers = subscribersByPromptId.get(promptId);
  if (subscribers) {
    for (const callback of subscribers) {
      callback();
    }
  }
};

const updateState = (
  promptId: string,
  updates: Partial<PresenceState>,
): void => {
  const current = getState(promptId);
  setState(promptId, { ...current, ...updates });
};

const handleMessage = (promptId: string, data: ServerMessage): void => {
  const current = getState(promptId);

  switch (data.type) {
    case 'presence':
      updateState(promptId, { users: data.users });
      break;

    case 'user_joined':
      updateState(promptId, {
        users: [
          ...current.users.filter((u) => u.id !== data.user.id),
          data.user,
        ],
      });
      break;

    case 'user_left':
      updateState(promptId, {
        users: current.users.filter((u) => u.id !== data.userId),
      });
      break;

    case 'user_active':
      updateState(promptId, {
        users: current.users.map((u) =>
          u.id === data.userId ? { ...u, isActive: data.isActive } : u,
        ),
      });
      break;

    case 'pong':
      // Heartbeat response, no state change needed
      break;
  }
};

const connect = (promptId: string): void => {
  // Don't reconnect if already connected
  if (socketByPromptId.has(promptId)) return;

  // Clear any pending reconnect
  const existingTimeout = reconnectTimeoutByPromptId.get(promptId);
  if (existingTimeout) {
    clearTimeout(existingTimeout);
    reconnectTimeoutByPromptId.delete(promptId);
  }

  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const wsUrl = `${protocol}//${window.location.host}/api/presence/${promptId}`;

  const socket = new WebSocket(wsUrl);
  socketByPromptId.set(promptId, socket);

  socket.onopen = () => {
    updateState(promptId, { isConnected: true, error: null });

    // Start heartbeat
    const pingInterval = setInterval(() => {
      if (socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ type: 'ping' }));
      }
    }, 30000);

    socket.addEventListener('close', () => clearInterval(pingInterval), {
      once: true,
    });

    // Track tab focus state
    const handleVisibilityChange = () => {
      if (socket.readyState === WebSocket.OPEN) {
        socket.send(
          JSON.stringify({
            type: 'focus',
            isActive: document.visibilityState === 'visible',
          }),
        );
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    socket.addEventListener(
      'close',
      () =>
        document.removeEventListener(
          'visibilitychange',
          handleVisibilityChange,
        ),
      { once: true },
    );
  };

  socket.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data) as ServerMessage;
      handleMessage(promptId, data);
    } catch {
      // Ignore malformed messages
    }
  };

  socket.onclose = () => {
    socketByPromptId.delete(promptId);
    updateState(promptId, { isConnected: false });

    // Reconnect if there are still subscribers
    const subscribers = subscribersByPromptId.get(promptId);
    if (subscribers && subscribers.size > 0) {
      const timeout = setTimeout(() => {
        reconnectTimeoutByPromptId.delete(promptId);
        connect(promptId);
      }, 3000);
      reconnectTimeoutByPromptId.set(promptId, timeout);
    }
  };

  socket.onerror = () => {
    updateState(promptId, { error: 'Connection error' });
  };
};

const disconnect = (promptId: string): void => {
  const socket = socketByPromptId.get(promptId);
  if (socket) {
    socket.close();
    socketByPromptId.delete(promptId);
  }

  const timeout = reconnectTimeoutByPromptId.get(promptId);
  if (timeout) {
    clearTimeout(timeout);
    reconnectTimeoutByPromptId.delete(promptId);
  }

  stateByPromptId.delete(promptId);
};

const subscribe = (promptId: string, callback: () => void): (() => void) => {
  let subscribers = subscribersByPromptId.get(promptId);
  if (!subscribers) {
    subscribers = new Set();
    subscribersByPromptId.set(promptId, subscribers);
  }

  const wasEmpty = subscribers.size === 0;
  subscribers.add(callback);

  // Connect when first subscriber joins
  if (wasEmpty) {
    connect(promptId);
  }

  return () => {
    subscribers?.delete(callback);

    // Disconnect when last subscriber leaves
    if (subscribers?.size === 0) {
      subscribersByPromptId.delete(promptId);
      disconnect(promptId);
    }
  };
};

const getServerSnapshot = (): PresenceState => DEFAULT_STATE;

export const usePresence = (promptId: string | undefined) => {
  const state = useSyncExternalStore(
    (callback) => {
      if (!promptId) return () => {};
      return subscribe(promptId, callback);
    },
    () => (promptId ? getState(promptId) : DEFAULT_STATE),
    getServerSnapshot,
  );

  return {
    users: state.users,
    isConnected: state.isConnected,
    error: state.error,
  };
};
