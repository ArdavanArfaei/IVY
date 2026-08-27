const pct = v => v > 0 ? `+${Math.round(v * 100)}%` : `${Math.round(v * 100)}%`;
const orToDir = or => or >= 1 ? 'up' : 'down';

// Translate an OR to a human-readable direction label
function orLabel(m) {
  if (m.target === 'yield') {
    const delta = Math.round((m.rr - 1) * 100);
    return delta >= 0 ? `yield ${pct(m.rr - 1)}` : `yield ${pct(m.rr - 1)}`;
  }
  if (m.target === 'mii') return `MII rate ${pct(m.rr - 1)}`;
  if (m.target === 'lbr') {
    const dir = m.or >= 1 ? '↑' : '↓';
    return `live birth ${dir}`;
  }
  if (m.target === 'mc') {
    const dir = m.or >= 1 ? '↑' : '↓';
    return `miscarriage ${dir}`;
  }
  return '';
}

const GRADE_COLOR = {
  A: 'var(--sage-deep)',
  B: 'var(--peri-deep)',
  C: 'var(--butter-deep)',
  D: 'var(--ink-faint)',
};

const GRADE_BG = {
  A: 'rgba(181,200,178,.18)',
  B: 'rgba(182,190,223,.18)',
  C: 'rgba(234,221,168,.22)',
  D: 'rgba(160,162,163,.12)',
};

export function renderChips(d, el) {
  if (!d.s.advanced || !d.activeMods.length) {
    el.hidden = true;
    return;
  }

  el.hidden = false;

  // Group mods by label prefix (deduplicate label lines that are same diagnosis)
  const seen = new Set();
  const chips = [];

  d.activeMods.forEach(m => {
    // Use a stable key — label up to first ' —' or '('
    const key = m.label.replace(/\s*[—(].*/, '').trim();
    const isNew = !seen.has(key);
    if (isNew) seen.add(key);

    const isD = m.grade === 'D';
    chips.push({ m, isD, isNew, key });
  });

  el.innerHTML = `<div class="chips-wrap">` +
    chips.map(({ m, isD }) => {
      const color  = GRADE_COLOR[m.grade];
      const bg     = GRADE_BG[m.grade];
      const effect = orLabel(m);
      const dimmed = isD ? 'chips-d' : '';
      return `<div class="chip ${dimmed}" style="--chip-color:${color};--chip-bg:${bg}">
        <span class="chip-grade">${m.grade}</span>
        <span class="chip-label">${m.label}</span>
        ${effect ? `<span class="chip-effect">${effect}</span>` : ''}
        ${isD ? '<span class="chip-contest">not in headline</span>' : ''}
      </div>`;
    }).join('') +
    `</div>`;
}
