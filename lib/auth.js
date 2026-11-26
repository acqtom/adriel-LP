import crypto from 'node:crypto';
import { json } from './http.js';

const COOKIE = 'ph_dash';
const MAX_AGE = 30 * 24 * 3600;

// Changing DASHBOARD_PASSWORD in Vercel logs everyone out (unless SESSION_SECRET is set separately).
function secret() { return process.env.SESSION_SECRET || process.env.DASHBOARD_PASSWORD || ''; }
function hash(s) { return crypto.createHash('sha256').update(String(s)).digest(); }
function safeEq(a, b) { return crypto.timingSafeEqual(hash(a), hash(b)); }
function sign(exp) { return exp + '.' + crypto.createHmac('sha256', secret()).update('dash:' + exp).digest('base64url'); }

function cookies(req) {
  const out = {};
  for (const part of (req.headers.cookie || '').split(';')) {
    const i = part.indexOf('=');
    if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}

export const passwordConfigured = () => !!process.env.DASHBOARD_PASSWORD;
export const checkPassword = (pw) => passwordConfigured() && safeEq(String(pw || ''), process.env.DASHBOARD_PASSWORD);

export function isAuthed(req) {
  if (!secret()) return false;
  const c = cookies(req)[COOKIE];
  if (!c) return false;
  const exp = c.split('.')[0];
  if (!(Number(exp) > Date.now())) return false;
  return safeEq(c, sign(exp));
}

export function requireAuth(req, res) {
  if (isAuthed(req)) return true;
  json(res, 401, { error: 'Not logged in' });
  return false;
}

export function loginCookie() {
  return `${COOKIE}=${sign(String(Date.now() + MAX_AGE * 1000))}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${MAX_AGE}`;
}
export function logoutCookie() {
  return `${COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;
}
