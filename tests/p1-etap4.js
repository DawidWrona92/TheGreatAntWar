// Eksperyment: wpływ mechanik etapu 4 (elewacja, widoczność, kierunek ciosu) na przebieg bitwy AI przeciw AI.
// Użycie: node tests/p1-etap4.js [--seeds 4] [--map 2] [--scenario bitwa] [--out plik.json]
const { spawn } = require('child_process');
const fs = require('fs');
const VARIANTS = { 'wszystko wyłączone': { e: 0, v: 0, f: 0 }, 'tylko elewacja': { e: 1, v: 0, f: 0 }, 'tylko widoczność': { e: 0, v: 1, f: 0 }, 'tylko kierunek ciosu': { e: 0, v: 0, f: 1 }, 'wszystko włączone': { e: 1, v: 1, f: 1 } };
function runOne({ seed, map, scenario, flags, maxSeconds }) {
  const { loadP1 } = require('./load-core');
  const { Sim, defs } = loadP1(); defs.params.elevation.on = !!flags.e; defs.params.visibility.on = !!flags.v; defs.params.facing.on = !!flags.f;
  const sim = Sim.create({ defs, seed, map, scenario, budget: 'sredni' }); const st = [0, 0]; for (const c of sim.comps) st[c.side] += c.initial;
  let acid = 0, high = 0, lobs = 0, seenAcid = new Set();
  for (let k = 0; k <= (maxSeconds || 400) * 20 && !sim.result; k++) { sim.step(); if (k % 10 === 0) for (const f of sim.fx) if (f.k === 'acid' && !seenAcid.has(f.id)) { seenAcid.add(f.id); acid++; if (f.lob > 22) high++; } }
  const a = sim.count_alive();
  return { seed, flags, winner: sim.result ? sim.result.winner : null, seconds: sim.tick / 20, fracWK: a[0] / st[0], fracLH: a[1] / st[1], acid, highLobs: high };
}
module.exports = { runOne, VARIANTS };
if (require.main === module) {
  if (process.argv[2] === '--worker') { process.stdout.write(JSON.stringify(runOne(JSON.parse(process.argv[3])))); return; }
  const args = process.argv.slice(2), opt = (n, d) => { const i = args.indexOf('--' + n); return i < 0 ? d : args[i + 1]; };
  const seeds = +opt('seeds', 4), map = +opt('map', 2), scenario = opt('scenario', 'bitwa'), out = opt('out', null);
  const jobs = []; for (const name in VARIANTS) for (let s = 1; s <= seeds; s++) jobs.push({ name, seed: s, map, scenario, flags: VARIANTS[name], maxSeconds: 400 });
  const results = []; let next = 0, running = 0;
  const pump = () => { while (running < 4 && next < jobs.length) { const job = jobs[next++]; running++; const p = spawn(process.execPath, [__filename, '--worker', JSON.stringify(job)]); let buf = ''; p.stdout.on('data', (d) => { buf += d; }); p.stderr.on('data', (d) => process.stderr.write(d)); p.on('close', () => { running--; try { results.push(Object.assign({ name: job.name }, JSON.parse(buf))); } catch (e) { console.error('błąd', job.name, job.seed); } if (next >= jobs.length && !running) done(); else pump(); }); } };
  const done = () => {
    const sum = {}; for (const name in VARIANTS) { const r = results.filter((x) => x.name === name), n = r.length; sum[name] = { runs: n, winsWK: r.filter((x) => x.winner === 'WK').length, sekundy: Math.round(r.reduce((t, x) => t + x.seconds, 0) / n), roznicaOcalalych: +(r.reduce((t, x) => t + x.fracWK - x.fracLH, 0) / n).toFixed(2), strzalyKwasem: Math.round(r.reduce((t, x) => t + x.acid, 0) / n), tory_strome: Math.round(r.reduce((t, x) => t + x.highLobs, 0) / n) }; }
    if (out) fs.writeFileSync(out, JSON.stringify({ generated: 'wykonane: node tests/p1-etap4.js', seeds, map, scenario, summary: sum, runs: results.sort((a, b) => a.name.localeCompare(b.name) || a.seed - b.seed) }, null, 1));
    console.log(JSON.stringify(sum, null, 1));
  };
  pump();
}
