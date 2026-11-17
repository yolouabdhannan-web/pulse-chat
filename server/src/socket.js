import { Server } from 'socket.io';
import { z } from 'zod';
import { config } from './config.js';
import { query } from './db.js';
import { setIo } from './io.js';
import { userFromSocketToken } from './middleware/auth.js';
import { messageDTO, messageFromRow } from './models/index.js';

const online = new Map();
export const onlineCount = () => online.size;

const payload = z.object({
  conversationId: z.string().uuid(),
  type: z.enum(['text', 'image', 'video', 'audio', 'file']).default('text'),
  text: z.string().max(4000).default(''),
  file: z.object({
    key: z.string().regex(/^[0-9a-f-]{36}\.[a-z0-9]{2,4}$/),
    name: z.string().max(120), size: z.number().int().nonnegative(), mime: z.string().max(100),
  }).optional(),
});

const callSignal = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('offer'),
    conversationId: z.string().uuid(),
    targetId: z.string().uuid(),
    media: z.enum(['audio', 'video']),
    sdp: z.string().max(200000),
  }),
  z.object({
    type: z.literal('answer'),
    conversationId: z.string().uuid(),
    targetId: z.string().uuid(),
    sdp: z.string().max(200000),
  }),
  z.object({
    type: z.literal('ice'),
    conversationId: z.string().uuid(),
    targetId: z.string().uuid(),
    candidate: z.object({
      candidate: z.string().max(10000),
      sdpMid: z.string().nullable().optional(),
      sdpMLineIndex: z.number().int().nullable().optional(),
      usernameFragment: z.string().nullable().optional(),
    }),
  }),
  z.object({
    type: z.enum(['end', 'reject']),
    conversationId: z.string().uuid(),
    targetId: z.string().uuid(),
  }),
]);

async function createMessage(user, raw) {
  const data = payload.parse(raw);
  if (data.type === 'text' && !data.text.trim()) throw new Error('Message vide');
  if (data.type !== 'text' && !data.file) throw new Error('Fichier manquant');
  const { rows: conversations } = await query(
    `SELECT c.id FROM conversations c JOIN conversation_members cm ON cm.conversation_id = c.id
     WHERE c.id = $1 AND cm.user_id = $2`,
    [data.conversationId, user.id],
  );
  if (!conversations.length) throw new Error('Conversation introuvable');

  const { rows: [row] } = await query(
    `INSERT INTO messages (conversation_id, sender_id, type, text, file, read_by)
     VALUES ($1, $2, $3, $4, $5, ARRAY[$2]::uuid[])
     RETURNING id, conversation_id AS "conversation", sender_id AS "senderId",
               type, text, file, read_by AS "readBy", deleted, created_at AS "createdAt"`,
    [data.conversationId, user.id, data.type, data.text.trim(), data.file ?? null],
  );
  row.reactions = [];
  await query('UPDATE conversations SET updated_at = NOW() WHERE id = $1', [data.conversationId]);
  return messageDTO({
    ...messageFromRow(row),
    sender: { id: user.id, username: user.username, color: user.color },
  });
}

export function initSocket(server) {
  const io = new Server(server, { cors: { origin: config.clientOrigin, credentials: true }, maxHttpBufferSize: 1e6 });
  setIo(io);

  io.use(async (socket, next) => {
    try {
      const user = await userFromSocketToken(socket.handshake.auth?.token);
      if (!user || user.role !== 'user') return next(new Error('unauthorized'));
      socket.user = user;
      next();
    } catch (error) {
      next(error);
    }
  });

  io.on('connection', async (socket) => {
    const uid = socket.user.id;
    socket.join(`user:${uid}`);
    const { rows } = await query(
      'SELECT conversation_id AS id FROM conversation_members WHERE user_id = $1',
      [uid],
    );
    rows.forEach((conversation) => socket.join(`conv:${conversation.id}`));

    online.set(uid, (online.get(uid) || 0) + 1);
    if (online.get(uid) === 1) socket.broadcast.emit('presence:update', { userId: uid, online: true });
    socket.emit('presence:list', [...online.keys()]);

    socket.on('message:send', async (data, ack) => {
      try {
        const message = await createMessage(socket.user, data);
        io.to(`conv:${message.conversation}`).emit('message:new', message);
        ack?.({ ok: true });
      } catch (error) {
        ack?.({ ok: false, error: error.name === 'ZodError' ? 'Message invalide' : error.message });
      }
    });

    socket.on('typing', ({ conversationId, typing } = {}) => {
      if (!socket.rooms.has(`conv:${conversationId}`)) return;
      socket.to(`conv:${conversationId}`).emit('typing', {
        conversationId, userId: uid, username: socket.user.username, typing: !!typing,
      });
    });

    socket.on('message:read', async ({ conversationId } = {}) => {
      if (!socket.rooms.has(`conv:${conversationId}`)) return;
      await query(
        `UPDATE messages SET read_by = array_append(read_by, $2::uuid)
         WHERE conversation_id = $1 AND NOT ($2::uuid = ANY(read_by))`,
        [conversationId, uid],
      );
      io.to(`conv:${conversationId}`).emit('message:read', { conversationId, userId: uid });
    });

    socket.on('message:react', async ({ messageId, emoji } = {}, ack) => {
      const allowed = ['👍', '❤️', '😂', '😮', '😢', '😡'];
      if (typeof messageId !== 'string' || !z.string().uuid().safeParse(messageId).success || !allowed.includes(emoji)) {
        ack?.({ ok: false, error: 'Réaction invalide' });
        return;
      }

      const { rows } = await query(
        `SELECT m.id, m.conversation_id AS "conversation"
         FROM messages m
         JOIN conversation_members cm ON cm.conversation_id = m.conversation_id
         WHERE m.id = $1 AND cm.user_id = $2 AND m.deleted = FALSE`,
        [messageId, uid],
      );
      if (!rows.length) {
        ack?.({ ok: false, error: 'Message introuvable' });
        return;
      }

      await query(
        `WITH removed AS (
           DELETE FROM message_reactions
           WHERE message_id = $1 AND user_id = $2 AND emoji = $3
           RETURNING message_id
         )
         INSERT INTO message_reactions (message_id, user_id, emoji)
         SELECT $1, $2, $3 WHERE NOT EXISTS (SELECT 1 FROM removed)
         ON CONFLICT (message_id, user_id)
         DO UPDATE SET emoji = EXCLUDED.emoji`,
        [messageId, uid, emoji],
      );
      const { rows: reactions } = await query(
        `SELECT user_id AS "userId", emoji FROM message_reactions WHERE message_id = $1`,
        [messageId],
      );
      io.to(`conv:${rows[0].conversation}`).emit('message:reactions', {
        messageId,
        reactions: reactions.map((reaction) => ({
          userId: String(reaction.userId),
          emoji: reaction.emoji,
        })),
      });
      ack?.({ ok: true });
    });

    socket.on('call:signal', async (raw, ack) => {
      const parsed = callSignal.safeParse(raw);
      if (!parsed.success) {
        ack?.({ ok: false, error: 'Signal d’appel invalide' });
        return;
      }
      const signal = parsed.data;
      if (signal.targetId === uid) {
        ack?.({ ok: false, error: 'Destinataire invalide' });
        return;
      }
      const { rows } = await query(
        `SELECT COUNT(DISTINCT user_id)::int AS count
         FROM conversation_members
         WHERE conversation_id = $1 AND user_id = ANY($2::uuid[])`,
        [signal.conversationId, [uid, signal.targetId]],
      );
      if (rows[0].count !== 2) {
        ack?.({ ok: false, error: 'Conversation ou destinataire introuvable' });
        return;
      }
      io.to(`user:${signal.targetId}`).emit('call:signal', {
        ...signal,
        from: uid,
        username: socket.user.username,
      });
      ack?.({ ok: true });
    });

    socket.on('disconnect', async () => {
      const count = (online.get(uid) || 1) - 1;
      if (count > 0) return online.set(uid, count);
      online.delete(uid);
      await query('UPDATE users SET last_seen = NOW() WHERE id = $1', [uid]);
      io.emit('presence:update', { userId: uid, online: false });
    });

    socket.emit('session:ready');
  });
}
