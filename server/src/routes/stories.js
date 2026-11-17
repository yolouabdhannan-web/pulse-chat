import { Router } from 'express';
import { query } from '../db.js';
import { requireAuth, requireUser } from '../middleware/auth.js';
import { getIo } from '../io.js';
import * as storage from '../storage.js';

const router = Router();
router.use(requireAuth, requireUser);

export async function expireStories() {
  const { rows } = await query(
    `SELECT DISTINCT file->>'key' AS key FROM stories WHERE expires_at <= NOW()`,
  );
  for (const { key } of rows) {
    const { rows: [references] } = await query(
      `SELECT EXISTS (
         SELECT 1 FROM stories WHERE file->>'key' = $1 AND expires_at > NOW()
       ) OR EXISTS (
         SELECT 1 FROM messages WHERE file->>'key' = $1 AND deleted = FALSE
       ) AS referenced`,
      [key],
    );
    if (!references.referenced) await storage.remove(key);
  }
  await query('DELETE FROM stories WHERE expires_at <= NOW()');
}

router.get('/', async (req, res) => {
  await expireStories();
  const { rows } = await query(
    `SELECT s.id, s.user_id AS "userId", u.username, u.color, u.avatar, s.type, s.file,
            s.created_at AS "createdAt", s.expires_at AS "expiresAt"
     FROM stories s JOIN users u ON u.id = s.user_id
     WHERE s.expires_at > NOW()
       AND (s.user_id = $1 OR EXISTS (
         SELECT 1 FROM conversation_members mine
         JOIN conversation_members theirs ON theirs.conversation_id = mine.conversation_id
         JOIN conversations c ON c.id = mine.conversation_id
         WHERE mine.user_id = $1 AND theirs.user_id = s.user_id AND c.is_general = FALSE
       ))
     ORDER BY s.created_at`,
    [req.user.id],
  );
  const grouped = new Map();
  for (const story of rows) {
    const key = String(story.userId);
    const list = grouped.get(key) || {
      user: {
        id: key,
        username: story.username,
        color: story.color,
        avatar: story.avatar?.key ? { ...story.avatar, url: `/api/files/${story.avatar.key}` } : null,
      },
      stories: [],
    };
    list.stories.push({
      id: String(story.id),
      type: story.type,
      file: { ...story.file, url: `/api/files/${story.file.key}` },
      createdAt: story.createdAt,
      expiresAt: story.expiresAt,
    });
    grouped.set(key, list);
  }
  res.json({ stories: [...grouped.values()] });
});

router.post('/', async (req, res) => {
  const { type, file } = req.body || {};
  if (!['image', 'video'].includes(type) || !file
    || typeof file.key !== 'string' || !/^[0-9a-f-]{36}\.(jpg|png|gif|webp|mp4|webm|mov)$/.test(file.key)
    || typeof file.name !== 'string' || typeof file.mime !== 'string') {
    return res.status(400).json({ error: 'Story invalide' });
  }
  const { rows: [story] } = await query(
    `INSERT INTO stories (user_id, type, file)
     VALUES ($1, $2, $3)
     RETURNING id, created_at AS "createdAt", expires_at AS "expiresAt"`,
    [req.user.id, type, file],
  );
  getIo().emit('story:new');
  res.status(201).json({
    story: {
      id: String(story.id),
      type,
      file: { ...file, url: `/api/files/${file.key}` },
      createdAt: story.createdAt,
      expiresAt: story.expiresAt,
    },
  });
});

export default router;
