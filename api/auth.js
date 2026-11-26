import { checkPassword, isAuthed, loginCookie, logoutCookie, passwordConfigured } from '../lib/auth.js';
import { handle, json, readBody } from '../lib/http.js';

export default handle(async (req, res) => {
  if (req.method === 'GET') return json(res, 200, { authed: isAuthed(req), configured: passwordConfigured() });

  if (req.method === 'POST') {
    if (!passwordConfigured()) return json(res, 503, { error: 'No password set. Add DASHBOARD_PASSWORD in Vercel, then redeploy.' });
    if (!checkPassword(readBody(req).password)) {
      await new Promise((r) => setTimeout(r, 800)); // slow down guessing
      return json(res, 401, { error: 'Wrong password' });
    }
    res.setHeader('Set-Cookie', loginCookie());
    return json(res, 200, { ok: true });
  }

  if (req.method === 'DELETE') {
    res.setHeader('Set-Cookie', logoutCookie());
    return json(res, 200, { ok: true });
  }

  json(res, 405, { error: 'Method not allowed' });
});
