import { PresenceRoom } from '../../workers/presence-room';

export { PresenceRoom };

// This entry point is bundled only by the isolated notification regression.
export default {
  fetch: async (request: Request, env: Env) => {
    const room = env.PRESENCE_ROOM.getByName('notification-document');
    if (new URL(request.url).pathname === '/notify') {
      await room.savedRevision({
        type: 'saved_revision',
        documentId: 'notification-document',
        kind: 'prompt',
        revision: 'saved-revision',
        changeId: 'change',
      });
      return new Response(null, { status: 204 });
    }
    return room.fetch(request);
  },
};
