# Comments — setup & deployment

This adds a native, account-free comment section to every post page, backed
by Cloudflare D1 and served from your existing `wuskaloosa-admin` Worker.

I couldn't run these steps for you — `wrangler` on your machine isn't logged
in to Cloudflare (`wrangler whoami` reports "not authenticated"), and
deploying/creating a database needs your Cloudflare account. Run the
commands below from your terminal.

## 1. Log in to wrangler (one time)

```bash
cd ~/Documents/UWWA/the-wuskaloosa-report/worker
npx wrangler login
```

This opens a browser window to authorize wrangler against your Cloudflare
account.

## 2. Create the D1 database

```bash
npx wrangler d1 create wuskaloosa-comments
```

This prints something like:

```toml
[[d1_databases]]
binding = "DB"
database_name = "wuskaloosa-comments"
database_id = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
```

Copy the `database_id` value and paste it into `worker/wrangler.toml`,
replacing `PASTE_YOUR_D1_DATABASE_ID_HERE` (the `[[d1_databases]]` block is
already there — just the id needs filling in).

## 3. Create the tables

```bash
npx wrangler d1 execute wuskaloosa-comments --remote --file=schema.sql
```

This creates the `comments` and `comment_likes` tables. Safe to re-run — it
uses `CREATE TABLE IF NOT EXISTS`.

## 4. Deploy the Worker

```bash
npx wrangler deploy
```

This ships the new `/api/comments` routes alongside your existing admin API.
No new secrets are *required* — comments will work immediately without
Turnstile (step 5 below is optional).

## 5. (Optional) Turn on Turnstile bot protection

Cloudflare Turnstile is a free, invisible CAPTCHA alternative. Comments work
fine without it — this just adds an extra layer of spam protection.

1. In the Cloudflare dashboard, go to **Turnstile** → **Add a site**.
2. Use widget mode **Managed**, add `wuskaloosareport.com` as a domain.
3. Copy the **Site Key** and **Secret Key** it gives you.
4. Set the secret on the Worker:
   ```bash
   npx wrangler secret put TURNSTILE_SECRET_KEY
   ```
   (paste the Secret Key when prompted)
5. Open `src/main.js`, find this line near the top:
   ```js
   const TURNSTILE_SITE_KEY = '';
   ```
   and paste your **Site Key** between the quotes.
6. Rebuild and redeploy the site (commit + push as usual — Cloudflare Pages
   rebuilds automatically).

Leaving `TURNSTILE_SITE_KEY` blank is completely fine — the Worker simply
skips the Turnstile check when `TURNSTILE_SECRET_KEY` isn't set, so nothing
breaks either way.

## What this touches

- **New:** `worker/schema.sql` — the D1 table definitions.
- **New:** `worker/moderation.js` — the server-side (authoritative) word/phrase
  blocklists. Edit this file any time to add or remove blocked terms.
- **New:** `src/moderation.js` — an identical copy used for the real-time
  warning shown while someone is typing. Keep both files in sync when you
  edit the lists (the file itself explains this at the top).
- **Changed:** `worker/worker.js` — adds `GET/POST /api/comments` and
  `POST /api/comments/:id/like`, all public (no admin login needed).
- **Changed:** `worker/wrangler.toml` — adds the D1 binding.
- **Changed:** `src/main.js` — renders the comment section on every post page,
  and makes the `CATEGORY · DATE` line show a clickable comment count.
- **Changed:** `src/styles.css` — comment section styling, matching the
  existing Wuskaloosa design (Oswald headings, Inter body, crimson accents).

Nothing about the existing admin login, post editor, ads, or email-list
features changed.

## Testing it

After deploying, visit any post and scroll to the bottom. Post a test
comment, like it from a different browser (or an incognito window — likes
are deduped per-browser via a random id stored in `localStorage`, not an
account), and try posting something that should get flagged (e.g. a swear
word) to confirm the real-time warning and the button disabling work.

## Moderation tuning

Both `worker/moderation.js` and `src/moderation.js` export a
`MODERATION_CONFIG` object with clearly separated lists: `profanity`,
`slurs`, `sexual`, `threats`, `harassment`, `political.phrases`, and
`spam`. Add or remove entries as needed — one phrase per line. Political
terms are intentionally multi-word phrases (e.g. `"vote for trump"`, not
just `"trump"`) so ordinary words aren't blocked out of context. Remember:
edit both files identically, then redeploy the Worker (`wrangler deploy`
from `worker/`) *and* push the site (so the client-side copy updates too).
