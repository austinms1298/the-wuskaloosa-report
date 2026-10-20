// =============================================================================
// Wuskaloosa Report — Admin API Worker
// =============================================================================
// Deploy: wrangler deploy
//
//   USER1_USERNAME / USER1_PASSWORD   first admin
//   USER2_USERNAME / USER2_PASSWORD   second admin
//   GITHUB_PAT                        Fine-grained PAT, Contents: Read & Write
//   JWT_SECRET                        openssl rand -hex 32
//
// Comments (see worker/COMMENTS_SETUP.md for the full walkthrough):
//   DB (D1 binding)                   created with `wrangler d1 create ...`
//   TURNSTILE_SECRET_KEY               optional — omit to run without Turnstile
// =============================================================================

import { moderate } from './moderation.js';

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

async function handleDeleteFile(req, env, ch) {
  const { path, sha } = await req.json().catch(() => ({}));
  if (!path || typeof path !== 'string')       return respond({ error: 'Missing path' }, 400, ch);
  if (path.startsWith('/'))                    return respond({ error: 'path must not start with /' }, 400, ch);
  if (path.split('/').some(s => s === '..'))   return respond({ error: 'path must not contain ..' }, 400, ch);
  if (!sha)                                    return respond({ error: 'Missing sha' }, 400, ch);
  const repoPath = `public/${path}`;
  await ghRequest('DELETE', `/repos/${REPO}/contents/${repoPath}`, env.GITHUB_PAT, {
    message: `Delete: ${repoPath}`,
    sha,
    branch: BRANCH,
  });
  return respond({ ok: true }, 200, ch);
}

async function handleUpload(req, env, ch) {
  const { path, content, sha: clientSha } = await req.json().catch(() => ({}));
  if (!path || typeof path !== 'string')      return respond({ error: 'Missing or invalid path' }, 400, ch);
  if (path.startsWith('/'))                   return respond({ error: 'path must not start with /' }, 400, ch);
  if (path.split('/').some(s => s === '..'))  return respond({ error: 'path must not contain ..' }, 400, ch);
  if (!content || typeof content !== 'string') return respond({ error: 'Missing content' }, 400, ch);

  const repoPath = `public/${path}`;

  // If no SHA supplied by the client, fetch the existing file's SHA so we can
  // update it without a 422 "sha wasn't supplied" error from GitHub.
  let sha = clientSha;
  if (!sha) {
    try {
      const existing = await ghRequest('GET', `/repos/${REPO}/contents/${repoPath}?ref=${BRANCH}`, env.GITHUB_PAT);
      if (existing.sha) sha = existing.sha;
    } catch {} // 404 = new file, no SHA needed
  }

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


// ── Comments (D1: DB) ──────────────────────────────────────────────────────
// Public, account-free comments. See worker/COMMENTS_SETUP.md for setup.

const MAX_NAME_LEN    = 60;
const MAX_COMMENT_LEN = 2000;
const MIN_COMMENT_LEN = 2;
const RATE_LIMIT_MS   = 15 * 1000;        // min time between comments, per IP
const DUPLICATE_WINDOW_MS = 5 * 60 * 1000; // reject identical repeat body, per IP

function uid() {
  return crypto.randomUUID();
}

async function hashIp(ip, secret) {
  const data = new TextEncoder().encode(`${ip}|${secret || 'wuskaloosa'}`);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, '0')).join('');
}

function stripHtml(str) {
  return String(str || '').replace(/<[^>]*>/g, '').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '');
}

async function verifyTurnstile(token, ip, env) {
  if (!env.TURNSTILE_SECRET_KEY) return true; // Turnstile not configured — skip
  if (!token) return false;
  try {
    const form = new FormData();
    form.append('secret', env.TURNSTILE_SECRET_KEY);
    form.append('response', token);
    if (ip) form.append('remoteip', ip);
    const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST', body: form,
    });
    const data = await res.json();
    return !!data.success;
  } catch {
    return false;
  }
}

function commentRow(r, anonId) {
  return {
    id: r.id,
    slug: r.post_slug,
    name: r.name,
    body: r.body,
    createdAt: r.created_at,
    likeCount: r.like_count,
    liked: anonId ? !!r.liked_by_me : false,
    isMine: !!(anonId && r.anon_id && r.anon_id === anonId),
  };
}

// Admin-only fields included on top of commentRow(), for the moderation view
function adminCommentRow(r) {
  return {
    id: r.id,
    slug: r.post_slug,
    name: r.name,
    body: r.body,
    createdAt: r.created_at,
    likeCount: r.like_count,
    status: r.status,
    moderationReason: r.moderation_reason,
    moderationCategory: r.moderation_category,
  };
}

async function handleListComments(url, env, ch) {
  if (!env.DB) return respond({ error: 'Comments are not configured yet.' }, 503, ch);
  const slug   = (url.searchParams.get('slug') || '').trim();
  const sort   = url.searchParams.get('sort') === 'liked' ? 'liked' : 'newest';
  const anonId = (url.searchParams.get('anonId') || '').trim();
  if (!slug) return respond({ error: 'Missing slug' }, 400, ch);

  const orderBy = sort === 'liked'
    ? 'c.like_count DESC, c.created_at DESC'
    : 'c.created_at DESC';

  const query = anonId
    ? `SELECT c.*, EXISTS(
         SELECT 1 FROM comment_likes l WHERE l.comment_id = c.id AND l.anon_id = ?2
       ) AS liked_by_me
       FROM comments c WHERE c.post_slug = ?1 AND c.status = 'approved'
       ORDER BY ${orderBy} LIMIT 500`
    : `SELECT c.*, 0 AS liked_by_me FROM comments c
       WHERE c.post_slug = ?1 AND c.status = 'approved'
       ORDER BY ${orderBy} LIMIT 500`;

  const stmt = anonId
    ? env.DB.prepare(query).bind(slug, anonId)
    : env.DB.prepare(query).bind(slug);

  const { results } = await stmt.all();
  const comments = results.map(r => commentRow(r, anonId));
  return respond({ comments, total: comments.length }, 200, ch);
}

async function handleCreateComment(req, env, ch) {
  if (!env.DB) return respond({ error: 'Comments are not configured yet.' }, 503, ch);
  const body = await req.json().catch(() => ({}));
  const slug       = String(body.slug || '').trim();
  const name       = stripHtml(body.name).trim().slice(0, MAX_NAME_LEN);
  const commentTxt = stripHtml(body.body).trim().slice(0, MAX_COMMENT_LEN);
  const turnstileToken = body.turnstileToken || '';
  const anonId     = String(body.anonId || '').trim().slice(0, 100) || null;

  if (!slug)        return respond({ error: 'Missing post.' }, 400, ch);
  if (!name)         return respond({ error: 'Please enter a name.' }, 400, ch);
  if (commentTxt.length < MIN_COMMENT_LEN)
    return respond({ error: 'Comment is too short.' }, 400, ch);

  const ip = req.headers.get('CF-Connecting-IP') || '0.0.0.0';
  const ipHash = await hashIp(ip, env.JWT_SECRET);

  const turnstileOk = await verifyTurnstile(turnstileToken, ip, env);
  if (!turnstileOk) return respond({ error: 'Spam check failed. Please try again.' }, 400, ch);

  // Rate limit: one comment per IP per RATE_LIMIT_MS
  const last = await env.DB.prepare(
    `SELECT created_at FROM comments WHERE ip_hash = ?1 ORDER BY created_at DESC LIMIT 1`
  ).bind(ipHash).first();
  const now = Date.now();
  if (last && now - last.created_at < RATE_LIMIT_MS) {
    return respond({ error: "You're commenting too quickly. Please wait a moment and try again." }, 429, ch);
  }

  // Duplicate protection: same IP + same body within the window
  const dup = await env.DB.prepare(
    `SELECT id FROM comments WHERE ip_hash = ?1 AND body = ?2 AND created_at > ?3 LIMIT 1`
  ).bind(ipHash, commentTxt, now - DUPLICATE_WINDOW_MS).first();
  if (dup) return respond({ error: 'That comment was already posted.' }, 400, ch);

  const result = moderate(name, commentTxt);
  const id = uid();
  await env.DB.prepare(
    `INSERT INTO comments (id, post_slug, name, body, created_at, status, moderation_reason, moderation_category, like_count, ip_hash, anon_id)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, 0, ?9, ?10)`
  ).bind(id, slug, name, commentTxt, now, result.allowed ? 'approved' : 'rejected',
         result.reason, result.category, ipHash, anonId).run();

  if (!result.allowed) {
    return respond({ error: result.reason, category: result.category }, 400, ch);
  }

  const total = await env.DB.prepare(
    `SELECT COUNT(*) AS n FROM comments WHERE post_slug = ?1 AND status = 'approved'`
  ).bind(slug).first();

  return respond({
    comment: { id, slug, name, body: commentTxt, createdAt: now, likeCount: 0, liked: false, isMine: true },
    total: total.n,
  }, 200, ch);
}

async function handleDeleteComment(commentId, req, env, ch) {
  if (!env.DB) return respond({ error: 'Comments are not configured yet.' }, 503, ch);

  const row = await env.DB.prepare(`SELECT id, post_slug, anon_id FROM comments WHERE id = ?1`).bind(commentId).first();
  if (!row) return respond({ error: 'Comment not found.' }, 404, ch);

  // Admin (valid JWT) can delete anything; otherwise the request must prove
  // it came from the same browser that posted the comment.
  const authHeader = req.headers.get('Authorization') || '';
  const payload = await jwtVerify(authHeader.replace(/^Bearer /, ''), env.JWT_SECRET || '');
  const isAdmin = !!payload;

  if (!isAdmin) {
    const body = await req.json().catch(() => ({}));
    const anonId = String(body.anonId || '').trim();
    if (!anonId || !row.anon_id || anonId !== row.anon_id) {
      return respond({ error: 'You can only delete your own comments.' }, 403, ch);
    }
  }

  await env.DB.prepare(`DELETE FROM comment_likes WHERE comment_id = ?1`).bind(commentId).run();
  await env.DB.prepare(`DELETE FROM comments WHERE id = ?1`).bind(commentId).run();

  const total = await env.DB.prepare(
    `SELECT COUNT(*) AS n FROM comments WHERE post_slug = ?1 AND status = 'approved'`
  ).bind(row.post_slug).first();

  return respond({ ok: true, total: total.n }, 200, ch);
}

// ── Admin: comment moderation (protected — mounted after the auth guard) ──────

async function handleAdminListCommentPosts(env, ch) {
  if (!env.DB) return respond({ error: 'Comments are not configured yet.' }, 503, ch);
  const { results } = await env.DB.prepare(
    `SELECT post_slug,
            COUNT(*) AS total,
            SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) AS rejected,
            MAX(created_at) AS last_at
     FROM comments
     GROUP BY post_slug
     ORDER BY last_at DESC`
  ).all();
  const posts = results.map(r => ({
    slug: r.post_slug, total: r.total, rejected: r.rejected, lastAt: r.last_at,
  }));
  return respond(posts, 200, ch);
}

async function handleAdminListComments(url, env, ch) {
  if (!env.DB) return respond({ error: 'Comments are not configured yet.' }, 503, ch);
  const slug = (url.searchParams.get('slug') || '').trim();
  if (!slug) return respond({ error: 'Missing slug' }, 400, ch);
  const { results } = await env.DB.prepare(
    `SELECT * FROM comments WHERE post_slug = ?1 ORDER BY created_at DESC LIMIT 1000`
  ).bind(slug).all();
  return respond(results.map(adminCommentRow), 200, ch);
}

async function handleToggleLike(commentId, req, env, ch) {
  if (!env.DB) return respond({ error: 'Comments are not configured yet.' }, 503, ch);
  const body = await req.json().catch(() => ({}));
  const anonId = String(body.anonId || '').trim();
  if (!anonId) return respond({ error: 'Missing client id.' }, 400, ch);

  const existing = await env.DB.prepare(
    `SELECT id FROM comment_likes WHERE comment_id = ?1 AND anon_id = ?2`
  ).bind(commentId, anonId).first();

  let liked;
  if (existing) {
    await env.DB.prepare(`DELETE FROM comment_likes WHERE id = ?1`).bind(existing.id).run();
    await env.DB.prepare(`UPDATE comments SET like_count = MAX(0, like_count - 1) WHERE id = ?1`).bind(commentId).run();
    liked = false;
  } else {
    await env.DB.prepare(
      `INSERT INTO comment_likes (id, comment_id, anon_id, created_at) VALUES (?1, ?2, ?3, ?4)`
    ).bind(uid(), commentId, anonId, Date.now()).run();
    await env.DB.prepare(`UPDATE comments SET like_count = like_count + 1 WHERE id = ?1`).bind(commentId).run();
    liked = true;
  }

  const row = await env.DB.prepare(`SELECT like_count FROM comments WHERE id = ?1`).bind(commentId).first();
  return respond({ liked, likeCount: row ? row.like_count : 0 }, 200, ch);
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
  // Collect all keys across KV pages (1000 max per list call)
  const allKeys = [];
  let cursor;
  do {
    const result = await env.EMAIL_LIST.list({ prefix: 'sub:', limit: 1000, ...(cursor ? { cursor } : {}) });
    allKeys.push(...result.keys);
    cursor = result.list_complete ? undefined : result.cursor;
  } while (cursor);
  // Fetch values in parallel batches of 50
  const emails = [];
  const BATCH = 50;
  for (let i = 0; i < allKeys.length; i += BATCH) {
    const vals = await Promise.all(allKeys.slice(i, i + BATCH).map(k => env.EMAIL_LIST.get(k.name)));
    for (const val of vals) {
      if (val) { try { emails.push(JSON.parse(val)); } catch {} }
    }
  }
  emails.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  return respond({ emails, total: emails.length }, 200, ch);
}

async function handleImportEmails(req, env, ch) {
  if (!env.EMAIL_LIST) return respond({ error: 'Email list not configured' }, 503, ch);
  const { emails } = await req.json().catch(() => ({}));
  if (!Array.isArray(emails)) return respond({ error: 'emails must be an array' }, 400, ch);
  let added = 0, skipped = 0;
  // Validate first
  const valid = [];
  for (const email of emails) {
    const e = String(email || '').trim().toLowerCase();
    if (!e || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)) { skipped++; continue; }
    valid.push(e);
  }
  // Parallel batches: check duplicates then put
  const BATCH = 25;
  const now = new Date().toISOString();
  for (let i = 0; i < valid.length; i += BATCH) {
    const batch = valid.slice(i, i + BATCH);
    const existing = await Promise.all(batch.map(e => env.EMAIL_LIST.get('sub:' + e)));
    const puts = [];
    for (let j = 0; j < batch.length; j++) {
      if (existing[j]) { skipped++; continue; }
      puts.push(env.EMAIL_LIST.put('sub:' + batch[j], JSON.stringify({
        email: batch[j], timestamp: now, source: 'import',
      })));
      added++;
    }
    await Promise.all(puts);
  }
  return respond({ ok: true, added, skipped }, 200, ch);
}

async function handleWipeEmails(env, ch) {
  if (!env.EMAIL_LIST) return respond({ error: 'Email list not configured' }, 503, ch);
  const allKeys = [];
  let cursor;
  do {
    const result = await env.EMAIL_LIST.list({ prefix: 'sub:', limit: 1000, ...(cursor ? { cursor } : {}) });
    allKeys.push(...result.keys.map(k => k.name));
    cursor = result.list_complete ? undefined : result.cursor;
  } while (cursor);
  const BATCH = 25;
  for (let i = 0; i < allKeys.length; i += BATCH) {
    await Promise.all(allKeys.slice(i, i + BATCH).map(k => env.EMAIL_LIST.delete(k)));
  }
  return respond({ ok: true, deleted: allKeys.length }, 200, ch);
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

      // ── Public: comments ──
      if (url.pathname === '/api/comments' && method === 'GET')
        return await handleListComments(url, env, ch);
      if (url.pathname === '/api/comments' && method === 'POST')
        return await handleCreateComment(request, env, ch);
      const likeMatch = url.pathname.match(/^\/api\/comments\/([^/]+)\/like$/);
      if (likeMatch && method === 'POST')
        return await handleToggleLike(likeMatch[1], request, env, ch);
      // Delete is "public" (self-service, via matching anonId) but also
      // doubles as the admin delete route — handleDeleteComment checks for
      // a valid admin JWT internally and allows either path.
      const deleteMatch = url.pathname.match(/^\/api\/comments\/([^/]+)$/);
      if (deleteMatch && method === 'DELETE')
        return await handleDeleteComment(deleteMatch[1], request, env, ch);

      // ── Auth guard ──
      const authHeader = request.headers.get('Authorization') || '';
      const payload    = await jwtVerify(authHeader.replace(/^Bearer /, ''), env.JWT_SECRET || '');
      if (!payload) return respond({ error: 'Unauthorized' }, 401, ch);

      // ── Protected: file upload ──
      if (url.pathname === '/api/upload' && method === 'POST')
        return await handleUpload(request, env, ch);
      if (url.pathname === '/api/upload' && method === 'DELETE')
        return await handleDeleteFile(request, env, ch);

      // ── Protected: ads config ──
      if (url.pathname === '/api/ads' && method === 'POST')
        return await handleSaveAds(request, env, ch);

      // ── Protected: email list ──
      if (url.pathname === '/api/emails' && method === 'GET')
        return await handleListEmails(env, ch);
      if (url.pathname === '/api/emails' && method === 'DELETE')
        return await handleWipeEmails(env, ch);
      if (url.pathname === '/api/emails/import' && method === 'POST')
        return await handleImportEmails(request, env, ch);
      const emailDel = url.pathname.match(/^\/api\/emails\/(.+)$/);
      if (emailDel && method === 'DELETE')
        return await handleDeleteEmail(decodeURIComponent(emailDel[1]), env, ch);

      // ── Protected: comment moderation ──
      if (url.pathname === '/api/admin/comments/posts' && method === 'GET')
        return await handleAdminListCommentPosts(env, ch);
      if (url.pathname === '/api/admin/comments' && method === 'GET')
        return await handleAdminListComments(url, env, ch);

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
