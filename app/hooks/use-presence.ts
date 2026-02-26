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
      type: 'content_diff_sync';
      field: 'systemMessage' | 'userMessage';
      position: number;
      deleteCount: number;
      insertText: string;
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

// Content diff type for efficient sync
export type ContentDiff = {
  field: 'systemMessage' | 'userMessage';
  position: number;
  deleteCount: number;
  insertText: string;
};

// Content sync callback for collaborative editing
export type ContentSyncCallback = (
  field: 'systemMessage' | 'userMessage',
  value: string,
  version: number,
  userId: string,
) => void;

// Content diff sync callback
export type ContentDiffSyncCallback = (
  diff: ContentDiff,
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
  onContentDiffSync?: ContentDiffSyncCallback;
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

// Exponential backoff with 50% jitter: prevents reconnection storms after deploys
const getRetryDelay = (retryCount: number): number => {
  const baseDelay = 3000;
  const maxDelay = 60000;
  const exponentialDelay = Math.min(baseDelay * 2 ** retryCount, maxDelay);
  const jitter = 0.5 + Math.random(); // 0.5x to 1.5x
  return Math.floor(exponentialDelay * jitter);
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
    | 'contentDiffSync'
    | 'contentState'
    | 'cursorSync'
    | 'cursorState',
  // biome-ignore lint/suspicious/noExplicitAny: union type for all event payloads
  payload: any,
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
    } else if (event === 'contentDiffSync' && cb.onContentDiffSync) {
      const diffPayload = payload as {
        diff: ContentDiff;
        version: number;
        userId: string;
      };
      cb.onContentDiffSync(
        diffPayload.diff,
        diffPayload.version,
        diffPayload.userId,
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
      // Full-text sync (used for paste, undo/redo, or large changes)
      updateState(promptId, {
        contentState: {
          ...current.contentState,
          [data.field]: data.value,
          version: data.version,
        },
      });
      fireEventCallbacks(promptId, 'contentSync', {
        field: data.field,
        value: data.value,
        version: data.version,
        userId: data.userId,
      });
      break;

    case 'content_diff_sync': {
      // Apply positional diff to local content state
      const currentText = current.contentState[data.field];
      const newText =
        currentText.slice(0, data.position) +
        data.insertText +
        currentText.slice(data.position + data.deleteCount);
      updateState(promptId, {
        contentState: {
          ...current.contentState,
          [data.field]: newText,
          version: data.version,
        },
      });
      fireEventCallbacks(promptId, 'contentDiffSync', {
        diff: {
          field: data.field,
          position: data.position,
          deleteCount: data.deleteCount,
          insertText: data.insertText,
        },
        version: data.version,
        userId: data.userId,
      });
      break;
    }

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

    // Clean up throttle timers and cached values
    for (const [key, timer] of contentThrottleByKey) {
      if (key.startsWith(`${promptId}:`)) {
        clearTimeout(timer);
        contentThrottleByKey.delete(key);
        pendingContentByKey.delete(key);
      }
    }
    for (const key of prevValueByPromptField.keys()) {
      if (key.startsWith(`${promptId}:`)) {
        prevValueByPromptField.delete(key);
      }
    }
    const cursorTimer = cursorThrottleByPromptId.get(promptId);
    if (cursorTimer) {
      clearTimeout(cursorTimer);
      cursorThrottleByPromptId.delete(promptId);
    }
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

// Track previous values per field for diff computation
const prevValueByPromptField = new Map<string, string>();

const computeDiff = (
  oldVal: string,
  newVal: string,
): { position: number; deleteCount: number; insertText: string } => {
  let start = 0;
  while (
    start < oldVal.length &&
    start < newVal.length &&
    oldVal[start] === newVal[start]
  ) {
    start++;
  }
  let oldEnd = oldVal.length;
  let newEnd = newVal.length;
  while (
    oldEnd > start &&
    newEnd > start &&
    oldVal[oldEnd - 1] === newVal[newEnd - 1]
  ) {
    oldEnd--;
    newEnd--;
  }
  return {
    position: start,
    deleteCount: oldEnd - start,
    insertText: newVal.slice(start, newEnd),
  };
};

// Content throttle: 100ms leading-edge throttle
const contentThrottleByKey = new Map<string, ReturnType<typeof setTimeout>>();
const pendingContentByKey = new Map<
  string,
  { field: 'systemMessage' | 'userMessage'; value: string }
>();

const sendContentUpdate = (
  promptId: string,
  field: 'systemMessage' | 'userMessage',
  value: string,
): void => {
  const socket = socketByPromptId.get(promptId);
  if (socket?.readyState !== WebSocket.OPEN) return;

  const key = `${promptId}:${field}`;
  const prevKey = key;
  const prevValue = prevValueByPromptField.get(prevKey) ?? '';

  // If no change, skip
  if (prevValue === value) return;

  const diff = computeDiff(prevValue, value);

  // If diff is >50% of the text length, send full text
  const diffSize = diff.deleteCount + diff.insertText.length;
  const useFullText = diffSize > value.length * 0.5;

  const doSend = () => {
    if (useFullText) {
      socket.send(JSON.stringify({ type: 'content_update', field, value }));
    } else {
      socket.send(
        JSON.stringify({
          type: 'content_diff',
          field,
          position: diff.position,
          deleteCount: diff.deleteCount,
          insertText: diff.insertText,
        }),
      );
    }
    prevValueByPromptField.set(prevKey, value);
  };

  // Leading-edge throttle: send immediately, then throttle
  if (!contentThrottleByKey.has(key)) {
    doSend();
    contentThrottleByKey.set(
      key,
      setTimeout(() => {
        contentThrottleByKey.delete(key);
        // Send any pending update
        const pending = pendingContentByKey.get(key);
        if (pending) {
          pendingContentByKey.delete(key);
          sendContentUpdate(promptId, pending.field, pending.value);
        }
      }, 100),
    );
  } else {
    // Queue latest value for send when throttle clears
    pendingContentByKey.set(key, { field, value });
  }
};

// Cursor throttle: 100ms leading-edge
const cursorThrottleByPromptId = new Map<
  string,
  ReturnType<typeof setTimeout>
>();

const sendCursorUpdate = (
  promptId: string,
  field: 'systemMessage' | 'userMessage',
  position: number,
  textareaWidth: number,
): void => {
  const socket = socketByPromptId.get(promptId);
  if (socket?.readyState !== WebSocket.OPEN) return;

  // Leading-edge throttle: send immediately, skip during cooldown
  if (cursorThrottleByPromptId.has(promptId)) return;

  socket.send(
    JSON.stringify({ type: 'cursor_update', field, position, textareaWidth }),
  );
  cursorThrottleByPromptId.set(
    promptId,
    setTimeout(() => {
      cursorThrottleByPromptId.delete(promptId);
    }, 100),
  );
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
