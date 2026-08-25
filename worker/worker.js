// =============================================================================
// Wuskaloosa Report — Admin API Worker
// =============================================================================
// Deploy: wrangler deploy
//
//   USER1_USERNAME / USER1_PASSWORD   first admin
//   USER2_USERNAME / USER2_PASSWORD   second admin
//   GITHUB_PAT                        Fine-grained PAT, Contents: Read & Write
//   JWT_SECRET                        openssl rand -hex 32
// =============================================================================

const REPO       = 'austinms1298/the-wuskaloosa-report';
const POSTS_PATH = 'src/content/posts';
const BRANCH     = 'main';
const GH_API     = 'https://api.github.com';

// ── CORS ─────────────────────────────────────────────────────────────────────
function corsHeaders(origin) {
  const allowed =
    origin === 'https://wuskaloosareport.com' ||
    (origin && origin.startsWith('http://localhost:')) ||
    (origin && origin.endsWith('.pages.dev'));
  return {
    'Access-Control-Allow-Origin':  allowed ? origin : 'https://wuskaloosareport.com',
    'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age':       '86400',
  };
}

function respond(data, status, ch) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...ch },
  });
}

// ── JWT ──────────────────────────────────────────────────────────────────────
function b64url(str) {
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function fromb64url(str) {
  return str.replace(/-/g, '+').replace(/_/g, '/') + '=='.slice((str.length + 3) % 4);
}

async function jwtSign(payload, secret) {
  const header = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body   = b64url(JSON.stringify(payload));
  const msg    = `${header}.${body}`;
  const key    = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  const rawSig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(msg));
  return `${msg}.${b64url(String.fromCharCode(...new Uint8Array(rawSig)))}`;
}

async function jwtVerify(token, secret) {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const [h, b, s] = parts;
    const key = await crypto.subtle.importKey(
      'raw', new TextEncoder().encode(secret),
      { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']
    );
    const sigBytes = Uint8Array.from(atob(fromb64url(s)), c => c.charCodeAt(0));
    const ok = await crypto.subtle.verify('HMAC', key, sigBytes, new TextEncoder().encode(`${h}.${b}`));
    if (!ok) return null;
    const payload = JSON.parse(atob(fromb64url(b)));
    if (payload.exp && Date.now() > payload.exp) return null;
    return payload;
  } catch { return null; }
}

// ── GitHub helpers ────────────────────────────────────────────────────────────
function ghHeaders(pat) {
  return {
    Authorization:          `Bearer ${pat}`,
    Accept:                 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'Content-Type':         'application/json',
    'User-Agent':           'wuskaloosa-admin-worker',
  };
}

async function ghRequest(method, path, pat, body) {
  const res = await fetch(`${GH_API}${path}`, {
    method,
    headers: ghHeaders(pat),
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`GitHub ${res.status}: ${text}`);
  return text ? JSON.parse(text) : {};
}

function b64decode(str) {
  const bytes = Uint8Array.from(atob(str.replace(/\n/g, '')), c => c.charCodeAt(0));
  return new TextDecoder('utf-8').decode(bytes);
}
function b64encode(str) {
  const bytes = new TextEncoder().encode(str);
  let bin = '';
  bytes.forEach(b => (bin += String.fromCharCode(b)));
  return btoa(bin);
}

// ── Route handlers ────────────────────────────────────────────────────────────

async function handleLogin(req, env, ch) {
  const body = await req.json().catch(() => ({}));
  const { username = '', password = '' } = body;
  const users = [
    { u: env.USER1_USERNAME, p: env.USER1_PASSWORD },
    { u: env.USER2_USERNAME, p: env.USER2_PASSWORD },
  ].filter(x => x.u);
  const match = users.find(x => x.u === username && x.p === password);
  if (!match) return respond({ error: 'Invalid credentials' }, 401, ch);
  const token = await jwtSign(
    { sub: username, iat: Date.now(), exp: Date.now() + 8 * 60 * 60 * 1000 },
    env.JWT_SECRET
  );
  return respond({ token, username }, 200, ch);
}

async function handleListPosts(env, ch) {
  let files;
  try {
    files = await ghRequest('GET', `/repos/${REPO}/contents/${POSTS_PATH}?ref=${BRANCH}`, env.GITHUB_PAT);
  } catch (err) {
    if (err.message.includes('404')) return respond([], 200, ch);
    throw err;
  }
  const posts = (Array.isArray(files) ? files : [])
    .filter(f => f.name.endsWith('.md'))
    .map(f => ({ name: f.name, sha: f.sha }))
    .sort((a, b) => b.name.localeCompare(a.name));
  return respond(posts, 200, ch);
}

async function handleGetPost(filename, env, ch) {
  const file = await ghRequest(
    'GET', `/repos/${REPO}/contents/${POSTS_PATH}/${filename}?ref=${BRANCH}`, env.GITHUB_PAT
  );
  return respond({ content: b64decode(file.content), sha: file.sha }, 200, ch);
}

async function handleSavePost(req, filename, env, ch) {
  const { content, sha } = await req.json();
  await ghRequest('PUT', `/repos/${REPO}/contents/${POSTS_PATH}/${filename}`, env.GITHUB_PAT, {
    message: sha ? `Update: ${filename}` : `Add: ${filename}`,
    content: b64encode(content),
    branch:  BRANCH,
    ...(sha ? { sha } : {}),
  });
  const updated = await ghRequest(
    'GET', `/repos/${REPO}/contents/${POSTS_PATH}/${filename}?ref=${BRANCH}`, env.GITHUB_PAT
  );
  return respond({ ok: true, sha: updated.sha }, 200, ch);
}

async function handleDeletePost(filename, sha, env, ch) {
  await ghRequest('DELETE', `/repos/${REPO}/contents/${POSTS_PATH}/${filename}`, env.GITHUB_PAT,
    { message: `Delete: ${filename}`, sha, branch: BRANCH });
  return respond({ ok: true }, 200, ch);
}

async function handleUpload(req, env, ch) {
  const { path, content, sha } = await req.json().catch(() => ({}));
  if (!path || typeof path !== 'string')      return respond({ error: 'Missing or invalid path' }, 400, ch);
  if (path.startsWith('/'))                   return respond({ error: 'path must not start with /' }, 400, ch);
  if (path.split('/').some(s => s === '..'))  return respond({ error: 'path must not contain ..' }, 400, ch);
  if (!content || typeof content !== 'string') return respond({ error: 'Missing content' }, 400, ch);

  const repoPath = `public/${path}`;
  await ghRequest('PUT', `/repos/${REPO}/contents/${repoPath}`, env.GITHUB_PAT, {
    message: `Upload: ${repoPath}`,
    content,
    branch: BRANCH,
    ...(sha ? { sha } : {}),
  });
  const updated = await ghRequest('GET', `/repos/${REPO}/contents/${repoPath}?ref=${BRANCH}`, env.GITHUB_PAT);
  return respond({ ok: true, url: `/${path}`, sha: updated.sha }, 200, ch);
}

// Ads config stored at public/ads/config.json
const ADS_CONFIG_PATH = 'public/ads/config.json';

async function handleGetAds(env, ch) {
  try {
    const file = await ghRequest('GET', `/repos/${REPO}/contents/${ADS_CONFIG_PATH}?ref=${BRANCH}`, env.GITHUB_PAT);
    const config = JSON.parse(b64decode(file.content));
    return respond({ config, sha: file.sha }, 200, ch);
  } catch (err) {
    if (err.message.includes('404')) return respond({ config: {}, sha: null }, 200, ch);
    throw err;
  }
}

async function handleSaveAds(req, env, ch) {
  const { config, sha } = await req.json().catch(() => ({}));
  if (!config || typeof config !== 'object') return respond({ error: 'Invalid config' }, 400, ch);
  const content = b64encode(JSON.stringify(config, null, 2));
  await ghRequest('PUT', `/repos/${REPO}/contents/${ADS_CONFIG_PATH}`, env.GITHUB_PAT, {
    message: 'Update ads config',
    content,
    branch: BRANCH,
    ...(sha ? { sha } : {}),
  });
  const updated = await ghRequest('GET', `/repos/${REPO}/contents/${ADS_CONFIG_PATH}?ref=${BRANCH}`, env.GITHUB_PAT);
  return respond({ ok: true, sha: updated.sha }, 200, ch);
}


// ── Email list (KV: EMAIL_LIST) ───────────────────────────────────────────────

async function handleSubscribe(req, env, ch) {
  const { email } = await req.json().catch(() => ({}));
  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email))
    return respond({ error: 'Invalid email' }, 400, ch);
  if (!env.EMAIL_LIST) return respond({ error: 'Email list not configured' }, 503, ch);
  const key = 'sub:' + email.toLowerCase();
  const existing = await env.EMAIL_LIST.get(key);
  if (existing) return respond({ ok: true, duplicate: true }, 200, ch);
  await env.EMAIL_LIST.put(key, JSON.stringify({
    email: email.toLowerCase(),
    timestamp: new Date().toISOString(),
    source: 'signup',
  }));
  return respond({ ok: true }, 200, ch);
}

async function handleListEmails(env, ch) {
  if (!env.EMAIL_LIST) return respond({ emails: [], total: 0 }, 200, ch);
  const list = await env.EMAIL_LIST.list({ prefix: 'sub:' });
  const emails = [];
  for (const key of list.keys) {
    const val = await env.EMAIL_LIST.get(key.name);
    if (val) { try { emails.push(JSON.parse(val)); } catch {} }
  }
  emails.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  return respond({ emails, total: emails.length }, 200, ch);
}

async function handleImportEmails(req, env, ch) {
  if (!env.EMAIL_LIST) return respond({ error: 'Email list not configured' }, 503, ch);
  const { emails } = await req.json().catch(() => ({}));
  if (!Array.isArray(emails)) return respond({ error: 'emails must be an array' }, 400, ch);
  let added = 0, skipped = 0;
  for (const email of emails) {
    if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(email).trim())) { skipped++; continue; }
    const key = 'sub:' + String(email).trim().toLowerCase();
    const existing = await env.EMAIL_LIST.get(key);
    if (existing) { skipped++; continue; }
    await env.EMAIL_LIST.put(key, JSON.stringify({
      email: String(email).trim().toLowerCase(),
      timestamp: new Date().toISOString(),
      source: 'import',
    }));
    added++;
  }
  return respond({ ok: true, added, skipped }, 200, ch);
}

async function handleDeleteEmail(email, env, ch) {
  if (!env.EMAIL_LIST) return respond({ error: 'Email list not configured' }, 503, ch);
  await env.EMAIL_LIST.delete('sub:' + email.toLowerCase());
  return respond({ ok: true }, 200, ch);
}

// ── Main ─────────────────────────────────────────────────────────────────────
export default {
  async fetch(request, env) {
    const url    = new URL(request.url);
    const method = request.method;
    const origin = request.headers.get('Origin') || '';
    const ch     = corsHeaders(origin);

    if (method === 'OPTIONS') return new Response(null, { status: 204, headers: ch });

    try {
      // ── Public routes ──
      if (url.pathname === '/api/login' && method === 'POST')
        return await handleLogin(request, env, ch);
      if (url.pathname === '/api/subscribe' && method === 'POST')
        return await handleSubscribe(request, env, ch);
      if (url.pathname === '/api/ads' && method === 'GET')
        return await handleGetAds(env, ch);

      // ── Auth guard ──
      const authHeader = request.headers.get('Authorization') || '';
      const payload    = await jwtVerify(authHeader.replace(/^Bearer /, ''), env.JWT_SECRET || '');
      if (!payload) return respond({ error: 'Unauthorized' }, 401, ch);

      // ── Protected: file upload ──
      if (url.pathname === '/api/upload' && method === 'POST')
        return await handleUpload(request, env, ch);

      // ── Protected: ads config ──
      if (url.pathname === '/api/ads' && method === 'POST')
        return await handleSaveAds(request, env, ch);

      // ── Protected: email list ──
      if (url.pathname === '/api/emails' && method === 'GET')
        return await handleListEmails(env, ch);
      if (url.pathname === '/api/emails/import' && method === 'POST')
        return await handleImportEmails(request, env, ch);
      const emailDel = url.pathname.match(/^\/api\/emails\/(.+)$/);
      if (emailDel && method === 'DELETE')
        return await handleDeleteEmail(decodeURIComponent(emailDel[1]), env, ch);

      // ── Protected: posts ──
      const m        = url.pathname.match(/^\/api\/posts(?:\/([^?]+))?$/);
      const filename = m?.[1];
      if (!filename && method === 'GET') return await handleListPosts(env, ch);
      if (filename  && method === 'GET') return await handleGetPost(filename, env, ch);
      if (filename  && method === 'POST') return await handleSavePost(request, filename, env, ch);
      if (filename  && method === 'DELETE')
        return await handleDeletePost(filename, url.searchParams.get('sha') || '', env, ch);

    } catch (err) {
      return respond({ error: err.message }, 500, ch);
    }

    return new Response('Not found', { status: 404 });
  },
};
