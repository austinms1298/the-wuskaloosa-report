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
    html: body.trim().startsWith('<') ? body.trim() : marked.parse(body)
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
        <p class="eyebrow">${formatDate(post.date)} &middot; ${escapeHtml(post.category)}</p>
        <h3><a href="/post?slug=${encodeURIComponent(post.slug)}">${escapeHtml(post.title)}</a></h3>
        <p>${escapeHtml(post.excerpt)}</p>
      </div>
    </article>`;
}

function header(active = 'home') {
  const links = [
    ['home', '/', 'Home'],
    ['archive', '/archive', 'Past Takes'],
    ['schedule', '/schedule', 'Schedule'],
    ['about', '/about', 'About'],
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
      <form class="newsletter-form" id="newsletter-form"
            data-formspree-id="YOUR_FORM_ID">
        <!-- Replace YOUR_FORM_ID above with your Formspree form ID (formspree.io) -->
        <label class="sr-only" for="nl-email">Email address</label>
        <input id="nl-email" type="email" name="email" placeholder="Enter your email" required>
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
            ${featured ? `<p>${escapeHtml(featured.excerpt)}</p><a class="button" href="/post?slug=${encodeURIComponent(featured.slug)}">READ THE TAKE <span>→</span></a>` : '<p style="color:var(--muted);font-size:15px;margin:10px 0">The first take drops before kickoff. Check back soon.</p>'}
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
          <div class="section-heading"><h2>CURRENT TAKES ☆</h2>${archive.length ? `<a href="/archive">VIEW ALL →</a>` : ''}</div>
          ${archive.length ? `<div class="card-grid">${archive.map(postCard).join('')}</div>` : `<p style="color:var(--muted);font-size:14px;margin:8px 0 0">Takes are coming — check back soon.</p>`}
        </section>

        <aside class="sponsor-ad" id="ad-homepage">
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
  return `
    ${header('schedule')}
    <main class="page-shell inner-page">
      <p class="eyebrow crimson">ROLL TIDE</p>
      <h1 class="page-title">2026 Alabama Football Schedule</h1>
      <p style="color:var(--muted);font-size:14px;margin:-28px 0 32px">All times CT. Times listed as Flex or Early/Night are TBA. This week's game is highlighted in crimson.</p>
      <section class="full-schedule">${rows}</section>
    </main>
    ${footer()}`;
}

function aboutPage() {
  return `
    ${header('about')}
    <main class="page-shell inner-page narrow">
      <p class="eyebrow crimson">ABOUT THE REPORT</p>
      <h1 class="page-title">Smart takes. Sassy opinions. Some football.</h1>
      <p class="lead">The Wuskaloosa Report is an independent Alabama football blog written from inside Tuscaloosa — no press box, no press credentials, just someone who's been watching this program their whole life and has a lot to say about it.</p>
      <p style="font-size:17px;line-height:1.7;margin:24px 0">Every game week you'll find analysis, previews, recaps, and the kind of honest takes the national media won't write because they don't love Alabama football like we do. Some of it will age well. Some of it won't. That's football.</p>
      <p style="font-size:17px;line-height:1.7;margin:24px 0">We cover the team, the program, and what it means to be an Alabama fan — from two-a-days in August all the way to wherever January takes us. Roll Tide.</p>
      <hr style="border:none;border-top:1px solid var(--line);margin:48px 0">
      <p class="eyebrow crimson">GET IN TOUCH</p>
      <p style="font-size:17px;line-height:1.7">Questions, corrections, sponsorship inquiries, or just want to argue about the offensive line? We're here for all of it.</p>
      <a class="button" href="mailto:${site.email}" style="margin-bottom:48px">EMAIL US <span>→</span></a>
      ${newsletter()}
    </main>
    ${footer()}`;
}

function notFoundPage() {
  return `
    ${header()}
    <main class="page-shell inner-page narrow" style="text-align:center">
      <p class="eyebrow crimson">404</p>
      <h1 class="page-title" style="font-size:clamp(60px,10vw,120px)">OUT of Bounds.</h1>
      <p class="lead">That page ran the wrong route. Let's get you back on the field.</p>
      <a class="button" href="/" style="margin-top:28px">BACK TO THE HOME FIELD <span>→</span></a>
    </main>
    ${footer()}`;
}

function postPage() {
  const slug = new URLSearchParams(window.location.search).get('slug');
  const post = posts.find(item => item.slug === slug);
  if (!post) return `
    ${header()}
    <main class="page-shell inner-page narrow">
      <p class="eyebrow crimson">404</p>
      <h1>Take not found.</h1>
      <p><a href="/archive" style="color:var(--crimson);font-weight:700">← Back to all takes</a></p>
    </main>
    ${footer()}`;

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

  return `
    ${header()}
    <main>
      <div class="ad-slot-wrap" id="ad-post-top"></div>
      <article class="article">
        <header class="article-header">
          <p style="font-size:13px;font-weight:700;color:var(--muted);margin:0 0 20px">
            <a href="/archive" style="color:var(--crimson)">← All Takes</a>
          </p>
          <p class="eyebrow crimson">${escapeHtml(post.category)} &middot; ${formatDate(post.date)}</p>
          <h1>${escapeHtml(post.title)}</h1>
          <p class="lead">${escapeHtml(post.excerpt)}</p>
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

// Newsletter form — submits to Formspree when a form ID is set
// Sign up at formspree.io, create a form, and replace YOUR_FORM_ID in newsletter()
const nlForm = document.querySelector('#newsletter-form');
if (nlForm) {
  nlForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const formId = nlForm.dataset.formspreeId;
    const emailVal = nlForm.querySelector('input[type="email"]').value;
    const btn = nlForm.querySelector('button');

    if (formId && formId !== 'YOUR_FORM_ID') {
      btn.textContent = 'SENDING...';
      btn.disabled = true;
      try {
        const res = await fetch(`https://formspree.io/f/${formId}`, {
          method: 'POST',
          headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: emailVal })
        });
        if (!res.ok) throw new Error();
      } catch {
        btn.textContent = "LET'S GO!";
        btn.disabled = false;
        return;
      }
    }

    // Show success state (works even without Formspree wired up)
    nlForm.innerHTML = `<p style="font-weight:800;color:#fff;margin:auto;font-size:15px;padding:14px 0">✓ You're on the list! Roll Tide 🏈</p>`;
  });
}

// ── Ads — load asynchronously after page render ────────────────────────────────
async function loadAds() {
  try {
    const res = await fetch('/ads/config.json');
    if (!res.ok) return;
    const cfg = await res.json();

    function injectAd(elId, slot) {
      const el = document.getElementById(elId);
      if (!el) return;
      const ad = cfg[slot];
      if (!ad || !ad.imageUrl) return;
      const openTag = ad.link
        ? `<a href="${escapeHtml(ad.link)}" target="_blank" rel="noopener sponsored">`
        : '<span>';
      const closeTag = ad.link ? '</a>' : '</span>';
      el.innerHTML =
        `<p class="ad-label">Advertisement</p>` +
        `${openTag}<img src="${escapeHtml(ad.imageUrl)}" alt="Sponsor" loading="lazy" onerror="this.closest('.ad-slot-wrap').style.display='none'">${closeTag}`;
    }

    injectAd('ad-post-top', 'post-top');
    injectAd('ad-post-bottom', 'post-bottom');

    // Homepage box — swap placeholder content for actual ad image
    const homeEl = document.getElementById('ad-homepage');
    const homeAd = cfg['homepage'];
    if (homeEl && homeAd && homeAd.imageUrl) {
      const openTag = homeAd.link
        ? `<a href="${escapeHtml(homeAd.link)}" target="_blank" rel="noopener sponsored">`
        : '<span>';
      const closeTag = homeAd.link ? '</a>' : '</span>';
      homeEl.innerHTML =
        `<p class="eyebrow">SPONSOR</p>` +
        `${openTag}<img src="${escapeHtml(homeAd.imageUrl)}" alt="Sponsor" loading="lazy" style="max-width:300px;max-height:250px;margin:auto;display:block" onerror="this.closest('.sponsor-ad').style.display='none'">${closeTag}`;
    }
  } catch { /* ads are non-critical — fail silently */ }
}

loadAds();
