import pg from 'pg';
import { newDb } from 'pg-mem';
import { config } from './config.js';

const { Pool } = pg;

const createPool = () => {
  if (config.databaseUrl?.startsWith('pg-mem://')) {
    const db = newDb();
    const { Pool: MemoryPool } = db.adapters.createPg();
    return new MemoryPool();
  }

  return new Pool({ connectionString: config.databaseUrl });
};

export const pool = createPool();

export const query = (text, values) => pool.query(text, values);

export async function initDb() {
  await query(`
    CREATE TABLE IF NOT EXISTS users (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      username TEXT NOT NULL UNIQUE,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
      blocked BOOLEAN NOT NULL DEFAULT FALSE,
      color INTEGER NOT NULL DEFAULT floor(random() * 360)::int,
      avatar JSONB,
      last_seen TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS conversations (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name TEXT,
      is_group BOOLEAN NOT NULL DEFAULT FALSE,
      is_general BOOLEAN NOT NULL DEFAULT FALSE,
      dm_key TEXT UNIQUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS conversation_members (
      conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      PRIMARY KEY (conversation_id, user_id)
    );

    CREATE TABLE IF NOT EXISTS user_contacts (
      owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      contact_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      display_name TEXT CHECK (char_length(display_name) <= 60),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (owner_id, contact_id),
      CHECK (owner_id <> contact_id)
    );

    CREATE TABLE IF NOT EXISTS messages (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
      sender_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      type TEXT NOT NULL DEFAULT 'text' CHECK (type IN ('text', 'image', 'video', 'audio', 'file')),
      text TEXT NOT NULL DEFAULT '' CHECK (char_length(text) <= 4000),
      file JSONB,
      read_by UUID[] NOT NULL DEFAULT '{}',
      deleted BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS reports (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
      reporter_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      reason TEXT NOT NULL DEFAULT 'Contenu inapproprié' CHECK (char_length(reason) <= 300),
      status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'dismissed', 'removed')),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (message_id, reporter_id)
    );

    CREATE TABLE IF NOT EXISTS message_reactions (
      message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      emoji TEXT NOT NULL CHECK (emoji IN ('👍', '❤️', '😂', '😮', '😢', '😡')),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (message_id, user_id)
    );

    CREATE TABLE IF NOT EXISTS stories (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      type TEXT NOT NULL CHECK (type IN ('image', 'video')),
      file JSONB NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      expires_at TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '24 hours'
    );

    CREATE INDEX IF NOT EXISTS messages_conversation_created_idx
      ON messages (conversation_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS reports_status_created_idx
      ON reports (status, created_at DESC);
    CREATE INDEX IF NOT EXISTS conversation_members_user_idx
      ON conversation_members (user_id);
    CREATE INDEX IF NOT EXISTS user_contacts_owner_idx
      ON user_contacts (owner_id);
    CREATE INDEX IF NOT EXISTS stories_expires_idx ON stories (expires_at);
  `);
  await query(`
    ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar JSONB;
    ALTER TABLE messages DROP CONSTRAINT IF EXISTS messages_type_check;
    ALTER TABLE messages
      ADD CONSTRAINT messages_type_check
      CHECK (type IN ('text', 'image', 'video', 'audio', 'file'));
  `);
}
