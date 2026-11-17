import { Router } from 'express';
import bcrypt from 'bcryptjs';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { query } from '../db.js';
import { publicUser } from '../models/index.js';
import { COOKIE, requireAuth, setAuthCookie, signToken } from '../middleware/auth.js';
import * as storage from '../storage.js';

const router = Router();
router.use(rateLimit({ windowMs: 15 * 60 * 1000, limit: 30, standardHeaders: true, legacyHeaders: false }));

const registerSchema = z.object({
  username: z.string().min(3).max(24).regex(/^[a-zA-Z0-9_]+$/, 'Lettres, chiffres et _ uniquement'),
  email: z.string().email(),
  password: z.string().min(8).regex(/[A-Za-z]/).regex(/\d/),
});

router.post('/register', async (req, res) => {
  const p = registerSchema.safeParse(req.body);
  if (!p.success) return res.status(400).json({ error: 'Données invalides' });
  const { username, email, password } = p.data;
  const normalizedEmail = email.toLowerCase();
  const { rows: existingUsers } = await query(
    'SELECT id FROM users WHERE email = $1 OR username = $2 LIMIT 1',
    [normalizedEmail, username],
  );
  if (existingUsers.length)
    return res.status(409).json({ error: 'Pseudo ou e-mail déjà utilisé' });

  const { rows: [user] } = await query(
    `INSERT INTO users (username, email, password_hash)
     VALUES ($1, $2, $3)
     RETURNING id, username, email, role, blocked, color, last_seen AS "lastSeen",
               created_at AS "createdAt"`,
    [username, normalizedEmail, await bcrypt.hash(password, 12)],
  );
  setAuthCookie(res, signToken(user));
  res.status(201).json({ user: publicUser(user) });
});

router.post('/login', async (req, res) => {
  const email = String(req.body?.email || '').toLowerCase();
  const { rows } = await query(
    `SELECT id, username, email, password_hash AS "passwordHash", role, blocked,
            color, avatar, last_seen AS "lastSeen", created_at AS "createdAt"
     FROM users WHERE email = $1`,
    [email],
  );
  const user = rows[0];
  const ok = user && (await bcrypt.compare(String(req.body?.password || ''), user.passwordHash));
  if (!ok) return res.status(401).json({ error: 'E-mail ou mot de passe incorrect' });
  if (user.blocked) return res.status(403).json({ error: 'Ce compte a été bloqué par un administrateur' });
  setAuthCookie(res, signToken(user));
  res.json({ user: publicUser(user) });
});

router.patch('/profile', requireAuth, async (req, res) => {
  const body = req.body || {};
  const updates = [];
  const values = [];
  if (typeof body.username === 'string') {
    const username = body.username.trim();
    if (!/^[a-zA-Z0-9_]{3,24}$/.test(username)) {
      return res.status(400).json({ error: 'Le pseudo doit contenir 3 à 24 lettres, chiffres ou _.' });
    }
    values.push(username);
    updates.push(`username = $${values.length}`);
  }
  if (Object.hasOwn(body, 'avatar')) {
    const avatar = body.avatar;
    if (avatar !== null && (!avatar || typeof avatar.key !== 'string'
      || !/^[0-9a-f-]{36}\.(jpg|png|gif|webp)$/.test(avatar.key)
      || !['image/jpeg', 'image/png', 'image/gif', 'image/webp'].includes(avatar.mime)
      || typeof avatar.name !== 'string' || typeof avatar.size !== 'number')) {
      return res.status(400).json({ error: 'Photo de profil invalide' });
    }
    values.push(avatar);
    updates.push(`avatar = $${values.length}`);
  }
  if (!updates.length) return res.status(400).json({ error: 'Aucun changement à enregistrer' });
  values.push(req.user.id);
  try {
    const { rows: [user] } = await query(
      `UPDATE users SET ${updates.join(', ')}, updated_at = NOW()
       WHERE id = $${values.length}
       RETURNING id, username, email, role, blocked, color, avatar,
                 last_seen AS "lastSeen", created_at AS "createdAt"`,
      values,
    );
    if (Object.hasOwn(body, 'avatar') && req.user.avatar?.key && req.user.avatar.key !== body.avatar?.key) {
      const { rows: [references] } = await query(
        `SELECT EXISTS (SELECT 1 FROM messages WHERE file->>'key' = $1 AND deleted = FALSE)
             OR EXISTS (SELECT 1 FROM stories WHERE file->>'key' = $1)
             OR EXISTS (SELECT 1 FROM users WHERE avatar->>'key' = $1) AS referenced`,
        [req.user.avatar.key],
      );
      if (!references.referenced) await storage.remove(req.user.avatar.key);
    }
    res.json({ user: publicUser(user) });
  } catch (error) {
    if (error.code === '23505') return res.status(409).json({ error: 'Ce pseudo est déjà utilisé.' });
    throw error;
  }
});

router.patch('/password', requireAuth, async (req, res) => {
  const { currentPassword, newPassword } = req.body || {};
  if (typeof currentPassword !== 'string' || typeof newPassword !== 'string'
    || newPassword.length < 8 || !/[A-Za-z]/.test(newPassword) || !/\d/.test(newPassword)) {
    return res.status(400).json({ error: 'Le nouveau mot de passe doit contenir 8 caractères minimum, une lettre et un chiffre.' });
  }
  const { rows: [account] } = await query('SELECT password_hash AS "passwordHash" FROM users WHERE id = $1', [req.user.id]);
  if (!account || !(await bcrypt.compare(currentPassword, account.passwordHash))) {
    return res.status(400).json({ error: 'Le mot de passe actuel est incorrect.' });
  }
  await query('UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2', [
    await bcrypt.hash(newPassword, 12), req.user.id,
  ]);
  res.json({ ok: true });
});

router.post('/logout', (_req, res) => {
  res.clearCookie(COOKIE);
  res.json({ ok: true });
});

router.get('/me', requireAuth, (req, res) => res.json({ user: publicUser(req.user) }));

export default router;
