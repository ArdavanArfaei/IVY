import { compute, SR_RATES } from './model.js';
import { renderHead }     from './ui/head.js';
import { renderFunnel }   from './ui/funnel.js';
import { renderCompare }  from './ui/compare.js';
import { initTimeline, renderTimeline } from './ui/timeline.js';
import { renderChips }    from './ui/chips.js';

const $ = id => document.getElementById(id);

// ─── Helpers ──────────────────────────────────────────────────────────────────
function pct(v) { return Math.round(v * 100); }

function readInputs() {
  return {
    age:        +$('age').value,
    amh:        parseFloat($('amh').value),
    afc:        parseFloat($('afc').value),
    eggs:       parseFloat($('eggs').value),
    blastocysts: parseFloat($('blasts').value),
    retrievals: +$('retrievals').value,
    mfLevel:    $('mfLevel').value,
    pgta:       $('pgta').checked,
    pgtm:       $('pgtm').checked,
    inh:        $('inh').value,
    pgtSR:      $('pgtSR').checked,
    srType:     $('srType').value,
    srCarrier:  $('srCarrier').value,
    pgtHLA:     $('pgtHLA').checked,
    pgtP:       $('pgtP').checked,
    // Tier 2 (always read; ignored in model when advanced=false)
    advanced:   $('advancedMode').checked,
    diagnoses:  [...document.querySelectorAll('.diag:checked')].map(el => el.value),
    bmi:        parseFloat($('bmi').value),
    smoking:    $('smoking').value,
    maleAge:    parseFloat($('maleAge').value),
    dfi:        $('dfi').value,
    failedFET:  +$('failedFET').value,
    blastGrade: $('blastGrade').value,
    biopsyDay:  $('biopsyDay').value,
    includeD:   $('includeD').checked,
  };
}

// ─── PGT-SR pass rate note ────────────────────────────────────────────────────
function updateSRNote() {
  const type    = $('srType').value;
  const carrier = $('srCarrier').value;
  const key     = type === 'rob'
    ? (carrier === 'female' ? 'rob_female' : 'rob_male')
    : type;
  const data    = SR_RATES[key] || SR_RATES.reciprocal;
  const lo = Math.round(data.lo * 100), hi = Math.round(data.hi * 100);
  $('srPassNote').textContent =
    `Published pass rate for this type: ${lo}–${hi}% of blastocysts have normal / balanced chromosomes. ` +
    (type === 'rob' ? 'Carrier sex makes a significant difference for Robertsonians.' : '');

  // Show/hide the carrier field — it only matters for rob and inversion
  $('srCarrierField').hidden = (type === 'reciprocal');
}

// ─── Male factor hint ─────────────────────────────────────────────────────────
function updateMFHint() {
  const level = $('mfLevel').value;
  const HINTS = {
    none:     '',
    mild:     'Mild reduction in fertilization and blastulation rates.',
    moderate: 'ICSI is the standard path. Fertilization and blastulation rates are noticeably lower.',
    severe:   'Surgical retrieval adds a urology track and pushes the cycle back about 10 weeks.',
    oa:       'Sperm retrieval for obstructive azoospermia is nearly always successful.',
    noa:      'Sperm retrieval rate is approximately 45% (range 39–50%). If retrieval succeeds, outcomes are decent — the model shows the two-stage probability.',
  };
  $('mfHint').textContent = HINTS[level] || '';
}

// ─── Update ───────────────────────────────────────────────────────────────────
function update() {
  // Age output
  $('ageOut').textContent   = $('age').value;

  const WORDS = ['', 'one', 'two', 'three', 'four'];
  const n = +$('retrievals').value;
  $('retrievalsOut').textContent  = n;
  $('retrievalWord').textContent  = WORDS[n] || n;

  // Sub-option visibility
  $('pgtmOpts').hidden  = !$('pgtm').checked;
  $('pgtSROpts').hidden = !$('pgtSR').checked;
  $('pgtPNote').hidden  = !$('pgtP').checked;

  // PGT-SR mutual exclusion: SR subsumes A
  if ($('pgtSR').checked) {
    $('pgta').disabled = true;
    $('pgta').checked  = false;
    $('pgtaRow').classList.add('tog-disabled');
  } else {
    $('pgta').disabled = false;
    $('pgtaRow').classList.remove('tog-disabled');
  }

  // PGT-HLA note: warn if PGT-M is not on
  const hlaNote = $('pgtHLA').checked && !$('pgtm').checked
    ? 'PGT-HLA is usually combined with PGT-M. The HLA 1-in-4 fraction still applies.' : '';
  // (store in title for now — could add a visible note element if needed)

  updateSRNote();
  updateMFHint();

  // Advanced tier 2
  $('tier2').hidden = !$('advancedMode').checked;

  // Compute
  const d = compute(readInputs());

  // PGT stack panel
  const stackEl = $('pgtStack');
  if (d.pgtStackSteps.length > 0) {
    stackEl.hidden = false;
    stackEl.innerHTML = `<div class="pgt-stack">
      <span class="pgt-stack-start">All blastocysts</span>` +
      d.pgtStackSteps.map(step =>
        `<span class="pgt-stack-arrow">→</span>
         <span class="pgt-stack-step"><b>${pct(step.rate)}%</b> after ${step.label}</span>`
      ).join('') +
      `</div>`;
  } else {
    stackEl.hidden = true;
  }

  // Render
  renderHead(d);
  renderFunnel(d, $('funnel'));
  renderCompare(d);
  renderTimeline(d);
  renderChips(d, $('chips'));
}

// ─── Event listeners ──────────────────────────────────────────────────────────
const TIER1_INPUTS = ['age', 'amh', 'afc', 'eggs', 'blasts', 'retrievals',
  'mfLevel', 'pgta', 'pgtm', 'inh', 'pgtSR', 'srType', 'srCarrier', 'pgtHLA', 'pgtP'];

const TIER2_INPUTS = ['bmi', 'smoking', 'maleAge', 'dfi', 'failedFET',
  'blastGrade', 'biopsyDay', 'includeD'];

[...TIER1_INPUTS, ...TIER2_INPUTS, 'advancedMode'].forEach(id => {
  const el = $(id);
  if (el) {
    el.addEventListener('input',  update);
    el.addEventListener('change', update);
  }
});

// Diagnosis checkboxes (dynamic)
document.querySelectorAll('.diag').forEach(el => {
  el.addEventListener('change', update);
});

window.addEventListener('resize', update);

initTimeline();
update();
