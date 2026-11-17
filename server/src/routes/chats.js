import { Router } from 'express';
import { pool, query } from '../db.js';
import { messageDTO, messageFromRow, publicUser } from '../models/index.js';
import { requireAuth, requireUser } from '../middleware/auth.js';
import { getIo } from '../io.js';

const router = Router();
router.use(requireAuth, requireUser);

const isId = (value) => typeof value === 'string'
  && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
const escapeLike = (value) => value.replace(/[\\%_]/g, '\\$&');
const MESSAGE_COLUMNS = `
  m.id, m.conversation_id AS "conversation", m.sender_id AS "senderId",
  u.username AS "senderUsername", u.color AS "senderColor", m.type, m.text,
  m.file, m.read_by AS "readBy", m.deleted, m.created_at AS "createdAt"`;

async function attachReactions(messages, userId) {
  if (!messages.length) return messages;
  const ids = messages.map((message) => message.id);
  const { rows } = await query(
    `SELECT message_id AS "messageId", user_id AS "userId", emoji
     FROM message_reactions WHERE message_id = ANY($1::uuid[])`,
    [ids],
  );
  const byMessage = new Map();
  for (const reaction of rows) {
    const list = byMessage.get(reaction.messageId) || [];
    list.push({ emoji: reaction.emoji, userId: String(reaction.userId), mine: reaction.userId === userId });
    byMessage.set(reaction.messageId, list);
  }
  return messages.map((message) => ({ ...message, reactions: byMessage.get(message.id) || [] }));
}

async function chatDTO(conversation, meId) {
  const [memberResult, lastResult, unreadResult] = await Promise.all([
    query(
      `SELECT u.id, u.username, u.color, u.avatar, u.last_seen AS "lastSeen"
       FROM conversation_members cm JOIN users u ON u.id = cm.user_id
       WHERE cm.conversation_id = $1`,
      [conversation.id],
    ),
    query(
      `SELECT ${MESSAGE_COLUMNS} FROM messages m
       JOIN users u ON u.id = m.sender_id
       WHERE m.conversation_id = $1
       ORDER BY m.created_at DESC LIMIT 1`,
      [conversation.id],
    ),
    query(
      `SELECT COUNT(*)::int AS count FROM messages
       WHERE conversation_id = $1 AND sender_id <> $2
         AND NOT ($2::uuid = ANY(read_by)) AND deleted = FALSE`,
      [conversation.id, meId],
    ),
  ]);
  const last = (await attachReactions(lastResult.rows, meId))[0];
  return {
    id: String(conversation.id),
    name: conversation.name,
    isGroup: conversation.isGroup,
    members: memberResult.rows.map((member) => ({
      id: String(member.id),
      username: member.username,
      color: member.color,
      avatar: member.avatar?.key ? { ...member.avatar, url: `/api/files/${member.avatar.key}` } : null,
      lastSeen: member.lastSeen,
    })),
    lastMessage: last ? messageDTO(messageFromRow(last)) : null,
    unread: unreadResult.rows[0].count,
    updatedAt: last?.createdAt ?? conversation.updatedAt,
  };
}

router.get('/users', async (req, res) => {
  const q = String(req.query.q || '').trim();
  const values = [req.user.id];
  let search = '';
  if (q) {
    values.push(`%${escapeLike(q)}%`);
    search = ` AND username ILIKE $2 ESCAPE '\\'`;
  }
  const { rows } = await query(
    `SELECT id, username, email, role, blocked, color, avatar,
            last_seen AS "lastSeen", created_at AS "createdAt"
     FROM users WHERE id <> $1 AND blocked = FALSE AND role = 'user'${search}
     ORDER BY username LIMIT 30`,
    values,
  );
  res.json({ users: rows.map(publicUser) });
});

router.get('/', async (req, res) => {
  const { rows } = await query(
    `SELECT c.id, c.name, c.is_group AS "isGroup", c.updated_at AS "updatedAt"
     FROM conversations c JOIN conversation_members cm ON cm.conversation_id = c.id
     WHERE cm.user_id = $1`,
    [req.user.id],
  );
  const chats = await Promise.all(rows.map((conversation) => chatDTO(conversation, req.user.id)));
  chats.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
  res.json({ chats });
});

router.post('/', async (req, res) => {
  const { userId } = req.body || {};
  if (!isId(userId) || userId === req.user.id) return res.status(400).json({ error: 'Utilisateur invalide' });
  const { rows: otherRows } = await query(
    `SELECT id FROM users WHERE id = $1 AND blocked = FALSE AND role = 'user'`,
    [userId],
  );
  if (!otherRows.length) return res.status(404).json({ error: 'Utilisateur introuvable' });

  const dmKey = [req.user.id, userId].sort().join(':');
  const { rows: [conversation] } = await query(
    `INSERT INTO conversations (dm_key, is_group)
     VALUES ($1, FALSE)
     ON CONFLICT (dm_key) DO UPDATE SET dm_key = EXCLUDED.dm_key
     RETURNING id, name, is_group AS "isGroup", updated_at AS "updatedAt",
               (xmax = 0) AS created`,
    [dmKey],
  );
  await query(
    `INSERT INTO conversation_members (conversation_id, user_id)
     VALUES ($1, $2), ($1, $3) ON CONFLICT DO NOTHING`,
    [conversation.id, req.user.id, userId],
  );

  if (conversation.created) {
    const io = getIo();
    io.in([`user:${req.user.id}`, `user:${userId}`]).socketsJoin(`conv:${conversation.id}`);
    io.to(`user:${userId}`).emit('chat:new', { id: String(conversation.id) });
  }
  res.status(conversation.created ? 201 : 200)
    .json({ chat: await chatDTO(conversation, req.user.id) });
});

router.post('/groups', async (req, res) => {
  const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
  const memberIds = Array.isArray(req.body?.userIds) ? [...new Set(req.body.userIds)] : [];
  if (name.length < 2 || name.length > 60 || memberIds.length < 1 || memberIds.length > 49
    || memberIds.some((id) => !isId(id) || id === req.user.id)) {
    return res.status(400).json({ error: 'Nom ou membres du groupe invalides' });
  }

  const client = await pool.connect();
  let conversation;
  try {
    await client.query('BEGIN');
    const { rows: users } = await client.query(
      `SELECT id FROM users WHERE id = ANY($1::uuid[]) AND blocked = FALSE AND role = 'user'`,
      [memberIds],
    );
    if (users.length !== memberIds.length) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Un ou plusieurs membres sont introuvables' });
    }

    const { rows: [created] } = await client.query(
      `INSERT INTO conversations (name, is_group)
       VALUES ($1, TRUE)
       RETURNING id, name, is_group AS "isGroup", updated_at AS "updatedAt"`,
      [name],
    );
    conversation = created;
    await client.query(
      `INSERT INTO conversation_members (conversation_id, user_id)
       SELECT $1, member_id FROM unnest($2::uuid[]) AS member_id
       UNION SELECT $1, $3::uuid`,
      [conversation.id, memberIds, req.user.id],
    );
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }

  const io = getIo();
  const allMembers = [...memberIds, req.user.id];
  io.in(allMembers.map((id) => `user:${id}`)).socketsJoin(`conv:${conversation.id}`);
  allMembers.forEach((id) => io.to(`user:${id}`).emit('chat:new', { id: String(conversation.id) }));
  res.status(201).json({ chat: await chatDTO(conversation, req.user.id) });
});

router.get('/:id/messages', async (req, res) => {
  if (!isId(req.params.id)) return res.status(400).json({ error: 'Identifiant invalide' });
  const { rows: conversations } = await query(
    `SELECT c.id FROM conversations c JOIN conversation_members cm ON cm.conversation_id = c.id
     WHERE c.id = $1 AND cm.user_id = $2`,
    [req.params.id, req.user.id],
  );
  if (!conversations.length) return res.status(404).json({ error: 'Conversation introuvable' });

  const values = [req.params.id];
  let beforeClause = '';
  if (req.query.before && !Number.isNaN(Date.parse(req.query.before))) {
    values.push(new Date(req.query.before));
    beforeClause = ' AND m.created_at < $2';
  }
  const { rows } = await query(
    `SELECT ${MESSAGE_COLUMNS} FROM messages m JOIN users u ON u.id = m.sender_id
     WHERE m.conversation_id = $1${beforeClause}
     ORDER BY m.created_at DESC LIMIT 50`,
    values,
  );
  const messages = await attachReactions(rows, req.user.id);
  res.json({ messages: messages.reverse().map((row) => messageDTO(messageFromRow(row))) });
});

export default router;
