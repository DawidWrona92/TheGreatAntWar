// Pomiar ruchu rot w korytarzach kopca (zakręty o 90°, rampa, wejście): ile mrówek stoi na swoim miejscu w szyku po dojściu kotwicy do celu.
// Użycie: node tests/p1-korytarze.js [--out plik.json]. Porównuje stan po poprawce (params.corridor.on = true) z zachowaniem sprzed niej (false).
const fs = require('fs');
const { loadP1 } = require('./load-core');
const TRIALS = [
  { name: 'LH rota 180: pierścień 0, zakręt N->W o 90° (cel 160 za rogiem)', side: 'LH', id: 20, x: 1336, y: 392, secs: 60 },
  { name: 'LH rota 180: pierścień 0, zakręt N->E o 90°', side: 'LH', id: 22, x: 2376, y: 392, secs: 60 },
  { name: 'LH rota 180: bliski cel za rogiem (70 za rogiem, start 110 przed)', side: 'LH', id: 20, x: 1336, y: 300, secs: 40, pre: [1446, 232] },
  { name: 'LH rota 180: rampa N poziom 0->1 i zakręt w pierścieniu 1', side: 'LH', id: 20, x: 1700, y: 376, secs: 80 },
  { name: 'LH plujki 60: prosto (kontrola)', side: 'LH', id: 17, x: 2232, y: 687, secs: 40 },
  { name: 'WK rota 100: z pola startu przez wejście do pierścienia 0 (zakręt przy wejściu)', side: 'WK', id: 1, x: 1336, y: 400, secs: 90 },
];
function trial(t, corridorOn) {
  const { Sim, defs } = loadP1(); defs.params.corridor.on = corridorOn;
  const sim = Sim.create({ defs, seed: 1, scenario: 'kopiec', aiSides: [] }), c = sim.comps[t.id];
  // bez obrońców poza gwardią w sercu (inaczej mierzylibyśmy walkę, a bitwa kończyłaby się od razu)
  for (const o of sim.comps) if (o.side === 1 && !o.startBy.dowodca && o.id !== t.id) { for (const i of o.ants) sim.alive[i] = 0; o.alive = 0; }
  if (t.pre) { c.ax = t.pre[0]; c.ay = t.pre[1]; c.order = { kind: 'hold', x: t.pre[0], y: t.pre[1] }; for (const i of c.ants) { sim.x[i] = t.pre[0]; sim.y[i] = t.pre[1]; } }
  sim.command({ k: 'order', side: t.side, comps: [t.id], kind: 'move', x: t.x, y: t.y });
  const ants = c.ants.filter((i) => sim.alive[i]); let settle = null;
  for (let k = 1; k <= t.secs * 20; k++) {
    sim.step();
    if (k % 20 === 0 && settle === null && Math.hypot(c.ax - t.x, c.ay - t.y) < 25 && ants.filter((i) => sim.debug.slotErr(i) < 25).length >= 0.95 * ants.length) settle = k / 20;
  }
  const ok = ants.filter((i) => sim.debug.slotErr(i) < 25).length;
  return { ok, n: ants.length, frac: +(ok / ants.length).toFixed(2), settleSeconds: settle, anchor: [Math.round(c.ax), Math.round(c.ay)] };
}
module.exports = { TRIALS, trial };
if (require.main === module) {
  const args = process.argv.slice(2), out = args.includes('--out') ? args[args.indexOf('--out') + 1] : null, rows = [];
  for (const t of TRIALS) { const before = trial(t, false), after = trial(t, true); rows.push({ name: t.name, przed: before, po: after }); console.log(t.name + '\n   przed: ' + before.ok + '/' + before.n + ' na miejscu, czas ' + before.settleSeconds + '\n   po:    ' + after.ok + '/' + after.n + ' na miejscu, czas ' + after.settleSeconds); }
  if (out) fs.writeFileSync(out, JSON.stringify({ generated: 'wykonane: node tests/p1-korytarze.js', trials: rows }, null, 1));
}
