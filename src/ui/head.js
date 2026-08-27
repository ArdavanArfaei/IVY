const pct = v => Math.round(v * 100);
const $ = id => document.getElementById(id);

export function renderHead(d) {
  const { noaGate, sensitivityActive, clbrLo, clbrHi, s } = d;

  // NOA two-stage gate
  const noaEl = $('noaGate');
  if (noaGate) {
    noaEl.hidden = false;
    $('noaSRR').textContent  = `${pct(noaGate.srr)}%`;
    $('noaCLBR').textContent = `${pct(noaGate.clbrIfCycle)}%`;
  } else {
    noaEl.hidden = true;
  }

  // Big number
  $('clbr').innerHTML = `${pct(d.clbr)}<span>%</span>`;

  // Sensitivity strip (shown when 3+ active mods)
  const stripEl = $('sensitivityStrip');
  if (sensitivityActive && clbrLo !== null && clbrHi !== null) {
    stripEl.hidden = false;
    stripEl.innerHTML =
      `<span class="sens-label">published range</span>` +
      `<span class="sens-range">${pct(clbrLo)}–${pct(clbrHi)}%</span>`;
  } else {
    stripEl.hidden = true;
  }

  // Stats
  $('sEmb').textContent = d.transferable < 10 ? d.transferable.toFixed(1) : Math.round(d.transferable);
  $('sTr').textContent  = d.expTransfers.toFixed(1);
  $('sWk').textContent  = Math.round(d.weeksToBeta);
  $('sMc').textContent  = `${pct(d.mcRate)}%`;

  // Label
  const bits = [];
  if (s.pgtSR)  bits.push('structurally-normal');
  else if (s.pgta) bits.push('chromosome-screened');
  if (s.pgtm)   bits.push('unaffected');
  if (s.pgtHLA) bits.push('HLA-matched');

  let label = bits.length
    ? `chance of a live birth from this retrieval, working through every ${bits.join(', ')} embryo it produces`
    : 'chance of a live birth from this retrieval, transferring every blastocyst one at a time';

  if (d.numRetr > 1) {
    label += ` (blastocysts from ${d.numRetr} retrievals pooled)`;
  }

  $('clbrLabel').textContent = label;
}
