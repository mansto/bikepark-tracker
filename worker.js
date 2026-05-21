// ── CORS ─────────────────────────────────────────────────────────────────────
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, PUT, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type',
};

function jsonRes(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status, headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

function errRes(message, status = 400) {
  return jsonRes({ error: message }, status);
}

// ── Crypto Helpers ────────────────────────────────────────────────────────────
async function hashPassword(password) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']
  );
  const hash = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations: 10_000 }, key, 256
  );
  const b64 = buf => btoa(String.fromCharCode(...new Uint8Array(buf)));
  return `pbkdf2:v1:${b64(salt)}:${b64(hash)}`;
}

async function verifyPassword(password, stored) {
  const parts = stored.split(':');
  if (parts.length !== 4 || parts[0] !== 'pbkdf2') return false;
  const salt = Uint8Array.from(atob(parts[2]), c => c.charCodeAt(0));
  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']
  );
  const hash = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations: 10_000 }, key, 256
  );
  const a = new Uint8Array(hash);
  const b = Uint8Array.from(atob(parts[3]), c => c.charCodeAt(0));
  let diff = a.length ^ b.length;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ (b[i] ?? 0);
  return diff === 0;
}

function generateToken(prefix = 'sess') {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  const hex = Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
  return `${prefix}_${hex}`;
}

// ── Session Auth ──────────────────────────────────────────────────────────────
async function requireAuth(request, env) {
  const auth = request.headers.get('Authorization') || '';
  if (!auth.startsWith('Bearer ')) return null;
  const token = auth.slice(7);
  return await env.GRAVITY_KV.get(`sessions:${token}`, 'json');
}

// ── Handlers ──────────────────────────────────────────────────────────────────
async function handleLogin(request, env) {
  const body = await request.json().catch(() => null);
  if (!body) return errRes('INVALID_BODY');

  const username = (body.username || '').trim().toLowerCase();
  const password = body.password || '';

  const userRaw = await env.GRAVITY_KV.get(`users:${username}`);
  if (!userRaw) return errRes('INVALID_CREDENTIALS', 401);

  const user = JSON.parse(userRaw);
  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) return errRes('INVALID_CREDENTIALS', 401);

  const token = generateToken('sess');
  await env.GRAVITY_KV.put(
    `sessions:${token}`,
    JSON.stringify({ userId: user.id, username, createdAt: Date.now() }),
    { expirationTtl: 60 * 60 * 24 * 7 }
  );

  return jsonRes({ token, username, userId: user.id });
}

async function handleLogout(request, env) {
  const auth = request.headers.get('Authorization') || '';
  if (auth.startsWith('Bearer ')) {
    await env.GRAVITY_KV.delete(`sessions:${auth.slice(7)}`);
  }
  return jsonRes({ ok: true });
}

async function handleGetData(request, env) {
  const session = await requireAuth(request, env);
  if (!session) return errRes('UNAUTHORIZED', 401);

  const data = await env.GRAVITY_KV.get(`user-data:${session.userId}`, 'json');
  return jsonRes(data ?? {});
}

async function handlePutData(request, env) {
  const session = await requireAuth(request, env);
  if (!session) return errRes('UNAUTHORIZED', 401);

  const body = await request.json().catch(() => null);
  if (!body) return errRes('INVALID_BODY');

  await env.GRAVITY_KV.put(`user-data:${session.userId}`, JSON.stringify(body));
  return new Response('OK', { headers: CORS });
}

// ── Router ────────────────────────────────────────────────────────────────────
export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS')
      return new Response(null, { status: 204, headers: CORS });

    const url = new URL(request.url);
    const { pathname } = url;
    const method = request.method;

    if (pathname === '/login'        && method === 'POST') return handleLogin(request, env);
    if (pathname === '/logout'       && method === 'POST') return handleLogout(request, env);
    if (pathname === '/'             && method === 'GET')  return handleGetData(request, env);
    if (pathname === '/'             && method === 'PUT')  return handlePutData(request, env);

    return new Response('Not Found', { status: 404, headers: CORS });
  },
};
