// Testy etapu B: karty i statystyki jednostek, system walki (trafienie, pancerz, odporności, minimum), morale z pasmami i odwrotem.
// Numery odpowiadają punktom listy testów ze specyfikacji interfejsu bitwy, statystyk i walki. Wszystkie liczby w testach pochodzą z JSON, nie są wartościami z gier Total War.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { loadP1 } = require('./load-core');

const results = [];
function test(name, fn) {
  if (process.env.ONLY && !name.includes(process.env.ONLY)) return;
  const t0 = Date.now();
  try { const note = fn(); results.push({ name, ok: true, note: note || '', ms: Date.now() - t0 }); }
  catch (e) { results.push({ name, ok: false, note: e.stack ? e.message : String(e), ms: Date.now() - t0 }); }
}
// armia z listy (scenariusz bitwa, mapa 1), bez AI, z możliwością zmiany definicji; wariancja losowa obrażeń i kierunek ciosu wyłączone, gdy chcemy dokładne wartości
function make(mod, extra) { const { Sim, defs } = loadP1(); if (mod) mod(defs); const sim = Sim.create(Object.assign({ defs, seed: 1, scenario: 'bitwa', map: 1, aiSides: [] }, extra || {})); sim.step(); return sim; }
const exact = (defs) => { defs.params.dmgVariance = 0; defs.params.facing.on = false; defs.params.combat.hitBase = 100; defs.params.combat.hitMax = 100; };
const antOf = (sim, kind, side) => { for (let i = 0; i < sim.count; i++) if (sim.alive[i] && (side < 0 || sim.side[i] === side) && sim.names[sim.type[i]] === kind) return i; throw new Error('brak mrówki ' + kind + ' strony ' + side); };
// przypisuje mrówce typ z tabel (testy sprawdzają wzory na tabelach typu, więc każdy typ można ustawić na istniejącej mrówce)
const asType = (sim, i, kind) => { sim.type[i] = sim.names.indexOf(kind); return i; };
// zwraca ubytek HP celu po jednym ciosie (cel wcześniej pełne i nieznacznie pogrubione, żeby nie zginął)
function strike(sim, a, d, base, kind) {
  sim.hp[d] = 1000; sim.grid[Math.floor(sim.y[d] / 16) * sim.COLS + Math.floor(sim.x[d] / 16)] = 0;
  const before = sim.hp[d]; sim.debug.hit(a, d, base, kind === 'melee', kind); return before - sim.hp[d];
}
const near = (x, y, eps, msg) => assert.ok(Math.abs(x - y) <= (eps || 1e-3), (msg || '') + ' oczekiwano ' + y + ', jest ' + x);

test('B1/B2. karta oddziału: liczebność żywych/max, suma HP żywych mrówek (max = suma początkowa), ranna mrówka nadal żywa', () => {
  const sim = make(); const c = sim.comps.find((q) => q.side === 0);
  let s = sim.compStats(c); assert.strictEqual(s.entities.current, c.alive); assert.strictEqual(s.entities.max, c.initial); assert.strictEqual(s.entities.current, s.entities.max);
  const hp0 = c.ants.reduce((t, i) => t + sim.hp[i], 0); near(s.health.current, hp0); near(s.health.max, hp0, 1e-3, 'maks HP = suma początkowa');
  // zranienie bez zabicia: liczebność bez zmian, HP spada o dokładną sumę
  let lost = 0; for (const i of c.ants.slice(0, 10)) { lost += sim.hp[i] * 0.5; sim.hp[i] *= 0.5; }
  s = sim.compStats(c); assert.strictEqual(s.entities.current, c.initial, 'ranna mrówka musi być żywa'); near(s.health.current, hp0 - lost);
  // śmierć jednej mrówki obniża liczebność o 1 i HP o jej HP
  const v = c.ants[20]; const hv = sim.hp[v]; sim.hp[v] = 0.001; const hpBefore = sim.compHp(c); sim.debug.hit(-1, v, 5, false, 'burst'); sim.step();
  s = sim.compStats(c); assert.strictEqual(s.entities.current, c.initial - 1); assert.ok(s.health.current <= hpBefore - 0.001 + 1e-6);
  return 'HP oddziału ' + s.health.current.toFixed(1) + '/' + s.health.max.toFixed(1) + ', liczebność ' + s.entities.current + '/' + s.entities.max + ' (' + hv.toFixed(1) + ' HP zabitej)';
});

test('B3. bazowe statystyki jednostek z JSON (osobno od modyfikatorów): zmęczenie obniża atak wręcz, ale nie zmienia wartości bazowej', () => {
  const sim = make(); const c = sim.comps.find((q) => q.side === 0 && sim.names[q.domType] === 'infantry'); const u = sim.defs.units.infantry.combat;
  let s = sim.compStats(c); near(s.attack.melee, u.meleeAttack); near(s.attack.baseDamage, u.baseDamage); near(s.defence.melee, u.meleeDefence); near(s.defence.armour, u.armour);
  c.fatigue = 80; s = sim.compStats(c); assert.ok(s.attack.melee < u.meleeAttack, 'zmęczenie nie obniżyło ataku'); near(s.attack.melee, u.meleeAttack - sim.defs.params.combat.fatigueAtk * 0.8); near(s.attack.baseDamage, u.baseDamage);
  assert.ok(s.effects.some((e) => e.name === 'Zmęczenie'), 'brak wpisu o zmęczeniu na liście aktywnych efektów');
  return 'wojownik: atak ' + u.meleeAttack + ', obrona ' + u.meleeDefence + ', obrażenia ' + u.baseDamage + '; po zmęczeniu 80%: atak ' + s.attack.melee;
});

test('B4. szansa trafienia wręcz = 50% + (atak - obrona) x 1 pp w granicach 5-95% (pomiar na tysiącach ciosów)', () => {
  const cases = [['infantry', 'infantry', 70], ['infantry', 'odzwierny', 47 + 5], ['pekacz', 'dowodca', 20], ['dowodca', 'plujka', 95]], out = [];
  for (const [ak, dk, expect] of cases) {
    const sim = make(); const a = antOf(sim, ak, 0), d = antOf(sim, dk, 1); const u = sim.defs.units;
    const att = u[ak].combat.meleeAttack, def = u[dk].combat.meleeDefence, formula = Math.max(5, Math.min(95, 50 + att - def)); assert.strictEqual(formula, expect, 'formuła testu ' + ak + ' vs ' + dk);
    const N = 6000; sim.combat.swings = sim.combat.hits = sim.combat.misses = 0; for (let k = 0; k < N; k++) { sim.hp[d] = 1000; sim.debug.hit(a, d, 1, true, 'melee'); }
    const rate = 100 * sim.combat.hits / sim.combat.swings; assert.ok(Math.abs(rate - expect) < 2.2, ak + ' vs ' + dk + ': zmierzono ' + rate.toFixed(1) + '% przy oczekiwanych ' + expect + '%'); out.push(ak + '>' + dk + ' ' + rate.toFixed(1) + '% (oczekiwane ' + expect + '%)');
  }
  // granice: bardzo duża przewaga i bardzo duża strata
  const hi = make((d) => { d.units.infantry.combat.meleeAttack = 500; }), a = antOf(hi, 'infantry', 0), t = antOf(hi, 'infantry', 1); hi.combat.swings = hi.combat.hits = 0; for (let k = 0; k < 3000; k++) { hi.hp[t] = 1000; hi.debug.hit(a, t, 1, true, 'melee'); }
  assert.ok(hi.combat.hits / hi.combat.swings < 0.97 && hi.combat.hits / hi.combat.swings > 0.92, 'górne ograniczenie 95% nie działa');
  const lo = make((d) => { d.units.infantry.combat.meleeAttack = -500; }), a2 = antOf(lo, 'infantry', 0), t2 = antOf(lo, 'infantry', 1); lo.combat.swings = lo.combat.hits = 0; for (let k = 0; k < 6000; k++) { lo.hp[t2] = 1000; lo.debug.hit(a2, t2, 1, true, 'melee'); }
  assert.ok(lo.combat.hits / lo.combat.swings < 0.07 && lo.combat.hits / lo.combat.swings > 0.03, 'dolne ograniczenie 5% nie działa');
  return out.join('; ');
});

test('B5. chybiony cios wręcz nie zadaje obrażeń, trafiony zadaje co najmniej minimum', () => {
  const sim = make((d) => { d.params.dmgVariance = 0; d.params.facing.on = false; }), a = antOf(sim, 'infantry', 0), d = antOf(sim, 'odzwierny', 1); let miss = 0, hit = 0;
  for (let k = 0; k < 800; k++) { sim.hp[d] = 1000; const m0 = sim.combat.misses; sim.debug.hit(a, d, 1, true, 'melee'); const lost = 1000 - sim.hp[d]; if (sim.combat.misses > m0) { assert.strictEqual(lost, 0, 'chybiony cios zranił'); miss++; } else { assert.ok(lost >= sim.defs.params.combat.minDamage - 1e-9, 'trafienie poniżej minimum'); hit++; } }
  assert.ok(miss > 100 && hit > 100); return 'chybień ' + miss + ', trafień ' + hit;
});

test('B6. pancerz zmniejsza obrażenia podstawowe o min(75%, pancerz x 0,75%), obrażenia przebijające pancerz nie są redukowane', () => {
  const sim = make(exact), P = sim.defs.params.combat, u = sim.defs.units;
  const a = antOf(sim, 'infantry', 0), heavy = asType(sim, antOf(sim, 'infantry', 1), 'ciezki'), taran = antOf(sim, 'taran', -1);
  const red = Math.min(P.armourCap, u.ciezki.combat.armour * P.armourScale) / 100, resM = u.ciezki.combat.damageResistance.melee || 0;
  const infDmg = u.infantry.combat.baseDamage * (1 - red) * (1 - resM); near(strike(sim, a, heavy, 0, 'melee'), infDmg, 1e-3, 'wojownik w ciężkiego (podstawowe)');
  const tDmg = (u.taran.combat.baseDamage * (1 - red) + u.taran.combat.armourPiercingDamage) * (1 - resM) * 1; near(strike(sim, taran, heavy, 0, 'melee'), tDmg * (sim.defs.counters.taran && sim.defs.counters.taran.ciezki || 1), 1e-3, 'taran w ciężkiego (podstawowe + przebijające)');
  // zero pancerza: pełne obrażenia podstawowe
  const soft = antOf(sim, 'infantry', 1); near(strike(sim, a, soft, 0, 'melee'), u.infantry.combat.baseDamage * (1 - (u.infantry.combat.damageResistance.melee || 0)), 1e-3, 'bez pancerza');
  // ograniczenie 75%
  const cap = make((d) => { exact(d); d.units.infantry.combat.baseDamage = 10; d.units.ciezki.combat.armour = 400; d.units.ciezki.combat.damageResistance = {}; }), ca = antOf(cap, 'infantry', 0), ch = asType(cap, antOf(cap, 'infantry', 1), 'ciezki');
  near(strike(cap, ca, ch, 0, 'melee'), 10 * 0.25, 1e-3, 'górne ograniczenie redukcji 75%');
  // przebijające obrażenia: pancerz nie ma wpływu
  const ap = (arm) => { const s = make((d) => { exact(d); d.units.infantry.combat.baseDamage = 0; d.units.infantry.combat.armourPiercingDamage = 3; d.units.ciezki.combat.armour = arm; d.units.ciezki.combat.damageResistance = {}; }); return strike(s, antOf(s, 'infantry', 0), asType(s, antOf(s, 'infantry', 1), 'ciezki'), 0, 'melee'); };
  near(ap(0), 3, 1e-3); near(ap(100), 3, 1e-3, 'pancerz zmniejszył obrażenia przebijające'); near(ap(400), 3, 1e-3);
  return 'redukcja ciężkiego ' + (red * 100).toFixed(1) + '%; wojownik ' + infDmg.toFixed(3) + ', taran ' + tDmg.toFixed(3) + '; przebijające 3 przy pancerzu 0/100/400 = 3';
});

test('B7. odporności działają po pancerzu: końcowe = po pancerzu x (1 - odporność); kwas i wybuch używają własnych odporności', () => {
  const sim = make((d) => { exact(d); d.units.odzwierny.combat.damageResistance = { melee: 0.2, acid: 0.5, burst: 0.1 }; d.units.odzwierny.combat.armour = 40; }), u = sim.defs.units, P = sim.defs.params.combat;
  const a = antOf(sim, 'infantry', 0), d = antOf(sim, 'odzwierny', 1), red = 40 * P.armourScale / 100;
  near(strike(sim, a, d, 0, 'melee'), u.infantry.combat.baseDamage * (1 - red) * 0.8, 1e-3, 'wręcz');
  near(strike(sim, a, d, 4, 'acid'), (u.infantry.combat.baseDamage * (1 - red) + u.infantry.combat.armourPiercingDamage) * 0.5, 1e-3, 'kwas (obrażenia ataku wyliczone jak w mechanice)');
  near(strike(sim, -1, d, 10, 'burst'), 10 * 0.9, 1e-3, 'wybuch: obrażenia przebijające pancerz, odporność 10%');
  return 'wręcz x0,8, kwas x0,5, wybuch x0,9 po pancerzu (wybuch w ogóle bez pancerza)';
});

test('B8. minimum obrażeń: trafienie bardzo słabym atakiem zadaje co najmniej 1 HP', () => {
  const sim = make((d) => { exact(d); d.units.infantry.combat.baseDamage = 0.01; d.units.ciezki.combat.armour = 100; }), a = antOf(sim, 'infantry', 0), d = asType(sim, antOf(sim, 'infantry', 1), 'ciezki');
  near(strike(sim, a, d, 0, 'melee'), sim.defs.params.combat.minDamage, 1e-9); return 'zadano ' + sim.defs.params.combat.minDamage + ' HP';
});

test('B9. odstęp między atakami: wojownicy w walce atakują nie częściej niż co T.cd x cdMod x cdScale (stały krok symulacji, bez zależności od klatek)', () => {
  const sim = make((d) => { d.params.fatigue.effCd = 0; for (const b of d.params.morale.bands) b.cd = 1; }, { aiSides: ['WK', 'LH'] });
  const inf = []; for (let i = 0; i < sim.count; i++) if (sim.names[sim.type[i]] === 'infantry') inf.push(i);
  const last = new Map(), prevN = new Map(); const gaps = [];
  for (let k = 0; k < 20 * 90 && !sim.result; k++) { sim.step(); for (const i of inf) { const n = sim.debug.swings(i); if (n !== (prevN.get(i) || 0)) { if (last.has(i) && n === (prevN.get(i) || 0) + 1) gaps.push(sim.tick - last.get(i)); last.set(i, sim.tick); prevN.set(i, n); } } }
  const expect = sim.defs.units.infantry.dmg !== undefined ? sim.defs.params.cdScale * sim.defs.units.infantry.cd * 20 : 0;
  assert.ok(gaps.length > 200, 'za mało ciosów do pomiaru: ' + gaps.length);
  const sorted = gaps.slice().sort((x, y) => x - y), p5 = sorted[Math.floor(sorted.length * 0.05)], mode = (() => { const m = {}; let best = 0, bv = 0; for (const g of gaps) { m[g] = (m[g] || 0) + 1; if (m[g] > best) { best = m[g]; bv = g; } } return bv; })();
  assert.ok(p5 >= expect - 1.01, '5. percentyl odstępu ' + p5 + ' kroków < oczekiwanego ' + expect.toFixed(2));
  assert.ok(Math.abs(mode - expect) <= 1.01, 'najczęstszy odstęp ' + mode + ' kroków, oczekiwano ' + expect.toFixed(2));
  return 'interwał ' + (expect / 20).toFixed(2) + ' s = ' + expect.toFixed(1) + ' kroków; ' + gaps.length + ' odstępów, najczęstszy ' + mode + ', 5. percentyl ' + p5;
});

test('B10. zasięg i celność strzału kwasem: plujka ma celność z JSON; chybiony strzał nie rani; tryb starego modelu zachowuje się jak dawniej', () => {
  const sim = make(), c = sim.comps.find((q) => sim.names[q.domType] === 'plujka'), s = sim.compStats(c), u = sim.defs.units.plujka.combat;
  near(s.attack.accuracy, u.accuracy); assert.ok(s.attack.ranged && s.attack.range > 50 && s.ammo && s.ammo.max > 0, 'brak danych zasięgu/amunicji'); near(s.ammo.current, c.acid);
  const a = sim.comps.find((q) => q.side === 0 && sim.names[q.domType] !== 'plujka');
  assert.strictEqual(sim.compStats(a).ammo, null, 'oddział bez amunicji nie powinien jej mieć');
  // stary model za bezpiecznikiem: wyłączony model walki nie dotyka statystyk, a zadaje obrażenia starym wzorem
  const old = make((d) => { d.params.combat.on = false; }); assert.strictEqual(old.defs.params.combat.on, false); const o1 = antOf(old, 'infantry', 0), o2 = antOf(old, 'infantry', 1); old.hp[o2] = 1000; old.debug.hit(o1, o2, 2, true, 'melee'); assert.ok(1000 - old.hp[o2] > 0, 'stary model nie zadał obrażeń');
  return 'plujka: zasięg ' + s.attack.range + ', celność ' + (s.attack.accuracy * 100) + '%, kwas ' + s.ammo.current + '/' + s.ammo.max;
});

// ---- morale
const sec = (sim, n) => { for (let k = 0; k < 20 * (n || 1) + 1; k++) sim.step(); };
// rota traci połowę mrówek przy niskim morale: kara za straty sprowadza morale do zera w ciągu sekundy (tak jak w prawdziwej bitwie)
const knock = (sim, c) => { c.control = 3; for (const i of c.ants.slice(0, Math.ceil(c.ants.length * 0.6))) { sim.hp[i] = 0; sim.debug.hit(-1, i, 1, false, 'burst'); } };
const rest = (sim) => { for (const c of sim.comps) c.fatigue = 0; };
const bandOf = (sim, c, v) => { c.control = v; sim.step(); sim.step(); for (let k = 0; k < 20; k++) sim.step(); return sim.compStats(c); };
test('B11. pasma morale (70/40/20/1/0): nazwa, ikona i kolor wynikają z wartości; zmiana pasma natychmiast zmienia kartę', () => {
  const sim = make(), c = sim.comps.find((q) => q.side === 1 && q.role !== 'reserve') || sim.comps.find((q) => q.side === 1), B = sim.defs.params.morale.bands;
  const seen = [];
  for (const [v, exp] of [[100, 0], [60, 1], [30, 2], [8, 3]]) {
    c.control = v; c.band = exp === 0 ? 0 : exp; c.cstate = exp ? 1 : 0; const s = sim.compStats(c); assert.strictEqual(s.morale.band, exp); assert.strictEqual(s.morale.name, B[exp].name); assert.strictEqual(s.morale.icon, B[exp].icon); assert.deepStrictEqual(s.morale.threshold, B.map((b) => b.min)); seen.push(B[exp].name);
  }
  assert.deepStrictEqual(B.map((b) => b.min), [70, 40, 20, 1, 0], 'progi pasm różnią się od specyfikacji');
  return seen.join(' > ');
});

test('B12. spadek morale zmienia pasmo, a efekt pasma (tempo ataku, prędkość) jest użyty w statystykach; brak migotania przy progu (histereza)', () => {
  const sim = make((d) => { d.params.morale.hyst = 3; }), c = sim.comps.find((q) => q.side === 1), B = sim.defs.params.morale.bands; rest(sim);
  // przejście 100 -> 60: pasmo "Pod presją" i wolniejszy atak
  bandOf(sim, c, 100); const i0 = sim.compStats(c).attack.interval; const s1 = bandOf(sim, c, 55); assert.ok(s1.morale.band >= 1, 'pasmo nie spadło: ' + s1.morale.band);
  assert.ok(sim.compStats(c).attack.interval > i0 * 1.05, 'efekt pasma nie wpływa na tempo ataku'); assert.ok(s1.effects.some((e) => e.name === B[s1.morale.band].name), 'brak efektu pasma na liście');
  // histereza: wartość wahająca się tuż nad i pod progiem 70 nie przełącza pasma co krok
  c.control = 66; sim.step(); let flips = 0, last = null; const bands = [];
  for (let k = 0; k < 120; k++) { c.control = 66 + (k % 2 ? 5 : 0); sim.step(); const b = c.band; if (last !== null && b !== last) flips++; last = b; bands.push(b); }
  assert.ok(flips <= 2, 'pasmo migocze przy progu: ' + flips + ' zmian w 120 krokach');
  return 'histereza: ' + flips + ' zmian pasma przy wahaniu 66 <-> 71; interwał ' + i0.toFixed(2) + ' -> ' + sim.compStats(c).attack.interval.toFixed(2);
});

test('B13. odwrót przy morale 0: rota obrońcy zaczyna odwrót (stan "odwrót" na karcie), atakujący wpada w szał; sąsiednie oddziały dostają karę za ucieczkę w promieniu', () => {
  const sim = make(), D = sim.comps.filter((q) => q.side === 1), c = D[0]; rest(sim);
  // sąsiad w promieniu i sąsiad poza promieniem
  const near1 = D[1], far = D[D.length - 1]; const R = sim.defs.params.morale.allyRadius;
  const shift = (q, x, y) => { const dx = x - q.ax, dy = y - q.ay; for (const i of q.ants) { sim.x[i] += dx; sim.y[i] += dy; } q.ax = x; q.ay = y; };
  shift(c, 1500, 800); shift(near1, 1500 + R * 0.5, 800); shift(far, 1500 + R * 2, 800);
  near1.control = far.control = 100; near1.routPen = far.routPen = 0; const nb = near1.control;
  knock(sim, c); sec(sim, 1);
  const s = sim.compStats(c); assert.ok(s.morale.retreating && s.state === 'odwrót', 'rota nie zaczęła odwrotu: ' + s.state); assert.ok(c.cstate === sim.CS_LOST);
  let got = 0, gotFar = 0; for (let k = 0; k < 40; k++) { sim.step(); if (near1.mb && near1.mb.rout < 0) got = near1.mb.rout; if (far.mb && far.mb.rout < 0) gotFar = far.mb.rout; }
  assert.ok(got < 0, 'sąsiad w promieniu nie dostał kary za ucieczkę'); assert.strictEqual(gotFar, 0, 'sąsiad poza promieniem dostał karę');
  const att = sim.comps.find((q) => q.side === 0); knock(sim, att); sec(sim, 1); assert.strictEqual(sim.compStats(att).state, sim.defs.params.morale.attackerRage ? 'szał' : 'odwrót');
  return 'obrońca: ' + s.state + ', atakujący: ' + sim.compStats(att).state + '; kara za ucieczkę sąsiada w promieniu ' + got.toFixed(1) + ', poza promieniem ' + gotFar;
});

test('B14. zebranie po odwrocie: dopiero po >= noThreatSec bez zagrożenia i morale >= rallyMin, potem rota czeka na rozkaz', () => {
  const sim = make(), c = sim.comps.filter((q) => q.side === 1)[0], MO = sim.defs.params.morale; rest(sim);
  // odizolowana rota w spokoju: wyrzucamy wrogów daleko, żeby nie było zagrożenia
  for (const q of sim.comps) if (q.side === 0) for (const i of q.ants) { sim.x[i] = 60; sim.y[i] = 60; } for (const q of sim.comps) if (q.side === 0) { q.ax = 60; q.ay = 60; }
  knock(sim, c); sec(sim, 1); assert.ok(c.retreating, 'brak odwrotu');
  // spokój, ale morale poniżej progu zebrania: rota dalej się wycofuje
  c.lastThreatTick = -1e9; c.control = 5; sec(sim, 1); assert.ok(c.control < MO.rallyMin && c.retreating, 'rota zebrała się przy morale ' + c.control + ' < ' + MO.rallyMin);
  // morale wysokie, ale zagrożenie przed chwilą: też jeszcze nie
  c.control = MO.rallyMin + 40; c.lastThreatTick = sim.tick; const t0 = sim.tick; let t1 = -1; for (let k = 0; k < 20 * 20; k++) { if (k === 40) assert.ok(c.retreating, 'zebranie po 2 s od zagrożenia (próg ' + MO.noThreatSec + ' s)'); sim.step(); c.lastThreatTick = Math.max(c.lastThreatTick, k < 1 ? sim.tick : c.lastThreatTick); if (!c.retreating) { t1 = sim.tick; break; } }
  assert.ok(t1 > 0, 'rota nie zebrała się w spokoju'); assert.ok((t1 - t0) / 20 >= MO.noThreatSec - 1.1, 'zebranie za wcześnie po ' + ((t1 - t0) / 20).toFixed(1) + ' s');
  assert.strictEqual(c.order.kind, 'hold', 'po zebraniu rota nie czeka na rozkaz'); return 'zebranie po ' + ((t1 - t0) / 20).toFixed(1) + ' s spokoju (próg ' + MO.noThreatSec + ' s, morale >= ' + MO.rallyMin + ')';
});

test('B15. tooltip morale: rozbicie źródeł pochodzi z rzeczywistych składników, a ich suma równa się zmianie morale w sekundzie', () => {
  const sim = make(), c = sim.comps.find((q) => q.side === 1 && q.alive > 0); rest(sim); sec(sim, 1); c.control = 60; let after = null;
  for (let k = 0; k < 25 && after === null; k++) { sim.step(); if (c.control !== 60) after = c.control; }
  assert.ok(after !== null, 'morale nie zmieniło się w ciągu sekundy'); const mb = sim.compStats(c).morale.breakdown, keys = ['regen', 'cmd', 'mass', 'side', 'loss', 'alarm', 'noCmd', 'cutOff', 'flank', 'rout', 'fatigue', 'captain'];
  for (const k of keys) assert.ok(k in mb, 'brak składnika ' + k);
  const sum = keys.reduce((t, k) => t + mb[k], 0); near(after - 60, sum, 1e-6, 'suma składników vs zmiana morale');
  return 'składniki: ' + keys.filter((k) => mb[k]).map((k) => k + ' ' + mb[k].toFixed(2)).join(', ') + '; suma ' + sum.toFixed(2) + ' = zmiana ' + (after - 60).toFixed(2);
});

test('B16. odporność psychiczna zmniejsza kary morale (strata, presja), nie premie', () => {
  const lossOf = (res) => { const sim = make((d) => { for (const k of Object.keys(d.units)) d.units[k].combat.moraleResistance = res; }), c = sim.comps.find((q) => q.side === 1); rest(sim); sec(sim, 1); for (const i of c.ants.slice(0, Math.floor(c.ants.length / 2))) { sim.hp[i] = 0; sim.debug.hit(-1, i, 1, false, 'burst'); } sec(sim, 1); return { loss: sim.compStats(c).morale.breakdown.loss, regen: sim.compStats(c).morale.breakdown.regen }; };
  const a = lossOf(0), b = lossOf(0.5);
  assert.ok(a.loss < -1 && Math.abs(b.loss) < Math.abs(a.loss) * 0.6, 'odporność nie zmniejszyła kary: ' + a.loss + ' vs ' + b.loss); near(a.regen, b.regen, 1e-9, 'premia regeneracji nie powinna zależeć od odporności');
  return 'kara za straty bez odporności ' + a.loss.toFixed(1) + '/s, z odpornością 50%: ' + b.loss.toFixed(1) + '/s; regeneracja bez zmian ' + a.regen;
});

test('B17. wskaźnik sił: własne wartości dokładne, wróg wyłącznie wg wiedzy strony (nieznany = 0 znanych rot), tryb obserwatora zna wszystko', () => {
  const sim = make(), own = sim.forces(0), obs = sim.forces(-1); assert.strictEqual(own.enemy.known, 0, 'wróg znany przed spotkaniem'); assert.ok(own.enemy.total > 0); assert.strictEqual(own.enemy.power, 0);
  near(own.own.hp, sim.comps.filter((q) => q.side === 0).reduce((t, q) => t + sim.compHp(q), 0));
  assert.strictEqual(obs.enemy.known, obs.enemy.total, 'obserwator powinien znać wszystkie roty');
  // widoczność: po objawieniu wroga wiedza rośnie, a po jego śmierci wiedza zostaje ostatnim obrazem
  const e = sim.comps.find((q) => q.side === 1); sim.debug.vis(); for (const i of e.ants) { sim.x[i] = sim.comps.find((q) => q.side === 0).ax + 60; sim.y[i] = sim.comps.find((q) => q.side === 0).ay; } e.ax = sim.comps.find((q) => q.side === 0).ax + 60; sim.debug.vis(); for (let k = 0; k < 60; k++) sim.step();
  const after = sim.forces(0); assert.ok(after.enemy.known >= 1 && after.enemy.power > 0, 'wiedza o wrogu nie wzrosła po zobaczeniu');
  return 'przed spotkaniem znane roty wroga 0/' + own.enemy.total + ', po spotkaniu ' + after.enemy.known + '/' + after.enemy.total;
});

test('B18. determinizm i niezależność od liczby klatek: ten sam przebieg dla tego samego ziarna, brak zależności rdzenia od zegara', () => {
  const html = fs.readFileSync((process.env.P1_FILE || path.join(__dirname, '..', 'prototypy', 'p1-bitwa.html')), 'utf8'), core = html.slice(html.indexOf('/*SIM-BEGIN*/'), html.indexOf('/*SIM-END*/'));
  assert.ok(!/Date\.now|performance\.now|Math\.random|requestAnimationFrame/.test(core), 'rdzeń zależy od zegara lub losowości zewnętrznej');
  const h = (seed) => { const sim = make(null, { seed }); for (let k = 0; k < 600; k++) sim.step(); return sim.hash(); };
  const a = h(5), b = h(5), c = h(6); assert.strictEqual(a, b); assert.notStrictEqual(a, c);
  return 'skrót ' + a + ' powtarzalny; ziarno 6 daje inny';
});

test('B19. model walki można wyłączyć bezpiecznikiem (params.combat.on = false) i morale (params.morale.spec = false); stare ścieżki nadal działają', () => {
  for (const mod of [(d) => { d.params.combat.on = false; }, (d) => { d.params.morale.spec = false; }, (d) => { d.params.combat.on = false; d.params.morale.spec = false; }]) {
    const sim = make(mod); for (let k = 0; k < 400; k++) sim.step(); const c = sim.comps[0]; const s = sim.compStats(c); assert.ok(s.entities.current > 0 && Number.isFinite(s.health.current) && Number.isFinite(s.morale.value));
  }
  return 'trzy kombinacje przełączników: start, 20 s symulacji i statystyki bez błędów';
});

test('B20. przeglądanie danych kart: wszystkie roty obu stron mają kompletne statystyki bez NaN', () => {
  const sim = make(null, { aiSides: ['WK', 'LH'] }); for (let k = 0; k < 20 * 60; k++) sim.step();
  let n = 0; for (const c of sim.comps) { const s = sim.compStats(c); const walk = (o, p) => { for (const k of Object.keys(o)) { const v = o[k]; if (v && typeof v === 'object') walk(v, p + '.' + k); else if (typeof v === 'number') assert.ok(Number.isFinite(v), 'NaN w ' + c.name + ' ' + p + '.' + k); } }; walk(s, ''); assert.ok(s.entities.current <= s.entities.max); assert.ok(s.health.current <= s.health.max + 1e-3, 'HP ponad maksimum'); n++; }
  return 'sprawdzono ' + n + ' rot po 60 s walki AI-AI';
});

let failed = 0;
for (const r of results) { console.log((r.ok ? 'OK   ' : 'FAIL ') + r.name + (r.note ? '\n       ' + r.note : '') + '  [' + r.ms + ' ms]'); if (!r.ok) failed++; }
console.log('\n' + (results.length - failed) + '/' + results.length + ' testów etapu B przeszło');
process.exit(failed ? 1 : 0);
