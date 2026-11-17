import 'dotenv/config';

const e = process.env;
const defaultIceServers = [{ urls: 'stun:stun.l.google.com:19302' }];
const iceServers = e.ICE_SERVERS ? JSON.parse(e.ICE_SERVERS) : defaultIceServers;
if (!Array.isArray(iceServers) || iceServers.length === 0 || iceServers.some((server) =>
  !server || !(typeof server.urls === 'string' || Array.isArray(server.urls)))) {
  throw new Error('ICE_SERVERS doit être une liste JSON de serveurs ICE valides.');
}

const databaseUrl = e.DATABASE_URL || (e.USE_PG_MEM === 'true' ? 'pg-mem://localhost/pulse' : undefined);

export const config = {
  port: Number(e.PORT) || 4000,
  isProd: e.NODE_ENV === 'production',
  databaseUrl,
  jwtSecret: e.JWT_SECRET,
  clientOrigin: e.CLIENT_ORIGIN || 'http://localhost:5173',
  iceServers,
  admin: {
    email: e.ADMIN_EMAIL,
    username: e.ADMIN_USERNAME || 'admin',
    password: e.ADMIN_PASSWORD,
  },
  s3: {
    bucket: e.S3_BUCKET,
    region: e.S3_REGION || 'us-east-1',
    endpoint: e.S3_ENDPOINT || undefined,
    accessKeyId: e.S3_ACCESS_KEY_ID,
    secretAccessKey: e.S3_SECRET_ACCESS_KEY,
  },
};

if (!config.jwtSecret || config.jwtSecret.length < 16) {
  throw new Error('JWT_SECRET manquant ou trop court (16 caractères minimum). Voir .env.example');
}

if (!config.databaseUrl && e.USE_PG_MEM !== 'true') {
  throw new Error('DATABASE_URL manquant. Configurez la connexion PostgreSQL dans server/.env.');
}
