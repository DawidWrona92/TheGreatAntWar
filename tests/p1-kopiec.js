// Eksperyment: Szturm kopca, AI przeciw AI. Czy atakujący dociera do serca, ile to trwa, czy ktoś utyka lub wchodzi w ścianę.
// Użycie: node tests/p1-kopiec.js [--seeds 4] [--out plik.json] [--limit 1500]
// Warianty: armia ze scenariusza oraz budżety Mały, Średni, Duży (atakujący x1,5).
const { spawn } = require('child_process');
const fs = require('fs');
const BLK = [0, 1, 0, 1, 1, 1, 1, 1, 0];
const VARIANTS = { 'armia ze scenariusza': '', 'budżet Mały': 'maly', 'budżet Średni': 'sredni', 'budżet Duży': 'duzy' };

function runOne({ seed, budget, maxSeconds }) {
  const { loadP1 } = require('./load-core');
  const { Sim, defs } = loadP1(); defs.world.scenarioTypes.kopiec.timeLimit = maxSeconds;
  const opts = { defs, seed, scenario: 'kopiec' }; if (budget) opts.budget = budget;
  const sim = Sim.create(opts), hx = sim.defs.world.nest[0], hy = sim.defs.world.nest[1], R = sim.defs.world.nestR;
  const first = [null, null, null, null]; let wall = 0, stepSum = 0, stepMax = 0, panicked = new Set(), toHeart = 0;
  const st = [0, 0]; for (const c of sim.comps) st[c.side] += c.initial;
  for (let k = 1; k <= maxSeconds * 20 && !sim.result; k++) {
    const t0 = process.hrtime.bigint(); sim.step(); const ms = Number(process.hrtime.bigint() - t0) / 1e6; stepSum += ms; stepMax = Math.max(stepMax, ms);
    if (k % 20 === 0) {
      const lv = [0, 0, 0, 0];
      for (let i = 0; i < sim.count; i++) if (sim.alive[i]) {
        if (BLK[sim.grid[Math.floor(sim.y[i] / 16) * sim.COLS + Math.floor(sim.x[i] / 16)]]) wall++;
        if (sim.side[i] === 0) { const l = sim.levelAt(sim.x[i], sim.y[i]); if (l >= 0) lv[l]++; }
      }
      for (let l = 1; l < 4; l++) if (first[l] === null && lv[l] >= 15) first[l] = k / 20;
      for (const c of sim.comps) if (c.side === 1 && c.cstate === sim.CS_LOST) { panicked.add(c.id); if (Math.hypot(c.ax - hx, c.ay - hy) < R * 1.5) toHeart++; }
    }
  }
  const a = sim.count_alive();
  return { seed, budget, winner: sim.result ? sim.result.winner : null, reason: sim.result ? sim.result.reason : 'bez rozstrzygnięcia w ' + maxSeconds + ' s', seconds: sim.tick / 20, fracWK: +(a[0] / st[0]).toFixed(2), fracLH: +(a[1] / st[1]).toFixed(2), firstSeconds15AtLevel: first, antsInWalls: wall, panickedLH: panicked.size, stepMeanMs: +(stepSum / sim.tick).toFixed(2), stepMaxMs: +stepMax.toFixed(0) };
}
module.exports = { runOne, VARIANTS };
if (require.main === module) {
  if (process.argv[2] === '--worker') { process.stdout.write(JSON.stringify(runOne(JSON.parse(process.argv[3])))); return; }
  const args = process.argv.slice(2), opt = (n, d) => { const i = args.indexOf('--' + n); return i < 0 ? d : args[i + 1]; };
  const seeds = +opt('seeds', 4), out = opt('out', null), limit = +opt('limit', 1500);
  const jobs = []; for (const name in VARIANTS) for (let s = 1; s <= seeds; s++) jobs.push({ name, seed: s, budget: VARIANTS[name], maxSeconds: limit });
  const results = []; let next = 0, running = 0;
  const pump = () => { while (running < 4 && next < jobs.length) { const job = jobs[next++]; running++; const p = spawn(process.execPath, [__filename, '--worker', JSON.stringify(job)]); let buf = ''; p.stdout.on('data', (d) => { buf += d; }); p.on('close', () => { results.push(Object.assign({ name: job.name }, JSON.parse(buf))); running--; if (next >= jobs.length && !running) done(); else pump(); }); } };
  const done = () => {
    const sum = {}; for (const name in VARIANTS) { const r = results.filter((x) => x.name === name), n = r.length, avg = (f) => +(r.reduce((t, x) => t + f(x), 0) / n).toFixed(2); sum[name] = { runs: n, winsWK: r.filter((x) => x.winner === 'WK').length, winsLH: r.filter((x) => x.winner === 'LH').length, sekundy: avg((x) => x.seconds), ocaleliWK: avg((x) => x.fracWK), ocaleliLH: avg((x) => x.fracLH), mrowekWScianach: r.reduce((t, x) => t + x.antsInWalls, 0), spanikowaneRotyLH: avg((x) => x.panickedLH), krokSrMs: avg((x) => x.stepMeanMs) }; }
    if (out) fs.writeFileSync(out, JSON.stringify({ generated: 'wykonane: node tests/p1-kopiec.js', seeds, limit, summary: sum, runs: results.sort((a, b) => a.name.localeCompare(b.name) || a.seed - b.seed) }, null, 1));
    console.log(JSON.stringify(sum, null, 1));
  };
  pump();
}
