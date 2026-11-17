import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import { findUserById } from '../models/index.js';

export const COOKIE = 'pulse_token';
const WEEK = 7 * 24 * 3600 * 1000;

export const signToken = (user) => jwt.sign({ sub: user.id }, config.jwtSecret, { expiresIn: '7d' });
export const signSocketToken = (user) =>
  jwt.sign({ sub: user.id, purpose: 'socket' }, config.jwtSecret, { expiresIn: '60s' });

export const setAuthCookie = (res, token) =>
  res.cookie(COOKIE, token, { httpOnly: true, secure: config.isProd, sameSite: 'lax', maxAge: WEEK });

// Le rôle et le blocage sont relus en base à chaque requête : jamais fiés au token.
export async function userFromToken(token) {
  if (!token) return null;
  let sub;
  try {
    ({ sub } = jwt.verify(token, config.jwtSecret));
  } catch {
    return null;
  }
  const user = await findUserById(sub);
  return user && !user.blocked ? user : null;
}

export async function userFromSocketToken(token) {
  if (!token) return null;
  let claims;
  try {
    claims = jwt.verify(token, config.jwtSecret);
  } catch {
    return null;
  }
  if (claims.purpose !== 'socket') return null;
  const user = await findUserById(claims.sub);
  return user && !user.blocked ? user : null;
}

export async function requireAuth(req, res, next) {
  const user = await userFromToken(req.cookies?.[COOKIE]);
  if (!user) return res.status(401).json({ error: 'Non authentifié' });
  req.user = user;
  next();
}

export function requireUser(req, res, next) {
  if (req.user.role !== 'user') return res.status(403).json({ error: 'Accès réservé aux utilisateurs' });
  next();
}

export function requireAdmin(req, res, next) {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Accès réservé aux administrateurs' });
  next();
}
