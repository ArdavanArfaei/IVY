import { CONSTANTS } from '../model.js';

const { NO_RESULT, FALSE_POS } = CONSTANTS;
const pct = v => Math.round(v * 100);

export function renderFunnel(d, el) {
  const { s, entry } = d;
  const mfActive = s.mfLevel && s.mfLevel !== 'none';

  // When entry point is blastocysts, upstream rows are not applicable
  const upstreamNA = entry === 'blastocysts';

  // Use totalBlasts as the reference width for multi-retrieval display
  const max = Math.max(upstreamNA ? d.totalBlasts : d.retrieved, 1);
  const rows = [];

  if (!upstreamNA) {
    rows.push({
      name: 'Eggs retrieved',
      tag: d.src,
      n: d.retrieved,
      color: 'var(--rose)',
      note: '',
      dimmed: false,
    });
    rows.push({
      name: 'Mature (MII)',
      tag: `${pct(d.matR)}%`,
      n: d.mature,
      color: 'var(--rose)',
      note: 'Immature eggs can\'t be fertilized and are set aside on day zero.',
      dimmed: false,
    });
    rows.push({
      name: 'Fertilized',
      tag: `${pct(d.fertR)}%`,
      n: d.fert,
      color: 'var(--sage)',
      note: mfActive
        ? 'ICSI — one sperm injected per egg. With male factor the fertilization rate and subsequent blastulation rate are lower.'
        : 'ICSI, one sperm into one egg at a time — standard when embryos will be biopsied, so stray sperm DNA doesn\'t contaminate the result.',
      dimmed: false,
    });
    rows.push({
      name: entry === 'retrieved' && d.numRetr > 1
        ? `Blastocysts (per retrieval × ${d.numRetr})`
        : 'Blastocysts',
      tag: `${pct(d.blastR)}%`,
      n: entry === 'retrieved' && d.numRetr > 1 ? d.totalBlasts : d.blasts,
      color: 'var(--sage)',
      note: 'Days 5 and 6. This is the steepest drop in the whole process.',
      dimmed: false,
    });
  } else {
    rows.push({
      name: 'Blastocysts banked',
      tag: d.src,
      n: d.totalBlasts,
      color: 'var(--sage)',
      note: 'You provided this count — egg retrieval and earlier stages aren\'t modelled separately.',
      dimmed: false,
    });
  }

  // Multi-retrieval note when predicted / retrieved entry
  if (!upstreamNA && d.numRetr > 1 && entry !== 'retrieved') {
    const lastRow = rows[rows.length - 1];
    lastRow.n    = d.totalBlasts;
    lastRow.name = `Blastocysts (${d.numRetr} retrievals pooled)`;
  }

  // Biopsy
  if (s.pgta || s.pgtm || s.pgtSR || s.pgtHLA) {
    rows.push({
      name: 'Biopsied with a result',
      tag: `${pct(1 - NO_RESULT)}%`,
      n: d.biopsy,
      color: 'var(--peri)',
      note: 'A few biopsies never amplify well enough to call. Those embryos stay frozen, unclassified.',
      dimmed: false,
    });
  }

  if (s.pgtSR) {
    const srPct = Math.round(d.srData.def * 100);
    const srLo  = Math.round(d.srData.lo  * 100);
    const srHi  = Math.round(d.srData.hi  * 100);
    rows.push({
      name: 'Balanced / structurally normal',
      tag: `~${srPct}%`,
      n: d.biopsy * d.srData.def,
      color: 'var(--peri)',
      note: `Published range for this rearrangement type: ${srLo}–${srHi}% of blastocysts have the correct amount of material. PGT-SR includes chromosome aneuploidy screening in the same assay.`,
      dimmed: false,
    });
  } else if (s.pgta) {
    rows.push({
      name: 'Euploid',
      tag: `${pct(d.eupR)}%`,
      n: d.biopsy * d.eupR,
      color: 'var(--peri)',
      note: 'Age sets this number and almost nothing else moves it.',
      dimmed: false,
    });
    rows.push({
      name: 'Cleared for transfer',
      tag: `${pct(1 - FALSE_POS)}%`,
      n: d.biopsy * d.eupR * (1 - FALSE_POS),
      color: 'var(--peri)',
      note: 'Some healthy embryos get called aneuploid or mosaic and never make it out of the freezer. That\'s the cost side of screening.',
      dimmed: false,
    });
  }

  if (s.pgtm) {
    rows.push({
      name: 'Unaffected',
      tag: `${pct(d.mFrac)}%`,
      n: d.transferable,
      color: 'var(--lilac)',
      note: 'Mendelian odds, independent of chromosome count. An affected embryo looks perfect and implants normally — nothing else catches it.',
      dimmed: false,
    });
  }

  rows.push({
    name: 'Transferable',
    tag: '',
    n: d.transferable,
    color: 'var(--butter-deep)',
    note: '',
    dimmed: false,
  });

  el.innerHTML = rows.map(r => {
    const w = Math.max(0, Math.min(100, (r.n / max) * 100));
    const opacity = r.dimmed ? 'opacity:.45' : '';
    return `<div class="stage" style="${opacity}">
      <div class="top">
        <div class="name">${r.name}${r.tag ? `<b>${r.tag}</b>` : ''}</div>
        <div class="cnt">${r.n < 10 ? r.n.toFixed(1) : Math.round(r.n)}<em>embryos</em></div>
      </div>
      <div class="bar"><i style="width:${w}%;background:${r.color}"></i></div>
      ${r.note ? `<div class="note">${r.note}</div>` : ''}
    </div>`;
  }).join('');
}
