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

// Server -> Client messages
type PresenceMessage =
  | { type: 'presence'; users: PresenceUser[] }
  | { type: 'user_joined'; user: PresenceUser }
  | { type: 'user_left'; userId: string }
  | { type: 'user_active'; userId: string; isActive: boolean }
  | { type: 'pong' };

// Client -> Server messages
type ClientMessage =
  | { type: 'ping' }
  | { type: 'focus'; isActive: boolean }
  | { type: 'init' };

type WebSocketAttachment = {
  userId: string;
  userName: string;
  userEmail: string;
  userImage: string | null;
  joinedAt: number;
};

export class PresenceRoom extends DurableObject<Env> {
  private users: Map<string, UserSession> = new Map();

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);

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
          }
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
}
