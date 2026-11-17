import http from 'http';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import bcrypt from 'bcryptjs';
import { config } from './config.js';
import { initDb, query } from './db.js';
import { initSocket } from './socket.js';
import authRoutes from './routes/auth.js';
import chatRoutes from './routes/chats.js';
import mediaRoutes from './routes/media.js';
import adminRoutes from './routes/admin.js';
import storyRoutes, { expireStories } from './routes/stories.js';
import { requireAuth, requireUser } from './middleware/auth.js';
import * as storage from './storage.js';

const app = express();
app.set('trust proxy', 1);
app.use(helmet({ crossOriginResourcePolicy: { policy: 'same-site' } }));
app.use(cors({ origin: config.clientOrigin, credentials: true }));
app.use(express.json({ limit: '100kb' }));
app.use(cookieParser());

app.get('/api/health', (_req, res) => res.json({ ok: true }));
app.get('/api/calls/config', requireAuth, requireUser, (_req, res) => {
  res.json({ iceServers: config.iceServers });
});
app.use('/api/auth', authRoutes);
app.use('/api/chats', chatRoutes);
app.use('/api/stories', storyRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api', mediaRoutes);

if (config.isProd) {
  const frontendDist = fileURLToPath(new URL('../../client/dist/', import.meta.url));
  app.use(express.static(frontendDist));
  app.use((req, res, next) => {
    if (req.method !== 'GET' || req.path === '/api' || req.path.startsWith('/api/')
      || req.path.startsWith('/socket.io')) {
      return next();
    }
    res.sendFile(path.join(frontendDist, 'index.html'));
  });
}

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: 'Erreur interne du serveur' });
});

async function bootstrap() {
  await initDb();
  await expireStories();
  const storyCleanup = setInterval(() => {
    expireStories().catch((error) => console.error('Échec du nettoyage des stories expirées', error));
  }, 15 * 60 * 1000);
  storyCleanup.unref();

  const { rows: generalMedia } = await query(
    `SELECT DISTINCT m.file->>'key' AS key
     FROM messages m
     JOIN conversations c ON c.id = m.conversation_id
     WHERE c.is_general = TRUE AND m.file->>'key' IS NOT NULL`,
  );
  await query('DELETE FROM conversations WHERE is_general = TRUE');
  for (const { key } of generalMedia) {
    const { rows: [references] } = await query(
      `SELECT EXISTS (SELECT 1 FROM messages WHERE file->>'key' = $1 AND deleted = FALSE)
           OR EXISTS (SELECT 1 FROM stories WHERE file->>'key' = $1) AS referenced`,
      [key],
    );
    if (!references.referenced) {
      try {
        await storage.remove(key);
      } catch (error) {
        console.error(`Échec de suppression du média ${key} du salon Général`, error);
      }
    }
  }

  const { email, username, password } = config.admin;
  if (email && password) {
    const { rows: admins } = await query('SELECT id FROM users WHERE email = $1', [email.toLowerCase()]);
    if (!admins.length) {
      const { rows: [admin] } = await query(
        `INSERT INTO users (username, email, role, password_hash)
         VALUES ($1, $2, 'admin', $3) RETURNING id`,
        [username, email.toLowerCase(), await bcrypt.hash(password, 12)],
      );
      console.log(`Compte admin créé : ${email}`);
    }
  }

  await query(
    `DELETE FROM conversation_members cm
     USING users u
     WHERE cm.user_id = u.id AND u.role = 'admin'`,
  );

  const server = http.createServer(app);
  initSocket(server);
  server.listen(config.port, () => console.log(`Pulse API sur http://localhost:${config.port}`));
}

bootstrap().catch((e) => { console.error(e); process.exit(1); });
