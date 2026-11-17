import { Router } from 'express';
import multer from 'multer';
import crypto from 'crypto';
import { query } from '../db.js';
import { requireAuth, requireUser } from '../middleware/auth.js';
import * as storage from '../storage.js';

const router = Router();
router.use(requireAuth);

const ALLOWED = {
  'image/jpeg': ['image', 'jpg'], 'image/png': ['image', 'png'], 'image/gif': ['image', 'gif'], 'image/webp': ['image', 'webp'],
  'video/mp4': ['video', 'mp4'], 'video/webm': ['video', 'webm'], 'video/quicktime': ['video', 'mov'],
  'application/pdf': ['file', 'pdf'], 'text/plain': ['file', 'txt'], 'application/zip': ['file', 'zip'],
  'application/msword': ['file', 'doc'],
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['file', 'docx'],
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['file', 'xlsx'],
  'application/x-zip-compressed': ['file', 'zip'],
  'audio/webm': ['audio', 'webm'],
  'audio/ogg': ['audio', 'ogg'],
  'audio/mp4': ['audio', 'm4a'],
  'audio/mpeg': ['audio', 'mp3'],
  'audio/wav': ['audio', 'wav'],
  'audio/x-wav': ['audio', 'wav'],
  'audio/aac': ['audio', 'aac'],
};

const allowedType = (mime) => ALLOWED[mime.split(';', 1)[0].trim().toLowerCase()];

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, callback) => (allowedType(file.mimetype)
    ? callback(null, true)
    : callback(new Error('Type de fichier non autorisé'))),
});

router.post('/upload', requireUser, (req, res) => {
  upload.single('file')(req, res, async (error) => {
    if (error) return res.status(400).json({ error: error.message });
    if (!req.file) return res.status(400).json({ error: 'Aucun fichier reçu' });
    try {
      const [type, ext] = allowedType(req.file.mimetype);
      const key = `${crypto.randomUUID()}.${ext}`;
      await storage.put(key, req.file.buffer, req.file.mimetype);
      const name = Buffer.from(req.file.originalname, 'latin1').toString('utf8')
        .replace(/[^\p{L}\p{N}._ -]/gu, '_').slice(0, 120);
      res.status(201).json({ type, file: { key, name, size: req.file.size, mime: req.file.mimetype } });
    } catch (storageError) {
      console.error(storageError);
      res.status(500).json({ error: 'Échec du stockage du fichier' });
    }
  });
});

router.get('/files/:key', async (req, res) => {
  if (!/^[0-9a-f-]{36}\.[a-z0-9]{2,4}$/.test(req.params.key)) return res.status(400).end();
  const { rows: [expiredStory] } = await query(
    `SELECT EXISTS (
       SELECT 1 FROM stories s
       WHERE s.file->>'key' = $1 AND s.expires_at <= NOW()
         AND NOT EXISTS (
           SELECT 1 FROM stories active
           WHERE active.file->>'key' = $1 AND active.expires_at > NOW()
         )
         AND NOT EXISTS (
           SELECT 1 FROM messages m
           WHERE m.file->>'key' = $1 AND m.deleted = FALSE
         )
     ) AS expired`,
    [req.params.key],
  );
  if (expiredStory.expired) return res.status(404).end();
  const location = await storage.locate(req.params.key);
  if (location.redirect) return res.redirect(location.redirect);
  res.setHeader('Cache-Control', 'private, max-age=3600');
  res.sendFile(location.path, (error) => error && !res.headersSent && res.status(404).end());
});

router.post('/messages/:id/report', requireUser, async (req, res) => {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(req.params.id)) {
    return res.status(400).json({ error: 'Identifiant invalide' });
  }
  const { rows: messages } = await query(
    'SELECT id, sender_id AS "senderId" FROM messages WHERE id = $1',
    [req.params.id],
  );
  const message = messages[0];
  if (!message || message.senderId === req.user.id) {
    return res.status(404).json({ error: 'Message introuvable' });
  }
  const reason = String(req.body?.reason || 'Contenu inapproprié').slice(0, 300);
  await query(
    `INSERT INTO reports (message_id, reporter_id, reason, status)
     VALUES ($1, $2, $3, 'pending')
     ON CONFLICT (message_id, reporter_id)
     DO UPDATE SET reason = EXCLUDED.reason, status = 'pending', updated_at = NOW()`,
    [message.id, req.user.id, reason],
  );
  res.status(201).json({ ok: true });
});

export default router;
