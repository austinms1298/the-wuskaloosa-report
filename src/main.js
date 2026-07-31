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
    schedulePdf: data.schedule_pdf || null,
    body,
    html: marked.parse(body)
  };
}

const posts = Object.entries(rawPosts)
  .map(([path, raw]) => parsePost(path, raw))
  .sort((a, b) => b.date - a.date);

const escapeHtml = (value = '') => String(value).replace(/[&<>'"]/g, char => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#039;', '"': '&quot;'
}[char]));

const formatDate = date => new Intl.DateTimeFormat('en-US', {
  month: 'short', day: 'numeric', year: 'numeric'
}).format(date);

function postCard(post) {
  return `
    <article class="post-card">
      <div class="post-card__body">
        <p class="eyebrow">${formatDate(post.date)}</p>
        <h3><a href="/post.html?slug=${encodeURIComponent(post.slug)}">${escapeHtml(post.title)}</a></h3>
        <p>${escapeHtml(post.excerpt)}</p>
      </div>
    </article>`;
}

function header(active = 'home') {
  const links = [
    ['home', '/', 'Home'],
    ['archive', '/archive.html', 'Past Takes'],
    ['schedule', '/schedule.html', 'Schedule'],
    ['about', '/about.html', 'About'],
    ['subscribe', '#subscribe', 'Subscribe']
  ];
  return `
    <header class="site-header">
      <a class="brand" href="/" aria-label="The Wuskaloosa Report home">
        <img src="/images/logo.png" alt="The Wuskaloosa Report" class="brand-logo">
      </a>
      <button class="menu-toggle" aria-expanded="false" aria-controls="site-nav">Menu</button>
      <nav id="site-nav" class="site-nav" aria-label="Primary navigation">
        ${links.map(([id, href, label]) => `<a class="${active === id ? 'active' : ''}" href="${href}">${label}</a>`).join('')}
      </nav>
      <div class="header-icons"><span aria-hidden="true">⌕</span><a href="mailto:${site.email}" aria-label="Email us">✉</a></div>
    </header>`;
}

function footer() {
  return `
    <footer class="footer">
      <div><strong>${site.title}</strong><p>${site.tagline}</p></div>
      <p>© ${new Date().getFullYear()} The Wuskaloosa Report</p>
    </footer>`;
}

function newsletter() {
  return `
    <section class="newsletter" id="subscribe">
      <div>
        <p class="marker-label">DON'T MISS A TAKE!</p>
        <h2>Get the newest thoughts, analysis and opinions in your inbox.</h2>
      </div>
      <form class="newsletter-form" onsubmit="event.preventDefault(); alert('Connect this form to your email service before launch.');">
        <label class="sr-only" for="email">Email address</label>
        <input id="email" type="email" placeholder="Enter your email" required>
        <button type="submit">LET'S GO!</button>
      </form>
    </section>`;
}

function homePage() {
  const featured = posts.find(post => post.featured) || posts[0];
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
            ${featured ? `<p>${escapeHtml(featured.excerpt)}</p><a class="button" href="/post.html?slug=${encodeURIComponent(featured.slug)}">READ THE TAKE <span>→</span></a>` : ''}
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
          <a class="button button-small" href="/schedule.html">VIEW FULL SCHEDULE</a>
        </aside>

        <section class="archive-preview">
          <div class="section-heading"><h2>CURRENT TAKES ☆</h2>${archive.length ? `<a href="/archive.html">VIEW ALL →</a>` : ''}</div>
          ${archive.length ? `<div class="card-grid">${archive.map(postCard).join('')}</div>` : `<p style="color:var(--muted);font-size:14px;margin:8px 0 0">Takes are coming — check back soon.</p>`}
        </section>

        <aside class="sponsor-ad">
          <p class="eyebrow">SPONSORSHIP</p>
          <h2>Your business could be featured here.</h2>
          <p>Reach Alabama football fans with a homepage sponsorship.</p>
          <a href="mailto:${site.email}?subject=Wuskaloosa%20Report%20Sponsorship">BECOME A SPONSOR →</a>
        </aside>

        ${newsletter()}
      </div>
    </main>
    ${footer()}`;
}

function archivePage() {
  return `${header('archive')}<main class="page-shell inner-page"><p class="eyebrow crimson">EVERY TAKE</p><h1 class="page-title">Past Takes</h1><div class="card-grid archive-grid">${posts.map(postCard).join('')}</div></main>${footer()}`;
}

function schedulePage() {
  const today = new Date(); today.setHours(0,0,0,0);
  const weekEnd = new Date(today); weekEnd.setDate(weekEnd.getDate() + 7);
  const rows = schedule.map(game => {
    const gd = game.gameDate ? new Date(game.gameDate) : null;
    const isThisWeek = gd && gd >= today && gd <= weekEnd;
    const isPast = gd && gd < today;
    const status = isThisWeek ? 'THIS WEEK!' : (isPast ? (game.result || 'FINAL') : (game.time || ''));
    const matchup = game.home === null ? game.opponent : `${game.home ? 'vs' : 'at'} ${game.opponent}`;
    const isBye = game.home === null;
    return `<div class="full-schedule-row${isThisWeek ? ' this-week' : ''}${isBye ? ' bye' : ''}">
      <span class="fs-date">${game.date}<em>${game.day}</em></span>
      <div class="fs-game">
        <h2>${matchup}</h2>
        ${game.city ? `<p class="fs-city">${game.city}</p>` : ''}
      </div>
      <strong class="fs-status${isThisWeek ? ' crimson' : ''}">${status}</strong>
    </div>`;
  }).join('');
  return `${header('schedule')}<main class="page-shell inner-page"><p class="eyebrow crimson">ROLL TIDE</p><h1 class="page-title">2026 Alabama Football Schedule</h1><section class="full-schedule">${rows}</section></main>${footer()}`;
}

function aboutPage() {
  return `${header('about')}<main class="page-shell inner-page narrow"><p class="eyebrow crimson">ABOUT THE REPORT</p><h1 class="page-title">Smart takes. Sassy opinions. Some football.</h1><p class="lead">The Wuskaloosa Report is an independent Alabama football blog built for fans who like their analysis with personality.</p><p>Replace this copy with the full story of the blog, its author and what readers can expect each week.</p>${newsletter()}</main>${footer()}`;
}

function notFoundPage() {
  return `${header()}<main class="page-shell inner-page narrow" style="text-align:center">
    <p class="eyebrow crimson">404</p>
    <h1 class="page-title" style="font-size:clamp(60px,10vw,120px)">OUT of Bounds.</h1>
    <p class="lead">That page ran the wrong route. Let's get you back on the field.</p>
    <a class="button" href="/" style="margin-top:28px">BACK TO THE HOME FIELD <span>→</span></a>
  </main>${footer()}`;
}

function postPage() {
  const slug = new URLSearchParams(window.location.search).get('slug');
  const post = posts.find(item => item.slug === slug);
  if (!post) return `${header()}<main class="page-shell inner-page narrow"><h1>Take not found</h1><p><a href="/archive.html">Return to the archive.</a></p></main>${footer()}`;
  const pdfBanner = post.schedulePdf
    ? `<a class="schedule-download" href="${escapeHtml(post.schedulePdf)}" download>
        <span class="schedule-download__icon">📄</span>
        <span>
          <strong>This Week's TV Schedule</strong>
          <span>Click to download &amp; print</span>
        </span>
        <span class="schedule-download__cta">DOWNLOAD →</span>
      </a>`
    : '';
  return `${header()}<main><article class="article"><header class="article-header"><p class="eyebrow crimson">${escapeHtml(post.category)} · ${formatDate(post.date)}</p><h1>${escapeHtml(post.title)}</h1><p class="lead">${escapeHtml(post.excerpt)}</p>${pdfBanner}</header><div class="article-body">${post.html}</div></article></main>${footer()}`;
}

const path = window.location.pathname;
let page = homePage();
if (path.endsWith('/archive.html')) page = archivePage();
if (path.endsWith('/schedule.html')) page = schedulePage();
if (path.endsWith('/about.html')) page = aboutPage();
if (path.endsWith('/post.html')) page = postPage();
if (path.endsWith('/404.html')) page = notFoundPage();

document.querySelector('#app').innerHTML = page;
const toggle = document.querySelector('.menu-toggle');
const nav = document.querySelector('.site-nav');
toggle?.addEventListener('click', () => {
  const open = toggle.getAttribute('aria-expanded') === 'true';
  toggle.setAttribute('aria-expanded', String(!open));
  nav.classList.toggle('open');
});
