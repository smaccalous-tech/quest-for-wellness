// Shared report rendering for admin-panel.html and client-portal.html.
// Everything that comes from the AI or from users is escaped before it reaches innerHTML.

export const APPROVED_BRANDS = [
  'Biolight Technologies',
  'Pure Encapsulations',
  'Biotics Research',
  'Premier Research Labs',
  'Metagenics',
];

export const WELLNESS_AREAS = [
  { key: 'energy', label: 'Energy' },
  { key: 'digestive', label: 'Digestive' },
  { key: 'immune', label: 'Immune' },
  { key: 'hormonal', label: 'Hormonal' },
  { key: 'stress', label: 'Stress resilience' },
  { key: 'nutritional', label: 'Nutritional' },
];

export const DISCLAIMER =
  'This report is for educational purposes only and is not intended to diagnose, treat, cure, or prevent any disease or medical condition.';

export function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// green 70+, yellow 40-69, orange below 40
export function scoreLevel(score) {
  const s = Number(score) || 0;
  if (s >= 70) return 'good';
  if (s >= 40) return 'fair';
  return 'low';
}

export function scoreWord(score) {
  return { good: 'Balanced', fair: 'Some stress', low: 'Needs support' }[scoreLevel(score)];
}

export function toDate(value) {
  if (!value) return null;
  if (typeof value.toDate === 'function') return value.toDate(); // Firestore Timestamp
  const d = new Date(value);
  return isNaN(d) ? null : d;
}

export function formatDate(value, opts = { month: 'short', day: 'numeric', year: 'numeric' }) {
  const d = toDate(value);
  return d ? d.toLocaleDateString(undefined, opts) : '—';
}

/** Circular gauge. The ring animates from 0 when `.qr-animate` is added (see animateGauges). */
export function gaugeHtml(score, { size = 'lg', label = 'Overall wellness' } = {}) {
  const s = Math.max(0, Math.min(100, Math.round(Number(score) || 0)));
  const r = 52, c = 2 * Math.PI * r;
  return `
    <div class="qr-gauge qr-gauge-${size} qr-${scoreLevel(s)}" data-score="${s}">
      <svg viewBox="0 0 120 120" aria-hidden="true">
        <circle class="qr-gauge-track" cx="60" cy="60" r="${r}"/>
        <circle class="qr-gauge-fill" cx="60" cy="60" r="${r}" stroke-dasharray="${c.toFixed(1)}" stroke-dashoffset="${c.toFixed(1)}" data-circ="${c.toFixed(1)}"/>
      </svg>
      <div class="qr-gauge-center">
        <span class="qr-gauge-num" data-target="${s}">${s}</span>
        ${size === 'lg' ? `<span class="qr-gauge-word">${scoreWord(s)}</span>` : ''}
      </div>
      ${label ? `<div class="qr-gauge-label">${esc(label)}</div>` : ''}
    </div>`;
}

/** Horizontal bars for the six wellness areas. */
export function barsHtml(scores = {}) {
  return `<div class="qr-bars">${WELLNESS_AREAS.map(({ key, label }) => {
    const s = Math.max(0, Math.min(100, Math.round(Number(scores[key]) || 0)));
    return `
      <div class="qr-bar-row qr-${scoreLevel(s)}" data-area="${key}">
        <div class="qr-bar-head"><span>${label}</span><span class="qr-bar-val">${s}</span></div>
        <div class="qr-bar-track"><div class="qr-bar-fill" style="--w:${s}%"></div></div>
      </div>`;
  }).join('')}</div>`;
}

/** Six small circular gauges (client dashboard). */
export function miniGaugesHtml(scores = {}) {
  return `<div class="qr-minis">${WELLNESS_AREAS.map(({ key, label }) =>
    gaugeHtml(scores[key], { size: 'sm', label })).join('')}</div>`;
}

/** Animate rings, numbers and bars inside `root` (call after inserting HTML). */
export function animateGauges(root) {
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  requestAnimationFrame(() => {
    root.querySelectorAll('.qr-gauge').forEach(g => {
      const fill = g.querySelector('.qr-gauge-fill');
      const circ = Number(fill.dataset.circ);
      const score = Number(g.dataset.score);
      fill.style.strokeDashoffset = String(circ * (1 - score / 100));
      const num = g.querySelector('.qr-gauge-num');
      if (reduce) { num.textContent = score; return; }
      const start = performance.now();
      const tick = now => {
        const p = Math.min((now - start) / 1200, 1);
        num.textContent = Math.round(score * (1 - Math.pow(1 - p, 3)));
        if (p < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
    root.querySelectorAll('.qr-bar-fill').forEach(b => b.classList.add('qr-grow'));
  });
}

/** Update an already-rendered gauge/bar set in place (admin sliders). */
export function updateScoresInPlace(root, analysis) {
  const g = root.querySelector('.qr-gauge-lg');
  if (g) {
    const s = analysis.overallScore;
    g.dataset.score = s;
    g.className = `qr-gauge qr-gauge-lg qr-${scoreLevel(s)}`;
    const fill = g.querySelector('.qr-gauge-fill');
    fill.style.strokeDashoffset = String(Number(fill.dataset.circ) * (1 - s / 100));
    g.querySelector('.qr-gauge-num').textContent = s;
    const word = g.querySelector('.qr-gauge-word');
    if (word) word.textContent = scoreWord(s);
  }
  WELLNESS_AREAS.forEach(({ key }) => {
    const row = root.querySelector(`.qr-bar-row[data-area="${key}"]`);
    if (!row) return;
    const s = analysis.wellnessScores[key];
    row.className = `qr-bar-row qr-${scoreLevel(s)}`;
    row.querySelector('.qr-bar-val').textContent = s;
    row.querySelector('.qr-bar-fill').style.setProperty('--w', `${s}%`);
  });
}

function supplementCardHtml(s, { requestButton }) {
  return `
    <div class="qr-supp">
      <div class="qr-supp-top">
        <span class="qr-supp-rank">${esc(s.rank)}</span>
        <span class="qr-priority qr-priority-${esc(String(s.priority).toLowerCase())}">${esc(s.priority)} priority</span>
      </div>
      <div class="qr-supp-brand">${esc(s.brand)}</div>
      <div class="qr-supp-name">${esc(s.name)}</div>
      <p class="qr-supp-reason">${esc(s.reason)}</p>
      ${requestButton ? `<button class="qr-btn qr-btn-outline qr-request-supp" data-name="${esc(s.name)}" data-brand="${esc(s.brand)}">Request this supplement</button>` : ''}
    </div>`;
}

/**
 * Full read-only report.
 * @param {object} a analysis data
 * @param {{requestButton?: boolean, extraActions?: string}} opts
 */
export function reportHtml(a, opts = {}) {
  const findings = (a.keyFindings || []).map(f => `<li>${esc(f)}</li>`).join('');
  const recs = (a.allRecommendations || []).map(r => `<li>${esc(r)}</li>`).join('');
  return `
    <div class="qr-report">
      <div class="qr-scores">
        ${gaugeHtml(a.overallScore)}
        <div class="qr-scores-bars">${barsHtml(a.wellnessScores)}</div>
      </div>
      <div class="qr-card qr-summary">
        <div class="qr-card-title">Your wellness summary</div>
        <p>${esc(a.summary)}</p>
      </div>
      ${findings ? `<div class="qr-card"><div class="qr-card-title">Key findings</div><ol class="qr-findings">${findings}</ol></div>` : ''}
      ${(a.topSupplements || []).length ? `
        <div class="qr-section-title">Top supplement recommendations</div>
        <div class="qr-supps">${a.topSupplements.map(s => supplementCardHtml(s, opts)).join('')}</div>` : ''}
      ${recs ? `
        <details class="qr-card qr-details">
          <summary>View full details — all recommendations</summary>
          <ul class="qr-recs">${recs}</ul>
        </details>` : ''}
      ${a.lifestyleNotes ? `<div class="qr-card qr-lifestyle"><div class="qr-card-title">Lifestyle support</div><p>${esc(a.lifestyleNotes)}</p></div>` : ''}
      ${a.followUpRecommended ? `<div class="qr-followup">A follow-up scan is recommended to track your progress.</div>` : ''}
      ${opts.extraActions || ''}
      <p class="qr-disclaimer">${esc(DISCLAIMER)}</p>
    </div>`;
}
