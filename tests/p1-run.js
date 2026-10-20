// Jedna partia AI przeciw AI w Node (bez grafiki). Używana przez eksperymenty i testy.
const { loadP1 } = require('./load-core');

function runBattle({ seed, passage, overrides, maxSeconds, supply, map, scenario }) {
  const { Sim, defs } = loadP1();
  for (const p in overrides || {}) {
    const ks = p.split('.'); const last = ks.pop(); ks.reduce((a, k) => a[k], defs)[last] = overrides[p];
  }
  const sim = Sim.create({ defs, seed, passage, supply, map, scenario });
  const limit = (maxSeconds || defs.world.timeLimit + 5) * Sim.HZ;
  let worst = 0, total = 0, steps = 0;
  while (!sim.result && sim.tick < limit) {
    const t0 = process.hrtime.bigint(); sim.step(); const ms = Number(process.hrtime.bigint() - t0) / 1e6;
    if (steps > 0 && ms > worst) worst = ms; total += ms; steps++;
  }
  const r = sim.report();
  const sum = (o) => Object.values(o).reduce((a, b) => a + b, 0);
  return {
    seed, passage, map: map == null ? 3 : map, scenario: scenario || 'oblezenie', winner: r.result ? r.result.winner : null, reason: r.result ? r.result.reason : 'brak rozstrzygnięcia', seconds: r.seconds,
    lostWK: sum(r.sides.WK.lost), lostLH: sum(r.sides.LH.lost), startWK: sum(r.sides.WK.start), startLH: sum(r.sides.LH.start),
    stepMeanMs: total / Math.max(1, steps), stepMaxMs: worst, hash: sim.hash(),
    controlLost: r.events.filter((e) => /utrata kontroli/.test(e.text)).length
  };
}
module.exports = { runBattle };
if (require.main === module) {
  const a = JSON.parse(process.argv[2]);
  process.stdout.write(JSON.stringify(runBattle(a)));
}
