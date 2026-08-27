import './styles.css';
import yaml from 'js-yaml';
import { marked } from 'marked';
import { schedule, site } from './data/site.js';

const rawPosts = import.meta.glob('./content/posts/*.md', {
  query: '?raw',
  import: 'default',
  eager: true
});

function parsePost(path, raw) {
  const match = raw.match(/^---\s*\n([\s\S]*?)\n---\s*\n([\s\S]*)$/);
  const data = match ? yaml.load(match[1]) : {};
  const body = match ? match[2] : raw;
  const slug = data.slug || path.split('/').pop().replace('.md', '');
  return {
    slug,
    title: data.title || 'Untitled',
    excerpt: data.excerpt || '',
    date: data.date ? new Date(data.date) : new Date(),
    image: data.image || '/images/post-placeholder.svg',
    category: data.category || 'Latest Take',
    featured: Boolean(data.featured),
    draft: Boolean(data.draft),
    schedulePdf: data.schedule_pdf || null,
    body,
    html: body.trim().startsWith('<') ? body.trim() : marked.parse(body)
  };
}

const posts = Object.entries(rawPosts)
  .map(([path, raw]) => parsePost(path, raw))
  .filter(p => !p.draft)
  .sort((a, b) => b.date - a.date);

const escapeHtml = (value = '') => String(value).replace(/[&<>'"]/g, char => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#039;', '"': '&quot;'
}[char]));

const formatDate = date => new Intl.DateTimeFormat('en-US', {
  month: 'short', day: 'numeric', year: 'numeric'
}).format(date);

function postUrl(post) {
  return /^\d{4}\/week\d+$/.test(post.slug)
    ? `/${post.slug}`
    : `/post?slug=${encodeURIComponent(post.slug)}`;
}

function postCard(post) {
  return `
    <article class="post-card">
      <div class="post-card__body">
        <p class="eyebrow">${formatDate(post.date)} &middot; ${escapeHtml(post.category)}</p>
        <h3><a href="${postUrl(post)}">${escapeHtml(post.title)}</a></h3>
        <p style="white-space:pre-wrap">${escapeHtml(post.excerpt)}</p>
      </div>
    </article>`;
}

function header(active = 'home', hideBrand = false) {
  const links = [
    ['home', '/', 'Home'],
    ['archive', '/archive', 'Past Takes'],
    ['schedule', '/schedule', 'SEC Schedules'],
    ['about', '/about', 'About'],
  ];
  return `
    <header class="site-header">
      ${hideBrand ? '' : `<a class="brand" href="/" aria-label="The Wuskaloosa Report home">
        <img src="/images/logo.png" alt="The Wuskaloosa Report" class="brand-logo">
      </a>`}
      <button class="menu-toggle" aria-expanded="false" aria-controls="site-nav" aria-label="Open menu">☰</button>
      <nav id="site-nav" class="site-nav" aria-label="Primary navigation">
        ${links.map(([id, href, label]) => `<a class="${active === id ? 'active' : ''}" href="${href}">${label}</a>`).join('')}
      </nav>

    </header>`;
}

function footer() {
  return `
    ${newsletter()}
    <footer class="footer">
      <div><strong>${site.title}</strong><p>${site.tagline}</p></div>
      <p>© ${new Date().getFullYear()} The Wuskaloosa Report &mdash; <a href="mailto:${site.email}" style="color:#bbb">${site.email}</a></p>
    </footer>`;
}

function newsletter() {
  return `
    <section class="newsletter" id="subscribe">
      <div>
        <p class="marker-label">DON'T MISS A TAKE!</p>
        <h2>Get the newest thoughts, analysis and opinions in your inbox.</h2>
      </div>
      <form class="newsletter-form" id="newsletter-form">
        <label class="sr-only" for="nl-email">Email address</label>
        <input id="nl-email" type="email" name="email" placeholder="Enter your email" required>
        <button type="submit">LET'S GO!</button>
      </form>
    </section>`;
}

function homePage() {
  const featured = posts[0];
  const archive = posts.filter(post => post.slug !== featured?.slug).slice(0, 3);
  return `
    ${header('home')}
    <main>
      <section class="hero">
        <img src="/images/hero-panel.png" alt="A colorful caricature-style football broadcast panel seated on the University of Alabama campus">
      </section>

      <div class="home-grid page-shell">
        <section class="latest-take">
          <div class="latest-copy">
            <p class="eyebrow crimson">LATEST TAKE</p>
            <h1>${escapeHtml(featured?.title || 'The Latest Wuskaloosa Report')}</h1>
            ${featured ? `<p style="white-space:pre-wrap">${escapeHtml(featured.excerpt)}</p><a class="button" href="${postUrl(featured)}">READ THE TAKE <span>→</span></a>` : '<p style="color:var(--muted);font-size:15px;margin:10px 0">The first take drops before kickoff. Check back soon.</p>'}
          </div>
        </section>

        <aside class="schedule-card">
          <h2>2026 Alabama Football Schedule</h2>
          <div class="schedule-list">
            ${(() => {
              const today = new Date(); today.setHours(0,0,0,0);
              const weekEnd = new Date(today); weekEnd.setDate(weekEnd.getDate() + 7);
              return schedule.map(game => {
                const gd = game.gameDate ? new Date(game.gameDate) : null;
                const isThisWeek = gd && gd >= today && gd <= weekEnd;
                const isPast = gd && gd < today;
                const label = isThisWeek ? 'THIS WEEK!' : (isPast ? (game.result || 'FINAL') : (game.time || ''));
                const cls = isThisWeek ? 'featured' : '';
                const matchup = game.home === null ? game.opponent : `${game.home ? 'vs' : 'at'} ${game.opponent}`;
                return `<div class="schedule-row ${cls}"><span>${game.date}</span><strong>${matchup}</strong><b>${label}</b></div>`;
              }).join('');
            })()}
          </div>
          <a class="button button-small" href="/schedule">VIEW FULL SCHEDULE</a>
        </aside>

        <section class="archive-preview">
          <div class="section-heading"><h2>LAST WEEK'S TAKES ☆</h2>${archive.length ? `<a href="/archive">VIEW ALL →</a>` : ''}</div>
          ${archive.length ? `<div class="card-grid">${archive.map(postCard).join('')}</div>` : `<p style="color:var(--muted);font-size:14px;margin:8px 0 0">Takes are coming — check back soon.</p>`}
        </section>

        <aside class="sponsor-ad" id="ad-homepage">
          <p class="eyebrow">SPONSORSHIP</p>
          <h2>Your business could be featured here.</h2>
          <p>Reach Alabama football fans with a homepage sponsorship.</p>
          <a href="mailto:${site.email}?subject=Wuskaloosa%20Report%20Sponsorship">BECOME A SPONSOR →</a>
        </aside>

      </div>
    </main>
    ${footer()}`;
}

function archivePage() {
  const emptyState = `
    <div style="text-align:center;padding:60px 0;color:var(--muted)">
      <p style="font-family:var(--marker);font-size:40px;margin:0">Coming soon.</p>
      <p style="margin:12px 0 0;font-size:15px">The takes are loading — check back before kickoff.</p>
    </div>`;
  return `
    ${header('archive')}
    <main class="page-shell inner-page">
      <p class="eyebrow crimson">EVERY TAKE</p>
      <h1 class="page-title">Past Takes</h1>
      ${posts.length
        ? `<div class="card-grid archive-grid">${posts.map(postCard).join('')}</div>`
        : emptyState
      }
    </main>
    ${footer()}`;
}

function schedulePage() {
  // ── All 16 SEC teams, alphabetical ──────────────────────────────────────
  // loc: 'home' | 'away' | 'neutral' | 'bye'
  const SEC = [
    { name: 'Alabama', isHome: true, games: [
      ['Sept. 5',  'East Carolina',      'home'],
      ['Sept. 12', 'Kentucky',           'away'],
      ['Sept. 19', 'Florida State',      'home'],
      ['Sept. 26', 'South Carolina',     'home'],
      ['Oct. 3',   'Mississippi State',  'away'],
      ['Oct. 10',  'Georgia',            'home'],
      ['Oct. 17',  'Tennessee',          'away'],
      ['Oct. 24',  'Texas A&M',          'home'],
      ['Oct. 31',  '',                   'bye' ],
      ['Nov. 7',   'LSU',                'away'],
      ['Nov. 14',  'Vanderbilt',         'away'],
      ['Nov. 21',  'UT-Chattanooga',     'home'],
      ['Nov. 28',  'Auburn',             'home'],
    ]},
    { name: 'Arkansas', games: [
      ['Sept. 5',  'North Alabama',      'home'],
      ['Sept. 12', 'Utah',               'away'],
      ['Sept. 19', 'Georgia',            'home'],
      ['Sept. 26', 'Tulsa',              'home'],
      ['Oct. 3',   'Texas A&M',          'away'],
      ['Oct. 10',  'Tennessee',          'home'],
      ['Oct. 17',  'Vanderbilt',         'away'],
      ['Oct. 24',  '',                   'bye' ],
      ['Oct. 31',  'Missouri',           'home'],
      ['Nov. 7',   'Auburn',             'away'],
      ['Nov. 14',  'South Carolina',     'home'],
      ['Nov. 21',  'Texas',              'away'],
      ['Nov. 28',  'LSU',                'home'],
    ]},
    { name: 'Auburn', games: [
      ['Sept. 5',  'Baylor (Atlanta)',   'neutral'],
      ['Sept. 12', 'Southern Miss',      'home'],
      ['Sept. 19', 'Florida',            'home'],
      ['Sept. 26', 'Vanderbilt',         'home'],
      ['Oct. 3',   'Tennessee',          'away'],
      ['Oct. 10',  '',                   'bye' ],
      ['Oct. 17',  'Georgia',            'away'],
      ['Oct. 24',  'LSU',                'home'],
      ['Oct. 31',  'Ole Miss',           'away'],
      ['Nov. 7',   'Arkansas',           'home'],
      ['Nov. 14',  'Mississippi State',  'away'],
      ['Nov. 21',  'Samford',            'home'],
      ['Nov. 28',  'Alabama',            'away'],
    ]},
    { name: 'Florida', games: [
      ['Sept. 5',  'Florida Atlantic',   'home'],
      ['Sept. 12', 'Campbell',           'home'],
      ['Sept. 19', 'Auburn',             'away'],
      ['Sept. 26', 'Ole Miss',           'home'],
      ['Oct. 3',   'Missouri',           'away'],
      ['Oct. 10',  'South Carolina',     'home'],
      ['Oct. 17',  'Texas',              'away'],
      ['Oct. 24',  '',                   'bye' ],
      ['Oct. 31',  'Georgia (Atlanta)',  'neutral'],
      ['Nov. 7',   'Oklahoma',           'home'],
      ['Nov. 14',  'Kentucky',           'away'],
      ['Nov. 21',  'Vanderbilt',         'home'],
      ['Nov. 28',  'Florida State',      'away'],
    ]},
    { name: 'Georgia', games: [
      ['Sept. 5',  'Tennessee State',    'home'],
      ['Sept. 12', 'Western Kentucky',   'home'],
      ['Sept. 19', 'Arkansas',           'away'],
      ['Sept. 26', 'Oklahoma',           'home'],
      ['Oct. 3',   'Vanderbilt',         'home'],
      ['Oct. 10',  'Alabama',            'away'],
      ['Oct. 17',  'Auburn',             'home'],
      ['Oct. 24',  '',                   'bye' ],
      ['Oct. 31',  'Florida (Atlanta)',  'neutral'],
      ['Nov. 7',   'Ole Miss',           'away'],
      ['Nov. 14',  'Missouri',           'home'],
      ['Nov. 21',  'South Carolina',     'away'],
      ['Nov. 28',  'Georgia Tech',       'home'],
    ]},
    { name: 'Kentucky', games: [
      ['Sept. 5',  'Youngstown State',   'home'],
      ['Sept. 12', 'Alabama',            'home'],
      ['Sept. 19', 'Texas A&M',          'away'],
      ['Sept. 26', 'South Alabama',      'home'],
      ['Oct. 3',   'South Carolina',     'away'],
      ['Oct. 10',  'LSU',                'home'],
      ['Oct. 17',  'Oklahoma',           'away'],
      ['Oct. 24',  'Vanderbilt',         'home'],
      ['Oct. 31',  '',                   'bye' ],
      ['Nov. 7',   'Tennessee',          'away'],
      ['Nov. 14',  'Florida',            'home'],
      ['Nov. 21',  'Missouri',           'away'],
      ['Nov. 28',  'Louisville',         'home'],
    ]},
    { name: 'LSU', games: [
      ['Sept. 5',  'Clemson',            'home'],
      ['Sept. 12', 'Louisiana Tech',     'home'],
      ['Sept. 19', 'Ole Miss',           'away'],
      ['Sept. 26', 'Texas A&M',          'home'],
      ['Oct. 3',   'McNeese State',      'home'],
      ['Oct. 10',  'Kentucky',           'away'],
      ['Oct. 17',  'Mississippi State',  'home'],
      ['Oct. 24',  'Auburn',             'away'],
      ['Oct. 31',  '',                   'bye' ],
      ['Nov. 7',   'Alabama',            'home'],
      ['Nov. 14',  'Texas',              'home'],
      ['Nov. 21',  'Tennessee',          'away'],
      ['Nov. 28',  'Arkansas',           'away'],
    ]},
    { name: 'Mississippi State', games: [
      ['Sept. 5',  'Louisiana-Monroe',   'home'],
      ['Sept. 12', 'Minnesota',          'away'],
      ['Sept. 19', 'South Carolina',     'away'],
      ['Sept. 26', 'Missouri',           'home'],
      ['Oct. 3',   'Alabama',            'home'],
      ['Oct. 10',  '',                   'bye' ],
      ['Oct. 17',  'LSU',                'away'],
      ['Oct. 24',  'Oklahoma',           'home'],
      ['Oct. 31',  'Texas',              'away'],
      ['Nov. 7',   'Vanderbilt',         'home'],
      ['Nov. 14',  'Auburn',             'home'],
      ['Nov. 21',  'Tennessee Tech',     'home'],
      ['Nov. 28',  'Ole Miss',           'away'],
    ]},
    { name: 'Missouri', games: [
      ['Sept. 5',  'Arkansas-Pine Bluff','home'],
      ['Sept. 12', 'Kansas',             'away'],
      ['Sept. 19', 'Troy',               'home'],
      ['Sept. 26', 'Mississippi State',  'away'],
      ['Oct. 3',   'Florida',            'home'],
      ['Oct. 10',  'Texas A&M',          'home'],
      ['Oct. 17',  'Ole Miss',           'away'],
      ['Oct. 24',  '',                   'bye' ],
      ['Oct. 31',  'Arkansas',           'away'],
      ['Nov. 7',   'Texas',              'home'],
      ['Nov. 14',  'Georgia',            'away'],
      ['Nov. 21',  'Kentucky',           'home'],
      ['Nov. 28',  'Oklahoma',           'home'],
    ]},
    { name: 'Oklahoma', games: [
      ['Sept. 5',  'UTEP',               'home'],
      ['Sept. 12', 'Michigan',           'away'],
      ['Sept. 19', 'New Mexico',         'home'],
      ['Sept. 26', 'Georgia',            'away'],
      ['Oct. 3',   '',                   'bye' ],
      ['Oct. 10',  'Texas (Dallas)',     'neutral'],
      ['Oct. 17',  'Kentucky',           'home'],
      ['Oct. 24',  'Mississippi State',  'away'],
      ['Oct. 31',  'South Carolina',     'home'],
      ['Nov. 7',   'Florida',            'away'],
      ['Nov. 14',  'Ole Miss',           'home'],
      ['Nov. 21',  'Texas A&M',          'home'],
      ['Nov. 28',  'Missouri',           'away'],
    ]},
    { name: 'Ole Miss', games: [
      ['Sept. 5',  'Louisville (Nashville)','neutral'],
      ['Sept. 12', 'Charlotte',          'home'],
      ['Sept. 19', 'LSU',                'home'],
      ['Sept. 26', 'Florida',            'away'],
      ['Oct. 3',   '',                   'bye' ],
      ['Oct. 10',  'Vanderbilt',         'away'],
      ['Oct. 17',  'Missouri',           'home'],
      ['Oct. 24',  'Texas',              'away'],
      ['Oct. 31',  'Auburn',             'home'],
      ['Nov. 7',   'Georgia',            'home'],
      ['Nov. 14',  'Oklahoma',           'away'],
      ['Nov. 21',  'Wofford',            'home'],
      ['Nov. 28',  'Mississippi State',  'home'],
    ]},
    { name: 'South Carolina', games: [
      ['Sept. 5',  'Kent State',         'home'],
      ['Sept. 12', 'Towson',             'home'],
      ['Sept. 19', 'Mississippi State',  'home'],
      ['Sept. 26', 'Alabama',            'away'],
      ['Oct. 3',   'Kentucky',           'home'],
      ['Oct. 10',  'Florida',            'away'],
      ['Oct. 17',  '',                   'bye' ],
      ['Oct. 24',  'Tennessee',          'home'],
      ['Oct. 31',  'Oklahoma',           'away'],
      ['Nov. 7',   'Texas A&M',          'home'],
      ['Nov. 14',  'Arkansas',           'away'],
      ['Nov. 21',  'Georgia',            'home'],
      ['Nov. 28',  'Clemson',            'away'],
    ]},
    { name: 'Tennessee', games: [
      ['Sept. 5',  'Furman',             'home'],
      ['Sept. 12', 'Georgia Tech',       'away'],
      ['Sept. 19', 'Kennesaw State',     'home'],
      ['Sept. 26', 'Texas',              'home'],
      ['Oct. 3',   'Auburn',             'home'],
      ['Oct. 10',  'Arkansas',           'away'],
      ['Oct. 17',  'Alabama',            'home'],
      ['Oct. 24',  'South Carolina',     'away'],
      ['Oct. 31',  '',                   'bye' ],
      ['Nov. 7',   'Kentucky',           'home'],
      ['Nov. 14',  'Texas A&M',          'away'],
      ['Nov. 21',  'LSU',                'home'],
      ['Nov. 28',  'Vanderbilt',         'away'],
    ]},
    { name: 'Texas', games: [
      ['Sept. 5',  'Texas State',        'home'],
      ['Sept. 12', 'Ohio State',         'home'],
      ['Sept. 19', 'UTSA',               'home'],
      ['Sept. 26', 'Tennessee',          'away'],
      ['Oct. 3',   '',                   'bye' ],
      ['Oct. 10',  'Oklahoma (Dallas)',  'neutral'],
      ['Oct. 17',  'Florida',            'home'],
      ['Oct. 24',  'Ole Miss',           'home'],
      ['Oct. 31',  'Mississippi State',  'home'],
      ['Nov. 7',   'Missouri',           'away'],
      ['Nov. 14',  'LSU',                'away'],
      ['Nov. 21',  'Arkansas',           'home'],
      ['Nov. 27',  'Texas A&M',          'away'],
    ]},
    { name: 'Texas A&M', games: [
      ['Sept. 5',  'Missouri State',     'home'],
      ['Sept. 12', 'Arizona State',      'home'],
      ['Sept. 19', 'Kentucky',           'home'],
      ['Sept. 26', 'LSU',                'away'],
      ['Oct. 3',   'Arkansas',           'home'],
      ['Oct. 10',  'Missouri',           'away'],
      ['Oct. 17',  'The Citadel',        'home'],
      ['Oct. 24',  'Alabama',            'away'],
      ['Oct. 31',  '',                   'bye' ],
      ['Nov. 7',   'South Carolina',     'away'],
      ['Nov. 14',  'Tennessee',          'home'],
      ['Nov. 21',  'Oklahoma',           'away'],
      ['Nov. 27',  'Texas',              'home'],
    ]},
    { name: 'Vanderbilt', games: [
      ['Sept. 5',  'Austin Peay',        'home'],
      ['Sept. 12', 'Delaware',           'home'],
      ['Sept. 19', 'NC State',           'home'],
      ['Sept. 26', 'Auburn',             'away'],
      ['Oct. 3',   'Georgia',            'away'],
      ['Oct. 10',  'Ole Miss',           'home'],
      ['Oct. 17',  'Arkansas',           'home'],
      ['Oct. 24',  'Kentucky',           'away'],
      ['Oct. 31',  '',                   'bye' ],
      ['Nov. 7',   'Mississippi State',  'away'],
      ['Nov. 14',  'Alabama',            'home'],
      ['Nov. 21',  'Florida',            'away'],
      ['Nov. 28',  'Tennessee',          'home'],
    ]},
  ];

  const gameRow = ([date, opp, loc]) => {
    if (loc === 'bye') {
      return `<div class="sgr bye"><span class="sgr-date">${date}</span><span class="sgr-opp bye-label">— Bye Week —</span><span class="sgr-loc"></span></div>`;
    }
    const label = loc === 'away' ? `<span class="sgr-at">at</span> ${opp}` : loc === 'neutral' ? `<span class="sgr-at">vs.</span> ${opp}` : opp;
    const locBadge = loc === 'home' ? '<span class="sgr-home">HOME</span>' : loc === 'neutral' ? '<span class="sgr-neutral">NEUTRAL</span>' : '<span class="sgr-away">AWAY</span>';
    return `<div class="sgr"><span class="sgr-date">${date}</span><span class="sgr-opp">${label}</span>${locBadge}</div>`;
  };

  const teamBlock = (t) => `
    <details class="sec-team"${t.isHome ? ' open' : ''}>
      <summary class="sec-team-hd">
        <span class="sec-team-name">${t.name}</span>
        <span class="sec-arrow">▼</span>
      </summary>
      <div class="sec-games">
        ${t.games.map(gameRow).join('')}
      </div>
    </details>`;

  return `
    ${header('schedule')}
    <main class="page-shell inner-page">
      <p class="eyebrow crimson">2026 SEASON</p>
      <h1 class="page-title">SEC Schedules</h1>
      <p style="color:var(--muted);font-size:14px;margin:-28px 0 36px">All 16 SEC teams. Click any team to expand their schedule.</p>
      <div class="sec-accordion">
        ${SEC.map(teamBlock).join('')}
      </div>
    </main>
    ${footer()}`;
}

function aboutPage() {
  return `
    ${header('about')}
    <main class="page-shell inner-page narrow">
      <p class="eyebrow crimson">ABOUT THE REPORT</p>
      <h1 class="page-title">Smart takes. Sassy opinions. Some football.</h1>
      <hr style="border:none;border-top:1px solid var(--line);margin:48px 0">
      <p class="eyebrow crimson">GET IN TOUCH</p>
      <p style="font-size:17px;line-height:1.7">Questions, corrections, sponsorship inquiries, or just want to argue about the offensive line? We're here for all of it.</p>
      <a class="button" href="mailto:${site.email}" style="margin-bottom:48px">EMAIL US <span>→</span></a>
    </main>
    ${footer()}`;
}

function notFoundPage() {
  return `
    ${header('home')}
    <main class="page-shell inner-page narrow" style="text-align:center">
      <p class="eyebrow crimson">404</p>
      <h1 class="page-title" style="font-size:clamp(60px,10vw,120px)">OUT of Bounds.</h1>
      <p class="lead">That page ran the wrong route. Let's get you back on the field.</p>
      <a class="button" href="/" style="margin-top:28px">BACK TO THE HOME FIELD <span>→</span></a>
    </main>
    ${footer()}`;
}

function postPage() {
  let slug = new URLSearchParams(window.location.search).get('slug');
  if (!slug) slug = window.location.pathname.replace(/^\//, '');
  const post = posts.find(item => item.slug === slug);
  if (!post) return `
    ${header('home')}
    <main class="page-shell inner-page narrow">
      <p class="eyebrow crimson">404</p>
      <h1>Take not found.</h1>
      <p><a href="/archive" style="color:var(--crimson);font-weight:700">← Back</a></p>
    </main>
    ${footer()}`;

  const pdfBanner = post.schedulePdf
    ? `<a class="schedule-download" href="${escapeHtml(post.schedulePdf)}" download>
        <span class="schedule-download__icon">📄</span>
        <span>
          <strong>This Week's Televised Schedule</strong>
          <span>Click to download &amp; print</span>
        </span>
        <span class="schedule-download__cta">DOWNLOAD →</span>
      </a>`
    : '';

  return `
    ${header('home')}
    <main>
      <div class="ad-slot-wrap" id="ad-post-top"></div>
      <article class="article">
        <header class="article-header">
          <p style="font-size:13px;font-weight:700;color:var(--muted);margin:0 0 20px">
            <a href="/archive" style="color:var(--crimson)">← Back</a>
          </p>
          <p class="eyebrow crimson">${escapeHtml(post.category)} &middot; ${formatDate(post.date)}</p>
          <h1>${escapeHtml(post.title)}</h1>
          <p class="lead" style="white-space:pre-wrap">${escapeHtml(post.excerpt)}</p>
          ${pdfBanner}
        </header>
        <div class="article-body">${post.html}</div>
      </article>
      <div class="ad-slot-wrap" id="ad-post-bottom"></div>
    </main>
    ${footer()}`;
}

// Router — handles both clean URLs (/archive) and .html URLs (/archive.html)
const rawPath = window.location.pathname;
const path = rawPath.replace(/\.html$/, '');

let page = homePage();
if (path === '/archive')  page = archivePage();
if (path === '/schedule') page = schedulePage();
if (path === '/about')    page = aboutPage();
if (path === '/post')     page = postPage();
if (/^\/\d{4}\/week\d+$/.test(path)) page = postPage();
if (path === '/404')      page = notFoundPage();

document.querySelector('#app').innerHTML = page;

// Mobile menu toggle
const toggle = document.querySelector('.menu-toggle');
const nav = document.querySelector('.site-nav');
toggle?.addEventListener('click', () => {
  const open = toggle.getAttribute('aria-expanded') === 'true';
  toggle.setAttribute('aria-expanded', String(!open));
  nav.classList.toggle('open');
});

// Newsletter form — submits to the admin Worker
const nlForm = document.querySelector('#newsletter-form');
if (nlForm) {
  nlForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const emailVal = nlForm.querySelector('input[type="email"]').value;
    const btn = nlForm.querySelector('button');
    btn.textContent = 'SENDING...';
    btn.disabled = true;
    try {
      await fetch('https://wuskaloosa-admin.austin-a73.workers.dev/api/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: emailVal })
      });
    } catch {
      // still show success — don't block the user on a network hiccup
    }
    nlForm.innerHTML = `<p style="font-weight:800;color:#fff;margin:auto;font-size:15px;padding:14px 0">✓ You're on the list! Roll Tide 🏈</p>`;
  });
}

// ── Ads — load asynchronously after page render ────────────────────────────────
async function loadAds() {
  try {
    const res = await fetch('/ads/config.json');
    if (!res.ok) return;
    const cfg = await res.json();
    const intervalMs = ((cfg.rotate && cfg.rotate.interval) || 6) * 1000;

    // Returns an array of ad objects for the given slot
    function resolveAds(slotKey) {
      if (cfg.library) {
        let slug = new URLSearchParams(window.location.search).get('slug');
        if (!slug) slug = window.location.pathname.replace(/^\//, '');
        const postConfig = slug ? cfg.posts?.[slug] : null;
        const field = slotKey === 'post-top' ? 'top' : slotKey === 'post-bottom' ? 'bottom' : 'homepage';
        const raw = postConfig?.[field] !== undefined
          ? postConfig[field]
          : (cfg.defaults?.[slotKey] || null);
        if (!raw) return [];
        const ids = Array.isArray(raw) ? raw : [raw];
        return ids.map(id => cfg.library[id]).filter(Boolean);
      }
      // Old flat format
      const ad = cfg[slotKey] || null;
      return ad ? [ad] : [];
    }

    function adMarkup(ad) {
      const openTag = ad.link
        ? `<a href="${escapeHtml(ad.link)}" target="_blank" rel="noopener sponsored">`
        : '<span>';
      const closeTag = ad.link ? '</a>' : '</span>';
      return `${openTag}<img src="${escapeHtml(ad.imageUrl)}" alt="Sponsor" loading="lazy" onerror="this.closest('.ad-slot-wrap').style.display='none'">${closeTag}`;
    }

    // Fade-transition rotation — avoids jitter from raw innerHTML swaps
    function startRotation(el, ads, prefix) {
      const inner = document.createElement('div');
      inner.style.cssText = 'transition:opacity 0.35s ease';
      inner.innerHTML = prefix + adMarkup(ads[0]);
      el.innerHTML = '';
      el.appendChild(inner);
      if (ads.length < 2) return;
      let idx = 0;
      setInterval(() => {
        idx = (idx + 1) % ads.length;
        inner.style.opacity = '0';
        setTimeout(() => {
          inner.innerHTML = prefix + adMarkup(ads[idx]);
          inner.style.opacity = '1';
        }, 350);
      }, intervalMs);
    }

    function injectAd(elId, slotKey) {
      const el = document.getElementById(elId);
      if (!el) return;
      const ads = resolveAds(slotKey);
      if (!ads.length) return;
      startRotation(el, ads, '<p class="ad-label">Advertisement</p>');
    }

    injectAd('ad-post-top', 'post-top');
    injectAd('ad-post-bottom', 'post-bottom');

    // Homepage box
    const homeEl = document.getElementById('ad-homepage');
    if (homeEl) {
      const homeAds = resolveAds('homepage');
      if (homeAds.length) {
        // Strip placeholder styling so the image fills the box cleanly
        homeEl.style.background = 'none';
        homeEl.style.border = '1px solid var(--line)';
        homeEl.style.padding = '0';

        const homeMarkup = (ad) => {
          const openTag = ad.link
            ? `<a href="${escapeHtml(ad.link)}" target="_blank" rel="noopener sponsored" style="display:block;line-height:0">`
            : '<span style="display:block;line-height:0">';
          const closeTag = ad.link ? '</a>' : '</span>';
          return `${openTag}<img src="${escapeHtml(ad.imageUrl)}" alt="Sponsor" loading="lazy" style="width:100%;height:auto;display:block" onerror="this.closest('.sponsor-ad').style.display='none'">${closeTag}`;
        };

        // Inner wrapper for smooth fade between rotating ads
        const homeInner = document.createElement('div');
        homeInner.style.cssText = 'transition:opacity 0.35s ease';
        homeInner.innerHTML = homeMarkup(homeAds[0]);
        homeEl.innerHTML = '';
        homeEl.appendChild(homeInner);

        if (homeAds.length > 1) {
          let idx = 0;
          setInterval(() => {
            idx = (idx + 1) % homeAds.length;
            homeInner.style.opacity = '0';
            setTimeout(() => {
              homeInner.innerHTML = homeMarkup(homeAds[idx]);
              homeInner.style.opacity = '1';
            }, 350);
          }, intervalMs);
        }
      }
    }
  } catch { /* ads are non-critical — fail silently */ }
}

loadAds();
