import { decodeBytes, parseCsv } from './csv.js';
import { rowsToTransactions } from './columns.js';
import { detectRecurring, summarize } from './detect.js';
import { buildLetter } from './letter.js';
import { sampleCsv } from './sample.js';
import { STRINGS, pickLang } from './i18n.js';

const REPO_URL = 'https://github.com/vqorn/plugtheleak';

const ICONS = {
  video: '🎬', music: '🎵', audio: '🎧', software: '💻', cloud: '☁️', ai: '🤖', news: '📰',
  fitness: '💪', gaming: '🎮', dating: '💘', learning: '🎓', mobile: '📱', internet: '🌐', tv: '📺',
  food: '🍝', mobility: '🚆', insurance: '🛡️', energy: '⚡', broadcast: '📻', housing: '🏠',
  finance: '🏦', charity: '💚', shopping: '🛒', other: '🔁',
};

// Mandatory or not cancellable in a meaningful way.
const NOT_CANCELLABLE = new Set(['broadcast']);

const state = {
  lang: pickLang(),
  result: null,
  error: '',
  loading: false,
  filter: 'subs',
  marked: new Set(),
  hidden: new Set(),
  open: new Set(),
  letter: { name: '', address: '', email: '', customerNo: '', revokeMandate: true },
};

const app = document.getElementById('app');
const t = () => STRINGS[state.lang];

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

function money(n) {
  return new Intl.NumberFormat(state.lang === 'de' ? 'de-DE' : 'en-IE', { style: 'currency', currency: 'EUR' }).format(n);
}

function formatDate(ms) {
  return new Date(ms).toLocaleDateString(state.lang === 'de' ? 'de-DE' : 'en-GB', {
    day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC',
  });
}

// ---------- Loading files ----------

async function handleFiles(fileList) {
  const files = [...fileList];
  if (!files.length) return;
  state.loading = true;
  state.error = '';
  render();
  const all = [];
  let error = '';
  for (const file of files) {
    const text = decodeBytes(await file.arrayBuffer());
    const { transactions, error: e } = rowsToTransactions(parseCsv(text));
    if (e && !error) error = e;
    all.push(...transactions);
  }
  loadTransactions(all, error);
}

function loadTransactions(transactions, error) {
  state.loading = false;
  state.marked.clear();
  state.hidden.clear();
  state.open.clear();
  if (!transactions.length) {
    state.result = null;
    state.error = error === 'no-header' ? t().errorNoHeader : t().errorNoRows;
    render();
    return;
  }
  const result = detectRecurring(transactions);
  if (!result.items.length && !result.maybe.length) {
    state.result = null;
    state.error = t().errorNothing;
  } else {
    state.result = result;
  }
  render();
  window.scrollTo({ top: 0 });
}

function loadDemo() {
  const { transactions, error } = rowsToTransactions(parseCsv(sampleCsv()));
  loadTransactions(transactions, error);
}

// ---------- Rendering ----------

function renderStart() {
  const s = t();
  return `
    <section class="hero">
      <h1>${esc(s.tagline)}</h1>
      <p class="privacy">🔒 ${esc(s.privacy)}</p>
    </section>
    <label class="drop" id="drop" tabindex="0">
      <input type="file" id="file" accept=".csv,.txt,text/csv" multiple hidden>
      <span class="drop-icon">📄</span>
      <strong>${esc(s.dropTitle)}</strong>
      <span class="muted">${esc(s.dropOr)}</span>
      <span class="btn primary">${esc(s.choose)}</span>
    </label>
    ${state.loading ? `<p class="center muted">${esc(s.reading)}</p>` : ''}
    ${state.error ? `<p class="error" role="alert">${esc(state.error)}</p>` : ''}
    <p class="center"><button class="btn link" data-action="demo">✨ ${esc(s.demo)}</button></p>
    <details class="how">
      <summary>${esc(s.howTitle)}</summary>
      <ol>${s.howSteps.map((x) => `<li>${esc(x)}</li>`).join('')}</ol>
      <p class="muted">${esc(s.howBanks)}</p>
    </details>`;
}

function badge(text, cls = '') {
  return `<span class="badge ${cls}">${esc(text)}</span>`;
}

function renderItem(item, { ended = false, hidden = false } = {}) {
  const s = t();
  const marked = state.marked.has(item.id);
  const cancellable = !ended && !hidden && !NOT_CANCELLABLE.has(item.category);
  const open = state.open.has(item.id);
  const badges = [];
  if (item.priceChange) badges.push(badge(s.priceUp(money(item.priceChange.from), money(item.priceChange.to)), 'warn'));
  if (item.variable) badges.push(badge(s.variable));
  if (item.directDebit) badges.push(badge(s.directDebit, 'soft'));
  return `
    <article class="item ${marked ? 'marked' : ''} ${ended ? 'ended' : ''}" data-id="${esc(item.id)}">
      <div class="item-main">
        ${cancellable ? `<label class="check" title="${esc(s.dontNeed)}"><input type="checkbox" data-action="mark" ${marked ? 'checked' : ''} aria-label="${esc(s.dontNeed)}: ${esc(item.name)}"></label>` : ''}
        <div class="icon" aria-hidden="true">${ICONS[item.category] || '🔁'}</div>
        <div class="info">
          <div class="name">${esc(item.name)}</div>
          <div class="meta">${esc(s.categories[item.category])} · ${esc(s.cadence[item.cadence])} · ${esc(s.lastPaid)} ${formatDate(item.last)}${!ended ? ` · ${esc(s.nextDue)} ${formatDate(item.next)}` : ''}</div>
          ${badges.length ? `<div class="badges">${badges.join('')}</div>` : ''}
        </div>
        <div class="price">
          <div class="amount">${item.variable ? '~' : ''}${money(item.amount)}</div>
          <div class="yearly">${money(item.yearly)}${esc(s.perYearShort)}</div>
        </div>
      </div>
      <div class="actions">
        ${cancellable ? `<button class="btn small danger" data-action="cancel">✂️ ${esc(s.cancel)}</button>` : ''}
        <button class="btn small ghost" data-action="toggle" aria-expanded="${open}">${esc(s.details)} (${item.count})</button>
        <button class="btn small ghost" data-action="${hidden ? 'unhide' : 'hide'}">${esc(hidden ? s.restore : s.hide)}</button>
      </div>
      ${open ? `<ul class="tx">${item.transactions
        .slice()
        .reverse()
        .map((x) => `<li><span>${formatDate(x.date)}</span><span class="tx-text">${esc(x.text)}</span><span>${money(x.amount)}</span></li>`)
        .join('')}</ul>` : ''}
    </article>`;
}

function renderResults() {
  const s = t();
  const r = state.result;
  const visible = r.items.filter((i) => !state.hidden.has(i.id));
  const filtered = visible.filter((i) => state.filter === 'all' || i.subscription);
  const active = filtered.filter((i) => i.active);
  const ended = filtered.filter((i) => !i.active);
  const hidden = r.items.filter((i) => state.hidden.has(i.id));
  const maybe = r.maybe.filter((i) => !state.hidden.has(i.id));
  const sum = summarize(visible);
  const subsView = state.filter === 'subs';
  const headline = subsView ? sum.subsYearly : sum.yearly;
  const headCount = subsView ? sum.subsCount : sum.activeCount;
  const markedItems = visible.filter((i) => i.active && state.marked.has(i.id));
  const saveYear = markedItems.reduce((a, i) => a + i.yearly, 0);

  return `
    <div class="toolbar">
      <div class="seg" role="group">
        <button class="${state.filter === 'all' ? 'on' : ''}" data-action="filter" data-value="all">${esc(s.filterAll)}</button>
        <button class="${state.filter === 'subs' ? 'on' : ''}" data-action="filter" data-value="subs">${esc(s.filterSubs)}</button>
      </div>
    </div>
    <section class="summary">
      <div class="big">
        <div class="big-value">${money(headline)}</div>
        <div class="big-label">${esc(subsView ? s.summaryYearlySubs : s.summaryYearly)}</div>
      </div>
      <div class="stats">
        <div><strong>${money(headline / 12)}</strong><span>${esc(s.summaryMonthly)}</span></div>
        <div><strong>${headCount}</strong><span>${esc(subsView ? s.summarySubsCount(headCount) : s.summaryCount(headCount))}</span></div>
      </div>
      <p>${esc(subsView ? s.summaryAll(money(sum.yearly)) : s.summarySubs(sum.subsCount, money(sum.subsYearly)))}</p>
      ${sum.priceIncreases ? `<p class="alert">📈 ${esc(s.priceAlerts(sum.priceIncreases))}</p>` : ''}
      <p class="muted small">${esc(s.summaryRange(formatDate(r.range.start), formatDate(r.range.end), r.count))}</p>
    </section>

    <div class="savings ${saveYear ? 'on' : ''}" aria-live="polite">
      ${saveYear ? `💸 ${esc(s.savings(money(saveYear), money(saveYear / 12)))}` : esc(s.savingsHint)}
    </div>

    <h2>${esc(s.sectionActive)}</h2>
    <div class="list">${active.map((i) => renderItem(i)).join('')}</div>

    ${maybe.length ? `
      <h2>${esc(s.sectionMaybe)}</h2>
      <p class="muted small">${esc(s.sectionMaybeHint)}</p>
      <div class="list">${maybe.map(renderMaybe).join('')}</div>` : ''}

    ${ended.length ? `
      <details class="section">
        <summary><h2>${esc(s.sectionEnded)} (${ended.length})</h2></summary>
        <p class="muted small">${esc(s.sectionEndedHint)}</p>
        <div class="list">${ended.map((i) => renderItem(i, { ended: true })).join('')}</div>
      </details>` : ''}

    ${hidden.length ? `
      <details class="section">
        <summary><h2>${esc(s.sectionHidden)} (${hidden.length})</h2></summary>
        <div class="list">${hidden.map((i) => renderItem(i, { hidden: true })).join('')}</div>
      </details>` : ''}

    <div class="bottom-actions">
      <button class="btn" data-action="export">⬇️ ${esc(s.exportCsv)}</button>
      <button class="btn" data-action="print">🖨️ ${esc(s.print)}</button>
      <button class="btn" data-action="reset">↩️ ${esc(s.startOver)}</button>
    </div>
    <p class="muted small center">${esc(s.disclaimer)}</p>`;
}

function renderMaybe(m) {
  const s = t();
  return `
    <article class="item maybe" data-id="${esc(m.id)}">
      <div class="item-main">
        <div class="icon" aria-hidden="true">${ICONS[m.category] || '🔁'}</div>
        <div class="info">
          <div class="name">${esc(m.name)}</div>
          <div class="meta">${esc(s.categories[m.category])} · ${esc(s.onlyOnce(formatDate(m.last)))}</div>
        </div>
        <div class="price"><div class="amount">${money(m.amount)}</div></div>
      </div>
      <div class="actions">
        <button class="btn small danger" data-action="cancel-maybe">✂️ ${esc(s.cancel)}</button>
        <button class="btn small ghost" data-action="hide">${esc(s.hide)}</button>
      </div>
    </article>`;
}

function render() {
  const s = t();
  document.documentElement.lang = state.lang;
  document.getElementById('lang').textContent = s.langSwitch;
  document.getElementById('footer-source').textContent = s.footerSource;
  document.getElementById('footer-offline').textContent = s.footerOffline;
  app.innerHTML = state.result ? renderResults() : renderStart();
}

// ---------- Cancel dialog ----------

const dialog = document.getElementById('dialog');
let dialogItem = null;

function openCancel(item) {
  dialogItem = { ...item, providerAddress: '' };
  renderDialog();
  if (typeof dialog.showModal === 'function') dialog.showModal();
  else dialog.setAttribute('open', '');
}

function letterText() {
  return buildLetter({ lang: state.lang, provider: dialogItem.name, providerAddress: dialogItem.providerAddress, ...state.letter });
}

function renderDialog() {
  const s = t();
  const item = dialogItem;
  const query = encodeURIComponent(`${item.name} ${state.lang === 'de' ? 'kündigen' : 'cancel subscription'}`);
  const L = state.letter;
  dialog.innerHTML = `
    <form method="dialog" class="dialog-inner" id="letter-form">
      <header>
        <h2>${esc(s.cancelTitle(item.name))}</h2>
        <button class="btn ghost small" value="close" aria-label="${esc(s.close)}">✕</button>
      </header>
      <h3>${esc(s.cancelOnline)}</h3>
      <p class="muted small">${esc(s.cancelOnlineHint)}</p>
      <p class="row">
        ${item.url ? `<a class="btn primary" href="${esc(item.url)}" target="_blank" rel="noopener noreferrer">${esc(s.cancelPage)} ↗</a>` : ''}
        <a class="btn" href="https://duckduckgo.com/?q=${query}" target="_blank" rel="noopener noreferrer">🔎 ${esc(s.cancelSearch)}</a>
      </p>
      <h3>${esc(s.letterTitle)}</h3>
      <p class="muted small">${esc(s.letterHint)}</p>
      <div class="grid">
        <label>${esc(s.fName)}<input name="name" value="${esc(L.name)}" autocomplete="name"></label>
        <label>${esc(s.fCustomerNo)}<input name="customerNo" value="${esc(L.customerNo)}"></label>
        <label>${esc(s.fAddress)}<textarea name="address" rows="2" autocomplete="street-address">${esc(L.address)}</textarea></label>
        <label>${esc(s.fProviderAddress)}<textarea name="providerAddress" rows="2">${esc(item.providerAddress)}</textarea></label>
        <label>${esc(s.fEmail)}<input name="email" type="email" value="${esc(L.email)}" autocomplete="email"></label>
        <label>${esc(s.fProvider)}<input name="provider" value="${esc(item.name)}"></label>
      </div>
      <label class="inline"><input type="checkbox" name="revokeMandate" ${L.revokeMandate ? 'checked' : ''}> ${esc(s.fRevoke)}</label>
      <textarea id="letter" class="letter" rows="14" aria-label="${esc(s.letterTitle)}">${esc(letterText().body)}</textarea>
      <p class="row">
        <button type="button" class="btn primary" data-action="copy">📋 ${esc(s.copy)}</button>
        <button type="button" class="btn" data-action="mail">✉️ ${esc(s.mail)}</button>
        <button type="button" class="btn" data-action="print-letter">🖨️ ${esc(s.printLetter)}</button>
      </p>
      <p class="tip"><strong>${esc(s.tipTitle)}:</strong> ${esc(s.tip)}</p>
    </form>`;
}

dialog.addEventListener('input', (e) => {
  const el = e.target;
  if (!el.name) return;
  if (el.name === 'providerAddress') dialogItem.providerAddress = el.value;
  else if (el.name === 'provider') dialogItem.name = el.value;
  else if (el.name === 'revokeMandate') state.letter.revokeMandate = el.checked;
  else state.letter[el.name] = el.value;
  document.getElementById('letter').value = letterText().body;
});

dialog.addEventListener('click', async (e) => {
  const btn = e.target.closest('[data-action]');
  if (!btn) return;
  const text = document.getElementById('letter').value;
  const action = btn.dataset.action;
  if (action === 'copy') {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const ta = document.getElementById('letter');
      ta.select();
      document.execCommand('copy');
    }
    btn.textContent = `✅ ${t().copied}`;
  } else if (action === 'mail') {
    const { subject } = letterText();
    location.href = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(text)}`;
  } else if (action === 'print-letter') {
    const out = document.getElementById('print-letter');
    out.textContent = text;
    document.body.classList.add('printing-letter');
    window.print();
    document.body.classList.remove('printing-letter');
  }
});

// ---------- Events ----------

function findItem(id) {
  const r = state.result;
  return r.items.find((i) => i.id === id) || r.maybe.find((i) => i.id === id);
}

function exportCsv() {
  const s = t();
  const de = state.lang === 'de';
  const head = de
    ? ['Name', 'Kategorie', 'Rhythmus', 'Betrag', 'Pro Jahr', 'Zuletzt', 'Nächste', 'Aktiv']
    : ['Name', 'Category', 'Cadence', 'Amount', 'Per year', 'Last', 'Next', 'Active'];
  const num = (n) => (de ? n.toFixed(2).replace('.', ',') : n.toFixed(2));
  const rows = state.result.items
    .filter((i) => !state.hidden.has(i.id))
    .map((i) => [i.name, s.categories[i.category], s.cadence[i.cadence], num(i.amount), num(i.yearly), formatDate(i.last), formatDate(i.next), i.active ? (de ? 'ja' : 'yes') : (de ? 'nein' : 'no')]);
  const csv = [head, ...rows].map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(de ? ';' : ',')).join('\r\n');
  const url = URL.createObjectURL(new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = de ? 'abos.csv' : 'subscriptions.csv';
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

app.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-action]');
  if (!btn) return;
  const card = btn.closest('[data-id]');
  const id = card && card.dataset.id;
  switch (btn.dataset.action) {
    case 'demo': return loadDemo();
    case 'filter': state.filter = btn.dataset.value; break;
    case 'mark':
      if (btn.checked) state.marked.add(id);
      else state.marked.delete(id);
      break;
    case 'hide': state.hidden.add(id); state.marked.delete(id); break;
    case 'unhide': state.hidden.delete(id); break;
    case 'toggle':
      if (state.open.has(id)) state.open.delete(id);
      else state.open.add(id);
      break;
    case 'cancel':
    case 'cancel-maybe': return openCancel(findItem(id));
    case 'export': return exportCsv();
    case 'print': return window.print();
    case 'reset': state.result = null; state.error = ''; break;
    default: return;
  }
  render();
});

app.addEventListener('change', (e) => {
  if (e.target.id === 'file') handleFiles(e.target.files);
});

app.addEventListener('keydown', (e) => {
  if (e.target.id === 'drop' && (e.key === 'Enter' || e.key === ' ')) {
    e.preventDefault();
    document.getElementById('file').click();
  }
});

// Drop anywhere on the page, not just on the box.
window.addEventListener('dragover', (e) => {
  e.preventDefault();
  document.body.classList.add('dragging');
});
window.addEventListener('dragleave', (e) => {
  if (!e.relatedTarget) document.body.classList.remove('dragging');
});
window.addEventListener('drop', (e) => {
  e.preventDefault();
  document.body.classList.remove('dragging');
  if (e.dataTransfer && e.dataTransfer.files.length) handleFiles(e.dataTransfer.files);
});

document.getElementById('lang').addEventListener('click', () => {
  state.lang = state.lang === 'de' ? 'en' : 'de';
  try {
    localStorage.setItem('plugtheleak-lang', state.lang);
  } catch {
    // storage blocked: language just won't be remembered
  }
  render();
});

document.getElementById('repo').href = REPO_URL;
document.getElementById('footer-source').href = REPO_URL;
render();
