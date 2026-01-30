import { useSyncExternalStore } from 'react';

export type PresenceUser = {
  id: string;
  name: string;
  email: string;
  image: string | null;
  joinedAt: number;
  isActive: boolean;
};

export type ContentState = {
  systemMessage: string;
  userMessage: string;
  version: number;
};

export type CursorPosition = {
  userId: string;
  userName: string;
  field: 'systemMessage' | 'userMessage';
  position: number;
  textareaWidth: number;
  isActive: boolean;
};

type PresenceState = {
  users: PresenceUser[];
  isConnected: boolean;
  error: string | null;
  contentState: ContentState;
  cursors: Map<string, CursorPosition>;
};

type ServerMessage =
  | { type: 'presence'; users: PresenceUser[] }
  | { type: 'user_joined'; user: PresenceUser }
  | { type: 'user_left'; userId: string }
  | { type: 'user_active'; userId: string; isActive: boolean }
  | { type: 'pong' }
  | {
      type: 'content_sync';
      field: 'systemMessage' | 'userMessage';
      value: string;
      version: number;
      userId: string;
    }
  | {
      type: 'content_state';
      systemMessage: string;
      userMessage: string;
      version: number;
    }
  | {
      type: 'cursor_sync';
      userId: string;
      userName: string;
      field: 'systemMessage' | 'userMessage';
      position: number;
      textareaWidth: number;
      isActive: boolean;
    }
  | {
      type: 'cursor_state';
      cursors: Array<{
        userId: string;
        userName: string;
        field: 'systemMessage' | 'userMessage';
        position: number;
        textareaWidth: number;
        isActive: boolean;
      }>;
    };

// Content sync callback for collaborative editing
export type ContentSyncCallback = (
  field: 'systemMessage' | 'userMessage',
  value: string,
  version: number,
  userId: string,
) => void;

// Cursor sync callback for cursor visualization
export type CursorSyncCallback = (cursor: CursorPosition) => void;

// Event callback types for presence notifications
export type PresenceEventCallbacks = {
  onUserJoined?: (user: PresenceUser) => void;
  onInitialPresence?: (users: PresenceUser[]) => void;
  onContentSync?: ContentSyncCallback;
  onContentState?: (state: ContentState) => void;
  onCursorSync?: CursorSyncCallback;
  onCursorState?: (cursors: CursorPosition[]) => void;
};

// Module-level state
const stateByPromptId = new Map<string, PresenceState>();
const socketByPromptId = new Map<string, WebSocket>();
const subscribersByPromptId = new Map<string, Set<() => void>>();
const eventCallbacksByPromptId = new Map<string, Set<PresenceEventCallbacks>>();
const reconnectTimeoutByPromptId = new Map<
  string,
  ReturnType<typeof setTimeout>
>();
const retryCountByPromptId = new Map<string, number>();

// Exponential backoff: 3s, 6s, 12s, 24s, max 60s
const getRetryDelay = (retryCount: number): number => {
  const baseDelay = 3000;
  const maxDelay = 60000;
  return Math.min(baseDelay * 2 ** retryCount, maxDelay);
};

const DEFAULT_STATE: PresenceState = {
  users: [],
  isConnected: false,
  error: null,
  contentState: {
    systemMessage: '',
    userMessage: '',
    version: 0,
  },
  cursors: new Map(),
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

const fireEventCallbacks = (
  promptId: string,
  event:
    | 'userJoined'
    | 'initialPresence'
    | 'contentSync'
    | 'contentState'
    | 'cursorSync'
    | 'cursorState',
  payload:
    | PresenceUser
    | PresenceUser[]
    | {
        field: 'systemMessage' | 'userMessage';
        value: string;
        version: number;
        userId: string;
      }
    | ContentState
    | CursorPosition
    | CursorPosition[],
): void => {
  const callbacks = eventCallbacksByPromptId.get(promptId);
  if (!callbacks) return;

  for (const cb of callbacks) {
    if (event === 'userJoined' && cb.onUserJoined) {
      cb.onUserJoined(payload as PresenceUser);
    } else if (event === 'initialPresence' && cb.onInitialPresence) {
      cb.onInitialPresence(payload as PresenceUser[]);
    } else if (event === 'contentSync' && cb.onContentSync) {
      const syncPayload = payload as {
        field: 'systemMessage' | 'userMessage';
        value: string;
        version: number;
        userId: string;
      };
      cb.onContentSync(
        syncPayload.field,
        syncPayload.value,
        syncPayload.version,
        syncPayload.userId,
      );
    } else if (event === 'contentState' && cb.onContentState) {
      cb.onContentState(payload as ContentState);
    } else if (event === 'cursorSync' && cb.onCursorSync) {
      cb.onCursorSync(payload as CursorPosition);
    } else if (event === 'cursorState' && cb.onCursorState) {
      cb.onCursorState(payload as CursorPosition[]);
    }
  }
};

const handleMessage = (promptId: string, data: ServerMessage): void => {
  const current = getState(promptId);

  switch (data.type) {
    case 'presence':
      updateState(promptId, { users: data.users });
      // Fire initial presence callback if there are users
      if (data.users.length > 0) {
        fireEventCallbacks(promptId, 'initialPresence', data.users);
      }
      break;

    case 'user_joined':
      updateState(promptId, {
        users: [
          ...current.users.filter((u) => u.id !== data.user.id),
          data.user,
        ],
      });
      // Fire user joined callback
      fireEventCallbacks(promptId, 'userJoined', data.user);
      break;

    case 'user_left': {
      const newCursors = new Map(current.cursors);
      newCursors.delete(data.userId);
      updateState(promptId, {
        users: current.users.filter((u) => u.id !== data.userId),
        cursors: newCursors,
      });
      break;
    }

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

    case 'content_state':
      updateState(promptId, {
        contentState: {
          systemMessage: data.systemMessage,
          userMessage: data.userMessage,
          version: data.version,
        },
      });
      fireEventCallbacks(promptId, 'contentState', {
        systemMessage: data.systemMessage,
        userMessage: data.userMessage,
        version: data.version,
      });
      break;

    case 'content_sync':
      // Update local content state
      updateState(promptId, {
        contentState: {
          ...current.contentState,
          [data.field]: data.value,
          version: data.version,
        },
      });
      // Fire callback for component to handle
      fireEventCallbacks(promptId, 'contentSync', {
        field: data.field,
        value: data.value,
        version: data.version,
        userId: data.userId,
      });
      break;

    case 'cursor_sync': {
      const cursorData: CursorPosition = {
        userId: data.userId,
        userName: data.userName,
        field: data.field,
        position: data.position,
        textareaWidth: data.textareaWidth,
        isActive: data.isActive,
      };
      const newCursors = new Map(current.cursors);
      newCursors.set(data.userId, cursorData);
      updateState(promptId, { cursors: newCursors });
      fireEventCallbacks(promptId, 'cursorSync', cursorData);
      break;
    }

    case 'cursor_state': {
      const cursorsMap = new Map<string, CursorPosition>();
      for (const cursor of data.cursors) {
        cursorsMap.set(cursor.userId, {
          userId: cursor.userId,
          userName: cursor.userName,
          field: cursor.field,
          position: cursor.position,
          textareaWidth: cursor.textareaWidth,
          isActive: cursor.isActive,
        });
      }
      updateState(promptId, { cursors: cursorsMap });
      fireEventCallbacks(
        promptId,
        'cursorState',
        data.cursors as CursorPosition[],
      );
      break;
    }
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
    // Reset retry count on successful connection
    retryCountByPromptId.delete(promptId);

    // Send init message to request current presence list
    // This follows the Cloudflare best practice of client-initiated data exchange
    socket.send(JSON.stringify({ type: 'init' }));

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

    // Reconnect if there are still subscribers (with exponential backoff)
    const subscribers = subscribersByPromptId.get(promptId);
    if (subscribers && subscribers.size > 0) {
      const retryCount = retryCountByPromptId.get(promptId) ?? 0;
      const delay = getRetryDelay(retryCount);
      retryCountByPromptId.set(promptId, retryCount + 1);

      const timeout = setTimeout(() => {
        reconnectTimeoutByPromptId.delete(promptId);
        connect(promptId);
      }, delay);
      reconnectTimeoutByPromptId.set(promptId, timeout);
    }
  };

  socket.onerror = () => {
    updateState(promptId, { error: 'Connection error' });
  };
};

// Debounce disconnect to handle React Strict Mode double mount/unmount
const disconnectTimeoutByPromptId = new Map<
  string,
  ReturnType<typeof setTimeout>
>();

const disconnect = (promptId: string): void => {
  // Clear any pending disconnect
  const existingDisconnect = disconnectTimeoutByPromptId.get(promptId);
  if (existingDisconnect) {
    clearTimeout(existingDisconnect);
  }

  // Debounce the actual disconnect by 100ms to handle React Strict Mode
  const timeout = setTimeout(() => {
    disconnectTimeoutByPromptId.delete(promptId);

    // Check again if there are subscribers (component may have remounted)
    const subscribers = subscribersByPromptId.get(promptId);
    if (subscribers && subscribers.size > 0) {
      return; // Don't disconnect, component remounted
    }

    const socket = socketByPromptId.get(promptId);
    if (socket) {
      socket.close();
      socketByPromptId.delete(promptId);
    }

    const reconnectTimeout = reconnectTimeoutByPromptId.get(promptId);
    if (reconnectTimeout) {
      clearTimeout(reconnectTimeout);
      reconnectTimeoutByPromptId.delete(promptId);
    }

    retryCountByPromptId.delete(promptId);
    stateByPromptId.delete(promptId);
  }, 100);

  disconnectTimeoutByPromptId.set(promptId, timeout);
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

const sendContentUpdate = (
  promptId: string,
  field: 'systemMessage' | 'userMessage',
  value: string,
): void => {
  const socket = socketByPromptId.get(promptId);
  if (socket?.readyState === WebSocket.OPEN) {
    socket.send(
      JSON.stringify({
        type: 'content_update',
        field,
        value,
      }),
    );
  }
};

const sendCursorUpdate = (
  promptId: string,
  field: 'systemMessage' | 'userMessage',
  position: number,
  textareaWidth: number,
): void => {
  const socket = socketByPromptId.get(promptId);
  if (socket?.readyState === WebSocket.OPEN) {
    socket.send(
      JSON.stringify({
        type: 'cursor_update',
        field,
        position,
        textareaWidth,
      }),
    );
  }
};

const subscribeToEvents = (
  promptId: string,
  callbacks: PresenceEventCallbacks,
): (() => void) => {
  let callbackSet = eventCallbacksByPromptId.get(promptId);
  if (!callbackSet) {
    callbackSet = new Set();
    eventCallbacksByPromptId.set(promptId, callbackSet);
  }

  callbackSet.add(callbacks);

  return () => {
    callbackSet?.delete(callbacks);
    if (callbackSet?.size === 0) {
      eventCallbacksByPromptId.delete(promptId);
    }
  };
};

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
    contentState: state.contentState,
    cursors: state.cursors,
    subscribeToEvents: promptId
      ? (callbacks: PresenceEventCallbacks) =>
          subscribeToEvents(promptId, callbacks)
      : undefined,
    sendContentUpdate: promptId
      ? (field: 'systemMessage' | 'userMessage', value: string) =>
          sendContentUpdate(promptId, field, value)
      : undefined,
    sendCursorUpdate: promptId
      ? (
          field: 'systemMessage' | 'userMessage',
          position: number,
          textareaWidth: number,
        ) => sendCursorUpdate(promptId, field, position, textareaWidth)
      : undefined,
  };
};
