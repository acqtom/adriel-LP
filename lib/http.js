export class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

export function json(res, status, obj) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(obj));
}

// Vercel parses JSON bodies; sendBeacon posts text/plain, which arrives as a string.
export function readBody(req) {
  let b = req.body;
  if (typeof b === 'string') { try { b = JSON.parse(b); } catch { b = null; } }
  return b && typeof b === 'object' ? b : {};
}

export function handle(fn) {
  return async (req, res) => {
    try { await fn(req, res); }
    catch (e) {
      const status = e.status || 500;
      if (status >= 500) console.error(e);
      json(res, status, { error: e.status ? e.message : 'Server error' });
    }
  };
}

export function str(v, max = 200) {
  if (v == null) return null;
  const s = String(v).trim().slice(0, max);
  return s || null;
}
