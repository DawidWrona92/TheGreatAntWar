// Eksperyment: Przeprawa, czy brody są osobnymi starciami i czy szybkość daje przewagę.
// Użycie: node tests/p1-przeprawa.js [--seeds 5] [--out plik.json]
// Warianty: bazowy, szybsza Wielka Kolonia (x1,4), szybszy Lake Hodges (x1,4), wolniejsza WK (x0,7), wolniejszy LH (x0,7).
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

function runOne({ seed, speedMult, maxSeconds }) {
  const { loadP1 } = require('./load-core');
  const { Sim, defs } = loadP1(); const sim = Sim.create({ defs, seed, scenario: 'przeprawa', speedMult });
  const F = sim.defs.world.fords, prev = new Uint8Array(sim.cap), K = F.length;
  const deaths = F.map(() => [0, 0]), firstCross = F.map(() => null), at90 = F.map(() => [0, 0]);
  const near = (x, y) => { let b = -1, bd = 650; F.forEach((f, k) => { const d = Math.hypot(x - (f.wx + f.ex) / 2, y - f.y); if (d < bd) { bd = d; b = k; } }); return b; };
  for (let k = 0; k <= (maxSeconds || 600) * 20 && !sim.result; k++) {
    sim.step();
    for (let i = 0; i < sim.count; i++) {
      if (prev[i] && !sim.alive[i]) { const f = near(sim.x[i], sim.y[i]); if (f >= 0) deaths[f][sim.side[i]]++; }
      prev[i] = sim.alive[i];
      if (sim.alive[i] && sim.side[i] === 0) for (let f = 0; f < K; f++) if (firstCross[f] === null && sim.x[i] > F[f].ex && Math.abs(sim.y[i] - F[f].y) < 250) firstCross[f] = k / 20;
    }
    if (k === 90 * 20) for (let i = 0; i < sim.count; i++) if (sim.alive[i]) { const f = near(sim.x[i], sim.y[i]); if (f >= 0) at90[f][sim.side[i]]++; }
  }
  const a = sim.count_alive();
  return { seed, speedMult, winner: sim.result ? sim.result.winner : null, reason: sim.result ? sim.result.reason : 'bez rozstrzygnięcia w ' + (maxSeconds || 600) + ' s', seconds: sim.tick / 20, alive: a, deaths, firstCross, at90 };
}
module.exports = { runOne };
if (require.main === module) {
  if (process.argv[2] === '--worker') { process.stdout.write(JSON.stringify(runOne(JSON.parse(process.argv[3])))); return; }
  const args = process.argv.slice(2), opt = (n, d) => { const i = args.indexOf('--' + n); return i < 0 ? d : args[i + 1]; };
  const seeds = +opt('seeds', 5), out = opt('out', null);
  const variants = [['bazowy', {}], ['WK x1,4', { WK: 1.4 }], ['LH x1,4', { LH: 1.4 }], ['WK x0,7', { WK: 0.7 }], ['LH x0,7', { LH: 0.7 }]];
  const jobs = []; for (const [name, sm] of variants) for (let s = 1; s <= seeds; s++) jobs.push({ name, seed: s, speedMult: sm, maxSeconds: 600 });
  const results = []; let next = 0, running = 0;
  const pump = () => { while (running < 4 && next < jobs.length) { const job = jobs[next++]; running++; const p = spawn(process.execPath, [__filename, '--worker', JSON.stringify(job)]); let buf = ''; p.stdout.on('data', (d) => { buf += d; }); p.stderr.on('data', (d) => process.stderr.write(d)); p.on('close', () => { running--; try { results.push(Object.assign({ name: job.name }, JSON.parse(buf))); } catch (e) { console.error('błąd', job.name, job.seed); } if (next >= jobs.length && !running) done(); else pump(); }); } };
  const done = () => {
    const sum = {};
    for (const [name] of variants) {
      const r = results.filter((x) => x.name === name), n = r.length, wk = r.filter((x) => x.winner === 'WK').length;
      const contested = r.map((x) => x.deaths.filter((d) => d[0] >= 60 && d[1] >= 60).length);
      const share = r.map((x) => { const t = x.deaths.reduce((a, d) => a + d[0] + d[1], 0) || 1; return Math.max(...x.deaths.map((d) => (d[0] + d[1]) / t)); });
      const cross = r.map((x) => x.firstCross.filter((c) => c !== null).length);
      sum[name] = { runs: n, winsWK: wk, bitwyOBrody: +(contested.reduce((a, b) => a + b, 0) / n).toFixed(2), najwiekszyUdzialStratWJednymBrodzie: +(share.reduce((a, b) => a + b, 0) / n).toFixed(2), brodyZPrzejsciemWK: +(cross.reduce((a, b) => a + b, 0) / n).toFixed(2), sekundy: Math.round(r.reduce((a, x) => a + x.seconds, 0) / n), zywiWK: Math.round(r.reduce((a, x) => a + x.alive[0], 0) / n), zywiLH: Math.round(r.reduce((a, x) => a + x.alive[1], 0) / n) };
    }
    const doc = { generated: 'wykonane: node tests/p1-przeprawa.js', seeds, summary: sum, runs: results.sort((a, b) => a.name.localeCompare(b.name) || a.seed - b.seed) };
    if (out) fs.writeFileSync(out, JSON.stringify(doc, null, 1));
    console.log(JSON.stringify(sum, null, 1));
  };
  pump();
}
