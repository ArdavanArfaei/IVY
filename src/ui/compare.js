import { CURVES } from '../model.js';

const pct = v => Math.round(v * 100);
const $ = id => document.getElementById(id);

function lerp_local(pts, x) {
  if (x <= pts[0][0]) return pts[0][1];
  if (x >= pts[pts.length - 1][0]) return pts[pts.length - 1][1];
  for (let i = 0; i < pts.length - 1; i++) {
    const [a0, a1] = pts[i], [b0, b1] = pts[i + 1];
    if (x >= a0 && x <= b0) return a1 + (x - a0) / (b0 - a0) * (b1 - a1);
  }
  return pts[pts.length - 1][1];
}

export function renderCompare(d) {
  const { s } = d;
  const usesSR = !!s.pgtSR;
  const usesA  = !!s.pgta;
  const anyScreen = usesSR || usesA;

  const withN  = d.compWith;
  const withT  = d.compWithT;
  const withoutN = d.compWithout;
  const withoutT = d.compWithoutT;
  const mcUntested = pct(lerp_local(CURVES.MC_UNT, s.age));

  $('cWithN').textContent    = `${pct(withN)}%`;
  $('cWithoutN').textContent = `${pct(withoutN)}%`;

  const withLabel = usesSR ? 'With PGT-SR' : 'With PGT-A';
  $('cWithLabel').textContent = withLabel;

  $('cWithD').textContent    = `${withT.toFixed(1)} transfers, ~10% miscarriage risk`;
  $('cWithoutD').textContent = `${withoutT.toFixed(1)} transfers, ~${mcUntested}% miscarriage risk`;

  // Highlight whichever is the current state
  $('cWith').className    = 'cbox' + (anyScreen ? ' on' : '');
  $('cWithout').className = 'cbox' + (!anyScreen ? ' on' : '');

  const saved = withoutT - withT;
  const gap   = Math.max(0, withoutN - withN);

  let note;
  if (usesSR) {
    const srLo  = Math.round(d.srData.lo  * 100);
    const srHi  = Math.round(d.srData.hi  * 100);
    note = `For this rearrangement type, ${srLo}–${srHi}% of blastocysts have a normal or balanced chromosome complement — PGT-SR identifies them. From a fixed embryo pool, chromosome screening can only remove embryos, never improve them, so cumulative live birth falls by ${(gap * 100).toFixed(1)} points compared to transferring everything. What it buys: ${Math.abs(saved).toFixed(1)} fewer transfers that would have failed, roughly ${Math.round(Math.abs(saved) * 6)} fewer weeks, and a miscarriage rate close to 10% instead of ~${mcUntested}%.`;
  } else {
    note = `Screening can only take embryos out of the pool, never improve one, so from a fixed cohort it costs about ${(gap * 100).toFixed(1)} points of cumulative live birth. A few viable embryos get called aneuploid or mosaic and never leave the freezer. ` +
      `What it buys back is ${Math.abs(saved).toFixed(1)} fewer transfers, roughly ${Math.round(Math.abs(saved) * 6)} weeks, and miscarriage risk of about 10% instead of ${mcUntested}%. That trade gets better with age, because the transfers you skip are ones that were never going to work.`;
  }

  if (s.pgtm) {
    note += ` None of this logic carries over to PGT-M. There is no natural filter for a single-gene condition: an affected embryo implants and develops like any other. Skip it and each transfer carries ${pct(1 - d.mFrac)}% odds of an affected pregnancy, found at CVS or amnio instead of in the freezer.`;
  }

  if (s.pgtHLA) {
    note += ` PGT-HLA reduces the transferable pool by 75% (1 in 4 embryos is an HLA match). Combined with PGT-M the joint fraction can drop to 3/16 — about 19% of blastocysts make it to transfer.`;
  }

  $('compareNote').textContent = note;
}
