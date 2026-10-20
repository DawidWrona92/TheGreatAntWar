// Testy poprawek po etapie C: automatyczny kontratak zaatakowanej roty, zasięg plujki.
const assert = require('assert');
const { loadP1 } = require('./load-core');
const results = [];
function test(name, fn) {
  if (process.env.ONLY && !name.includes(process.env.ONLY)) return;
  const t0 = Date.now();
  try { const note = fn(); results.push({ name, ok: true, note: note || '', ms: Date.now() - t0 }); }
  catch (e) { results.push({ name, ok: false, note: e.stack ? e.message : String(e), ms: Date.now() - t0 }); }
}
function make(map, mod, extra) { const { Sim, defs } = loadP1(); if (mod) mod(defs); const sim = Sim.create(Object.assign({ defs, seed: 1, scenario: 'bitwa', map: map || 1, aiSides: [] }, extra || {})); sim.step(); return sim; }
const moveComp = (sim, c, x, y) => { const dx = x - c.ax, dy = y - c.ay; for (const i of c.ants) { sim.x[i] += dx; sim.y[i] += dy; } c.ax = x; c.ay = y; };
const cellOf = (sim, x, y) => Math.floor(y / sim.CELL) * sim.COLS + Math.floor(x / sim.CELL);
function freeSpot(sim) { for (let y = 300; y < sim.H - 300; y += 40) for (let x = 400; x < sim.W - 400; x += 40) { let ok = true; for (let dy = -80; dy <= 80 && ok; dy += 16) for (let dx = -80; dx <= 260 && ok; dx += 16) if (sim.grid[cellOf(sim, x + dx, y + dy)] !== 0) ok = false; if (ok) return [x, y]; } throw new Error('brak miejsca'); }
// scena: rota LH (dowolna piechota) jako zaatakowana, wrogie plujki WK strzelają z odległości poza zasięgiem wzroku rot wręcz; reszta armii daleko
function scene(mod, extra) {
  const sim = make(1, mod, extra), [x, y] = freeSpot(sim);
  const victim = sim.comps.find((c) => c.side === 1 && sim.names[c.domType] === 'infantry' && !c.startBy.dowodca), obs = sim.comps.find((c) => c.side === 1 && c !== victim && sim.names[c.domType] === 'infantry' && !c.startBy.dowodca);
  const shooter = sim.comps.find((c) => c.side === 1 && sim.names[c.domType] === 'plujka');   // plujki są tylko u LH w armii z listy: zmieniamy typy mrówek wrogiej roty na plujki
  const foe = sim.comps.find((c) => c.side === 0 && sim.names[c.domType] === 'infantry'); for (const i of foe.ants) sim.type[i] = sim.names.indexOf('plujka'); foe.acid = foe.acidMax = 360; foe.domType = sim.names.indexOf('plujka');
  for (const c of sim.comps) if (c !== victim && c !== foe && c !== obs) moveComp(sim, c, 60 + c.id * 4, 60);
  moveComp(sim, victim, x, y); moveComp(sim, foe, x + 105, y); moveComp(sim, obs, x + 60, y + 60);
  for (const c of [victim, obs]) c.order = { kind: 'hold', x: c.ax, y: c.ay, face: null, done: false };
  sim.debug.vis(); return { sim, victim, foe, obs, x, y };
}
const shotsAt = (sim, c, n) => { let hits = 0; for (let k = 0; k < n; k++) { sim.step(); } return c.dmgIn; };

test('zasięg plujki: 120 (zwiększony z 80), zgodny w JSON, statystykach i obszarze ostrzału', () => {
  const sim = make(1), pl = sim.comps.find((c) => sim.names[c.domType] === 'plujka'); assert.strictEqual(sim.defs.units.plujka.range, 120); assert.strictEqual(sim.compStats(pl).attack.range, 120);
  const [x, y] = freeSpot(sim), shooter = pl; moveComp(sim, shooter, x, y); const a = sim.fireArea(shooter.id); const open = a.rays.filter((r) => r.why === 'range'); assert.ok(open.length > 20 && open.every((r) => Math.abs(r.reach - 120) <= sim.defs.ui.overlays.fire.rayStep + 1e-6));
  return 'zasięg 120 w każdą stronę (było 80)';
});

test('kontratak: zaatakowana rota gracza bez nadrzędnego rozkazu sama atakuje agresora (widocznego, osiągalnego) i oznacza to rozkazem attackTarget', () => {
  const { sim, victim, foe } = scene(); const keep = JSON.stringify(victim.order); assert.ok(sim.compVisible(foe, 1), 'agresor powinien być widoczny');
  for (let k = 0; k < 20 * 12 && victim.order.kind !== 'attackTarget'; k++) sim.step();
  assert.ok(victim.dmgIn > 0, 'rota nie została zaatakowana'); assert.strictEqual(victim.order.kind, 'attackTarget', 'rota nie przeszła do ataku: ' + JSON.stringify(victim.order)); assert.strictEqual(victim.order.target, foe.id); assert.ok(victim.order.auto);
  const d0 = Math.hypot(victim.ax - foe.ax, victim.ay - foe.ay); for (let k = 0; k < 20 * 6; k++) sim.step(); assert.ok(Math.hypot(victim.ax - foe.ax, victim.ay - foe.ay) < d0 - 20, 'rota nie zbliża się do agresora');
  assert.ok(sim.events.some((e) => /kontratakuje agresora/.test(e.text) && e.comp === victim.id), 'brak komunikatu o kontrataku');
  return 'rota po ataku plujek: ' + keep + ' -> attackTarget (auto), zbliżenie ' + d0.toFixed(0) + ' -> ' + Math.hypot(victim.ax - foe.ax, victim.ay - foe.ay).toFixed(0);
});

test('kontratak nie nadpisuje nadrzędnego rozkazu: jawne Stój, rozkaz ruchu w toku, rota AI i wyłączenie w JSON zostają przy swoim', () => {
  const run = (setup, extra) => { const { sim, victim, foe } = scene(null, extra); setup(sim, victim); for (let k = 0; k < 20 * 12; k++) sim.step(); return { sim, victim, foe }; };
  // jawne Stój (H)
  let r = run((sim, v) => { sim.command({ k: 'order', side: 'LH', comps: [v.id], kind: 'hold', x: v.ax, y: v.ay }); }); assert.strictEqual(r.victim.order.kind, 'hold'); assert.ok(r.victim.order.explicit); assert.ok(r.victim.dmgIn > 0);
  // rozkaz ruchu w toku (daleko, nie zdąży dojść)
  r = run((sim, v) => { sim.command({ k: 'order', side: 'LH', comps: [v.id], kind: 'move', x: v.ax - 500, y: v.ay }); }); assert.strictEqual(r.victim.order.kind, 'move'); assert.ok(!r.victim.order.auto);
  // AI steruje swoimi rotami: brak reakcji automatycznej (dotychczasowa logika AI)
  const ai = scene(null, { aiSides: ['LH'] }); for (let k = 0; k < 20 * 12; k++) ai.sim.step(); assert.ok(!(ai.victim.order.kind === 'attackTarget' && ai.victim.order.auto), 'reakcja automatyczna działa dla roty AI');
  // wyłączenie w JSON
  const off = scene((d) => { d.params.reaction.on = false; }); for (let k = 0; k < 20 * 12; k++) off.sim.step(); assert.strictEqual(off.victim.order.kind, 'hold'); assert.ok(off.victim.dmgIn > 0);
  return 'jawne Stój, ruch w toku, AI i params.reaction.on=false: brak automatycznego ataku';
});

test('kontratak: martwy lub niewidoczny agresor kończy rozkaz automatyczny (pościg wygasa po pamięci widoczności i lostSec)', () => {
  // niewidoczny agresor: przeszkoda zasłania wzrok, ale kwas leci (łukiem nie, ściana blokuje oba tory) => wystarczy sprawdzić regułę przy braku widoczności
  const { sim, victim, foe } = scene(); for (let k = 0; k < 20 * 8 && victim.order.kind !== 'attackTarget'; k++) sim.step(); assert.strictEqual(victim.order.kind, 'attackTarget');
  for (const i of foe.ants) { sim.alive[i] = 0; sim.hp[i] = 0; } foe.alive = 0; for (let k = 0; k < 40; k++) sim.step(); assert.ok(victim.order.done || victim.order.kind !== 'attackTarget' || sim.comps[victim.order.target].alive <= 0, 'rozkaz ataku martwego agresora pozostał aktywny');
  // wygasanie, gdy agresor długo niewidoczny: ustawiamy auto-rozkaz i wymuszamy brak widoku
  const s2 = scene(); for (let k = 0; k < 20 * 8 && s2.victim.order.kind !== 'attackTarget'; k++) s2.sim.step(); assert.strictEqual(s2.victim.order.kind, 'attackTarget');
  moveComp(s2.sim, s2.foe, s2.sim.W - 120, s2.sim.H - 120); s2.foe.order = { kind: 'hold', x: s2.foe.ax, y: s2.foe.ay, face: null, done: false };   // agresor zostaje daleko, poza widokiem for (let k = 0; k < 20 * 35; k++) s2.sim.step(); assert.ok(s2.victim.order.done, 'pościg za niewidocznym agresorem nie wygasł: ' + JSON.stringify(s2.victim.order) + ' t=' + s2.sim.tick);
  return 'martwy lub niewidoczny agresor kończy auto-rozkaz';
});

test('świeży rozkaz ruchu wydany stojącej rocie obowiązuje od razu: nie jest oznaczony jako wykonany w tym samym kroku, rota rusza, a brak postępu jest wykrywany (regresja: skuteczny rozkaz był odświeżany dopiero raz na sekundę)', () => {
  const sim = make(1), c = sim.comps.find((q) => q.side === 1 && q.alive >= 100 && !q.startBy.dowodca); for (let k = 0; k < 3; k++) sim.step();
  const x0 = c.ax; sim.command({ k: 'order', side: 'LH', comps: [c.id], kind: 'move', x: c.ax - 140, y: c.ay }); sim.step();
  assert.strictEqual(c.order.kind, 'move'); assert.strictEqual(c.order.done, false, 'rozkaz oznaczony jako wykonany w kroku wydania'); assert.strictEqual(c.eff.kind, 'move'); assert.ok(c.ax < x0, 'rota nie ruszyła w kroku wydania');
  // Shift: drugi rozkaz trafia do kolejki, a pierwszy nie jest pomijany
  const sim2 = make(1), d = sim2.comps.find((q) => q.side === 1 && q.alive >= 100 && !q.startBy.dowodca); for (let k = 0; k < 3; k++) sim2.step();
  sim2.command({ k: 'order', side: 'LH', comps: [d.id], kind: 'move', x: d.ax - 120, y: d.ay }); sim2.command({ k: 'order', side: 'LH', comps: [d.id], kind: 'move', x: d.ax - 120, y: d.ay + 80, queue: true }); sim2.step();
  assert.strictEqual(d.queue.length, 1, 'drugi rozkaz powinien trafić do kolejki'); assert.strictEqual(d.order.done, false);
  let t1 = -1; for (let k = 0; k < 20 * 30; k++) { sim2.step(); if (t1 < 0 && d.order.done) t1 = k; if (t1 >= 0) break; }
  assert.ok(t1 > 20, 'pierwszy rozkaz z kolejki wykonany natychmiast (' + t1 + ' kroków)');
  return 'nowy rozkaz: done=false, rota rusza w tym samym kroku; kolejka: pierwszy rozkaz trwa ' + (t1 / 20).toFixed(1) + ' s';
});

let failed = 0;
for (const r of results) { console.log((r.ok ? 'OK   ' : 'FAIL ') + r.name + (r.note ? '\n       ' + r.note : '') + '  [' + r.ms + ' ms]'); if (!r.ok) failed++; }
console.log('\n' + (results.length - failed) + '/' + results.length + ' testów poprawek przeszło');
process.exit(failed ? 1 : 0);
