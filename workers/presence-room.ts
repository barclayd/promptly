import { DurableObject } from 'cloudflare:workers';

export type PresenceUser = {
  id: string;
  name: string;
  email: string;
  image: string | null;
  joinedAt: number;
  isActive: boolean;
};

type UserSession = {
  user: PresenceUser;
  connectionCount: number;
};

// Cursor position state for each user
type CursorPosition = {
  userId: string;
  field: 'systemMessage' | 'userMessage';
  position: number;
  timestamp: number;
};

// Content state for collaborative editing
type ContentState = {
  systemMessage: string;
  userMessage: string;
  version: number;
};

// Server -> Client messages
type PresenceMessage =
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
      isActive: boolean;
    }
  | {
      type: 'cursor_state';
      cursors: Array<{
        userId: string;
        userName: string;
        field: 'systemMessage' | 'userMessage';
        position: number;
        isActive: boolean;
      }>;
    };

// Client -> Server messages
type ClientMessage =
  | { type: 'ping' }
  | { type: 'focus'; isActive: boolean }
  | { type: 'init' }
  | {
      type: 'content_update';
      field: 'systemMessage' | 'userMessage';
      value: string;
    }
  | {
      type: 'cursor_update';
      field: 'systemMessage' | 'userMessage';
      position: number;
    };

type WebSocketAttachment = {
  userId: string;
  userName: string;
  userEmail: string;
  userImage: string | null;
  joinedAt: number;
};

export class PresenceRoom extends DurableObject<Env> {
  private users: Map<string, UserSession> = new Map();
  private cursorPositions: Map<string, CursorPosition> = new Map();
  private contentState: ContentState = {
    systemMessage: '',
    userMessage: '',
    version: 0,
  };

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);

    // Restore content state from storage (for hibernation recovery)
    this.ctx.blockConcurrencyWhile(async () => {
      const stored = await this.ctx.storage.get<ContentState>('contentState');
      if (stored) {
        this.contentState = stored;
      }
    });

    try {
      // Restore user sessions from hibernated WebSocket connections
      // Following official Cloudflare example pattern
      const sockets = this.ctx.getWebSockets();
      for (const ws of sockets) {
        try {
          const attachment =
            ws.deserializeAttachment() as WebSocketAttachment | null;
          if (attachment?.userId) {
            const existingSession = this.users.get(attachment.userId);
            if (existingSession) {
              existingSession.connectionCount++;
            } else {
              // Restore session from attachment data
              this.users.set(attachment.userId, {
                user: {
                  id: attachment.userId,
                  name: attachment.userName,
                  email: attachment.userEmail,
                  image: attachment.userImage,
                  joinedAt: attachment.joinedAt,
                  isActive: true,
                },
                connectionCount: 1,
              });
            }
          }
        } catch (e) {
          console.error('[PresenceRoom] Error restoring socket:', e);
        }
      }
    } catch (e) {
      console.error('[PresenceRoom] Error in constructor:', e);
    }
  }

  async fetch(request: Request): Promise<Response> {
    // Extract user data from URL query params (set by the worker)
    const url = new URL(request.url);
    const userId = url.searchParams.get('userId');
    const userName = url.searchParams.get('userName');
    const userEmail = url.searchParams.get('userEmail');
    const userImage = url.searchParams.get('userImage');

    if (!userId || !userName || !userEmail) {
      return new Response('Missing user data', { status: 400 });
    }

    // Create WebSocket pair
    const webSocketPair = new WebSocketPair();
    const client = webSocketPair[0];
    const server = webSocketPair[1];

    // Accept the WebSocket with hibernation support
    this.ctx.acceptWebSocket(server);

    // Store full user data in the WebSocket attachment for hibernation persistence
    const joinedAt = Date.now();
    const attachment: WebSocketAttachment = {
      userId,
      userName,
      userEmail,
      userImage: userImage || null,
      joinedAt,
    };
    server.serializeAttachment(attachment);

    // Set up user session immediately (following official example)
    // Don't send anything yet - client will send 'init' message to get presence list
    const existingSession = this.users.get(userId);
    if (existingSession) {
      existingSession.connectionCount++;
    } else {
      const user: PresenceUser = {
        id: userId,
        name: userName,
        email: userEmail,
        image: userImage || null,
        joinedAt,
        isActive: true,
      };
      this.users.set(userId, { user, connectionCount: 1 });
    }

    return new Response(null, {
      status: 101,
      webSocket: client,
    });
  }

  webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): void {
    if (typeof message !== 'string') return;

    try {
      const data = JSON.parse(message) as ClientMessage;
      const attachment = ws.deserializeAttachment() as WebSocketAttachment;

      switch (data.type) {
        case 'init': {
          // Client is ready - send current presence list and broadcast join
          const presenceList = this.getPresenceList();
          ws.send(JSON.stringify({ type: 'presence', users: presenceList }));

          // Send current content state
          ws.send(
            JSON.stringify({
              type: 'content_state',
              systemMessage: this.contentState.systemMessage,
              userMessage: this.contentState.userMessage,
              version: this.contentState.version,
            }),
          );

          // Send current cursor positions (excluding own cursor)
          const cursorList = this.getCursorList(attachment.userId);
          if (cursorList.length > 0) {
            ws.send(
              JSON.stringify({ type: 'cursor_state', cursors: cursorList }),
            );
          }

          // Broadcast join to all other users
          const session = this.users.get(attachment.userId);
          if (session) {
            this.broadcast(
              { type: 'user_joined', user: session.user },
              attachment.userId,
            );
          }
          break;
        }

        case 'ping':
          ws.send(JSON.stringify({ type: 'pong' }));
          break;

        case 'focus': {
          const session = this.users.get(attachment.userId);
          if (session && session.user.isActive !== data.isActive) {
            session.user.isActive = data.isActive;
            this.broadcast(
              {
                type: 'user_active',
                userId: attachment.userId,
                isActive: data.isActive,
              },
              attachment.userId,
            );

            // Also broadcast cursor update with new isActive state
            const cursor = this.cursorPositions.get(attachment.userId);
            if (cursor) {
              this.broadcast(
                {
                  type: 'cursor_sync',
                  userId: attachment.userId,
                  userName: attachment.userName,
                  field: cursor.field,
                  position: cursor.position,
                  isActive: data.isActive,
                },
                attachment.userId,
              );
            }
          }
          break;
        }

        case 'content_update': {
          // Increment version and update content state
          this.contentState.version++;
          this.contentState[data.field] = data.value;

          // Persist to storage for hibernation recovery
          this.ctx.storage.put('contentState', this.contentState);

          // Broadcast to all OTHER clients (not the sender)
          this.broadcast(
            {
              type: 'content_sync',
              field: data.field,
              value: data.value,
              version: this.contentState.version,
              userId: attachment.userId,
            },
            attachment.userId,
          );
          break;
        }

        case 'cursor_update': {
          // Update cursor position for this user
          this.cursorPositions.set(attachment.userId, {
            userId: attachment.userId,
            field: data.field,
            position: data.position,
            timestamp: Date.now(),
          });

          // Get user's active state
          const userSession = this.users.get(attachment.userId);
          const isActive = userSession?.user.isActive ?? true;

          // Broadcast cursor position to all OTHER clients
          this.broadcast(
            {
              type: 'cursor_sync',
              userId: attachment.userId,
              userName: attachment.userName,
              field: data.field,
              position: data.position,
              isActive,
            },
            attachment.userId,
          );
          break;
        }
      }
    } catch {
      // Ignore malformed messages
    }
  }

  webSocketClose(ws: WebSocket): void {
    this.handleDisconnect(ws);
  }

  webSocketError(ws: WebSocket): void {
    this.handleDisconnect(ws);
  }

  private handleDisconnect(ws: WebSocket): void {
    const attachment = ws.deserializeAttachment() as WebSocketAttachment | null;
    if (!attachment) return;

    const session = this.users.get(attachment.userId);
    if (!session) return;

    session.connectionCount--;

    // Only remove user and broadcast leave when all their connections are closed
    if (session.connectionCount <= 0) {
      this.users.delete(attachment.userId);
      this.cursorPositions.delete(attachment.userId);
      this.broadcast({ type: 'user_left', userId: attachment.userId });
    }
  }

  private broadcast(message: PresenceMessage, excludeUserId?: string): void {
    const messageStr = JSON.stringify(message);
    const sockets = this.ctx.getWebSockets();

    for (const socket of sockets) {
      const attachment =
        socket.deserializeAttachment() as WebSocketAttachment | null;
      if (attachment && excludeUserId && attachment.userId === excludeUserId) {
        continue;
      }
      try {
        socket.send(messageStr);
      } catch {
        // Socket may be closing, ignore errors
      }
    }
  }

  private getPresenceList(): PresenceUser[] {
    return Array.from(this.users.values()).map((session) => session.user);
  }

  private getCursorList(excludeUserId?: string): Array<{
    userId: string;
    userName: string;
    field: 'systemMessage' | 'userMessage';
    position: number;
    isActive: boolean;
  }> {
    const cursors: Array<{
      userId: string;
      userName: string;
      field: 'systemMessage' | 'userMessage';
      position: number;
      isActive: boolean;
    }> = [];

    for (const [userId, cursor] of this.cursorPositions) {
      if (excludeUserId && userId === excludeUserId) continue;

      const session = this.users.get(userId);
      if (session) {
        cursors.push({
          userId: cursor.userId,
          userName: session.user.name,
          field: cursor.field,
          position: cursor.position,
          isActive: session.user.isActive,
        });
      }
    }

    return cursors;
  }
}
