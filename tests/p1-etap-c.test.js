// Testy etapu C (rdzeń): zapytania, z których korzystają nakładki taktyczne: zasięg, wykonalność i przyczyny blokady ostrzału, obrys roty, punkty podejścia.
// Numeracja B-C1... odpowiada punktom listy testów ze specyfikacji znaczników i nakładek (sekcja 17).
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
const WALL = 1;
const cellOf = (sim, x, y) => Math.floor(y / sim.CELL) * sim.COLS + Math.floor(x / sim.CELL);
const moveComp = (sim, c, x, y) => { const dx = x - c.ax, dy = y - c.ay; for (const i of c.ants) { sim.x[i] += dx; sim.y[i] += dy; } c.ax = x; c.ay = y; };
// plujki WK nie istnieją w armii listy; bierzemy rotę plujek LH jako strzelców i rotę wroga WK
function setup(sim) {
  const sh = sim.comps.find((c) => c.side === 1 && sim.names[c.domType] === 'plujka'), en = sim.comps.find((c) => c.side === 0 && sim.names[c.domType] === 'infantry');
  const eye = sim.comps.find((c) => c.side === 1 && sim.names[c.domType] === 'infantry');   // obserwator strony strzelców
  return { sh, en, eye };
}
// ustawia strzelców i cel na wolnym terenie: strzelcy w (x, y), wróg d jednostek na prawo, obserwator tuż przy wrogu
const x0 = (x) => x;
function arrange(sim, d, x, y) { const { sh, en, eye } = setup(sim); moveComp(sim, sh, x, y); moveComp(sim, en, x + d, y); moveComp(sim, eye, x + d - 30, y + 30); sim.debug.vis(); return { sh, en, eye }; }
// przesuwa wroga tak, by między skrajnymi mrówkami strzelców i wroga był odstęp gap (w osi x); zwraca kolumnę komórek w połowie odstępu
function gapArrange(sim, x, y, gap) {
  for (const c of sim.comps) if (c.side === 0 && c.role !== undefined && c !== sim.comps.find((q) => q.side === 0 && sim.names[q.domType] === 'infantry')) moveComp(sim, c, 60 + c.id * 4, 60);   // inni wrogowie daleko, żeby nie zakłócali pomiaru
  const { sh, en, eye } = arrange(sim, 100, x, y); const maxS = Math.max(...sh.ants.filter((i) => sim.alive[i]).map((i) => sim.x[i])), minE = Math.min(...en.ants.filter((i) => sim.alive[i]).map((i) => sim.x[i]));
  moveComp(sim, en, en.ax + (maxS + gap - minE), en.ay); moveComp(sim, eye, en.ax - 30, en.ay + 30); sim.debug.vis();
  return { sh, en, eye, wallX: maxS + gap / 2 };
}
// liczba strzałów kwasem (efekty 'acid') w ciągu n kroków; dopływ kwasu z zapasów podnosi pulę, więc sama pula nie mówi, czy ktoś strzelał
function shots(sim, n) { const seen = new Set(); for (let k = 0; k < n; k++) { sim.step(); for (const e of sim.fx) if (e.k === 'acid') seen.add(e.id); } return seen.size; }
function freeSpot(sim) { for (let y = 300; y < sim.H - 300; y += 40) for (let x = 400; x < sim.W - 400; x += 40) { let ok = true; for (let dy = -60; dy <= 60 && ok; dy += 16) for (let dx = -60; dx <= 200 && ok; dx += 16) { const g = sim.grid[cellOf(sim, x + dx, y + dy)]; if (g !== 0) ok = false; } if (ok) return [x, y]; } throw new Error('brak wolnego miejsca'); }

test('B-C1/8/12. zasięg broni z parametrów i modyfikatorów; cel poza zasięgiem daje przyczynę "range" i poziom czerwony', () => {
  const sim = make(1), [x, y] = freeSpot(sim), { sh, en } = arrange(sim, 200, x, y); const R = sim.compStats(sh).attack.range;
  assert.strictEqual(R, sim.defs.units.plujka.range, 'zasięg w statystykach różni się od JSON');
  const fc = sim.fireCheck(sh.id, en.id); assert.ok(fc.visible, 'wróg powinien być widoczny dla strony strzelców'); assert.strictEqual(fc.ok, 0); assert.strictEqual(fc.why, 'range'); assert.strictEqual(fc.level, 'red'); assert.strictEqual(fc.range, R);
  moveComp(sim, en, x + 40, y); sim.debug.vis(); const near = sim.fireCheck(sh.id, en.id); assert.ok(near.ok > 0 && near.level === 'green', 'w zasięgu nie ma pełnego ostrzału: ' + near.level + ' ' + near.frac);
  return 'zasięg ' + R + '; cel 200 jedn.: ' + fc.why + '/' + fc.level + ', cel 40 jedn.: ' + near.level + ' (' + near.ok + '/' + near.shooters + ')';
});

test('B-C6/7. brak kierunku w mechanice plujki: obszar ostrzału na otwartym terenie to koło (równy zasięg w każdą stronę), nie stożek', () => {
  const sim = make(1), [x, y] = freeSpot(sim), { sh } = arrange(sim, 60, x, y), a = sim.fireArea(sh.id), R = sim.defs.units.plujka.range;
  assert.strictEqual(a.rays.length, 360 / sim.defs.ui.overlays.fire.rayStepDeg);
  const open = a.rays.filter((r) => r.why === 'range'); assert.ok(open.length >= a.rays.length * 0.7, 'za mało otwartych promieni: ' + open.length);
  for (const r of open) assert.ok(Math.abs(r.reach - R) <= sim.defs.ui.overlays.fire.rayStep + 1e-6, 'promień ' + r.a + ' ma zasięg ' + r.reach + ' zamiast ' + R);
  // obrót roty nie zmienia pola (brak sektora)
  const before = JSON.stringify(a.rays.map((r) => r.reach)); sh.face = (sh.face || 0) + 1.2; for (const i of sh.ants) sim.heading && (sim.heading[i] = 1.2); assert.strictEqual(JSON.stringify(sim.fireArea(sh.id).rays.map((r) => r.reach)), before, 'pole zależy od kierunku roty, choć broń nie ma ograniczenia kierunkowego');
  return 'promieni ' + a.rays.length + ', otwartych ' + open.length + ', zasięg ' + R + ' w każdą stronę';
});

test('B-C9/13/14/21. ściana między strzelcami a celem: wykonalność spada do zera z przyczyną "wall", punkt blokady leży w ścianie, a rzeczywisty ostrzał się nie odbywa; po usunięciu ściany jest pełny', () => {
  const sim = make(1), [x, y] = freeSpot(sim), { sh, en, wallX } = gapArrange(sim, x0(x), y, 40);
  const ok0 = sim.fireCheck(sh.id, en.id); assert.ok(ok0.visible && ok0.ok > 0 && ok0.level !== 'red', 'przed ścianą: ' + ok0.level + ' ' + ok0.frac);
  const cells = []; for (let yy = 24; yy < sim.H - 24; yy += 8) cells.push(cellOf(sim, wallX, yy));   // ściana na całej wysokości mapy: nikt jej nie obejdzie w trakcie testu
  const saved = cells.map((c) => sim.grid[c]); for (const c of cells) sim.grid[c] = WALL;
  // wróg widziany przez obserwatora z boku (poza ścianą), strzelcy za ścianą go nie widzą, ale strona tak: wykonalność dotyczy strzału, nie widoczności
  moveComp(sim, sim.comps.find((c) => c.side === 1 && sim.names[c.domType] === 'infantry'), en.ax - 20, y + 200); sim.debug.vis();
  const fc = sim.fireCheck(sh.id, en.id); assert.ok(fc.visible, 'strona powinna widzieć wroga'); assert.strictEqual(fc.ok, 0, 'ściana nie zablokowała strzału'); assert.strictEqual(fc.why, 'wall'); assert.strictEqual(fc.level, 'red');
  assert.strictEqual(sim.grid[cellOf(sim, fc.bx, fc.by)], WALL, 'punkt blokady nie leży w ścianie'); assert.ok(Math.abs(fc.bx - wallX) <= sim.CELL, 'blokada nie leży na linii ściany');
  const a0 = sh.acid, n0 = shots(sim, 120); assert.strictEqual(n0, 0, 'plujki strzelały mimo ściany (' + n0 + ' strzałów)');
  cells.forEach((c, q) => { sim.grid[c] = saved[q]; }); sim.debug.vis(); const fc3 = sim.fireCheck(sh.id, en.id); assert.ok(fc3.ok > 0 && fc3.level !== 'red', 'po usunięciu ściany: ' + fc3.level);
  const n1 = shots(sim, 160); assert.ok(n1 > 0, 'plujki nie strzelają po usunięciu ściany');
  return 'ściana: ' + fc.why + ' w (' + fc.bx.toFixed(0) + ', ' + fc.by.toFixed(0) + '), strzałów 0; bez ściany: ' + fc3.level + ', kwas ' + a0 + ' -> ' + sh.acid;
});

test('B-C4/11. tor łukowy: shotAt zgadza się ze strzałem rdzenia (shotApex) na mapie ze wzgórzami; wysoki grzbiet blokuje tor z przyczyną "terrain", punktem na torze, a niski tor nie ma wpływu na ścianę', () => {
  const sim = make(2), pl = sim.comps.find((c) => c.side === 1 && sim.names[c.domType] === 'plujka'), en = sim.comps.find((c) => c.side === 0 && sim.names[c.domType] === 'infantry'); assert.ok(sim.hills, 'mapa 2 powinna mieć wzgórza');
  const R = sim.defs.units.plujka.range; let agree = 0, n = 0;
  const probe = () => { agree = 0; n = 0; for (let t = 0; t < 400; t++) { const i = pl.ants[t % pl.ants.length], a = sim.x[i] + (((t * 37) % 160) - 80), b = sim.y[i] + (((t * 53) % 160) - 80); if (a < 20 || b < 20 || a > sim.W - 20 || b > sim.H - 20) continue; const j = en.ants[0], ox = sim.x[j], oy = sim.y[j]; sim.x[j] = a; sim.y[j] = b; const A = sim.shotApex(i, j), B = sim.shotAt(sim.x[i], sim.y[i], a, b, R); sim.x[j] = ox; sim.y[j] = oy; n++; if ((A >= 0) === (B.apex >= 0)) agree++; } };
  probe(); assert.strictEqual(agree, n, 'zgodność przed grzbietem ' + agree + '/' + n);
  // sztuczny grzbiet 90 jedn. wysokości w kolumnie komórek 3 jednostki od strzelca na wschód
  const i0 = pl.ants[0], sx = sim.x[i0], sy = sim.y[i0], col = Math.floor((sx + 40) / sim.CELL); for (let r = 0; r < sim.ROWS; r++) sim.height[r * sim.COLS + col] = 90;
  const r = sim.shotAt(sx, sy, sx + 76, sy, R); assert.strictEqual(r.apex, -1); assert.strictEqual(r.why, 'terrain'); assert.ok(r.bx > sx && r.bx < sx + 76 && Math.abs(r.by - sy) < 1, 'punkt blokady spoza toru: ' + r.bx + ',' + r.by);
  const j = en.ants[0]; sim.x[j] = sx + 76; sim.y[j] = sy; assert.ok(sim.shotApex(i0, j) < 0, 'rdzeń strzela przez grzbiet'); probe(); assert.strictEqual(agree, n, 'zgodność po grzbiecie ' + agree + '/' + n);
  return n + ' par po grzbiecie: zgodność 100%; blokada terenem w (' + r.bx.toFixed(0) + ', ' + r.by.toFixed(0) + ')';
});

test('B-C15. ostrzał części oddziału: poziomy wykonalności z progów JSON (80/50/1/0), a podział strzelców daje żółty, gdy tylko część ma strzał', () => {
  const sim = make(1); assert.deepStrictEqual([sim.fireLevel(1, true), sim.fireLevel(0.8, true), sim.fireLevel(0.79, true), sim.fireLevel(0.5, true), sim.fireLevel(0.49, true), sim.fireLevel(0.01, true), sim.fireLevel(0, true), sim.fireLevel(1, false)], ['green', 'green', 'yellow', 'yellow', 'orange', 'orange', 'red', 'red']);
  const [x, y] = freeSpot(sim), { sh, en } = arrange(sim, 60, x, y); const R = sim.defs.units.plujka.range;
  // połowa strzelców zostaje, druga połowa jest przesunięta poza zasięg (w tył)
  const ants = sh.ants.filter((i) => sim.alive[i]); ants.slice(0, ants.length >> 1).forEach((i) => { sim.x[i] -= R + 60; }); sim.debug.vis();
  const fc = sim.fireCheck(sh.id, en.id); assert.ok(fc.frac > 0.3 && fc.frac < 0.7, 'ułamek ' + fc.frac); assert.strictEqual(fc.level, fc.frac * 100 >= 50 ? 'yellow' : 'orange'); assert.ok(fc.ok < fc.shooters && fc.ok > 0);
  return 'strzelcy ' + fc.ok + '/' + fc.shooters + ' = ' + (fc.frac * 100).toFixed(0) + '% -> ' + fc.level + ' (' + fc.why + ')';
});

test('B-C16. nakładki nie ujawniają wrogów: cel niewidoczny dla strony strzelców (za ścianą) daje visible=false bez punktu blokady i bez wykonalności', () => {
  const sim = make(1), [x, y] = freeSpot(sim), { sh, en, eye, wallX } = gapArrange(sim, x0(x), y, 40);
  moveComp(sim, eye, 100, 100); for (const c of sim.comps) if (c.side === 1 && c !== sh && c !== eye) moveComp(sim, c, 150 + c.id * 3, 120);
  for (let yy = y - 400; yy <= y + 400; yy += 8) sim.grid[cellOf(sim, wallX, yy)] = WALL; sim.debug.vis();
  const fc = sim.fireCheck(sh.id, en.id); assert.strictEqual(fc.visible, false); assert.strictEqual(fc.ok, 0); assert.strictEqual(fc.bx, null); assert.strictEqual(fc.level, 'red');
  const a = sim.fireArea(sh.id); assert.ok(!JSON.stringify(a).includes('"id"'), 'pole ostrzału zawiera dane jednostek');
  return 'cel w zasięgu, ale zasłonięty ścianą i niewidoczny: visible=false';
});

test('B-C17/18. plama kwasu: promień z parametrów jednostki, trafia wyłącznie wrogów (brak ognia sojuszniczego w mechanice, więc nakładka nie ma co oznaczać)', () => {
  const sim = make(1), [x, y] = freeSpot(sim), { sh, en, eye } = arrange(sim, 40, x, y), fc = sim.fireCheck(sh.id, en.id);
  assert.strictEqual(fc.aoe, sim.defs.units.plujka.aoe); assert.strictEqual(sim.compStats(sh).attack.aoe, sim.defs.units.plujka.aoe);
  // własna mrówka tuż obok celu, wróg bez kwasu: po strzałach własna mrówka jest cała, wróg ranny
  for (const c of sim.comps) if (c.side === 0 && c !== en) moveComp(sim, c, 100 + c.id * 4, 100);
  // wróg bez walki wręcz i bez kwasu: nic nie rani własnej mrówki prócz ewentualnego ognia sojuszniczego
  const ally = eye.ants[0], target = en.ants[0]; for (const i of en.ants) sim.type[i] = sim.names.indexOf('plujka');
  sim.x[ally] = sim.x[target] + 2; sim.y[ally] = sim.y[target]; sim.hp[ally] = 1000; en.acid = 0; for (const c of sim.comps) if (c.side === 0) c.acid = 0;
  const hpT = en.ants.reduce((t, i) => t + sim.hp[i], 0); for (let k = 0; k < 200; k++) sim.step();
  assert.strictEqual(sim.hp[ally], 1000, 'ogień sojuszniczy zranił własną mrówkę'); assert.ok(en.ants.reduce((t, i) => t + (sim.alive[i] ? sim.hp[i] : 0), 0) < hpT, 'plujki nie raniły wroga');
  return 'promień ' + fc.aoe + ', własna mrówka obok celu bez obrażeń, wróg ranny';
});

test('B-C20. obrys roty: otoczka wypukła zawiera wszystkie żywe mrówki, odświeża się po ruchu i śmierci, nie jest przeliczana dwa razy w tym samym kroku', () => {
  const sim = make(1), c = sim.comps.find((q) => q.side === 0 && q.alive > 50), inside = (h, px, py) => { let s = 0; for (let q = 0; q < h.length; q++) { const a = h[q], b = h[(q + 1) % h.length], cr = (b[0] - a[0]) * (py - a[1]) - (b[1] - a[1]) * (px - a[0]); if (cr !== 0) { if (s === 0) s = Math.sign(cr); else if (Math.sign(cr) !== s) return false; } } return true; };
  const h = sim.compHull(c); assert.ok(h.length >= 3); for (const i of c.ants) if (sim.alive[i]) assert.ok(inside(h, sim.x[i], sim.y[i]), 'mrówka poza obrysem'); assert.strictEqual(sim.compHull(c), h, 'pamięć podręczna nie działa');
  moveComp(sim, c, c.ax + 100, c.ay); sim.step(); const h2 = sim.compHull(c); assert.notStrictEqual(h2, h); for (const i of c.ants) if (sim.alive[i]) assert.ok(inside(h2, sim.x[i], sim.y[i]));
  const far = c.ants.filter((i) => sim.alive[i]).sort((a, b) => sim.x[b] - sim.x[a])[0]; sim.alive[far] = 0; c.alive--; sim.step(); const h3 = sim.compHull(c); assert.ok(!c.ants.filter((i) => sim.alive[i]).some((i) => !inside(h3, sim.x[i], sim.y[i])));
  return 'otoczka ' + h.length + ' wierzchołków dla ' + c.alive + ' mrówek';
});

test('B-C10. punkty podejścia: dwie roty atakujące jeden cel z różnych stron dostają różne punkty na obrysie celu (a nie wspólny środek)', () => {
  const sim = make(1), t = sim.comps.find((q) => q.side === 1 && q.alive > 50), a = sim.comps.filter((q) => q.side === 0)[0], b = sim.comps.filter((q) => q.side === 0)[1];
  moveComp(sim, a, t.ax - 200, t.ay); moveComp(sim, b, t.ax + 50, t.ay + 250); sim.step();
  const p = sim.approachPoint(a, t), q = sim.approachPoint(b, t); assert.ok(Math.hypot(p[0] - q[0], p[1] - q[1]) > 20, 'punkty podejścia są wspólne'); const h = sim.compHull(t);
  const distToHull = (pt) => { let best = 1e9; for (let i = 0; i < h.length; i++) { const A = h[i], B = h[(i + 1) % h.length], ex = B[0] - A[0], ey = B[1] - A[1], u = Math.max(0, Math.min(1, ((pt[0] - A[0]) * ex + (pt[1] - A[1]) * ey) / (ex * ex + ey * ey || 1))); best = Math.min(best, Math.hypot(pt[0] - A[0] - ex * u, pt[1] - A[1] - ey * u)); } return best; };
  assert.ok(distToHull(p) < 1.5 && distToHull(q) < 1.5, 'punkt podejścia nie leży na obrysie'); assert.ok(Math.hypot(p[0] - a.ax, p[1] - a.ay) < Math.hypot(t.ax - a.ax, t.ay - a.ay), 'punkt podejścia jest za środkiem celu');
  return 'punkty (' + p.map((v) => v.toFixed(0)) + ') i (' + q.map((v) => v.toFixed(0)) + ')';
});

test('B-C21. determinizm: zapytania nakładek nie zmieniają stanu symulacji (skrót stanu po 300 krokach z zapytaniami i bez nich jest identyczny)', () => {
  const run = (queries) => { const sim = make(2, null, { aiSides: ['WK', 'LH'] }); const sh = sim.comps.find((c) => c.side === 1 && sim.names[c.domType] === 'plujka'), en = sim.comps.find((c) => c.side === 0); for (let k = 0; k < 300; k++) { sim.step(); if (queries && k % 10 === 0) { sim.fireCheck(sh.id, en.id); sim.fireArea(sh.id); sim.compHull(en); sim.approachPoint(sh, en); sim.shotAt(sim.x[sh.ants[0]], sim.y[sh.ants[0]], en.ax, en.ay, 80); } } return sim.hash(); };
  assert.strictEqual(run(true), run(false)); return 'skrót identyczny';
});

let failed = 0;
for (const r of results) { console.log((r.ok ? 'OK   ' : 'FAIL ') + r.name + (r.note ? '\n       ' + r.note : '') + '  [' + r.ms + ' ms]'); if (!r.ok) failed++; }
console.log('\n' + (results.length - failed) + '/' + results.length + ' testów etapu C (rdzeń) przeszło');
process.exit(failed ? 1 : 0);
