import { query } from '../db.js';

export const publicUser = (user) => ({
  id: String(user.id),
  username: user.username,
  email: user.email,
  role: user.role,
  blocked: user.blocked,
  color: user.color,
  avatar: user.avatar?.key ? { ...user.avatar, url: `/api/files/${user.avatar.key}` } : null,
  lastSeen: user.lastSeen,
  createdAt: user.createdAt,
});

export const messageDTO = (message) => ({
  id: String(message.id),
  conversation: String(message.conversation),
  sender: {
    id: String(message.sender?.id ?? message.senderId),
    username: message.sender?.username ?? message.senderUsername,
    color: message.sender?.color ?? message.senderColor,
  },
  type: message.type,
  text: message.deleted ? '' : message.text,
  file: message.deleted || !message.file?.key
    ? null
    : { ...message.file, url: `/api/files/${message.file.key}` },
  reactions: message.deleted ? [] : (message.reactions || []),
  readBy: message.readBy.map(String),
  deleted: message.deleted,
  createdAt: message.createdAt,
});

export const messageFromRow = (row) => ({
  id: row.id,
  conversation: row.conversation,
  sender: { id: row.senderId, username: row.senderUsername, color: row.senderColor },
  type: row.type,
  text: row.text,
  file: row.file,
  readBy: row.readBy,
  deleted: row.deleted,
  createdAt: row.createdAt,
});

export async function findUserById(id) {
  const { rows } = await query(
    `SELECT id, username, email, password_hash AS "passwordHash", role, blocked,
            color, avatar, last_seen AS "lastSeen", created_at AS "createdAt"
     FROM users WHERE id = $1`,
    [id],
  );
  return rows[0] ?? null;
}
