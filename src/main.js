import './styles.css';
import yaml from 'js-yaml';
import { marked } from 'marked';
import { schedule, site } from './data/site.js';

// Decode common HTML entities stored in CMS fields (e.g. &nbsp; from Quill)
const decodeEntities = (s = '') => String(s)
  .replace(/&nbsp;/g, ' ')
  .replace(/&amp;/g, '&')
  .replace(/&lt;/g, '<')
  .replace(/&gt;/g, '>')
  .replace(/&quot;/g, '"')
  .replace(/&#039;/g, "'")
  .replace(/&#39;/g, "'");

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
    excerpt: decodeEntities(data.excerpt || ''),
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


// Strip HTML tags and return up to maxLen plain-text characters from article body
function bodyPreview(html, maxLen = 300) {
  const plain = decodeEntities(html.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
  if (plain.length <= maxLen) return plain;
  const cut = plain.lastIndexOf(' ', maxLen);
  return plain.slice(0, cut > 0 ? cut : maxLen) + '…';
}

// Extract h2/h3 section headings from article HTML for the outline block
function articleHeadings(html, max = 5) {
  return [...html.matchAll(/<h[23][^>]*>([\s\S]*?)<\/h[23]>/gi)]
    .slice(0, max)
    .map(m => m[1].replace(/<[^>]+>/g, '').trim())
    .filter(Boolean);
}

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
    ['subscribe', '/subscribe', 'Subscribe'],
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
    <footer class="footer">
      <div><strong>${site.title}</strong><p>${site.tagline}</p></div>
      <p>© ${new Date().getFullYear()} The Wuskaloosa Report &mdash; <a href="mailto:${site.email}" style="color:#bbb">${site.email}</a></p>
    </footer>`;
}

function newsletter() {
  return `
    <style>
      #nl-bar{display:flex;justify-content:space-between;align-items:center;gap:30px;background:#8f1224;color:#fff;padding:30px 36px;overflow:hidden}
      #nl-bar .nl-title{font-family:var(--marker),'Oswald',sans-serif;font-size:30px;margin:0;line-height:1.1}
      #nl-bar .nl-sub{font-size:15px;font-weight:500;margin:5px 0 0;max-width:520px}
      #nl-bar .nl-btn{flex-shrink:0;background:#1e1818;color:#fff;font-weight:800;padding:14px 24px;font-size:13px;letter-spacing:.05em;text-decoration:none;white-space:nowrap;display:inline-block}
      @media(max-width:680px){#nl-bar{flex-direction:column;align-items:stretch;padding:26px 20px}}
    </style>
    <section id="nl-bar">
      <div>
        <p class="nl-title">DON'T MISS A TAKE!</p>
        <p class="nl-sub">Get the newest thoughts, analysis and opinions in your inbox.</p>
      </div>
      <a href="/subscribe" class="nl-btn">SUBSCRIBE NOW →</a>
    </section>`;
}


function subscribePage() {
  document.title = 'Subscribe | The Wuskaloosa Report';
  return '';
}
function homePage() {
  const featured = posts[0];
  const archive = posts.filter(post => post.slug !== featured?.slug).slice(0, 3);
  const featuredHeadings = featured ? articleHeadings(featured.html) : [];
  return `

    <main>
      <section class="hero">
        <img src="/images/hero-panel.png" alt="A colorful caricature-style football broadcast panel seated on the University of Alabama campus" width="1520" height="400" fetchpriority="high" loading="eager" decoding="async">
      </section>

      <div class="home-grid page-shell">
        <section class="latest-take">
          <div class="latest-copy">
            <p class="eyebrow crimson">LATEST TAKE</p>
            <h1>${escapeHtml(featured?.title || 'The Latest Wuskaloosa Report')}</h1>
            ${featured
              ? `<p style="font-size:12px;font-weight:800;letter-spacing:.1em;color:var(--muted);text-transform:uppercase;margin:0 0 16px">${formatDate(featured.date)} &nbsp;&middot;&nbsp; ${escapeHtml(featured.category)}</p>
                 ${featured.excerpt
                   ? `<p style="font-size:18px;line-height:1.55;font-style:italic;border-left:3px solid var(--crimson);padding-left:14px;margin:0 0 18px;white-space:pre-wrap;color:var(--deep)">${escapeHtml(featured.excerpt)}</p>`
                   : ''}
                 <div style="border-top:1px solid var(--line);margin-bottom:18px"></div>
                 <p style="font-size:17px;line-height:1.75;color:var(--deep);margin:0 0 22px">${escapeHtml(bodyPreview(featured.html, 420))}</p>
                 ${featuredHeadings.length >= 2
                   ? `<div style="background:#fff;border:1px solid var(--line);border-left:3px solid var(--crimson);padding:14px 18px;margin-bottom:24px">
                        <p style="font-size:11px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;color:var(--muted);margin:0 0 10px">In this take</p>
                        <ul style="margin:0;padding:0;list-style:none;display:flex;flex-direction:column;gap:8px">
                          ${featuredHeadings.map(h => `<li style="font-size:14px;font-weight:700;color:var(--deep);padding-left:16px;position:relative"><span style="position:absolute;left:0;color:var(--crimson)">›</span>${escapeHtml(h)}</li>`).join('')}
                        </ul>
                      </div>`
                   : ''}
                 <a class="button" href="${postUrl(featured)}">Read More and Download your TV Schedule <span>→</span></a>`
              : '<p style="color:var(--muted);font-size:15px;margin:10px 0">The first take drops before kickoff. Check back soon.</p>'
            }
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
    </main>`;
}

function archivePage() {
  const emptyState = `
    <div style="text-align:center;padding:60px 0;color:var(--muted)">
      <p style="font-family:var(--marker);font-size:40px;margin:0">Coming soon.</p>
      <p style="margin:12px 0 0;font-size:15px">The takes are loading — check back before kickoff.</p>
    </div>`;

  function buildSeasonSections() {
    const byYear = {};
    posts.forEach(p => {
      const yr = p.date instanceof Date ? p.date.getFullYear() : new Date(p.date).getFullYear();
      if (!byYear[yr]) byYear[yr] = [];
      byYear[yr].push(p);
    });
    const years = Object.keys(byYear).map(Number).sort((a, b) => b - a);
    return years.map((yr, i) => {
      const count = byYear[yr].length;
      const cards = byYear[yr].map(postCard).join('');
      return '<details class="archive-year"' + (i === 0 ? ' open' : '') + '>'
        + '<summary class="archive-year-hd">'
        + yr + ' Season'
        + '<span class="archive-year-count">' + count + ' take' + (count !== 1 ? 's' : '') + '</span>'
        + '</summary>'
        + '<div class="card-grid archive-grid">' + cards + '</div>'
        + '</details>';
    }).join('');
  }

  return '<main class="page-shell inner-page">'
    + '<p class="eyebrow crimson">EVERY TAKE</p>'
    + '<h1 class="page-title">Past Takes</h1>'
    + (posts.length ? buildSeasonSections() : emptyState)
    + '</main>';
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

    <main class="page-shell inner-page">
      <p class="eyebrow crimson">2026 SEASON</p>
      <h1 class="page-title">SEC Schedules</h1>
      <p style="color:var(--muted);font-size:14px;margin:-28px 0 36px">All 16 SEC teams. Click any team to expand their schedule.</p>
      <div class="sec-accordion">
        ${SEC.map(teamBlock).join('')}
      </div>
    </main>`;
}

function aboutPage() {
  return `

    <main class="page-shell inner-page narrow">
      <p class="eyebrow crimson">ABOUT THE REPORT</p>
      <h1 class="page-title">Smart takes, Sassy opinions, and Some football!</h1>

      <p style="font-size:18px;line-height:1.7;margin-bottom:0">
        Jackie Wuska Wear is a native of Birmingham and resides in Tuscaloosa with her husband Jason Wear
        and four-legged children Albert, Chas, Lola and Vivvy — who often make appearances in her football commentary.
        Jackie attended The University of Alabama for undergraduate and grad school, where a few friends
        deemed the nickname <strong>"Wuskaloosa"</strong> upon her.
      </p>

      <p style="font-size:18px;line-height:1.7">
        Jackie proudly works for United Way of West Alabama. However, 12 years ago she began sharing college
        football television schedules with other avid football fans. At first, the football schedule would be
        delivered with a simple, <em>"Enjoy! RTR!"</em>
      </p>

      <p style="font-size:18px;line-height:1.7">
        But with the success of the Coach Saban Era of Alabama Football, Jackie — along with the majority of
        Alabama fans — caught a severe case of <em>"getting the big head."</em> As a result, a direct link
        may be seen between the intensity and growth in Alabama's football superiority and the increase in
        the length of Jackie's commentary in her delivery of football schedules. The delusion of grandeur
        got so out of hand that Jackie began unsuccessfully (despite championing some very pertinent campaign
        platforms) running for Homecoming Queen annually for the past eight years (and counting)…decades
        after graduating from UA.
      </p>

      <blockquote style="border-left:4px solid var(--crimson);margin:36px 0;padding:16px 24px;background:rgba(143,18,36,.05);font-family:var(--marker);font-size:26px;font-weight:400;line-height:1.3;color:var(--deep)">
        This website is both a direct result of the cockiness that has become… <span class="crimson">ALABAMA FOOTBALL</span>
        as well as an effort for Alabama fans to channel our inner Jedi so that we may play the necessary
        Jedi mind tricks to fully restore Alabama's football dominance.
      </blockquote>

      <p style="font-size:18px;line-height:1.7">
        Jackie understands some folks were not raised to love UA and tries not to judge them or their parents —
        and is actually even more appreciative of their visiting WuskaloosaReport.com, realizing the experience
        may be very much like a <em>"Eww, smell this…"</em> encounter…requiring curiosity and courage on their part.
      </p>

      <p style="font-size:18px;line-height:1.7">
        While you may not learn anything from the posts when you visit WuskaloosaReport.com, by doing so,
        you are helping fulfill Jackie's childhood dream to ensure each and every man, woman and child has
        access to the times and channels for all college football games.
      </p>

      <p style="font-size:20px;font-weight:700;margin:40px 0 48px">Thank you, enjoy and RTR!</p>

      <hr style="border:none;border-top:1px solid var(--line);margin:0 0 48px">
      <p class="eyebrow crimson">GET IN TOUCH</p>
      <p style="font-size:17px;line-height:1.7">Questions, corrections, sponsorship inquiries, or just want to argue about the offensive line? We're here for all of it.</p>
      <a class="button" href="mailto:${site.email}" style="margin-bottom:48px">EMAIL US <span>→</span></a>

    </main>`;
}

function notFoundPage() {
  return `

    <main class="page-shell inner-page narrow" style="text-align:center">
      <p class="eyebrow crimson">404</p>
      <h1 class="page-title" style="font-size:clamp(60px,10vw,120px)">OUT of Bounds.</h1>
      <p class="lead">That page ran the wrong route. Let's get you back on the field.</p>
      <a class="button" href="/" style="margin-top:28px">BACK TO THE HOME FIELD <span>→</span></a>
    </main>`;
}

function postPage() {
  let slug = new URLSearchParams(window.location.search).get('slug');
  if (!slug) slug = window.location.pathname.replace(/^\//, '');
  const post = posts.find(item => item.slug === slug);
  if (!post) return `

    <main class="page-shell inner-page narrow">
      <p class="eyebrow crimson">404</p>
      <h1>Take not found.</h1>
      <p><a href="/archive" style="color:var(--crimson);font-weight:700">← Back</a></p>
    </main>`;

  const pdfBanner = post.schedulePdf
    ? `<a class="schedule-download" href="${escapeHtml(post.schedulePdf)}" download>
        <span class="schedule-download__icon">📄</span>
        <span>
          <strong>This Weeks Televised Football Schedule</strong>
          <span>Click to download &amp; print</span>
        </span>
        <span class="schedule-download__cta">DOWNLOAD →</span>
      </a>`
    : '';

  return `

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
    </main>`;
}

// Router — handles both clean URLs (/archive) and .html URLs (/archive.html)
const rawPath = window.location.pathname;
const path = rawPath.replace(/\.html$/, '');

let page = homePage();
if (path === '/archive')  page = archivePage();
if (path === '/schedule') page = schedulePage();
if (path === '/about')    page = aboutPage();
if (path === '/subscribe') page = subscribePage();
if (path === '/post')     page = postPage();
if (/^\/\d{4}\/week\d+$/.test(path)) page = postPage();
if (path === '/404')      page = notFoundPage();

document.querySelector('#app').innerHTML = page;

// Inject newsletter bar before footer on all pages except /subscribe
if (path !== '/subscribe') {
  const footerEl = document.querySelector('.footer');
  if (footerEl) footerEl.insertAdjacentHTML('beforebegin', newsletter());
}

// Update active nav link
const _navSection = path === '/archive' ? 'archive' : path === '/schedule' ? 'schedule' : path === '/about' ? 'about' : path === '/subscribe' ? 'subscribe' : 'home';
document.querySelectorAll('#site-nav a').forEach(a => a.classList.remove('active'));
const _navActive = document.querySelector(`#site-nav a[data-nav="${_navSection}"]`);
if (_navActive) _navActive.classList.add('active');


// Mobile menu toggle
const toggle = document.querySelector('.menu-toggle');
const nav = document.querySelector('.site-nav');
toggle?.addEventListener('click', () => {
  const open = toggle.getAttribute('aria-expanded') === 'true';
  toggle.setAttribute('aria-expanded', String(!open));
  nav.classList.toggle('open');
});

// Newsletter handled by Kit embed

// ── Ads — load asynchronously after page render ────────────────────────────────
async function loadAds() {
  try {
    const res = await fetch('/ads/config.json');
    if (!res.ok) return;
    const cfg = await res.json();
    const intervalMs = ((cfg.rotate && cfg.rotate.interval) || 6) * 1000;

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
      const ad = cfg[slotKey] || null;
      return ad ? [ad] : [];
    }

    function adLayerHTML(ad) {
      const openTag = ad.link
        ? `<a href="${escapeHtml(ad.link)}" target="_blank" rel="noopener sponsored">`
        : '<span>';
      const closeTag = ad.link ? '</a>' : '</span>';
      return `${openTag}<img src="${escapeHtml(ad.imageUrl)}" alt="Sponsor" loading="eager"
        onerror="this.closest('.ad-layer').style.display='none'">${closeTag}`;
    }

    // Pre-decode an ad image before making it visible
    function preloadAd(ad) {
      if (!ad || !ad.imageUrl) return Promise.resolve();
      const img = new Image();
      img.src = ad.imageUrl;
      if (img.decode) return img.decode().catch(() => {});
      return new Promise(r => { img.onload = img.onerror = r; });
    }

    // Two-layer crossfade rotator — container size NEVER changes
    function startRotation(el, ads, isRect) {
      // Label
      const label = document.createElement('p');
      label.className = 'ad-label';
      label.textContent = 'Advertisement';

      // Fixed-size rotator container
      const rotator = document.createElement('div');
      rotator.className = isRect
        ? 'ad-rotator ad-rotator--rect'
        : 'ad-rotator ad-rotator--leader';

      // Layer A (initially visible) and Layer B (hidden)
      const layerA = document.createElement('div');
      layerA.className = 'ad-layer';
      layerA.style.opacity = '1';
      layerA.innerHTML = adLayerHTML(ads[0]);

      const layerB = document.createElement('div');
      layerB.className = 'ad-layer';
      layerB.style.opacity = '0';
      layerB.innerHTML = adLayerHTML(ads[1] || ads[0]);

      rotator.appendChild(layerA);
      rotator.appendChild(layerB);
      el.innerHTML = '';
      el.appendChild(label);
      el.appendChild(rotator);

      if (ads.length < 2) return;

      let idx = 0;
      let front = 0; // 0 = A on top, 1 = B on top
      const layers = [layerA, layerB];

      async function tick() {
        idx = (idx + 1) % ads.length;
        const nextAd = ads[idx];
        const back = 1 - front;
        // Swap content into the hidden layer while it's invisible, then decode
        layers[back].innerHTML = adLayerHTML(nextAd);
        await preloadAd(nextAd);
        // Crossfade
        layers[back].style.opacity = '1';
        layers[front].style.opacity = '0';
        front = back;
      }

      // Delay rotation start until after the page has settled
      const startTimer = () => { setInterval(tick, intervalMs); };
      if (document.readyState === 'complete') {
        setTimeout(startTimer, 500);
      } else {
        window.addEventListener('load', () => setTimeout(startTimer, 500), { once: true });
      }
    }

    function injectAd(elId, slotKey) {
      const el = document.getElementById(elId);
      if (!el) return;
      const ads = resolveAds(slotKey);
      if (!ads.length) return;
      startRotation(el, ads, false);
    }

    injectAd('ad-post-top', 'post-top');
    injectAd('ad-post-bottom', 'post-bottom');

    // Homepage box
    const homeEl = document.getElementById('ad-homepage');
    if (homeEl) {
      const homeAds = resolveAds('homepage');
      if (homeAds.length) {
        homeEl.style.background = 'none';
        homeEl.style.border = '1px solid var(--line)';
        homeEl.style.padding = '0';
        startRotation(homeEl, homeAds, true);
      }
    }
  } catch { /* ads are non-critical — fail silently */ }
}

loadAds();
