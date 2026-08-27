// Pure calculation model — no DOM access.
// Keep all functions referentially transparent.

// ─── Math helpers ─────────────────────────────────────────────────────────────
// Count-like stages (yield, fertilization, blastulation) compose multiplicatively.
// Probability-like stages (LBR, miscarriage) compose in log-odds, because the
// published effects are odds ratios and ORs are additive on that scale.

const logit = p => Math.log(p / (1 - p));
const expit  = z => 1 / (1 + Math.exp(-z));

function applyCount(base, mods) {
  if (!mods.length) return base;
  const rr = mods.reduce((a, m) => a * m.rr, 1);
  return base * Math.max(rr, 0.15);  // floor: stacked RRs never zero a stage out
}

function applyProb(base, mods) {
  if (!mods.length) return base;
  const z = mods.reduce((a, m) => a + Math.log(m.or), logit(base));
  return Math.min(0.92, Math.max(0.005, expit(z)));
}

// ─── Age curves ───────────────────────────────────────────────────────────────
// Confidence A on shape, C on absolute level (centre-to-centre spread is wide).
export const CURVES = {
  // Euploid fraction of blastocysts by age — mid-range of published series.
  EUPLOID: [[26,.68],[30,.63],[33,.60],[35,.55],[37,.44],[39,.34],[41,.26],[43,.13],[45,.05],[47,.02]],
  // Live birth per euploid single FET — from SART PGT-A cycles.
  // Note: once euploid, age barely moves this. Age effect lives in EUPLOID.
  LBR_EUP: [[28,.552],[34,.548],[36,.536],[39,.518],[41.5,.497],[43,.462],[46,.42]],
  // Oocyte maturity (MII) rate by age.
  MATURE:  [[28,.81],[34,.79],[38,.76],[42,.73],[46,.70]],
  // 2PN → usable blastocyst rate by age.
  BLAST:   [[28,.47],[33,.45],[36,.41],[39,.37],[42,.32],[46,.27]],
  // Miscarriage risk after an untested blastocyst transfer.
  MC_UNT:  [[28,.14],[34,.16],[37,.21],[40,.28],[43,.36],[46,.44]],
};

export const CONSTANTS = {
  NO_RESULT: 0.03,   // biopsies that never amplify to a call
  FALSE_POS: 0.06,   // viable embryos discarded as aneuploid or mosaic
  LBR_ANEU:  0.02,   // live birth from a whole-chromosome aneuploid transfer
  NOA_SRR:   0.446,  // sperm retrieval rate for non-obstructive azoospermia (micro-TESE)
};

// ─── Male factor coefficients ──────────────────────────────────────────────────
// Grade B. NOA is a gate (must check SRR first), not just a multiplier.
const MF = {
  none:     { fertR: 0.72, blastMult: 1.00 },
  mild:     { fertR: 0.68, blastMult: 0.96 },
  moderate: { fertR: 0.63, blastMult: 0.92 },
  severe:   { fertR: 0.58, blastMult: 0.88 },
  oa:       { fertR: 0.67, blastMult: 0.90 },  // obstructive azoospermia (MESA/TESA)
  noa:      { fertR: 0.58, blastMult: 0.82 },  // non-obstructive; pre-multiplied by SRR at output
};

// ─── PGT-SR pass rates ────────────────────────────────────────────────────────
// PGT-SR subsumes PGT-A — commercial panels include chromosome screening.
// Grade B-C. Carrier sex matters a lot for Robertsonians (see spec).
export const SR_RATES = {
  reciprocal: { lo: 0.20, def: 0.25, hi: 0.30 },
  rob_male:   { lo: 0.55, def: 0.70, hi: 0.85 },
  rob_female: { lo: 0.40, def: 0.52, hi: 0.63 },
  inversion:  { lo: 0.65, def: 0.72, hi: 0.80 },
};

// ─── Blastocyst grade LBR odds-ratios (relative to best grade AA) ─────────────
// Based on 10,482 frozen single blastocyst transfers (PMC7943864). Grade B.
const GRADE_OR = {
  AA:    { or: 1.00, lo: 0.90, hi: 1.10 },
  AB:    { or: 0.88, lo: 0.79, hi: 0.98 },
  BA:    { or: 0.88, lo: 0.79, hi: 0.98 },
  BB:    { or: 0.72, lo: 0.62, hi: 0.83 },
  BC:    { or: 0.62, lo: 0.51, hi: 0.75 },
  CB:    { or: 0.62, lo: 0.51, hi: 0.75 },
  CC:    { or: 0.51, lo: 0.39, hi: 0.67 },
  mixed: { or: 0.88, lo: 0.72, hi: 1.00 },
};

// ─── Interpolation ────────────────────────────────────────────────────────────
export function lerp(pts, x) {
  if (x <= pts[0][0]) return pts[0][1];
  if (x >= pts[pts.length - 1][0]) return pts[pts.length - 1][1];
  for (let i = 0; i < pts.length - 1; i++) {
    const [a0, a1] = pts[i], [b0, b1] = pts[i + 1];
    if (x >= a0 && x <= b0) return a1 + (x - a0) / (b0 - a0) * (b1 - a1);
  }
  return pts[pts.length - 1][1];
}

// ─── Entry point ──────────────────────────────────────────────────────────────
// Precedence: blastocysts > twoPN > retrieved > predicted.
// Modifiers upstream of the entry point are discarded — the user-supplied
// number already contains their effect.
const STAGE_IDX = { yield: 0, fertilization: 1, blastulation: 2, transfer: 3, miscarriage: 4 };

function entryPoint(s) {
  if (!isNaN(s.blastocysts) && s.blastocysts > 0) return 'blastocysts';
  if (!isNaN(s.twoPN)       && s.twoPN > 0)       return 'twoPN';
  if (!isNaN(s.eggs)        && s.eggs > 0)         return 'retrieved';
  return 'predicted';
}

// Minimum stage index that can apply mods given an entry point.
function minStageIdx(entry) {
  if (entry === 'blastocysts') return STAGE_IDX.transfer;
  if (entry === 'twoPN')       return STAGE_IDX.blastulation;
  if (entry === 'retrieved')   return STAGE_IDX.fertilization;
  return STAGE_IDX.yield;
}

// ─── Tier 2 modifier builder ──────────────────────────────────────────────────
// Builds the list of active modifiers from advanced inputs.
// Each mod: { label, grade, stage, type:'count'|'prob', target:'yield'|'mii'|'lbr'|'mc', rr|or, lo, hi }
// Mods upstream of entry point are dropped.
// Grade D mods are dropped unless includeD === true.
function buildMods(s, entry, includeD) {
  const mods    = [];
  const minIdx  = minStageIdx(entry);
  const hasAMH  = !isNaN(s.amh) && s.amh > 0;
  const hasAFC  = !isNaN(s.afc) && s.afc > 0;

  function add(m) {
    if (STAGE_IDX[m.stage] < minIdx) return;
    if (m.grade === 'D' && !includeD) return;
    mods.push(m);
  }

  const diag = Array.isArray(s.diagnoses) ? s.diagnoses : [];

  // ── Female diagnoses ──────────────────────────────────────────────────────

  if (diag.includes('pcos')) {
    // Yield: only if AMH/AFC not provided (DOR rule applies here too)
    if (!hasAMH && !hasAFC) {
      add({ label: 'PCOS', grade: 'B', stage: 'yield', type: 'count', target: 'yield',
            rr: 1.65, lo: 1.50, hi: 1.80 });
    }
    add({ label: 'PCOS — MII rate', grade: 'C', stage: 'fertilization', type: 'count', target: 'mii',
          rr: 0.94, lo: 0.88, hi: 1.00 });
  }

  if (diag.includes('endo_none')) {
    add({ label: 'Endometriosis', grade: 'B', stage: 'yield', type: 'count', target: 'yield',
          rr: 0.85, lo: 0.78, hi: 0.93 });
  }

  if (diag.includes('endo_large')) {
    add({ label: 'Endometriosis + endometrioma', grade: 'B', stage: 'yield', type: 'count', target: 'yield',
          rr: 0.70, lo: 0.60, hi: 0.80 });
  }

  if (diag.includes('adeno')) {
    add({ label: 'Adenomyosis (MUSA features)', grade: 'C', stage: 'transfer', type: 'prob', target: 'lbr',
          or: 0.62, lo: 0.50, hi: 0.77 });
    add({ label: 'Adenomyosis — miscarriage risk', grade: 'C', stage: 'miscarriage', type: 'prob', target: 'mc',
          or: 2.88, lo: 1.90, hi: 4.36 });
  }

  if (diag.includes('adeno_inner')) {
    // Worst subtype: inner-myometrium involvement
    add({ label: 'Adenomyosis — inner myometrium', grade: 'C', stage: 'transfer', type: 'prob', target: 'lbr',
          or: 0.29, lo: 0.18, hi: 0.47 });
    add({ label: 'Adenomyosis — miscarriage risk', grade: 'C', stage: 'miscarriage', type: 'prob', target: 'mc',
          or: 2.88, lo: 1.90, hi: 4.36 });
  }

  if (diag.includes('endo_adeno')) {
    add({ label: 'Endometriosis + adenomyosis', grade: 'C', stage: 'transfer', type: 'prob', target: 'lbr',
          or: 0.80, lo: 0.68, hi: 0.94 });
  }

  if (diag.includes('hydro_untreated')) {
    add({ label: 'Hydrosalpinx (untreated)', grade: 'A', stage: 'transfer', type: 'prob', target: 'lbr',
          or: 0.58, lo: 0.48, hi: 0.70 });
  }

  if (diag.includes('hydro_treated')) {
    // After salpingectomy — outcomes largely restored
    add({ label: 'Hydrosalpinx (after salpingectomy)', grade: 'A', stage: 'transfer', type: 'prob', target: 'lbr',
          or: 2.14, lo: 1.54, hi: 2.97 });
  }

  if (diag.includes('fibroid_sub')) {
    add({ label: 'Submucosal fibroid', grade: 'B', stage: 'transfer', type: 'prob', target: 'lbr',
          or: 0.30, lo: 0.18, hi: 0.50 });
  }

  if (diag.includes('fibroid_intra_dist')) {
    add({ label: 'Intramural fibroid (cavity-distorting)', grade: 'C', stage: 'transfer', type: 'prob', target: 'lbr',
          or: 0.70, lo: 0.54, hi: 0.91 });
  }

  if (diag.includes('fibroid_intra_none')) {
    // Grade D: CI includes 1 (OR 1.17, CI 0.62–2.22)
    add({ label: 'Intramural fibroid (non-distorting)', grade: 'D', stage: 'transfer', type: 'prob', target: 'lbr',
          or: 1.00, lo: 0.62, hi: 2.22 });
  }
  // Subserosal fibroid: no effect — no mod added

  // ── Lifestyle ─────────────────────────────────────────────────────────────

  const bmi = parseFloat(s.bmi);
  if (!isNaN(bmi) && bmi > 0) {
    if (bmi >= 30) {
      add({ label: `BMI ${bmi.toFixed(0)} — obese`, grade: 'A', stage: 'transfer', type: 'prob', target: 'lbr',
            or: 0.85, lo: 0.76, hi: 0.95 });
      add({ label: `BMI ${bmi.toFixed(0)} — miscarriage`, grade: 'B', stage: 'miscarriage', type: 'prob', target: 'mc',
            or: 1.31, lo: 1.10, hi: 1.56 });
    } else if (bmi >= 25) {
      add({ label: `BMI ${bmi.toFixed(0)} — overweight`, grade: 'B', stage: 'transfer', type: 'prob', target: 'lbr',
            or: 0.84, lo: 0.72, hi: 0.98 });
    } else if (bmi < 18.5) {
      add({ label: `BMI ${bmi.toFixed(0)} — underweight`, grade: 'B', stage: 'transfer', type: 'prob', target: 'lbr',
            or: 0.93, lo: 0.82, hi: 1.05 });
    }
  }

  if (s.smoking === 'active') {
    add({ label: 'Active smoking', grade: 'B', stage: 'transfer', type: 'prob', target: 'lbr',
          or: 0.54, lo: 0.43, hi: 0.68 });
    add({ label: 'Smoking — miscarriage', grade: 'B', stage: 'miscarriage', type: 'prob', target: 'mc',
          or: 2.65, lo: 1.96, hi: 3.57 });
  } else if (s.smoking === 'secondhand') {
    add({ label: 'Secondhand smoke', grade: 'C', stage: 'transfer', type: 'prob', target: 'lbr',
          or: 0.75, lo: 0.62, hi: 0.91 });
  }

  // ── Paternal factors ──────────────────────────────────────────────────────

  const maleAge = parseFloat(s.maleAge);
  if (!isNaN(maleAge) && maleAge > 45) {
    add({ label: `Paternal age ${Math.round(maleAge)}`, grade: 'B', stage: 'transfer', type: 'prob', target: 'lbr',
          or: 0.78, lo: 0.67, hi: 0.91 });
    add({ label: `Paternal age — miscarriage`, grade: 'B', stage: 'miscarriage', type: 'prob', target: 'mc',
          or: 1.60, lo: 1.22, hi: 2.09 });
  }

  // DFI drives miscarriage, not fertilization.
  if (s.dfi === 'mid') {
    add({ label: 'Sperm DFI 15–30%', grade: 'B', stage: 'miscarriage', type: 'prob', target: 'mc',
          or: 1.50, lo: 1.20, hi: 2.00 });
  } else if (s.dfi === 'high') {
    add({ label: 'Sperm DFI >30%', grade: 'B', stage: 'miscarriage', type: 'prob', target: 'mc',
          or: 2.50, lo: 1.50, hi: 4.00 });
  }

  // ── Transfer history ──────────────────────────────────────────────────────

  const failedFET = parseInt(s.failedFET) || 0;
  if (failedFET >= 1) {
    const OR  = [null, 0.80, 0.65, 0.55];
    const LO  = [null, 0.65, 0.50, 0.40];
    const HI  = [null, 0.98, 0.85, 0.74];
    const idx = Math.min(failedFET, 3);
    add({ label: `${failedFET} prior failed euploid FET${failedFET > 1 ? 's' : ''}`,
          grade: 'C', stage: 'transfer', type: 'prob', target: 'lbr',
          or: OR[idx], lo: LO[idx], hi: HI[idx] });
  }

  return mods;
}

// ─── Main compute function ────────────────────────────────────────────────────
/**
 * @param {Object} s - full input state
 * @returns {Object} all computed values needed by UI modules
 */
export function compute(s) {
  const { NO_RESULT, FALSE_POS, LBR_ANEU, NOA_SRR } = CONSTANTS;

  const age      = s.age || 34;
  const pgta     = !!s.pgta;
  const pgtm     = !!s.pgtm;
  const pgtSR    = !!s.pgtSR;
  const pgtHLA   = !!s.pgtHLA;
  const mfLevel  = s.mfLevel || 'none';
  const numRetr  = Math.max(1, Math.round(s.retrievals || 1));
  const includeD = !!s.includeD;
  const advanced = !!s.advanced;

  const mf    = MF[mfLevel] || MF.none;
  const isNOA = mfLevel === 'noa';

  // Entry point determines which upstream mods apply
  const entry = entryPoint(s);

  // Tier 2 mods (only built when advanced mode is on)
  const allMods = advanced ? buildMods(s, entry, includeD) : [];
  const yieldMods = allMods.filter(m => m.target === 'yield');
  const miiMods   = allMods.filter(m => m.target === 'mii');
  const lbrMods   = allMods.filter(m => m.target === 'lbr');
  const mcMods    = allMods.filter(m => m.target === 'mc');

  // ── Biopsy day → euploidy scale ───────────────────────────────────────────
  const BDAY_SCALE = { '5': 1.00, '6': 0.71, '7': 0.74, mixed: 0.90 };
  const biopsyScale = BDAY_SCALE[s.biopsyDay] || 1.00;
  // Day 7 also has worse implantation beyond euploidy
  const day7Penalty = (s.biopsyDay === '7' && advanced)
    ? [{ or: 0.75, lo: 0.60, hi: 0.90 }]
    : [];

  // ── Blastocyst grade → LBR OR ─────────────────────────────────────────────
  const gradeData = advanced && s.blastGrade ? GRADE_OR[s.blastGrade] : null;
  const gradeMods = gradeData ? [{ ...gradeData }] : [];

  const allLbrMods = [...lbrMods, ...gradeMods, ...day7Penalty];

  // ── Base age-derived rates ─────────────────────────────────────────────────
  const matR_base   = lerp(CURVES.MATURE, age);
  const blastR_base = lerp(CURVES.BLAST, age);
  const eupR_base   = lerp(CURVES.EUPLOID, age);
  const lbrEup_base = lerp(CURVES.LBR_EUP, age);
  const mc_base     = lerp(CURVES.MC_UNT, age);

  // Effective euploidy rate after biopsy-day adjustment
  const eupR = Math.max(0.02, Math.min(0.95, eupR_base * biopsyScale));

  // Effective MII rate
  const matR = applyCount(matR_base, miiMods);

  // ── LBR with mods (three variants for sensitivity) ────────────────────────
  function lbrWith(variant) {
    if (!allLbrMods.length) return lbrEup_base;
    const vm = allLbrMods.map(m => ({
      or: variant === 'lo' ? (m.lo ?? m.or) : variant === 'hi' ? (m.hi ?? m.or) : m.or,
    }));
    return applyProb(lbrEup_base, vm);
  }
  const lbrEupMod = lbrWith('def');
  const lbrEupLo  = lbrWith('lo');
  const lbrEupHi  = lbrWith('hi');

  // ── MC rate with mods ─────────────────────────────────────────────────────
  // Screened embryos have ~10% miscarriage (lower than unscreened)
  const mcBase = (pgta || pgtSR) ? 0.10 : mc_base;
  const mcRateMod = mcMods.length ? applyProb(mcBase, mcMods) : mcBase;

  // ── Mendelian fraction ────────────────────────────────────────────────────
  const inh   = s.inh || 'ar';
  const mFrac = pgtm ? (inh === 'ad' || inh === 'xl_strict' ? 0.50 : 0.75) : 1;

  // ── PGT-SR pass rate ──────────────────────────────────────────────────────
  const srKey  = s.srType === 'rob'
    ? (s.srCarrier === 'female' ? 'rob_female' : 'rob_male')
    : (s.srType || 'reciprocal');
  const srData = SR_RATES[srKey] || SR_RATES.reciprocal;

  // ── Blasts per retrieval ──────────────────────────────────────────────────
  // Each extra retrieval: age +0.25 yrs (≈3 months apart).
  // User-supplied blastocyst count is the total pool — no multiplication.
  const ageTaper = age => lerp([[28,1],[35,.97],[40,.88],[46,.78]], age);

  function blastsForRetrieval(i) {
    if (entry === 'blastocysts') return s.blastocysts;  // caller handles this
    const ageR    = age + i * 0.25;
    const ageTap  = ageTaper(ageR);
    const matR_r  = lerp(CURVES.MATURE, ageR);
    const blaR_r  = lerp(CURVES.BLAST, ageR);
    let ret;
    if (entry === 'retrieved') {
      ret = s.eggs;
    } else {
      const ests = [];
      if (!isNaN(s.afc) && s.afc > 0) ests.push(s.afc * 0.85 * ageTap);
      if (!isNaN(s.amh) && s.amh > 0) ests.push((3.1 * s.amh + 2.4) * ageTap);
      ret = ests.length
        ? ests.reduce((a, b) => a + b) / ests.length
        : lerp([[26,15],[32,13],[36,10.5],[39,8],[42,5.5],[46,3]], ageR);
      ret = applyCount(ret, yieldMods);
    }
    const miiR_r = applyCount(matR_r, miiMods);
    return Math.max(0, ret) * miiR_r * mf.fertR * blaR_r * mf.blastMult;
  }

  // Totals
  let totalBlasts, src, retrieved_d, mature_d, fert_d, blasts_d;

  if (entry === 'blastocysts') {
    totalBlasts  = s.blastocysts;
    src          = 'your blastocyst count';
    retrieved_d  = NaN;
    mature_d     = NaN;
    fert_d       = NaN;
    blasts_d     = s.blastocysts;
  } else {
    totalBlasts = 0;
    for (let i = 0; i < numRetr; i++) totalBlasts += blastsForRetrieval(i);

    // Display values for funnel (first retrieval only)
    const ageTap0 = ageTaper(age);
    let r0;
    if (entry === 'retrieved') {
      r0  = s.eggs;
      src = 'your retrieval';
    } else {
      const ests = [];
      if (!isNaN(s.afc) && s.afc > 0) ests.push(s.afc * 0.85 * ageTap0);
      if (!isNaN(s.amh) && s.amh > 0) ests.push((3.1 * s.amh + 2.4) * ageTap0);
      r0  = ests.length
        ? ests.reduce((a, b) => a + b) / ests.length
        : lerp([[26,15],[32,13],[36,10.5],[39,8],[42,5.5],[46,3]], age);
      r0  = applyCount(r0, yieldMods);
      src = ests.length === 2 ? 'AMH and follicle count'
          : !isNaN(s.afc) && s.afc > 0 ? 'follicle count'
          : !isNaN(s.amh) && s.amh > 0 ? 'AMH'
          : 'typical for this age';
      if (yieldMods.length) src += ' (adjusted)';
    }
    retrieved_d = Math.max(0, r0);
    mature_d    = retrieved_d * matR;
    fert_d      = mature_d * mf.fertR;
    blasts_d    = fert_d * blastR_base * mf.blastMult;
  }

  // ── arm(): per-blastocyst CLBR ────────────────────────────────────────────
  // A screen can only remove embryos, never improve one.
  // CLBR = 1 − (1 − T·p)^blasts where T = probability a blast gets transferred,
  // p = probability of live birth given transfer.
  function arm(blasts, lbrE, eupR_eff, srPass) {
    const pgtActive = pgta || pgtm || pgtSR || pgtHLA;
    const r = pgtActive ? (1 - NO_RESULT) : 1;
    let T;
    const hlaFrac = pgtHLA ? 0.25 : 1;
    if (pgtSR) {
      T = r * srPass * mFrac * hlaFrac;
    } else if (pgta) {
      T = r * eupR_eff * (1 - FALSE_POS) * mFrac * hlaFrac;
    } else {
      T = r * mFrac * hlaFrac;
    }
    const p = (pgta || pgtSR)
      ? lbrE
      : eupR_eff * lbrE + (1 - eupR_eff) * LBR_ANEU;
    const n    = blasts * T;
    const clbr = blasts > 0 ? 1 - Math.pow(1 - T * p, blasts) : 0;
    return { T, p, n, clbr, transfers: p > 0 ? clbr / p : 0 };
  }

  const main = arm(totalBlasts, lbrEupMod, eupR, srData.def);

  // ── Sensitivity strip ─────────────────────────────────────────────────────
  // Show only when 3+ active modifiers are in play.
  const sensitivityActive = allMods.length >= 3;
  let clbrLo = main.clbr, clbrHi = main.clbr;
  if (sensitivityActive) {
    const lo = arm(totalBlasts, lbrEupLo, eupR, pgtSR ? srData.lo : srData.def);
    const hi = arm(totalBlasts, lbrEupHi, eupR, pgtSR ? srData.hi : srData.def);
    clbrLo = lo.clbr;
    clbrHi = hi.clbr;
  }

  // ── NOA two-stage gate ────────────────────────────────────────────────────
  // P(baby) = P(sperm found) × P(baby | cycle proceeds)
  const clbrRaw = main.clbr;
  const noaGate = isNOA
    ? { srr: NOA_SRR, clbrIfCycle: clbrRaw, clbrOverall: NOA_SRR * clbrRaw }
    : null;
  const clbr = isNOA ? NOA_SRR * clbrRaw : clbrRaw;

  // Scale sensitivity by NOA SRR too
  if (isNOA && sensitivityActive) {
    clbrLo *= NOA_SRR;
    clbrHi *= NOA_SRR;
  }

  // ── Compare arms ──────────────────────────────────────────────────────────
  // Shows what chromosome screening does (or would do) to the same embryo pool.
  function armCompare(useA, useM, useSR) {
    const pgtAny = useA || useM || useSR;
    const r2 = pgtAny ? (1 - NO_RESULT) : 1;
    const mF2 = useM ? mFrac : 1;
    let T2;
    if (useSR) {
      T2 = r2 * srData.def * mF2;
    } else if (useA) {
      T2 = r2 * eupR * (1 - FALSE_POS) * mF2;
    } else {
      T2 = r2 * mF2;
    }
    const p2 = (useA || useSR)
      ? lbrEupMod
      : eupR * lbrEupMod + (1 - eupR) * LBR_ANEU;
    const n2    = totalBlasts * T2;
    const clbr2 = totalBlasts > 0 ? 1 - Math.pow(1 - T2 * p2, totalBlasts) : 0;
    return { T: T2, p: p2, n: n2, clbr: clbr2, transfers: p2 > 0 ? clbr2 / p2 : 0 };
  }

  const compWith    = armCompare(pgtSR ? false : true, pgtm, pgtSR);
  const compWithout = armCompare(false, pgtm, false);
  // Guardrail: screening must not raise CLBR from fixed pool
  if (compWith.clbr > compWithout.clbr + 0.001) {
    console.warn('[model] guardrail: compWith.clbr > compWithout.clbr — check filters');
  }

  // altArm: the "other side" of the current main calculation (for existing compare toggle)
  const altArm = (pgta || pgtSR) ? compWithout : compWith;

  // ── PGT stack running rates ───────────────────────────────────────────────
  const pgtStackSteps = [];
  let stackT = 1.0;
  if (pgtSR) {
    stackT *= srData.def;
    pgtStackSteps.push({ label: 'PGT-SR', rate: stackT });
  } else if (pgta) {
    stackT *= eupR * (1 - FALSE_POS);
    pgtStackSteps.push({ label: 'PGT-A', rate: stackT });
  }
  if (pgtm) {
    stackT *= mFrac;
    pgtStackSteps.push({ label: 'PGT-M', rate: stackT });
  }
  if (pgtHLA) {
    stackT *= 0.25;
    pgtStackSteps.push({ label: 'PGT-HLA', rate: stackT });
  }

  // ── Calendar ──────────────────────────────────────────────────────────────
  const prepEnd  = 13
    + (isNOA ? 12 : mfLevel === 'severe' ? 10 : mfLevel !== 'none' ? 4 : 0);
  const genEnd   = pgtm ? 14 : pgtSR ? 7 : 0;
  const cycle    = Math.max(prepEnd, genEnd);
  const resultWk = pgtm ? 2 : (pgta || pgtSR) ? 1.5 : 0;
  const fetStart = cycle + 3 + resultWk;
  const transferWk = fetStart + 5;
  const betaWk   = transferWk + 1.5;
  const weeksToBeta = betaWk
    + Math.max(0, main.transfers - 1) * 6
    + Math.max(0, numRetr - 1) * 10;

  const pgtActive_any = pgta || pgtm || pgtSR || pgtHLA;
  const biopsy = pgtActive_any ? totalBlasts * (1 - NO_RESULT) : totalBlasts;

  return {
    s,
    entry, src, numRetr,
    // funnel (first-retrieval display values)
    retrieved: retrieved_d, mature: mature_d, fert: fert_d, blasts: blasts_d,
    totalBlasts, biopsy,
    // rates
    matR, fertR: mf.fertR, blastR: blastR_base * mf.blastMult, eupR, mFrac,
    lbrEupMod,
    // headline outcomes
    transferable: main.n,
    perTransfer:  main.p,
    mcRate:       mcRateMod,
    clbr:         Math.max(0, Math.min(0.999, clbr)),
    clbrLo:       sensitivityActive ? Math.max(0, clbrLo) : null,
    clbrHi:       sensitivityActive ? Math.min(0.999, clbrHi) : null,
    expTransfers: main.transfers,
    // compare panel
    compWith: compWith.clbr, compWithout: compWithout.clbr,
    compWithT: compWith.transfers, compWithoutT: compWithout.transfers,
    altClbr: altArm.clbr, altTransfers: altArm.transfers,
    // NOA gate
    noaGate,
    // advanced
    activeMods: allMods, sensitivityActive,
    pgtStackSteps, srData,
    // calendar
    cycle, prepEnd, genEnd, resultWk, fetStart, transferWk, weeksToBeta, betaWk,
  };
}
