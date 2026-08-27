const GUT = 84; // matches --gut CSS variable

let _lastData = null;
let _currentTab = 'ivf';

export function initTimeline() {
  document.querySelectorAll('.tl-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      _currentTab = btn.dataset.tab;
      document.querySelectorAll('.tl-tab').forEach(b =>
        b.classList.toggle('active', b === btn)
      );
      document.querySelectorAll('[data-tl]').forEach(el => {
        el.hidden = el.dataset.tl !== _currentTab;
      });
      if (_lastData) _render(_currentTab, _lastData);
    });
  });
}

export function renderTimeline(d) {
  _lastData = d;
  _render(_currentTab, d);
}

// ─── helpers ──────────────────────────────────────────────────────────────────
const BLEED = 72;

function getPW(totalWeeks) {
  const scrollEl = document.querySelector('.tlscroll');
  const available = (scrollEl?.clientWidth ?? 600) - GUT - BLEED;
  return Math.max(16, available / totalWeeks);
}

function buildAxis(el, totalWeeks, PW) {
  let html = '';
  for (let w = 0; w <= totalWeeks; w++) {
    const x = w * PW;
    if (w % 4 === 0) {
      const mo = w / 4;
      html += `<div class="ax-month" style="left:${x}px">
        <div class="ax-month-label">${mo === 0 ? 'Start' : 'Mo\u00a0' + mo}</div>
        <div class="ax-month-tick"></div>
      </div>`;
    } else if (w % 2 === 0) {
      html += `<div class="ax-week-tick" style="left:${x}px"></div>`;
    }
  }
  el.innerHTML = html;
  el.style.width = `${totalWeeks * PW}px`;
}

function wSeg(t) { return t.length * 6.6 + 22; }
function wPt(t)  { return t.length * 5.4 + 14; }

function packRows(items) {
  const ends = [];
  items.forEach(it => {
    for (let r = 0; r < ends.length; r++) {
      if (it.L >= ends[r] + 12) { it.row = r; ends[r] = it.R; return; }
    }
    it.row = ends.length;
    ends.push(it.R);
  });
  return ends.length;
}

function buildLane(el, segs, pts, W, PW, totalWeeks) {
  segs = segs.slice().sort((a, b) => a.a - b.a);
  pts  = pts.slice().sort((a, b) => a.a - b.a);

  segs.forEach(g => {
    g.L      = g.a * PW;
    g.Wd     = Math.max((g.b - g.a) * PW, 8);
    g.inside = g.Wd >= wSeg(g.label);
    g.R      = g.inside ? g.L + g.Wd : g.L + g.Wd + 8 + wSeg(g.label);
  });
  const segRows = packRows(segs);

  pts.forEach(p => {
    p.L = p.a * PW;
    p.R = p.L + 13 + wPt(p.label);
  });
  const ptRows = packRows(pts);

  const SEG_H = 30, PT_H = 17, TOP = 11;
  const ptTop = TOP + segRows * SEG_H + (segRows ? 5 : 0);
  const h     = ptTop + ptRows * PT_H + 13;

  let html = '<div class="gridbg"></div>';
  for (let w = 0; w <= totalWeeks; w += 4) {
    const x  = w * PW;
    const bw = Math.min(4 * PW, W - x);
    if ((w / 4) % 2 === 1) html += `<div class="month-band" style="left:${x}px;width:${bw}px"></div>`;
    if (w > 0)              html += `<div class="month-line" style="left:${x}px"></div>`;
  }

  pts.forEach(p => { html += `<div class="prule" style="left:${p.L}px"></div>`; });

  segs.forEach(g => {
    const t = TOP + g.row * SEG_H;
    html += `<div class="seg" title="${g.label}" style="left:${g.L}px;width:${g.Wd}px;top:${t}px;background:${g.bg}">${g.inside ? g.label : ''}</div>`;
    if (!g.inside) {
      html += `<div class="segout" style="left:${g.L + g.Wd + 8}px;top:${t}px">${g.label}</div>`;
    }
  });

  pts.forEach(p => {
    const t = ptTop + p.row * PT_H;
    html += `<div class="pt" style="left:${p.L - 4.5}px;top:${t + 3}px;background:var(--clay-deep)"></div>`;
    html += `<div class="ptlabel" style="left:${p.L + 9}px;top:${t}px">${p.label}</div>`;
  });

  el.innerHTML = html;
  el.style.width  = `${W}px`;
  el.style.height = `${h}px`;
}

// ─── tab renders ──────────────────────────────────────────────────────────────
function _render(tab, d) {
  if (tab === 'ivf') renderIvf(d);
  else renderPregnancy(d);
}

function renderIvf(d) {
  const { s, cycle: c, fetStart, transferWk: t, numRetr } = d;
  const mfLevel  = s.mfLevel || 'none';
  const isNOA    = mfLevel === 'noa';
  const mfActive = mfLevel !== 'none';

  // Extend axis for extra retrievals
  const extraRetrWks = Math.max(0, numRetr - 1) * 10;
  const totalWeeks   = Math.ceil(t + 2 + extraRetrWks);
  const PW = getPW(totalWeeks);
  const W  = totalWeeks * PW;

  const inner = document.getElementById('tlinner');
  inner.style.width = `${GUT + W + BLEED}px`;
  inner.style.setProperty('--wkpx', `${PW}px`);

  buildAxis(document.getElementById('axis'), totalWeeks, PW);

  // ── Her ──
  const herS = [
    { a: 0,        b: 13,           label: 'Egg-quality window, 90 days', bg: 'var(--rose)' },
    { a: 4,        b: 10,           label: 'Baseline workup',             bg: '#EFD9D6' },
    { a: c,        b: c + 2,        label: 'Stimulation',                 bg: 'var(--rose)' },
    { a: fetStart, b: fetStart + 5, label: 'Lining prep',                 bg: '#EFD9D6' },
  ];
  const herP = [
    { a: c + 2, label: 'retrieval' },
    { a: t,     label: 'transfer' },
  ];

  // Extra retrieval markers
  for (let i = 1; i < numRetr; i++) {
    const retrivalOffset = t + i * 10;  // rough offset
    herP.push({ a: retrivalOffset, label: `retrieval ${i + 1}` });
    herS.push({
      a: retrivalOffset - 2,
      b: retrivalOffset,
      label: 'Stimulation',
      bg: 'var(--rose)',
    });
  }

  // ── Him ──
  const himS = [{ a: 0, b: 13, label: 'Sperm turnover, 90 days', bg: 'var(--sage)' }];
  const himP = [
    { a: 1, label: 'semen analysis' },
    { a: Math.max(4, c - 2), label: 'backup freeze' },
  ];

  if (isNOA) {
    himS.push({ a: 4, b: 16, label: 'Hormonal optimisation pre-TESE', bg: '#D8E4D6' });
    himP.push({ a: c + 2, label: 'micro-TESE' });
  } else if (mfLevel === 'severe') {
    himS.push({ a: 2, b: 12, label: 'Urology, DFI, surgical plan', bg: '#D8E4D6' });
    himP.push({ a: c + 2, label: 'TESE, same day' });
  } else if (mfActive) {
    himS.push({ a: 2, b: 9, label: 'Urology, DFI, retest', bg: '#D8E4D6' });
  }

  // ── Lab ──
  const labS = [], labP = [];

  if (s.pgtSR) {
    labS.push({ a: 0, b: 3, label: 'Karyotype both partners', bg: '#CDD3EA' });
    labS.push({ a: 3, b: 7, label: 'PGT-SR probe setup',      bg: 'var(--peri)' });
  }
  if (s.pgtm) {
    labS.push({ a: 0, b: 3,  label: 'Carrier screen / confirm variant', bg: 'var(--peri)' });
    labS.push({ a: 3, b: 6,  label: 'Family DNA in',                    bg: '#CDD3EA' });
    labS.push({ a: 6, b: 14, label: 'Build + validate custom test',     bg: 'var(--peri)' });
  }

  labS.push({ a: c + 2, b: c + 3, label: 'Fertilize + culture', bg: '#CDD3EA' });

  const anyTest = s.pgta || s.pgtm || s.pgtSR || s.pgtHLA;
  if (anyTest) {
    labS.push({ a: c + 3, b: c + 3 + d.resultWk, label: 'Results', bg: 'var(--peri)' });
    labP.push({ a: c + 3, label: 'biopsy + freeze' });
  } else {
    labP.push({ a: c + 3, label: 'freeze all' });
  }

  buildLane(document.getElementById('laneHer'), herS, herP, W, PW, totalWeeks);
  buildLane(document.getElementById('laneHim'), himS, himP, W, PW, totalWeeks);
  buildLane(document.getElementById('laneLab'), labS, labP, W, PW, totalWeeks);

  // Timeline note
  const bits = [];
  if (s.pgtm) bits.push("the custom test build is the critical path — it can't start until reference DNA from relatives is in hand");
  if (s.pgtSR) bits.push('probe setup for structural rearrangements adds about 4 weeks before the cycle can start');
  if (isNOA) bits.push('hormonal optimisation before micro-TESE adds about 12 weeks — and sperm retrieval succeeds only about 45% of the time');
  else if (mfLevel === 'severe') bits.push('surgical retrieval adds a urology track and pushes the cycle back about 10 weeks');
  else if (mfActive) bits.push('the urology workup adds about 4 weeks before you can start');
  if (!bits.length) bits.push('nothing is waiting on a lab build, so the 90-day gamete window sets the start date');

  const multiNote = numRetr > 1 ? ` Banking across ${numRetr} retrievals adds roughly ${(numRetr - 1) * 10} weeks before transfers begin.` : '';

  document.getElementById('tlNote').textContent =
    `Right now ${bits.join(', and ')}. Retrieval around week\u00a0${Math.round(c + 2)}, first transfer around week\u00a0${Math.round(t)} — roughly month\u00a0${(Math.round(t) / 4).toFixed(1)}.${multiNote}`;
}

function renderPregnancy(d) {
  const { s } = d;
  const anyPGT = s.pgtm || s.pgtSR;
  const totalWeeks = 20;
  const PW = getPW(totalWeeks);
  const W  = totalWeeks * PW;

  const inner = document.getElementById('tlinner');
  inner.style.width = `${GUT + W + BLEED}px`;
  inner.style.setProperty('--wkpx', `${PW}px`);

  buildAxis(document.getElementById('axis'), totalWeeks, PW);

  const pS = [
    { a: 0,   b: 1.5, label: 'Two-week wait',  bg: '#F0E8C8' },
    { a: 1.5, b: 4.5, label: 'Early scans',    bg: 'var(--butter)' },
    { a: 4.5, b: 8.5, label: 'OB handoff',     bg: '#F0E8C8' },
  ];
  const pP = [
    { a: 1.5, label: 'beta hCG' },
    { a: 4.5, label: 'heartbeat' },
    { a: 8.5, label: 'NIPT' },
  ];

  if (anyPGT) {
    // CVS window: ~10–13 wks gestational = ~3–6 wks from transfer (assuming 5-day blast)
    pS.push({ a:  3, b:  6,  label: 'CVS window',         bg: 'var(--lilac)' });
    pS.push({ a:  8.5, b: 14, label: 'Confirmatory window', bg: 'var(--butter)' });
    pS.push({ a: 14, b: 20,  label: 'To anatomy scan',    bg: '#F0E8C8' });
    pP.push({ a: 12, label: 'amnio option' });
  } else {
    pS.push({ a: 8.5, b: 20, label: 'To anatomy scan', bg: 'var(--butter)' });
  }
  pP.push({ a: 20, label: '20\u2011wk scan' });

  buildLane(document.getElementById('lanePreg'), pS, pP, W, PW, totalWeeks);

  const prenatalNote = anyPGT
    ? ' Confirmatory prenatal testing (CVS or amnio) is available. About 8–12% of patients with a PGT result actually pursue it.'
    : '';

  document.getElementById('tlNote').textContent =
    `Week\u00a00\u202f=\u202ftransfer day. Beta hCG\u00a0~1.5\u202fwks, heartbeat\u00a0~4.5\u202fwks, NIPT\u00a0~8.5\u202fwks, anatomy scan at 20\u202fwks.${prenatalNote}`;
}
