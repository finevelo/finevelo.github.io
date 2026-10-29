// Finevelo backend: a small single-page app on top of the GitHub API.
import { marked } from 'marked';
import * as gh from './github.js';
import * as auth from './auth.js';
import {
  ARTICLES_DIR, SETTINGS_PATH, SOURCES_PATH, CATEGORIES, FORMATS, LICENSES,
  parseArticle, serializeArticle, slugify, isDraft, validate, nextRun,
} from './content.js';

const root = document.getElementById('admin');
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const fmtDate = (d) => (d ? new Date(d).toLocaleString('de-DE', { dateStyle: 'medium', timeStyle: 'short' }) : '–');
const fmtDay = (d) => (d ? new Date(d).toLocaleDateString('de-DE', { day: 'numeric', month: 'short', year: 'numeric' }) : '–');
const ago = (d) => {
  const m = Math.round((Date.now() - new Date(d)) / 60000);
  if (m < 60) return `vor ${m} Min.`;
  if (m < 1440) return `vor ${Math.round(m / 60)} Std.`;
  return `vor ${Math.round(m / 1440)} Tagen`;
};

let toastTimer;
function toast(msg, isErr = false) {
  document.querySelector('.adm-toast')?.remove();
  const el = document.createElement('div');
  el.className = `adm-toast${isErr ? ' err' : ''}`;
  el.textContent = msg;
  document.body.append(el);
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.remove(), isErr ? 8000 : 4500);
}

// ---------- data cache ----------
const cache = { articles: null, settings: null, sources: null };

async function loadArticles(force = false) {
  if (cache.articles && !force) return cache.articles;
  const files = await gh.readFolder(ARTICLES_DIR);
  cache.articles = files
    .filter((f) => f.name.endsWith('.md'))
    .map((f) => parseArticle(f.name, f.text, f.sha))
    .sort((a, b) => new Date(b.data.pubDate || 0) - new Date(a.data.pubDate || 0));
  return cache.articles;
}
async function loadSettings(force = false) {
  if (cache.settings && !force) return cache.settings;
  return (cache.settings = await gh.readJson(SETTINGS_PATH));
}
async function loadSources(force = false) {
  if (cache.sources && !force) return cache.sources;
  return (cache.sources = await gh.readJson(SOURCES_PATH));
}

// ---------- login ----------
// Modes: password (default), link (login link by mail), reset (request reset mail),
// password-new (after the reset mail), token (emergency login with a GitHub token).
function renderLogin(mode = auth.configured ? 'password' : 'token', { error = '', info = '', mail = '' } = {}) {
  root.className = '';
  const mailField = `<label class="adm-field"><span>E-Mail</span>
    <input id="mail" type="email" autocomplete="username" value="${esc(mail)}" required /></label>`;
  const forms = {
    password: `
      <p>Melde dich mit deiner E-Mail-Adresse an.</p>
      ${mailField}
      <label class="adm-field"><span>Passwort</span>
        <input id="pw" type="password" autocomplete="current-password" required /></label>
      <button class="adm-btn" type="submit">Anmelden</button>
      <div class="adm-login-links">
        <button type="button" data-mode="link">Stattdessen Login-Link per Mail</button>
        <button type="button" data-mode="reset">Passwort vergessen?</button>
      </div>`,
    link: `
      <p>Wir schicken dir einen Link. Ein Klick darauf meldet dich an, ganz ohne Passwort.</p>
      ${mailField}
      <button class="adm-btn" type="submit">Login-Link senden</button>
      <div class="adm-login-links"><button type="button" data-mode="password">Mit Passwort anmelden</button></div>`,
    reset: `
      <p>Gib deine Adresse ein. Du bekommst einen Link, mit dem du ein neues Passwort setzt.</p>
      ${mailField}
      <button class="adm-btn" type="submit">Link zum Zurücksetzen senden</button>
      <div class="adm-login-links"><button type="button" data-mode="password">Zurück zur Anmeldung</button></div>`,
    'password-new': `
      <p>Lege ein neues Passwort fest${auth.email() ? ` für <strong>${esc(auth.email())}</strong>` : ''}.</p>
      <label class="adm-field"><span>Neues Passwort</span>
        <input id="pw" type="password" autocomplete="new-password" minlength="10" required /></label>
      <label class="adm-field"><span>Wiederholen</span>
        <input id="pw2" type="password" autocomplete="new-password" minlength="10" required /></label>
      <button class="adm-btn" type="submit">Passwort speichern</button>`,
    token: `
      <p>Notfall-Zugang mit dem GitHub-Token des Kontos <strong>finevelo</strong>. Er bleibt nur in diesem Browser.</p>
      <label class="adm-field"><span>GitHub-Token</span>
        <input id="tok" type="password" autocomplete="off" placeholder="github_pat_…" required /></label>
      <label class="adm-check"><input id="remember" type="checkbox" /> Auf diesem Gerät angemeldet bleiben</label>
      <button class="adm-btn" type="submit">Anmelden</button>
      ${auth.configured ? '<div class="adm-login-links"><button type="button" data-mode="password">Mit E-Mail anmelden</button></div>' : ''}`,
  };
  root.innerHTML = `
    <div class="adm-login"><form class="adm-login-box" id="login" novalidate>
      <div class="adm-logo">Finevelo<small>Redaktion</small></div>
      ${forms[mode]}
      <p class="adm-login-msg" role="status">${error ? `<span class="adm-err">${esc(error)}</span>` : info ? `<span class="adm-ok">${esc(info)}</span>` : ''}</p>
    </form>
    ${auth.configured && mode !== 'token' && mode !== 'password-new' ? '<a class="adm-login-foot" href="#/token">Notfall-Zugang mit GitHub-Token</a>' : ''}
    </div>`;
  const form = document.getElementById('login');
  const val = (id) => document.getElementById(id)?.value.trim() ?? '';
  form.querySelector('input')?.focus();
  form.querySelectorAll('[data-mode]').forEach((b) =>
    b.addEventListener('click', () => renderLogin(b.dataset.mode, { mail: val('mail') })),
  );
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!form.reportValidity()) return;
    const btn = form.querySelector('button[type=submit]');
    btn.disabled = true;
    const mail = val('mail');
    try {
      if (mode === 'password') {
        await auth.signInWithPassword(mail, document.getElementById('pw').value);
        await gh.checkAccess();
        return home();
      }
      if (mode === 'link') {
        await auth.sendLoginLink(mail);
        return renderLogin('link', { mail, info: 'Link ist unterwegs. Schau in dein Postfach (auch im Spam-Ordner).' });
      }
      if (mode === 'reset') {
        await auth.sendReset(mail);
        return renderLogin('password', { mail, info: 'Falls die Adresse freigeschaltet ist, kommt gleich eine Mail mit dem Link.' });
      }
      if (mode === 'password-new') {
        const pw = document.getElementById('pw').value;
        if (pw.length < 10) throw new Error('Bitte mindestens 10 Zeichen.');
        if (pw !== document.getElementById('pw2').value) throw new Error('Die beiden Passwörter sind nicht gleich.');
        await auth.setPassword(pw);
        toast('Neues Passwort gespeichert.');
        return home();
      }
      gh.setToken(val('tok'), document.getElementById('remember').checked);
      await gh.checkAccess();
      home();
    } catch (err) {
      if (mode === 'password' || mode === 'token') gh.signOut();
      renderLogin(mode, { mail, error: err.message });
    }
  });
}

const home = () => (location.hash && location.hash !== '#/' ? (location.hash = '#/') : route());

// ---------- shell ----------
const NAV = [
  ['#/', 'Übersicht'],
  ['#/articles', 'Artikel'],
  ['#/sources', 'Quellen & Firmen'],
  ['#/agent', 'Agent'],
  ['#/analytics', 'Analytics'],
];
function shell(active, content, drafts = null) {
  root.className = 'admin';
  root.innerHTML = `
    <aside class="adm-side">
      <a href="#/" class="adm-logo">Finevelo<small>Redaktion</small></a>
      <nav class="adm-nav" aria-label="Backend">
        ${NAV.map(([href, label]) => `<a href="${href}" ${href === active ? 'aria-current="page"' : ''}>${label}${href === '#/articles' && drafts ? `<span class="adm-badge" title="Entwürfe">${drafts}</span>` : ''}</a>`).join('')}
        <div class="adm-nav-sep">Daten</div>
        <a href="/admin/cms/#/collections/data" target="_blank" rel="noopener">Bike-Datenbank ↗</a>
        <a href="/admin/cms/#/collections/guides" target="_blank" rel="noopener">Guides ↗</a>
      </nav>
      <div class="adm-side-foot">
        <a href="/" target="_blank" rel="noopener">Website ansehen ↗</a>
        ${auth.email() && !gh.hasToken() ? `<span class="adm-side-user" title="Angemeldet">${esc(auth.email())}</span>` : ''}
        <button id="signout" type="button">Abmelden</button>
      </div>
    </aside>
    <main class="adm-main" id="view">${content}</main>`;
  document.getElementById('signout').addEventListener('click', () => {
    gh.signOut();
    Object.keys(cache).forEach((k) => (cache[k] = null));
    location.hash = '#/';
    renderLogin();
  });
  return document.getElementById('view');
}
const loading = (active) => shell(active, '<p class="adm-loading">Lade …</p>', cache.articles?.filter(isDraft).length);
const failed = (view, err) => (view.innerHTML = `<div class="adm-errors"><strong>Fehler:</strong> ${esc(err.message)}</div>`);

const articleRow = (a) => `
  <li><a class="adm-row" href="#/edit/${encodeURIComponent(a.slug)}">
    <div>
      <div class="adm-row-title">${esc(a.data.title || a.slug)}</div>
      <div class="adm-row-meta">
        <span class="adm-pill ${isDraft(a) ? 'draft' : 'live'}">${isDraft(a) ? 'Entwurf' : 'Online'}</span>
        <span>${esc(CATEGORIES[a.data.category] || a.data.category || '')}</span>
        <span>${esc(FORMATS[a.data.format] || '')}</span>
        <span>${fmtDay(a.data.pubDate)}</span>
        ${a.data.source?.name ? `<span>Quelle: ${esc(a.data.source.name)}</span>` : ''}
      </div>
    </div>
    <span class="adm-btn ghost">${isDraft(a) ? 'Prüfen' : 'Bearbeiten'}</span>
  </a></li>`;

// ---------- dashboard ----------
async function viewDashboard() {
  const view = loading('#/');
  try {
    const [articles, settings, runs, secret] = await Promise.all([
      loadArticles(true),
      loadSettings(true),
      gh.listRuns('agent.yml', 5).catch(() => null),
      gh.getSecret('ANTHROPIC_API_KEY').catch(() => undefined),
    ]);
    const drafts = articles.filter(isDraft);
    const live = articles.filter((a) => !isDraft(a));
    const s = settings.data;
    const next = nextRun(s);
    const lastRun = runs?.workflow_runs?.find((r) => r.status === 'completed' && (r.event === 'workflow_dispatch' || r.conclusion !== 'skipped'));
    const v = shell('#/', `
      <div class="adm-head"><div><h1>Übersicht</h1><p>${new Date().toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' })}</p></div>
        <div class="adm-actions"><a class="adm-btn" href="#/new">Neuer Artikel</a></div></div>
      <div class="adm-cards">
        <a class="adm-card" href="#/articles?f=drafts"><div class="k">Warten auf Freigabe</div><div class="v">${drafts.length}</div><div class="s">Entwürfe</div></a>
        <a class="adm-card" href="#/articles?f=live"><div class="k">Online</div><div class="v">${live.length}</div><div class="s">Artikel</div></a>
        <a class="adm-card" href="#/agent"><div class="k">Agent</div><div class="v">${s.enabled ? 'An' : 'Aus'}</div>
          <div class="s">${s.enabled ? (next ? `Nächster Lauf ${fmtDate(next)}` : 'Kein Termin im Zeitplan') : 'Zeitplan pausiert'}</div></a>
        <a class="adm-card" href="#/agent"><div class="k">Claude-API-Schlüssel</div>
          <div class="v ${secret ? 'adm-ok' : secret === null ? 'adm-warn' : ''}">${secret ? 'Aktiv' : secret === null ? 'Fehlt' : '?'}</div>
          <div class="s">${secret ? `seit ${fmtDay(secret.updated_at)}` : secret === null ? 'Ohne Schlüssel läuft der Agent nicht' : 'Status nicht lesbar'}</div></a>
      </div>
      <div class="adm-section-title"><h2>Warten auf Freigabe</h2><a href="#/articles?f=drafts">Alle Entwürfe →</a></div>
      ${drafts.length ? `<ul class="adm-list">${drafts.slice(0, 6).map(articleRow).join('')}</ul>` : '<p class="adm-empty">Keine Entwürfe. Neue Vorschläge des Agenten erscheinen hier.</p>'}
      <div class="adm-section-title" style="margin-top:36px"><h2>Zuletzt veröffentlicht</h2><a href="#/articles?f=live">Alle Artikel →</a></div>
      <ul class="adm-list">${live.slice(0, 5).map(articleRow).join('')}</ul>
      <div class="adm-section-title" style="margin-top:36px"><h2>Letzter Agent-Lauf</h2><a href="#/agent">Agent →</a></div>
      <p>${lastRun ? `${fmtDate(lastRun.run_started_at)} · ${lastRun.conclusion === 'success' ? '<span class="adm-ok">erfolgreich</span>' : `<span class="adm-err">${esc(lastRun.conclusion)}</span>`} · <a href="${lastRun.html_url}" target="_blank" rel="noopener">Protokoll</a>` : 'Noch kein Lauf.'}</p>
    `, drafts.length);
    return v;
  } catch (e) {
    if (e.status === 401) return renderLogin(e.message);
    failed(view, e);
  }
}

// ---------- article list ----------
async function viewArticles(params) {
  const view = loading('#/articles');
  try {
    const articles = await loadArticles(true);
    const state = { f: params.get('f') || 'all', cat: '', q: '' };
    const drafts = articles.filter(isDraft).length;
    shell('#/articles', `
      <div class="adm-head"><div><h1>Artikel</h1><p>${articles.length} Artikel, davon ${drafts} Entwürfe</p></div>
        <div class="adm-actions"><a class="adm-btn" href="#/new">Neuer Artikel</a></div></div>
      <div class="adm-actions" style="margin-bottom:16px">
        <div class="adm-tabs" id="tabs">
          ${[['all', 'Alle'], ['drafts', 'Entwürfe'], ['live', 'Online']].map(([k, l]) => `<button type="button" data-f="${k}" aria-pressed="${state.f === k}">${l}</button>`).join('')}
        </div>
        <select class="adm-in" id="cat" style="width:auto"><option value="">Alle Rubriken</option>${Object.entries(CATEGORIES).map(([k, l]) => `<option value="${k}">${l}</option>`).join('')}</select>
        <input class="adm-in" id="q" type="search" placeholder="Suchen …" style="width:auto;min-width:200px" />
      </div>
      <ul class="adm-list" id="list"></ul>`, drafts);
    const draw = () => {
      const q = state.q.toLowerCase();
      const rows = articles.filter((a) =>
        (state.f === 'all' || (state.f === 'drafts') === isDraft(a)) &&
        (!state.cat || a.data.category === state.cat) &&
        (!q || `${a.data.title} ${a.slug} ${(a.data.tags || []).join(' ')}`.toLowerCase().includes(q)));
      document.getElementById('list').innerHTML = rows.length ? rows.map(articleRow).join('') : '<li class="adm-empty">Keine Artikel gefunden.</li>';
    };
    document.getElementById('tabs').addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (!b) return;
      state.f = b.dataset.f;
      document.querySelectorAll('#tabs button').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
      draw();
    });
    document.getElementById('cat').addEventListener('change', (e) => ((state.cat = e.target.value), draw()));
    document.getElementById('q').addEventListener('input', (e) => ((state.q = e.target.value), draw()));
    draw();
  } catch (e) {
    if (e.status === 401) return renderLogin(e.message);
    failed(view, e);
  }
}

// ---------- editor ----------
const get = (obj, path) => path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);
const setPath = (obj, path, value) => {
  const keys = path.split('.');
  let o = obj;
  for (const k of keys.slice(0, -1)) o = o[k] ??= {};
  o[keys.at(-1)] = value;
};
const toLocalInput = (d) => {
  if (!d) return '';
  const x = new Date(d);
  const pad = (n) => String(n).padStart(2, '0');
  return `${x.getFullYear()}-${pad(x.getMonth() + 1)}-${pad(x.getDate())}T${pad(x.getHours())}:${pad(x.getMinutes())}`;
};

function field(path, label, a, { type = 'text', max, hint, placeholder = '', rows } = {}) {
  const v = path === 'body' ? a.body : get(a.data, path) ?? '';
  const count = max ? `<small data-count="${path}" class="${String(v).length > max ? 'over' : ''}">${String(v).length}/${max}</small>` : hint ? `<small>${esc(hint)}</small>` : '';
  const attrs = `data-path="${path}" placeholder="${esc(placeholder)}"`;
  const input =
    type === 'textarea'
      ? `<textarea ${attrs} rows="${rows || 3}" class="${path === 'body' ? 'body' : ''}">${esc(v)}</textarea>`
      : type === 'datetime'
        ? `<input type="datetime-local" ${attrs} value="${toLocalInput(v)}" />`
        : `<input type="text" ${attrs} value="${esc(v)}" />`;
  return `<label class="adm-field"><span>${label}${count}</span>${input}</label>`;
}
const select = (path, label, a, options) => `
  <label class="adm-field"><span>${label}</span><select data-path="${path}">
    ${Object.entries(options).map(([k, l]) => `<option value="${k}" ${get(a.data, path) === k ? 'selected' : ''}>${l}</option>`).join('')}
  </select></label>`;

async function viewEditor(slug) {
  const isNew = !slug;
  const view = loading('#/articles');
  let a;
  try {
    const articles = await loadArticles();
    if (isNew) {
      a = { slug: '', sha: null, isNew: true, body: '', data: { title: '', description: '', category: 'road', format: 'launch-brief', author: 'editorial', draft: true, pubDate: new Date(), hero: { alt: '' }, tags: [], faq: [] } };
    } else {
      const found = articles.find((x) => x.slug === slug);
      if (!found) throw new Error(`Artikel „${slug}“ nicht gefunden.`);
      a = structuredClone(found);
    }
  } catch (e) {
    if (e.status === 401) return renderLogin(e.message);
    return failed(view, e);
  }
  a.data.hero ??= { alt: '' };
  a.data.faq ??= [];
  a.data.tags ??= [];
  let pendingImage = null; // { base64, url }
  const wasDraft = isDraft(a);

  const licenseOptions = LICENSES.map((l) => `<option value="${esc(l.name)}" ${a.data.hero.license?.name === l.name ? 'selected' : ''}>${esc(l.name)}</option>`).join('');
  shell('#/articles', `
    <div class="adm-head"><div><h1>${isNew ? 'Neuer Artikel' : 'Artikel bearbeiten'}</h1>
      <p>${isNew ? 'Wird erst gespeichert, wenn du auf einen der Knöpfe klickst.' : `<span class="adm-pill ${wasDraft ? 'draft' : 'live'}">${wasDraft ? 'Entwurf' : 'Online'}</span> &nbsp;${esc(a.slug)}${wasDraft ? '' : ` · <a href="/news/${esc(a.slug)}/" target="_blank" rel="noopener">ansehen ↗</a>`}`}</p></div>
      <div class="adm-actions">
        <a class="adm-btn ghost" href="#/articles">Zurück</a>
        ${!isNew ? '<button class="adm-btn danger" id="del" type="button">Löschen</button>' : ''}
        ${!isNew && !wasDraft ? '<button class="adm-btn ghost" id="unpublish" type="button">Offline nehmen</button>' : ''}
        <button class="adm-btn ghost" id="save-draft" type="button">${wasDraft ? 'Entwurf speichern' : 'Als Entwurf speichern'}</button>
        <button class="adm-btn" id="publish" type="button">${wasDraft ? 'Veröffentlichen' : 'Änderungen veröffentlichen'}</button>
      </div></div>
    <div id="errors"></div>
    <div class="adm-editor">
      <form id="form" autocomplete="off" onsubmit="return false">
        <fieldset><legend>Inhalt</legend>
          ${field('title', 'Titel', a)}
          ${isNew ? `<label class="adm-field"><span>Adresse (Slug)<small>finevelo.com/news/…</small></span><input type="text" id="slug" placeholder="wird aus dem Titel erzeugt" /></label>` : ''}
          ${field('dek', 'Unterzeile', a, { type: 'textarea', rows: 2 })}
          ${field('body', 'Text (Markdown: ## Zwischenüberschrift, **fett**, | Tabelle |)', a, { type: 'textarea' })}
        </fieldset>
        <fieldset><legend>Einordnung</legend>
          <div class="adm-grid3">
            ${select('category', 'Rubrik', a, CATEGORIES)}
            ${select('format', 'Format', a, FORMATS)}
            ${field('pubDate', 'Datum', a, { type: 'datetime' })}
          </div>
          <label class="adm-check"><input type="checkbox" data-path="featured" ${a.data.featured ? 'checked' : ''} /> Aufmacher auf der Startseite</label>
          <div class="adm-grid2">
            ${field('bike', 'Rad in der Datenbank', a, { hint: 'z. B. pinarello/dogma-f' })}
            ${field('tags', 'Tags', a, { hint: 'mit Komma trennen' })}
          </div>
          ${field('disclosure', 'Offenlegung (Pflicht bei NonPlus-Produkten)', a, { type: 'textarea', rows: 2 })}
        </fieldset>
        <fieldset><legend>Suchmaschinen</legend>
          ${field('seoTitle', 'SEO-Titel', a, { max: 60, placeholder: 'Marke Modell Jahr: Preis, Gewicht' })}
          ${field('description', 'Meta-Beschreibung (mit Preis)', a, { type: 'textarea', rows: 2, max: 170 })}
        </fieldset>
        <fieldset><legend>Specs-Box</legend>
          <div class="adm-grid2">
            ${field('specs.price', 'Preis', a, { hint: 'TBC, wenn unbestätigt' })}
            ${field('specs.weight', 'Gewicht', a, { hint: 'mit Größe, claimed/measured' })}
            ${field('specs.groupset', 'Gruppe', a)}
            ${field('specs.availability', 'Verfügbarkeit', a)}
          </div>
          ${field('specs.url', 'Herstellerlink', a)}
        </fieldset>
        <fieldset><legend>Titelbild</legend>
          <div class="adm-imgdrop" id="imgdrop">
            ${a.data.hero.src ? `<img src="${esc(a.data.hero.src)}" alt="" id="imgthumb" />` : '<img alt="" id="imgthumb" hidden />'}
            <div>Bild wählen oder hierher ziehen. Es wird auf 1200 × 675 zugeschnitten und als WebP gespeichert. Ohne Bild erscheint die Illustration.</div>
            <input type="file" id="imgfile" accept="image/*" hidden />
          </div>
          ${field('hero.alt', 'Alt-Text (was ist zu sehen)', a)}
          ${field('hero.caption', 'Bildunterschrift', a)}
          <div class="adm-grid2">
            ${field('hero.credit', 'Credit', a, { placeholder: 'Photo: Name / Wikimedia Commons' })}
            <label class="adm-field"><span>Lizenz</span><select id="license"><option value="">–</option>${licenseOptions}</select></label>
            ${field('hero.sourceUrl', 'Link zur Bildquelle', a)}
            ${field('hero.changes', 'Bearbeitung', a, { placeholder: 'cropped' })}
          </div>
        </fieldset>
        <fieldset><legend>Quelle</legend>
          <div class="adm-grid2">${field('source.name', 'Name', a)}${field('source.url', 'URL', a)}</div>
        </fieldset>
        <fieldset><legend>FAQ</legend>
          <div class="adm-faq" id="faq"></div>
          <button class="adm-btn ghost" type="button" id="faq-add">Frage hinzufügen</button>
        </fieldset>
      </form>
      <aside class="adm-preview" aria-label="Vorschau"><p class="adm-preview-label">Vorschau</p><div id="preview"></div></aside>
    </div>`, cache.articles?.filter(isDraft).length);

  const form = document.getElementById('form');
  const preview = document.getElementById('preview');

  const drawPreview = () => {
    const d = a.data;
    const specs = d.specs && (d.specs.price || d.specs.weight)
      ? `<dl class="specs">${[['Preis', d.specs.price], ['Gewicht', d.specs.weight], ['Gruppe', d.specs.groupset], ['Verfügbarkeit', d.specs.availability]].filter(([, v]) => v).map(([k, v]) => `<div><dt>${k}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl>`
      : '';
    const img = pendingImage?.url || d.hero?.src;
    preview.innerHTML = `
      <p class="kicker">${esc(CATEGORIES[d.category] || '')} · ${esc(FORMATS[d.format] || '')}</p>
      <h1>${esc(d.title || 'Titel')}</h1>
      ${d.dek ? `<p class="dek">${esc(d.dek)}</p>` : ''}
      ${img ? `<img class="hero" src="${esc(img)}" alt="${esc(d.hero?.alt)}" />` : '<div class="hero">Illustration</div>'}
      <p class="credit">${esc([d.hero?.caption, d.hero?.credit, d.hero?.license?.name].filter(Boolean).join(' · '))}</p>
      ${d.disclosure ? `<p class="disclosure"><strong>Disclosure:</strong> ${esc(d.disclosure)}</p>` : ''}
      ${specs}
      <div class="prose">${marked.parse(a.body || '')}</div>`;
  };

  const drawFaq = () => {
    document.getElementById('faq').innerHTML = a.data.faq
      .map((f, i) => `<div class="adm-faq-item"><div>
        <label class="adm-field"><span>Frage</span><input type="text" data-faq="${i}" data-k="q" value="${esc(f.q)}" /></label>
        <label class="adm-field"><span>Antwort</span><textarea data-faq="${i}" data-k="a" rows="2">${esc(f.a)}</textarea></label>
      </div><button class="adm-btn danger" type="button" data-faq-del="${i}" aria-label="Frage entfernen">×</button></div>`)
      .join('');
  };

  let t;
  form.addEventListener('input', (e) => {
    const el = e.target;
    if (el.dataset.faq !== undefined) {
      a.data.faq[+el.dataset.faq][el.dataset.k] = el.value;
    } else if (el.dataset.path) {
      const p = el.dataset.path;
      const v = el.type === 'checkbox' ? el.checked : el.value;
      if (p === 'body') a.body = v;
      else if (p === 'tags') a.data.tags = v.split(',').map((s) => s.trim()).filter(Boolean);
      else if (p === 'pubDate') a.data.pubDate = v ? new Date(v) : '';
      else setPath(a.data, p, v);
      const c = document.querySelector(`[data-count="${p}"]`);
      if (c) {
        const max = +c.textContent.split('/')[1];
        c.textContent = `${v.length}/${max}`;
        c.classList.toggle('over', v.length > max);
      }
    }
    clearTimeout(t);
    t = setTimeout(drawPreview, 150);
  });
  document.querySelector('[data-path="tags"]').value = a.data.tags.join(', ');
  document.getElementById('license').addEventListener('change', (e) => {
    const l = LICENSES.find((x) => x.name === e.target.value);
    a.data.hero.license = l ? { name: l.name, url: l.url } : undefined;
    drawPreview();
  });
  document.getElementById('faq-add').addEventListener('click', () => {
    a.data.faq.push({ q: '', a: '' });
    drawFaq();
  });
  document.getElementById('faq').addEventListener('click', (e) => {
    const i = e.target.dataset.faqDel;
    if (i === undefined) return;
    a.data.faq.splice(+i, 1);
    drawFaq();
  });

  // Image: crop to 1200x675 and convert to WebP in the browser
  const drop = document.getElementById('imgdrop');
  const fileIn = document.getElementById('imgfile');
  const takeImage = async (file) => {
    if (!file?.type.startsWith('image/')) return;
    const bmp = await createImageBitmap(file);
    const W = 1200, H = 675;
    const scale = Math.max(W / bmp.width, H / bmp.height);
    const canvas = Object.assign(document.createElement('canvas'), { width: W, height: H });
    canvas.getContext('2d').drawImage(bmp, (W - bmp.width * scale) / 2, (H - bmp.height * scale) / 2, bmp.width * scale, bmp.height * scale);
    const blob = await new Promise((r) => canvas.toBlob(r, 'image/webp', 0.82));
    const base64 = await new Promise((r) => {
      const fr = new FileReader();
      fr.onload = () => r(String(fr.result).split(',')[1]);
      fr.readAsDataURL(blob);
    });
    pendingImage = { base64, url: URL.createObjectURL(blob) };
    if (!a.data.hero.changes) a.data.hero.changes = 'cropped, resized';
    const thumb = document.getElementById('imgthumb');
    thumb.src = pendingImage.url;
    thumb.hidden = false;
    document.querySelector('[data-path="hero.changes"]').value = a.data.hero.changes;
    drawPreview();
  };
  drop.addEventListener('click', () => fileIn.click());
  fileIn.addEventListener('change', () => takeImage(fileIn.files[0]));
  drop.addEventListener('dragover', (e) => e.preventDefault());
  drop.addEventListener('drop', (e) => {
    e.preventDefault();
    takeImage(e.dataTransfer.files[0]);
  });

  const buttons = () => document.querySelectorAll('.adm-head button');
  async function save(draft) {
    const errBox = document.getElementById('errors');
    if (isNew) {
      a.slug = slugify(document.getElementById('slug').value || a.data.title);
      if (cache.articles.some((x) => x.slug === a.slug)) {
        errBox.innerHTML = `<div class="adm-errors">Die Adresse „${esc(a.slug)}“ gibt es schon. Bitte einen anderen Titel oder Slug.</div>`;
        return;
      }
    }
    if (!draft && wasDraft && !isNew) a.data.pubDate = new Date(); // first publication gets today's date
    if (!draft && !wasDraft && !isNew) a.data.updatedDate = new Date();
    a.data.draft = draft;
    // Drafts only need a title; publishing needs every mandatory field.
    const errors = draft ? (a.data.title ? [] : ['Titel fehlt.']) : validate(a);
    if (errors.length) {
      errBox.innerHTML = `<div class="adm-errors"><strong>Bitte noch ergänzen:</strong><ul>${errors.map((x) => `<li>${esc(x)}</li>`).join('')}</ul></div>`;
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    errBox.innerHTML = '';
    buttons().forEach((b) => (b.disabled = true));
    try {
      if (pendingImage) {
        const path = `public/images/${a.slug}-hero.webp`;
        await gh.putBinary(path, pendingImage.base64, `Image for “${a.slug}”`);
        a.data.hero.src = `/images/${a.slug}-hero.webp`;
        pendingImage = null;
      }
      const text = serializeArticle(a);
      const msg = `${draft ? 'Draft' : 'Publish'}: ${a.data.title}`;
      a.sha = await gh.putFile(`${ARTICLES_DIR}/${a.slug}.md`, text, a.sha, msg);
      cache.articles = null;
      toast(draft ? 'Entwurf gespeichert.' : 'Veröffentlicht. In etwa 2 Minuten online.');
      location.hash = `#/edit/${encodeURIComponent(a.slug)}`;
      if (!isNew) route();
    } catch (e) {
      toast(e.message, true);
      buttons().forEach((b) => (b.disabled = false));
    }
  }
  document.getElementById('save-draft').addEventListener('click', () => save(true));
  document.getElementById('publish').addEventListener('click', () => save(false));
  document.getElementById('unpublish')?.addEventListener('click', () => {
    if (confirm('Artikel offline nehmen? Er bleibt als Entwurf erhalten.')) save(true);
  });
  document.getElementById('del')?.addEventListener('click', async () => {
    if (!confirm(`„${a.data.title}“ endgültig löschen? Das lässt sich nur über die GitHub-Historie zurückholen.`)) return;
    try {
      await gh.deleteFile(`${ARTICLES_DIR}/${a.slug}.md`, a.sha, `Delete: ${a.data.title}`);
      cache.articles = null;
      toast('Gelöscht.');
      location.hash = '#/articles';
    } catch (e) {
      toast(e.message, true);
    }
  });

  drawFaq();
  drawPreview();
}

// ---------- sources ----------
const REG = { open: 'Noch offen', applied: 'Beantragt', registered: 'Registriert', 'not-needed': 'Nicht nötig' };
const TYPES = { brand: 'Marke', outlet: 'Fachmedium', press: 'Presseportal' };

async function viewSources() {
  const view = loading('#/sources');
  let src;
  try {
    src = structuredClone(await loadSources(true));
  } catch (e) {
    if (e.status === 401) return renderLogin(e.message);
    return failed(view, e);
  }
  const rows = src.data;
  const counts = Object.fromEntries(Object.keys(REG).map((k) => [k, rows.filter((r) => r.registration === k).length]));
  shell('#/sources', `
    <div class="adm-head"><div><h1>Quellen &amp; Firmen</h1>
      <p>${rows.length} Einträge · ${counts.registered} registriert · ${counts.applied} beantragt · ${counts.open} offen</p></div>
      <div class="adm-actions"><button class="adm-btn ghost" id="add" type="button">Eintrag hinzufügen</button><button class="adm-btn" id="save" type="button">Speichern</button></div></div>
    <p class="adm-muted" style="color:var(--muted);margin:-12px 0 20px;font-size:14px">Der Agent liest die RSS-Feeds aller aktiven Einträge. Presseportal-Passwörter gehören in deinen Passwort-Manager, nicht hierher.</p>
    <div class="adm-table-wrap"><table class="adm-table"><thead><tr>
      <th>Aktiv</th><th>Name</th><th>Typ</th><th>Registrierung</th><th>RSS-Feed</th><th>Presseportal</th><th>Website</th><th>Pressekontakt</th><th>Notizen</th><th></th>
    </tr></thead><tbody id="rows"></tbody></table></div>`, cache.articles?.filter(isDraft).length);

  const opt = (o, v) => Object.entries(o).map(([k, l]) => `<option value="${k}" ${v === k ? 'selected' : ''}>${l}</option>`).join('');
  const draw = () => {
    document.getElementById('rows').innerHTML = rows
      .map((r, i) => `<tr data-i="${i}">
        <td><input type="checkbox" data-k="active" ${r.active ? 'checked' : ''} style="width:18px;min-width:0" /></td>
        <td><input data-k="name" value="${esc(r.name)}" /></td>
        <td><select data-k="type">${opt(TYPES, r.type)}</select></td>
        <td><select data-k="registration">${opt(REG, r.registration)}</select></td>
        <td><input data-k="rss" value="${esc(r.rss)}" placeholder="–" /></td>
        <td><input data-k="pressPortal" value="${esc(r.pressPortal)}" placeholder="–" /></td>
        <td><input data-k="website" value="${esc(r.website)}" /></td>
        <td><input data-k="contact" value="${esc(r.contact)}" placeholder="–" /></td>
        <td><input data-k="notes" value="${esc(r.notes)}" placeholder="–" /></td>
        <td><button class="adm-btn danger" type="button" data-del="${i}" aria-label="Entfernen">×</button></td>
      </tr>`)
      .join('');
  };
  const tbody = () => document.getElementById('rows');
  document.getElementById('view').addEventListener('input', (e) => {
    const tr = e.target.closest('tr[data-i]');
    if (!tr) return;
    const r = rows[+tr.dataset.i];
    const k = e.target.dataset.k;
    r[k] = e.target.type === 'checkbox' ? e.target.checked : e.target.value.trim() || null;
    if (k === 'name' && !r.id) r.id = slugify(r.name);
  });
  document.getElementById('view').addEventListener('click', (e) => {
    const i = e.target.dataset.del;
    if (i === undefined) return;
    if (confirm(`„${rows[+i].name}“ entfernen?`)) {
      rows.splice(+i, 1);
      draw();
    }
  });
  document.getElementById('add').addEventListener('click', () => {
    rows.unshift({ id: '', name: '', type: 'brand', active: true, website: '', rss: null, pressPortal: null, registration: 'open', contact: null, notes: null });
    draw();
    tbody().querySelector('[data-k="name"]').focus();
  });
  document.getElementById('save').addEventListener('click', async (e) => {
    for (const r of rows) r.id ||= slugify(r.name);
    const clean = rows.filter((r) => r.name);
    e.target.disabled = true;
    try {
      src.sha = await gh.writeJson(SOURCES_PATH, clean, src.sha, 'Update sources');
      cache.sources = { data: clean, sha: src.sha };
      toast('Quellen gespeichert.');
    } catch (err) {
      toast(err.message, true);
    } finally {
      e.target.disabled = false;
    }
  });
  draw();
}

// ---------- agent ----------
const DAYS = { mon: 'Mo', tue: 'Di', wed: 'Mi', thu: 'Do', fri: 'Fr', sat: 'Sa', sun: 'So' };
const MODELS = { 'claude-opus-5-5': 'Claude Opus 5.5 (beste Qualität)', 'claude-sonnet-5-5': 'Claude Sonnet 5.5 (günstiger)' };

async function viewAgent() {
  const view = loading('#/agent');
  let st, runs, secret;
  try {
    [st, runs, secret] = await Promise.all([
      loadSettings(true).then(structuredClone),
      gh.listRuns('agent.yml', 10).catch(() => null),
      gh.getSecret('ANTHROPIC_API_KEY').catch(() => undefined),
    ]);
  } catch (e) {
    if (e.status === 401) return renderLogin(e.message);
    return failed(view, e);
  }
  const s = st.data;
  const next = nextRun(s);
  const runRows = (runs?.workflow_runs || [])
    .map((r) => {
      const done = r.status === 'completed';
      const ok = r.conclusion === 'success';
      return `<tr><td>${fmtDate(r.run_started_at || r.created_at)}</td><td>${r.event === 'schedule' ? 'Zeitplan' : 'von Hand'}</td>
        <td><span class="adm-pill ${!done ? '' : ok ? 'live' : 'err'}">${!done ? 'läuft' : ok ? 'fertig' : esc(r.conclusion)}</span></td>
        <td><a href="${r.html_url}" target="_blank" rel="noopener">Protokoll ↗</a></td></tr>`;
    })
    .join('');

  shell('#/agent', `
    <div class="adm-head"><div><h1>Agent</h1>
      <p>${s.enabled ? (s.days.length ? `Eingeschaltet · nächster Lauf ${next ? fmtDate(next) : 'nicht im Zeitplan'}` : '<span class="adm-warn">Eingeschaltet, aber kein Wochentag gewählt: der Agent läuft nie.</span>') : 'Ausgeschaltet: läuft nur, wenn du ihn von Hand startest.'}</p></div>
      <div class="adm-actions"><button class="adm-btn ghost" id="dry" type="button">Probelauf (speichert nichts)</button><button class="adm-btn" id="run" type="button">Jetzt ausführen</button></div></div>

    <section class="adm-panel"><h2>Zeitplan &amp; Regeln</h2>
      <p class="lead">Der Agent nimmt die Feeds der Magazine nur als Tipp, sucht dazu die Originalmeldung des Herstellers, schreibt daraus in eigenen Worten und lässt jede Zahl gegenprüfen. Seiten, die KI-Nutzung per robots.txt oder TDM-Vorbehalt ausschließen, liest er nicht. Jeder Artikel kommt als Entwurf zu dir.</p>
      <form id="settings" onsubmit="return false">
        <label class="adm-check"><input type="checkbox" name="enabled" ${s.enabled ? 'checked' : ''} /> <strong>Agent nach Zeitplan ausführen</strong></label>
        <label class="adm-check"><input type="checkbox" name="backfill" ${s.backfill !== false ? 'checked' : ''} /> Ohne Neuheiten: Hintergrundartikel zu Produkten aus 2025–2026 schreiben <span style="color:var(--muted)">(nur Themen, zu denen es noch keinen Artikel gibt)</span></label>
        <div class="adm-field"><span>Wochentage</span><div class="adm-tabs" id="days">
          ${Object.entries(DAYS).map(([k, l]) => `<button type="button" data-day="${k}" aria-pressed="${s.days.includes(k)}">${l}</button>`).join('')}
        </div></div>
        <div class="adm-grid3">
          <label class="adm-field"><span>Uhrzeiten<small>volle Stunden, mit Komma</small></span><input name="times" value="${esc(s.times.join(', '))}" /></label>
          <label class="adm-field"><span>Artikel pro Lauf (max.)</span><input name="maxArticlesPerRun" type="number" min="1" max="10" value="${s.maxArticlesPerRun}" /></label>
          <label class="adm-field"><span>Mindest-Relevanz<small>0–100</small></span><input name="minScore" type="number" min="0" max="100" value="${s.minScore}" /></label>
          <label class="adm-field"><span>Meldungen der letzten … Stunden</span><input name="lookbackHours" type="number" min="6" max="168" value="${s.lookbackHours}" /></label>
          <label class="adm-field"><span>Modell</span><select name="model">${Object.entries(MODELS).map(([k, l]) => `<option value="${k}" ${s.model === k ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
          <label class="adm-field"><span>Zeitzone</span><input name="timezone" value="${esc(s.timezone)}" /></label>
        </div>
        <div class="adm-field"><span>Rubriken</span><div class="adm-tabs" id="cats">
          ${Object.entries(CATEGORIES).map(([k, l]) => `<button type="button" data-cat="${k}" aria-pressed="${s.categories.includes(k)}">${l}</button>`).join('')}
        </div></div>
        <button class="adm-btn" id="save-settings" type="button">Einstellungen speichern</button>
      </form>
    </section>

    <section class="adm-panel"><h2>Claude-API-Schlüssel</h2>
      <p class="lead">${secret ? `<span class="adm-ok">Hinterlegt</span>, zuletzt geändert ${fmtDate(secret.updated_at)}.` : secret === null ? '<span class="adm-warn">Noch kein Schlüssel hinterlegt.</span> Ohne Schlüssel läuft der Agent nicht.' : '<span class="adm-err">Status nicht lesbar.</span> Hat der Token das Recht „Secrets“?'}
        Der Schlüssel wird im Browser verschlüsselt und als geschütztes GitHub-Secret gespeichert. Danach kann ihn niemand mehr lesen, auch du nicht, nur ersetzen.</p>
      <div class="adm-actions"><input class="adm-in" id="apikey" type="password" autocomplete="off" placeholder="sk-ant-…" style="max-width:420px" />
        <button class="adm-btn" id="save-key" type="button">${secret ? 'Schlüssel ersetzen' : 'Schlüssel speichern'}</button></div>
    </section>

    <section class="adm-panel"><h2>Letzte Läufe</h2>
      <p class="lead">Ein Lauf dauert meist 3–10 Minuten. Neue Artikel erscheinen danach unter <a href="#/articles?f=drafts">Entwürfe</a>.</p>
      <div class="adm-table-wrap"><table class="adm-table"><thead><tr><th>Start</th><th>Auslöser</th><th>Status</th><th></th></tr></thead>
      <tbody>${runRows || '<tr><td colspan="4" class="adm-empty">Noch keine Läufe.</td></tr>'}</tbody></table></div>
    </section>`, cache.articles?.filter(isDraft).length);

  const toggle = (id) => document.getElementById(id).addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (b) b.setAttribute('aria-pressed', String(b.getAttribute('aria-pressed') !== 'true'));
  });
  toggle('days');
  toggle('cats');

  document.getElementById('save-settings').addEventListener('click', async (e) => {
    const f = new FormData(document.getElementById('settings'));
    const times = String(f.get('times')).split(',').map((x) => x.trim()).filter(Boolean);
    if (!times.every((x) => /^([01]\d|2[0-3]):00$/.test(x))) return toast('Uhrzeiten bitte als volle Stunden, z. B. 06:00, 14:00.', true);
    const pickedDays = document.querySelectorAll('#days [aria-pressed=true]').length;
    if (f.get('enabled') === 'on' && !pickedDays) return toast('Bitte mindestens einen Wochentag wählen, sonst läuft der Agent nie.', true);
    const { autoPublish, ...rest } = s;
    const data = {
      ...rest,
      enabled: f.get('enabled') === 'on',
      backfill: f.get('backfill') === 'on',
      days: [...document.querySelectorAll('#days [aria-pressed=true]')].map((b) => b.dataset.day),
      times,
      maxArticlesPerRun: +f.get('maxArticlesPerRun'),
      minScore: +f.get('minScore'),
      lookbackHours: +f.get('lookbackHours'),
      model: f.get('model'),
      timezone: String(f.get('timezone')).trim() || 'Europe/Berlin',
      categories: [...document.querySelectorAll('#cats [aria-pressed=true]')].map((b) => b.dataset.cat),
    };
    e.target.disabled = true;
    try {
      await gh.writeJson(SETTINGS_PATH, data, st.sha, 'Update agent settings');
      cache.settings = null;
      toast('Einstellungen gespeichert.');
      viewAgent();
    } catch (err) {
      toast(err.message, true);
      e.target.disabled = false;
    }
  });

  document.getElementById('save-key').addEventListener('click', async (e) => {
    const input = document.getElementById('apikey');
    const v = input.value.trim();
    if (!v.startsWith('sk-ant-')) return toast('Das sieht nicht wie ein Claude-API-Schlüssel aus (beginnt mit sk-ant-).', true);
    e.target.disabled = true;
    try {
      await gh.setSecret('ANTHROPIC_API_KEY', v);
      input.value = '';
      toast('Schlüssel verschlüsselt gespeichert.');
      viewAgent();
    } catch (err) {
      toast(err.message, true);
      e.target.disabled = false;
    }
  });

  const start = async (btn, dryRun) => {
    btn.disabled = true;
    try {
      await gh.dispatch('agent.yml', { force: 'true', dry_run: dryRun ? 'true' : 'false' });
      toast(dryRun ? 'Probelauf gestartet. Ergebnis im Protokoll.' : 'Agent gestartet. Neue Entwürfe in einigen Minuten.');
      setTimeout(viewAgent, 6000);
    } catch (err) {
      toast(err.message, true);
      btn.disabled = false;
    }
  };
  document.getElementById('run').addEventListener('click', (e) => start(e.target, false));
  document.getElementById('dry').addEventListener('click', (e) => start(e.target, true));
}

// ---------- analytics ----------
const fmtNum = (n) => Number(n || 0).toLocaleString('de-DE');
const delta = (now, before) => {
  if (!before) return now ? '<span class="adm-muted">neu</span>' : '<span class="adm-muted">–</span>';
  const d = Math.round(((now - before) / before) * 100);
  return `<span class="${d >= 0 ? 'adm-up' : 'adm-down'}">${d >= 0 ? '▲' : '▼'} ${Math.abs(d)} %</span> <span class="adm-muted">zum Zeitraum davor</span>`;
};
const REF_LABEL = { '': 'Direkt / unbekannt' };
const DEVICE_LABEL = { mobile: 'Smartphone', tablet: 'Tablet', desktop: 'Computer', '': 'Unbekannt' };

function barList(rows, label, value, total) {
  if (!rows.length) return '<p class="adm-empty">Noch keine Daten.</p>';
  const max = Math.max(...rows.map(value), 1);
  return `<ul class="adm-bars">${rows
    .map((r) => `<li><span class="adm-bar" style="width:${(value(r) / max) * 100}%"></span><span class="adm-bar-label">${label(r)}</span><span class="adm-bar-value">${fmtNum(value(r))}${total ? ` <small>${Math.round((value(r) / total) * 100)} %</small>` : ''}</span></li>`)
    .join('')}</ul>`;
}

function dailyChart(daily) {
  const W = 760, H = 220, top = 12, bottom = 26, left = 36, right = 4;
  const max = Math.max(...daily.map((d) => d.visitors), 1);
  const nice = (m) => { const p = 10 ** Math.floor(Math.log10(m)); return Math.ceil(m / p) * p; };
  const ymax = nice(max);
  const step = (W - left - right) / daily.length;
  const bw = Math.max(2, Math.min(28, step - 2));
  const y = (v) => top + (H - top - bottom) * (1 - v / ymax);
  // Visitors are whole numbers: no 0,5 gridline when the scale is tiny.
  const ticks = Number.isInteger(ymax / 2) ? [0, ymax / 2, ymax] : [0, ymax];
  const every = Math.ceil(daily.length / 7);
  const day = (d) => new Date(d.day).toLocaleDateString('de-DE', { day: 'numeric', month: 'short' });
  return `<svg viewBox="0 0 ${W} ${H}" class="adm-chart-svg" role="img" aria-label="Besucher pro Tag">
    ${ticks.map((t) => `<line x1="${left}" x2="${W - right}" y1="${y(t)}" y2="${y(t)}" class="grid"/><text x="${left - 8}" y="${y(t) + 4}" class="tick" text-anchor="end">${fmtNum(t)}</text>`).join('')}
    ${daily
      .map((d, i) => {
        const x = left + i * step + (step - bw) / 2;
        const h = Math.max(0, y(0) - y(d.visitors));
        const r = Math.min(4, bw / 2, h);
        const path = h ? `M${x},${y(0)} V${y(0) - h + r} Q${x},${y(0) - h} ${x + r},${y(0) - h} H${x + bw - r} Q${x + bw},${y(0) - h} ${x + bw},${y(0) - h + r} V${y(0)} Z` : '';
        return `<g class="col" data-i="${i}">
          <rect x="${left + i * step}" y="${top}" width="${step}" height="${H - top - bottom}" class="hit"/>
          ${path ? `<path d="${path}" class="bar"/>` : ''}
          ${i % every === 0 ? `<text x="${x + bw / 2}" y="${H - 8}" class="tick" text-anchor="middle">${day(d)}</text>` : ''}
        </g>`;
      })
      .join('')}
    <line x1="${left}" x2="${W - right}" y1="${y(0)}" y2="${y(0)}" class="base"/>
  </svg>`;
}

async function viewAnalytics(params) {
  const days = [7, 30, 90].includes(+params.get('d')) ? +params.get('d') : 30;
  const view = loading('#/analytics');
  if (!auth.signedIn() || gh.hasToken()) {
    view.innerHTML = `<div class="adm-head"><div><h1>Analytics</h1></div></div><p class="adm-empty">Analytics gibt es nur mit der Anmeldung per E-Mail, nicht mit dem GitHub-Notfall-Token.</p>`;
    return;
  }
  let st, articles;
  try {
    [st, articles] = await Promise.all([
      auth.supabase.rpc('fv_stats', { days }).then(({ data, error }) => {
        if (error) throw new Error(/not allowed/.test(error.message) ? 'Dieses Konto ist für Analytics nicht freigeschaltet.' : /fv_stats|function/.test(error.message) ? 'Analytics ist in Supabase noch nicht eingerichtet.' : error.message);
        return data;
      }),
      loadArticles().catch(() => []),
    ]);
  } catch (err) {
    return failed(view, err);
  }
  const titles = Object.fromEntries(articles.map((a) => [`/news/${a.slug}/`, a.data.title]));
  const pageLabel = (p) => (p === '/' ? 'Startseite' : titles[p] ? esc(titles[p]) : `<code>${esc(p)}</code>`);
  const t = st.totals, pv = st.previous;
  const perVisit = t.visitors ? (t.views / t.visitors).toLocaleString('de-DE', { maximumFractionDigits: 1 }) : '–';
  const daySum = (k) => st.daily.reduce((n, d) => n + d[k], 0);

  view.innerHTML = `
    <div class="adm-head"><div><h1>Analytics</h1><p>Ohne Cookies erfasst · Besucher werden pro Tag gezählt</p></div>
      <div class="adm-tabs" role="group" aria-label="Zeitraum">${[7, 30, 90].map((d) => `<a href="#/analytics?d=${d}" aria-pressed="${d === days}" class="adm-tab">${d} Tage</a>`).join('')}</div></div>
    <div class="adm-cards">
      <div class="adm-card"><div class="k">Besucher</div><div class="v">${fmtNum(t.visitors)}</div><div class="s">${delta(t.visitors, pv.visitors)}</div></div>
      <div class="adm-card"><div class="k">Seitenaufrufe</div><div class="v">${fmtNum(t.views)}</div><div class="s">${delta(t.views, pv.views)}</div></div>
      <div class="adm-card"><div class="k">Seiten pro Besuch</div><div class="v">${perVisit}</div><div class="s">Durchschnitt</div></div>
      <div class="adm-card"><div class="k">Gerade aktiv</div><div class="v">${fmtNum(st.live)}</div><div class="s">letzte 5 Minuten</div></div>
    </div>

    <section class="adm-panel adm-chart">
      <h2>Besucher pro Tag</h2>
      <div class="adm-chart-wrap">${dailyChart(st.daily)}<div class="adm-tip" hidden></div></div>
      <details class="adm-details"><summary>Als Tabelle</summary>
        <table class="adm-table"><thead><tr><th>Tag</th><th>Besucher</th><th>Seitenaufrufe</th></tr></thead>
        <tbody>${st.daily.slice().reverse().map((d) => `<tr><td>${fmtDay(d.day)}</td><td>${fmtNum(d.visitors)}</td><td>${fmtNum(d.views)}</td></tr>`).join('')}</tbody>
        <tfoot><tr><td>Summe</td><td>${fmtNum(daySum('visitors'))}</td><td>${fmtNum(daySum('views'))}</td></tr></tfoot></table>
      </details>
    </section>

    <div class="adm-grid2">
      <section class="adm-panel"><h2>Meistgelesene Seiten</h2><p class="lead">Seitenaufrufe</p>${barList(st.pages, (r) => pageLabel(r.path), (r) => r.views)}</section>
      <section class="adm-panel"><h2>Woher die Besucher kommen</h2><p class="lead">Besucher</p>${barList(st.refs, (r) => esc(REF_LABEL[r.ref] ?? r.ref), (r) => r.visitors, t.visitors)}</section>
      <section class="adm-panel"><h2>Geräte</h2><p class="lead">Besucher</p>${barList(st.devices, (r) => DEVICE_LABEL[r.device] ?? esc(r.device), (r) => r.visitors, t.visitors)}</section>
      <section class="adm-panel"><h2>Browsersprache</h2><p class="lead">Besucher</p>${barList(st.langs, (r) => (r.lang ? esc(r.lang.toUpperCase()) : 'Unbekannt'), (r) => r.visitors, t.visitors)}</section>
    </div>
    <p class="adm-muted adm-note">Nicht gezählt werden Bots, das Backend und Besucher mit „Do Not Track“ oder Global Privacy Control. Die Zahlen sind daher eher eine Untergrenze.</p>`;

  // Hover: tooltip per day column.
  const wrap = view.querySelector('.adm-chart-wrap');
  const tip = wrap.querySelector('.adm-tip');
  wrap.querySelectorAll('.col').forEach((g) => {
    g.addEventListener('mouseenter', () => {
      const d = st.daily[+g.dataset.i];
      g.classList.add('on');
      tip.innerHTML = `<strong>${new Date(d.day).toLocaleDateString('de-DE', { weekday: 'short', day: 'numeric', month: 'long' })}</strong><br>${fmtNum(d.visitors)} Besucher · ${fmtNum(d.views)} Aufrufe`;
      tip.hidden = false;
      const box = g.querySelector('.hit').getBoundingClientRect();
      const host = wrap.getBoundingClientRect();
      const x = Math.min(Math.max(box.left - host.left + box.width / 2, 70), host.width - 70);
      tip.style.left = `${x}px`;
    });
    g.addEventListener('mouseleave', () => {
      g.classList.remove('on');
      tip.hidden = true;
    });
  });
}

// ---------- router ----------
function route() {
  const [path, query = ''] = location.hash.replace(/^#/, '').split('?');
  if (auth.recovering && auth.signedIn()) return renderLogin('password-new');
  if (!gh.signedIn()) return renderLogin(path === '/token' ? 'token' : undefined);
  if (path === '/token' || path === '/password') return (location.hash = '#/');
  const params = new URLSearchParams(query);
  window.scrollTo(0, 0);
  if (path.startsWith('/edit/')) return viewEditor(decodeURIComponent(path.slice(6)));
  if (path === '/new') return viewEditor(null);
  if (path === '/articles') return viewArticles(params);
  if (path === '/sources') return viewSources();
  if (path === '/agent') return viewAgent();
  if (path === '/analytics') return viewAnalytics(params);
  return viewDashboard();
}
window.addEventListener('hashchange', route);
auth.init().then(route, () => route());
