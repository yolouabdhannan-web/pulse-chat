import { Router } from 'express';
import { query } from '../db.js';
import { messageDTO, messageFromRow, publicUser } from '../models/index.js';
import { requireAdmin, requireAuth } from '../middleware/auth.js';
import { getIo } from '../io.js';
import { onlineCount } from '../socket.js';
import bcrypt from 'bcryptjs';

const router = Router();
router.use(requireAuth, requireAdmin);

router.get('/stats', async (_req, res) => {
  const since = new Date();
  since.setUTCHours(0, 0, 0, 0);
  since.setTime(since.getTime() - 6 * 864e5);
  const [users, blocked, messages, media, pending, messagePerDay, usersPerDay] = await Promise.all([
    query('SELECT COUNT(*)::int AS count FROM users'),
    query('SELECT COUNT(*)::int AS count FROM users WHERE blocked = TRUE'),
    query('SELECT COUNT(*)::int AS count FROM messages WHERE deleted = FALSE'),
    query(`SELECT COUNT(*)::int AS count FROM messages
           WHERE type <> 'text' AND deleted = FALSE`),
    query(`SELECT COUNT(*)::int AS count FROM reports WHERE status = 'pending'`),
    query(
      `SELECT to_char(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD') AS date,
              COUNT(*)::int AS count
       FROM messages WHERE created_at >= $1
       GROUP BY date`,
      [since],
    ),
    query(
      `SELECT to_char(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD') AS date,
              COUNT(*)::int AS count
       FROM users WHERE created_at >= $1
       GROUP BY date`,
      [since],
    ),
  ]);
  const messagesByDay = Object.fromEntries(messagePerDay.rows.map((day) => [day.date, day.count]));
  const usersByDay = Object.fromEntries(usersPerDay.rows.map((day) => [day.date, day.count]));
  const days = Array.from({ length: 7 }, (_, index) => {
    const key = new Date(since.getTime() + index * 864e5).toISOString().slice(0, 10);
    return { date: key, messages: messagesByDay[key] || 0, users: usersByDay[key] || 0 };
  });
  res.json({
    users: users.rows[0].count,
    blocked: blocked.rows[0].count,
    online: onlineCount(),
    messages: messages.rows[0].count,
    media: media.rows[0].count,
    pendingReports: pending.rows[0].count,
    days,
  });
});

router.get('/users', async (req, res) => {
  const search = String(req.query.q || '').trim();
  const values = [];
  let where = '';
  if (search) {
    values.push(`%${search.replace(/[\\%_]/g, '\\$&')}%`);
    where = `WHERE username ILIKE $1 ESCAPE '\\' OR email ILIKE $1 ESCAPE '\\'`;
  }
  const { rows } = await query(
    `SELECT id, username, email, role, blocked, color, avatar,
            last_seen AS "lastSeen", created_at AS "createdAt"
     FROM users ${where} ORDER BY created_at DESC LIMIT 200`,
    values,
  );
  res.json({ users: rows.map(publicUser) });
});

router.patch('/users/:id', async (req, res) => {
  const { id } = req.params;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) {
    return res.status(400).json({ error: 'Identifiant invalide' });
  }
  if (id === req.user.id) return res.status(400).json({ error: 'Vous ne pouvez pas modifier votre propre compte' });

  const blocked = typeof req.body.blocked === 'boolean' ? req.body.blocked : undefined;
  const role = ['user', 'admin'].includes(req.body.role) ? req.body.role : undefined;
  const { rows } = await query(
    `UPDATE users SET
       blocked = COALESCE($2, blocked),
       role = COALESCE($3, role),
       updated_at = NOW()
     WHERE id = $1
     RETURNING id, username, email, role, blocked, color, avatar,
               last_seen AS "lastSeen", created_at AS "createdAt"`,
    [id, blocked ?? null, role ?? null],
  );
  const user = rows[0];
  if (!user) return res.status(404).json({ error: 'Utilisateur introuvable' });
  if (user.role === 'admin') {
    await query('DELETE FROM conversation_members WHERE user_id = $1', [id]);
    getIo().in(`user:${id}`).disconnectSockets(true);
  } else if (blocked) {
    getIo().in(`user:${id}`).disconnectSockets(true);
  }
  res.json({ user: publicUser(user) });
});

router.patch('/users/:id/password', async (req, res) => {
  const { id } = req.params;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) {
    return res.status(400).json({ error: 'Identifiant invalide' });
  }
  if (id === req.user.id) return res.status(400).json({ error: 'Utilisez les paramètres de votre compte pour changer votre mot de passe.' });
  const password = req.body?.password;
  if (typeof password !== 'string' || password.length < 8 || !/[A-Za-z]/.test(password) || !/\d/.test(password)) {
    return res.status(400).json({ error: 'Le mot de passe doit contenir 8 caractères minimum, une lettre et un chiffre.' });
  }
  const { rows: [target] } = await query(
    'UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2 RETURNING id',
    [await bcrypt.hash(password, 12), id],
  );
  if (!target) return res.status(404).json({ error: 'Utilisateur introuvable' });
  getIo().in(`user:${id}`).disconnectSockets(true);
  res.json({ ok: true });
});

router.get('/reports', async (_req, res) => {
  const { rows } = await query(
    `SELECT r.id, r.reason, r.created_at AS "createdAt",
            reporter.username AS "reporterUsername",
            m.id AS "messageId", m.conversation_id AS "conversation",
            m.sender_id AS "senderId", sender.username AS "senderUsername",
            sender.color AS "senderColor", m.type, m.text, m.file,
            m.read_by AS "readBy", m.deleted, m.created_at AS "messageCreatedAt"
     FROM reports r
     JOIN users reporter ON reporter.id = r.reporter_id
     JOIN messages m ON m.id = r.message_id
     JOIN users sender ON sender.id = m.sender_id
     WHERE r.status = 'pending'
     ORDER BY r.created_at DESC LIMIT 100`,
  );
  res.json({
    reports: rows.map((row) => ({
      id: String(row.id),
      reason: row.reason,
      createdAt: row.createdAt,
      reporter: row.reporterUsername,
      message: messageDTO(messageFromRow({
        ...row,
        id: row.messageId,
        createdAt: row.messageCreatedAt,
      })),
    })),
  });
});

router.patch('/reports/:id', async (req, res) => {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(req.params.id)) {
    return res.status(400).json({ error: 'Identifiant invalide' });
  }
  const { rows: reports } = await query('SELECT id, message_id AS "messageId" FROM reports WHERE id = $1', [req.params.id]);
  const report = reports[0];
  if (!report) return res.status(404).json({ error: 'Signalement introuvable' });

  if (req.body.action === 'remove') {
    const { rows: messages } = await query(
      `UPDATE messages SET deleted = TRUE, text = '', file = NULL, updated_at = NOW()
       WHERE id = $1
       RETURNING id, conversation_id AS "conversation"`,
      [report.messageId],
    );
    const message = messages[0];
    if (message) {
      getIo().to(`conv:${message.conversation}`).emit('message:deleted', {
        id: String(message.id), conversation: String(message.conversation),
      });
    }
    await query(`UPDATE reports SET status = 'removed', updated_at = NOW() WHERE message_id = $1`, [report.messageId]);
  } else {
    await query(`UPDATE reports SET status = 'dismissed', updated_at = NOW() WHERE id = $1`, [report.id]);
  }
  res.json({ ok: true });
});

export default router;
