import { decodeBytes, parseCsv } from './csv.js';
import { rowsToTransactions } from './columns.js';
import { detectRecurring, summarize, findOverlaps } from './detect.js';
import { buildIcs } from './calendar.js';
import { drawCard } from './card.js';
import { buildLetter } from './letter.js';
import { sampleCsv } from './sample.js';
import { STRINGS, pickLang } from './i18n.js';

const REPO_URL = 'https://github.com/vqorn/PlugTheLeak';
const SITE_URL = 'https://vqorn.github.io/PlugTheLeak/';

// Line icons, drawn on a 24px grid with a 1.6px stroke.
const ICON = {
  lock: '<rect x="5" y="10.5" width="14" height="10" rx="2.5"/><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5"/>',
  search: '<circle cx="11" cy="11" r="6.5"/><path d="m20 20-4.2-4.2"/>',
  letter: '<rect x="3" y="5.5" width="18" height="13" rx="2.5"/><path d="m4 7.5 8 5.5 8-5.5"/>',
  file: '<path d="M14 3H7.5A2.5 2.5 0 0 0 5 5.5v13A2.5 2.5 0 0 0 7.5 21h9a2.5 2.5 0 0 0 2.5-2.5V8z"/><path d="M14 3v5h5"/><path d="M12 17.5v-6m-2.75 2.75L12 11.5l2.75 2.75"/>',
  chevron: '<path d="m9 5.5 6.5 6.5L9 18.5"/>',
  down: '<path d="m5.5 9 6.5 6.5L18.5 9"/>',
  close: '<path d="M6 6l12 12M18 6 6 18"/>',
  external: '<path d="M14 4h6v6"/><path d="M20 4 11 13"/><path d="M18 14v4.5a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 4 18.5v-11A1.5 1.5 0 0 1 5.5 6H10"/>',
  trend: '<path d="m4 16 5-5 4 4 7-7"/><path d="M15 8h5v5"/>',
  layers: '<path d="m12 3.5 8.5 4.75L12 13 3.5 8.25z"/><path d="m3.5 12.5 8.5 4.75 8.5-4.75"/>',
  clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
  spark: '<path d="M12 3.5v3.5M12 17v3.5M3.5 12H7M17 12h3.5M6 6l2.4 2.4M15.6 15.6 18 18M6 18l2.4-2.4M15.6 8.4 18 6"/>',
  share: '<path d="M12 15V3.5"/><path d="m7.5 8 4.5-4.5L16.5 8"/><path d="M6 11.5H5.5A2 2 0 0 0 3.5 13.5v5a2 2 0 0 0 2 2h13a2 2 0 0 0 2-2v-5a2 2 0 0 0-2-2H18"/>',
  calendar: '<rect x="3.5" y="5" width="17" height="15.5" rx="2.5"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
};

const CURRENCIES = ['EUR', 'USD', 'GBP', 'CHF', 'CAD', 'AUD', 'NZD', 'SEK', 'NOK', 'DKK', 'PLN', 'CZK', 'HUF', 'JPY', 'INR', 'BRL', 'MXN', 'ZAR', 'SGD', 'HKD'];

const REGION_CURRENCY = {
  US: 'USD', GB: 'GBP', UK: 'GBP', CA: 'CAD', AU: 'AUD', NZ: 'NZD', CH: 'CHF', LI: 'CHF', SE: 'SEK', NO: 'NOK',
  DK: 'DKK', PL: 'PLN', CZ: 'CZK', HU: 'HUF', JP: 'JPY', IN: 'INR', BR: 'BRL', MX: 'MXN', ZA: 'ZAR', SG: 'SGD', HK: 'HKD',
};

// When the file doesn't say, the browser's region is the best guess.
function defaultCurrency() {
  for (const tag of navigator.languages || [navigator.language || '']) {
    const region = (tag.split('-')[1] || '').toUpperCase();
    if (REGION_CURRENCY[region]) return REGION_CURRENCY[region];
    if (region) return 'EUR';
  }
  return (navigator.language || '').startsWith('de') ? 'EUR' : 'USD';
}

function icon(name, cls = '') {
  return `<svg class="ic ${cls}" viewBox="0 0 24 24" aria-hidden="true">${ICON[name]}</svg>`;
}

// Tile colours per category, loosely following the system palette of iOS.
const TILE = {
  video: '#ff3b30', music: '#ff2d55', audio: '#ff9500', software: '#007aff', cloud: '#32ade6',
  ai: '#5856d6', news: '#8e8e93', fitness: '#34c759', gaming: '#af52de', dating: '#ff2d55',
  learning: '#30b0c7', mobile: '#007aff', internet: '#5ac8fa', tv: '#5856d6', food: '#ff9500',
  mobility: '#34c759', insurance: '#a2845e', energy: '#ff9f0a', broadcast: '#8e8e93',
  housing: '#a2845e', finance: '#30b0c7', charity: '#34c759', shopping: '#ff9500', other: '#8e8e93',
};

// Mandatory or not cancellable in a meaningful way.
const NOT_CANCELLABLE = new Set(['broadcast']);

const state = {
  lang: pickLang(),
  result: null,
  error: '',
  loading: false,
  filter: 'subs',
  currency: defaultCurrency(),
  warning: '',
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

function locale() {
  if (state.lang === 'de') return 'de-DE';
  const nav = navigator.language || '';
  return nav.startsWith('en') ? nav : 'en-US';
}

function money(n, digits = 2) {
  const cur = state.currency;
  const d = cur === 'JPY' || cur === 'HUF' ? 0 : digits;
  return new Intl.NumberFormat(locale(), {
    style: 'currency', currency: cur, minimumFractionDigits: d, maximumFractionDigits: d,
  }).format(n);
}

function formatDate(ms) {
  return new Date(ms).toLocaleDateString(locale(), {
    day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC',
  });
}

function tile(item) {
  const letter = (item.name.match(/\p{L}|\d/u) || ['?'])[0].toUpperCase();
  return `<span class="tile" style="background:${TILE[item.category] || TILE.other}" aria-hidden="true">${esc(letter)}</span>`;
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
  let currency = null;
  const seen = new Set();
  for (const file of files) {
    const text = decodeBytes(await file.arrayBuffer());
    const { transactions, error: e, currency: c } = rowsToTransactions(parseCsv(text));
    if (e && !error) error = e;
    if (c) seen.add(c);
    currency = currency || c;
    all.push(...transactions);
  }
  state.warning = seen.size > 1 ? t().mixedCurrencies([...seen].join(', ')) : '';
  loadTransactions(all, error, currency);
}

function loadTransactions(transactions, error, currency) {
  state.loading = false;
  state.currency = currency || defaultCurrency();
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
  state.warning = '';
  const { transactions, error, currency } = rowsToTransactions(parseCsv(sampleCsv(Date.now(), state.lang)));
  loadTransactions(transactions, error, currency);
}

// ---------- Start page ----------

function renderStart() {
  const s = t();
  const featureIcons = ['lock', 'search', 'letter'];
  return `
    <section class="hero">
      <p class="eyebrow">${esc(s.eyebrow)}</p>
      <h1>${esc(s.heroA)}<br><span class="dim">${esc(s.heroB)}</span></h1>
      <p class="lead">${esc(s.lead)}</p>
      <div class="cta">
        <label class="pill primary" for="file">${esc(s.choose)}</label>
        <button class="textlink" data-action="demo">${esc(s.demo)} ${icon('chevron', 'sm')}</button>
      </div>
      <input type="file" id="file" accept=".csv,.txt,text/csv" multiple hidden>
    </section>

    <section class="drop" id="drop" tabindex="0" role="button" aria-label="${esc(s.choose)}">
      ${icon('file', 'xl')}
      <p class="drop-title">${esc(s.dropTitle)}</p>
      <p class="drop-hint">${esc(s.dropHint)}</p>
      ${state.loading ? `<p class="drop-hint">${esc(s.reading)}</p>` : ''}
    </section>
    ${state.error ? `<p class="notice" role="alert">${esc(state.error)}</p>` : ''}

    <section class="features">
      ${s.features.map(([title, text], i) => `
        <article class="feature">
          ${icon(featureIcons[i], 'lg')}
          <h3>${esc(title)}</h3>
          <p>${esc(text)}</p>
        </article>`).join('')}
    </section>

    <section class="how">
      <h2>${esc(s.howTitle)}</h2>
      <ol class="steps">${s.howSteps.map((x) => `<li>${esc(x)}</li>`).join('')}</ol>
      <p class="fine">${esc(s.howBanks)}</p>
    </section>`;
}

// ---------- Results ----------

let overlapIds = new Set();

function renderInsights(visible) {
  const s = t();
  const active = visible.filter((i) => i.active);
  const overlaps = findOverlaps(active);
  overlapIds = new Set(overlaps.flatMap((o) => o.ids));
  const rows = [];
  const row = (ic, text, sub = '') => `
    <li class="insight">
      <span class="insight-ic">${icon(ic)}</span>
      <div class="insight-text"><span>${esc(text)}</span>${sub ? `<span class="insight-sub">${esc(sub)}</span>` : ''}</div>
    </li>`;
  for (const o of overlaps) {
    rows.push(row('layers', s.overlap(o.names.length, s.kinds[o.kind] || o.kind, o.names.join(', ')), s.overlapCost(money(o.yearly))));
  }
  for (const i of active.filter((x) => x.trial)) {
    rows.push(row('spark', s.trialLine(i.name, money(i.trial.amount), money(i.amount), s.cadence[i.cadence])));
  }
  for (const i of active.filter((x) => x.isNew && !x.trial)) {
    rows.push(row('clock', s.newLine(i.name, formatDate(i.first))));
  }
  for (const i of active.filter((x) => x.priceChange)) {
    rows.push(row('trend', s.priceLine(i.name, money(i.priceChange.from), money(i.priceChange.to))));
  }
  return rows.length ? group(s.insightsTitle, rows.join(''), s.insightsHint) : '';
}

function renderRow(item, { ended = false, hidden = false } = {}) {
  const s = t();
  const marked = state.marked.has(item.id);
  const open = state.open.has(item.id);
  const cancellable = !ended && !hidden && !NOT_CANCELLABLE.has(item.category);
  const tags = [];
  if (item.priceChange) tags.push(`<span class="tag warn">${icon('trend', 'xs')} ${esc(s.priceUp(money(item.priceChange.from), money(item.priceChange.to)))}</span>`);
  if (item.trial) tags.push(`<span class="tag warn">${esc(s.trialTag)}</span>`);
  if (item.isNew) tags.push(`<span class="tag">${esc(s.newTag)}</span>`);
  if (overlapIds.has(item.id)) tags.push(`<span class="tag warn">${esc(s.overlapTag)}: ${esc(s.kinds[item.kind] || '')}</span>`);
  if (item.variable) tags.push(`<span class="tag">${esc(s.variable)}</span>`);
  if (item.directDebit) tags.push(`<span class="tag">${esc(s.directDebit)}</span>`);

  return `
    <li class="row ${marked ? 'marked' : ''} ${ended ? 'ended' : ''} ${open ? 'open' : ''}" data-id="${esc(item.id)}">
      <div class="row-main" data-action="toggle" role="button" tabindex="0" aria-expanded="${open}">
        ${cancellable ? `<input type="checkbox" class="check" data-action="mark" ${marked ? 'checked' : ''} aria-label="${esc(s.dontNeed)}: ${esc(item.name)}">` : '<span class="check-space"></span>'}
        ${tile(item)}
        <div class="row-text">
          <span class="row-name">${esc(item.name)}</span>
          <span class="row-meta">${esc(s.categories[item.category])} · ${esc(s.cadence[item.cadence])}</span>
        </div>
        <div class="row-price">
          <span class="row-amount">${item.variable ? '~' : ''}${money(item.amount)}</span>
          <span class="row-yearly">${money(item.yearly)}${esc(s.perYearShort)}</span>
        </div>
        ${icon('chevron', 'row-chev')}
      </div>
      ${open ? `
        <div class="row-more">
          ${tags.length ? `<div class="tags">${tags.join('')}</div>` : ''}
          <dl class="facts">
            <div><dt>${esc(s.lastPaid)}</dt><dd>${formatDate(item.last)}</dd></div>
            ${!ended ? `<div><dt>${esc(s.nextDue)}</dt><dd>${formatDate(item.next)}</dd></div>` : ''}
          </dl>
          <ul class="tx">${item.transactions.slice().reverse().map((x) => `
            <li><span>${formatDate(x.date)}</span><span class="tx-text">${esc(x.text)}</span><span>${money(x.amount)}</span></li>`).join('')}
          </ul>
          <div class="row-actions">
            ${cancellable ? `<button class="pill primary small" data-action="cancel">${esc(s.cancel)}</button>` : ''}
            ${!ended && !hidden ? `<button class="textlink" data-action="remind">${esc(s.remind)}</button>` : ''}
            <button class="textlink" data-action="${hidden ? 'unhide' : 'hide'}">${esc(hidden ? s.restore : s.hide)}</button>
          </div>
        </div>` : ''}
    </li>`;
}

function renderMaybe(m) {
  const s = t();
  return `
    <li class="row" data-id="${esc(m.id)}">
      <div class="row-main static">
        <span class="check-space"></span>
        ${tile(m)}
        <div class="row-text">
          <span class="row-name">${esc(m.name)}</span>
          <span class="row-meta">${esc(s.categories[m.category])} · ${esc(s.onlyOnce(formatDate(m.last)))}</span>
        </div>
        <div class="row-price"><span class="row-amount">${money(m.amount)}</span></div>
        <div class="row-inline-actions">
          <button class="textlink" data-action="cancel-maybe">${esc(s.cancelShort)}</button>
          <button class="iconbtn" data-action="hide" aria-label="${esc(s.hide)}">${icon('close', 'sm')}</button>
        </div>
      </div>
    </li>`;
}

function group(title, rows, hint = '') {
  return `
    <section class="group">
      <h2 class="group-title">${esc(title)}</h2>
      ${hint ? `<p class="group-hint">${esc(hint)}</p>` : ''}
      <ul class="list">${rows}</ul>
    </section>`;
}

function renderResults() {
  const s = t();
  const r = state.result;
  const visible = r.items.filter((i) => !state.hidden.has(i.id));
  const subsView = state.filter === 'subs';
  const filtered = visible.filter((i) => !subsView || i.subscription);
  const active = filtered.filter((i) => i.active);
  const ended = filtered.filter((i) => !i.active);
  const hidden = r.items.filter((i) => state.hidden.has(i.id));
  const maybe = r.maybe.filter((i) => !state.hidden.has(i.id));
  const sum = summarize(visible);
  const headline = subsView ? sum.subsYearly : sum.yearly;
  const headCount = subsView ? sum.subsCount : sum.activeCount;
  const saveYear = visible.filter((i) => i.active && state.marked.has(i.id)).reduce((a, i) => a + i.yearly, 0);

  return `
    <div class="seg" role="tablist">
      <button role="tab" aria-selected="${!subsView}" class="${!subsView ? 'on' : ''}" data-action="filter" data-value="all">${esc(s.filterAll)}</button>
      <button role="tab" aria-selected="${subsView}" class="${subsView ? 'on' : ''}" data-action="filter" data-value="subs">${esc(s.filterSubs)}</button>
    </div>

    <section class="total">
      <p class="eyebrow plain">${esc(subsView ? s.costSubs : s.costAll)}</p>
      <p class="total-value">${money(headline, 0)}</p>
      <p class="total-sub">${esc(s.perYearLong)}</p>
      <p class="total-line">${esc(s.monthlyLine(money(headline / 12), headCount, subsView))}</p>
      ${state.warning ? `<p class="notice">${esc(state.warning)}</p>` : ''}
      ${sum.priceIncreases ? `<p class="total-alert">${icon('trend', 'xs')} ${esc(s.priceAlerts(sum.priceIncreases))}</p>` : ''}
      <p class="fine">${esc(subsView ? s.summaryAll(money(sum.yearly)) : s.summarySubs(sum.subsCount, money(sum.subsYearly)))}</p>
      <p class="fine">${esc(s.summaryRange(formatDate(r.range.start), formatDate(r.range.end), r.count))}</p>
      <div class="cta"><button class="pill primary" data-action="share">${icon('share', 'sm')} ${esc(s.shareCta)}</button></div>
      <label class="currency">${esc(s.currency)}
        <select id="currency">${CURRENCIES.map((c) => `<option value="${c}" ${c === state.currency ? 'selected' : ''}>${c}</option>`).join('')}</select>
      </label>
    </section>

    ${renderInsights(filtered)}
    ${group(s.sectionActive, active.map((i) => renderRow(i)).join(''), s.savingsHint)}
    ${maybe.length ? group(s.sectionMaybe, maybe.map(renderMaybe).join(''), s.sectionMaybeHint) : ''}

    ${ended.length ? `
      <details class="group fold">
        <summary class="group-title">${esc(s.sectionEnded)} <span class="count">${ended.length}</span>${icon('down', 'sm fold-ic')}</summary>
        <p class="group-hint">${esc(s.sectionEndedHint)}</p>
        <ul class="list">${ended.map((i) => renderRow(i, { ended: true })).join('')}</ul>
      </details>` : ''}

    ${hidden.length ? `
      <details class="group fold">
        <summary class="group-title">${esc(s.sectionHidden)} <span class="count">${hidden.length}</span>${icon('down', 'sm fold-ic')}</summary>
        <ul class="list">${hidden.map((i) => renderRow(i, { hidden: true })).join('')}</ul>
      </details>` : ''}

    <nav class="links">
      <button class="textlink" data-action="remind-all">${esc(s.remindAll)}</button>
      <button class="textlink" data-action="export">${esc(s.exportCsv)}</button>
      <button class="textlink" data-action="print">${esc(s.print)}</button>
      <button class="textlink" data-action="reset">${esc(s.startOver)}</button>
    </nav>
    <p class="fine center">${esc(s.remindHint)}</p>
    <p class="fine center">${esc(s.disclaimer)}</p>

    <div class="savebar ${saveYear ? 'show' : ''}" aria-live="polite">
      ${saveYear ? `<span>${esc(s.savingsLead)} <strong>${money(saveYear)}</strong> ${esc(s.savingsTail(money(saveYear / 12)))}</span>` : ''}
    </div>`;
}

function render() {
  const s = t();
  document.documentElement.lang = state.lang;
  document.getElementById('lang').textContent = s.langSwitch;
  document.getElementById('footer-source').textContent = s.footerSource;
  document.getElementById('footer-offline').textContent = s.footerOffline;
  document.getElementById('footer-disclaimer').textContent = s.privacy;
  app.innerHTML = state.result ? renderResults() : renderStart();
}

// ---------- Share card ----------

let shareNames = false;

function cardData() {
  const s = t();
  const r = state.result;
  const visible = r.items.filter((i) => !state.hidden.has(i.id));
  const active = visible.filter((i) => i.active && i.subscription);
  const total = active.reduce((a, i) => a + i.yearly, 0);
  const saving = active.filter((i) => state.marked.has(i.id)).reduce((a, i) => a + i.yearly, 0);
  const chips = [];
  for (const o of findOverlaps(active)) chips.push(s.cardOverlap(o.names.length, s.kinds[o.kind] || o.kind));
  const trials = active.filter((i) => i.trial).length;
  if (trials) chips.push(s.cardTrials(trials));
  const prices = active.filter((i) => i.priceChange).length;
  if (prices) chips.push(s.cardPrices(prices));
  return {
    total: money(total, 0),
    totalText: money(total, 0),
    eyebrow: s.cardEyebrow,
    perYear: s.perYearLong,
    monthlyLine: s.cardMonthly(money(total / 12), active.length),
    saving: saving ? s.cardSaving(money(saving, 0)) : '',
    chips,
    items: active.map((i) => ({ name: i.name, category: i.category, yearly: money(i.yearly, 0) + s.perYearShort, marked: state.marked.has(i.id) })),
    showNames: shareNames,
    footer: s.cardFooter,
    tagline: s.cardTagline,
    url: SITE_URL.replace(/^https:\/\//, '').replace(/\/$/, ''),
    tile: (cat) => TILE[cat] || TILE.other,
  };
}

function renderShare() {
  const s = t();
  const canvas = drawCard(document.createElement('canvas'), cardData());
  dialog.innerHTML = `
    <form method="dialog" class="sheet">
      <header class="sheet-head">
        <h2>${esc(s.shareTitle)}</h2>
        <button class="iconbtn" value="close" aria-label="${esc(s.close)}">${icon('close')}</button>
      </header>
      <p class="fine">${esc(s.shareHint)}</p>
      <img class="card-preview" alt="" src="${canvas.toDataURL('image/png')}">
      <label class="switch"><input type="checkbox" data-action="share-names" ${shareNames ? 'checked' : ''}><span>${esc(s.showNames)}</span></label>
      <div class="cta left">
        ${navigator.canShare ? `<button type="button" class="pill primary" data-action="share-send">${icon('share', 'sm')} ${esc(s.shareBtn)}</button>` : ''}
        <button type="button" class="${navigator.canShare ? 'pill' : 'pill primary'}" data-action="share-save">${esc(s.downloadImage)}</button>
      </div>
    </form>`;
  dialog.shareCanvas = canvas;
}

function openShare() {
  renderShare();
  if (typeof dialog.showModal === 'function') dialog.showModal();
  else dialog.setAttribute('open', '');
}

async function shareImage(send) {
  const canvas = dialog.shareCanvas;
  const blob = await new Promise((res) => canvas.toBlob(res, 'image/png'));
  const file = new File([blob], 'plugtheleak.png', { type: 'image/png' });
  const total = cardData().totalText;
  if (send && navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], text: `${t().shareText(total)} ${SITE_URL}` });
      return;
    } catch (e) {
      if (e && e.name === 'AbortError') return;
    }
  }
  download(blob, 'plugtheleak.png', 'image/png');
}

// ---------- Cancel sheet ----------

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
    <form method="dialog" class="sheet">
      <header class="sheet-head">
        <h2>${esc(s.cancelTitle(item.name))}</h2>
        <button class="iconbtn" value="close" aria-label="${esc(s.close)}">${icon('close')}</button>
      </header>

      <section class="sheet-section">
        <h3>${esc(s.cancelOnline)}</h3>
        <p class="fine">${esc(s.cancelOnlineHint)}</p>
        <div class="cta left">
          ${item.url ? `<a class="pill primary" href="${esc(item.url)}" target="_blank" rel="noopener noreferrer">${esc(s.cancelPage)} ${icon('external', 'xs')}</a>` : ''}
          <a class="${item.url ? 'textlink' : 'pill primary'}" href="https://duckduckgo.com/?q=${query}" target="_blank" rel="noopener noreferrer">${esc(s.cancelSearch)} ${icon(item.url ? 'chevron' : 'external', 'xs')}</a>
        </div>
      </section>

      <section class="sheet-section">
        <h3>${esc(s.letterTitle)}</h3>
        <p class="fine">${esc(s.letterHint)}</p>
        <div class="fields">
          <label>${esc(s.fName)}<input name="name" value="${esc(L.name)}" autocomplete="name"></label>
          <label>${esc(s.fCustomerNo)}<input name="customerNo" value="${esc(L.customerNo)}"></label>
          <label>${esc(s.fAddress)}<textarea name="address" rows="2" autocomplete="street-address">${esc(L.address)}</textarea></label>
          <label>${esc(s.fProviderAddress)}<textarea name="providerAddress" rows="2">${esc(item.providerAddress)}</textarea></label>
          <label>${esc(s.fEmail)}<input name="email" type="email" value="${esc(L.email)}" autocomplete="email"></label>
          <label>${esc(s.fProvider)}<input name="provider" value="${esc(item.name)}"></label>
        </div>
        <label class="switch"><input type="checkbox" name="revokeMandate" ${L.revokeMandate ? 'checked' : ''}><span>${esc(s.fRevoke)}</span></label>
        <textarea id="letter" class="letter" rows="13" aria-label="${esc(s.letterTitle)}">${esc(letterText().body)}</textarea>
        <div class="cta left">
          <button type="button" class="pill primary" data-action="copy">${esc(s.copy)}</button>
          <button type="button" class="pill" data-action="mail">${esc(s.mail)}</button>
          <button type="button" class="pill" data-action="print-letter">${esc(s.printLetter)}</button>
        </div>
        <p class="fine">${esc(s.tip)}</p>
      </section>
    </form>`;
}

dialog.addEventListener('input', (e) => {
  const el = e.target;
  if (el.dataset.action === 'share-names') {
    shareNames = el.checked;
    return renderShare();
  }
  if (!el.name) return;
  if (el.name === 'providerAddress') dialogItem.providerAddress = el.value;
  else if (el.name === 'provider') dialogItem.name = el.value;
  else if (el.name === 'revokeMandate') state.letter.revokeMandate = el.checked;
  else state.letter[el.name] = el.value;
  document.getElementById('letter').value = letterText().body;
});

dialog.addEventListener('click', async (e) => {
  if (e.target === dialog) return dialog.close();
  const btn = e.target.closest('[data-action]');
  if (!btn) return;
  const action = btn.dataset.action;
  if (action === 'share-send' || action === 'share-save') return shareImage(action === 'share-send');
  if (action === 'share-names') return;
  const text = document.getElementById('letter').value;
  if (action === 'copy') {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const ta = document.getElementById('letter');
      ta.select();
      document.execCommand('copy');
    }
    btn.textContent = t().copied;
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
  download('\uFEFF' + csv, de ? 'abos.csv' : 'subscriptions.csv', 'text/csv;charset=utf-8');
}

function download(content, filename, type) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function downloadReminders(items) {
  if (!items.length) return;
  const ics = buildIcs(items, { lang: state.lang, money: (n) => money(n) });
  const name = items.length === 1 ? items[0].name.replace(/[^\w-]+/g, '-').toLowerCase() : 'subscriptions';
  download(ics, `${name}.ics`, 'text/calendar;charset=utf-8');
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
      e.stopPropagation();
      if (btn.checked) state.marked.add(id);
      else state.marked.delete(id);
      break;
    case 'hide': state.hidden.add(id); state.marked.delete(id); state.open.delete(id); break;
    case 'unhide': state.hidden.delete(id); break;
    case 'toggle':
      if (state.open.has(id)) state.open.delete(id);
      else state.open.add(id);
      break;
    case 'cancel':
    case 'cancel-maybe': return openCancel(findItem(id));
    case 'export': return exportCsv();
    case 'share': return openShare();
    case 'remind': return downloadReminders([findItem(id)]);
    case 'remind-all':
      return downloadReminders(state.result.items.filter((i) => i.active && !state.hidden.has(i.id)
        && (state.filter === 'all' || i.subscription) && !NOT_CANCELLABLE.has(i.category)));
    case 'print': return window.print();
    case 'reset': state.result = null; state.error = ''; break;
    default: return;
  }
  render();
});

app.addEventListener('change', (e) => {
  if (e.target.id === 'file') handleFiles(e.target.files);
  if (e.target.id === 'currency') {
    state.currency = e.target.value;
    render();
  }
});

app.addEventListener('keydown', (e) => {
  if (e.key !== 'Enter' && e.key !== ' ') return;
  if (e.target.id === 'drop') {
    e.preventDefault();
    document.getElementById('file').click();
  } else if (e.target.classList.contains('row-main') && e.target.dataset.action === 'toggle') {
    e.preventDefault();
    e.target.click();
  }
});

app.addEventListener('click', (e) => {
  if (e.target.closest('#drop')) document.getElementById('file').click();
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
