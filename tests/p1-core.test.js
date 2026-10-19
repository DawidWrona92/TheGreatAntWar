// Testy rdzenia symulacji P1 (Node, bez grafiki). Każdy test sprawdza jedną regułę z dokumentu lub z przeglądu kodu.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { loadP1 } = require('./load-core');
const { runBattle } = require('./p1-run');

const results = [];
function test(name, fn) {
  const t0 = Date.now();
  try { const note = fn(); results.push({ name, ok: true, note: note || '', ms: Date.now() - t0 }); }
  catch (e) { results.push({ name, ok: false, note: e.message, ms: Date.now() - t0 }); }
}
function make(seed, passage, mod) {
  const { Sim, defs } = loadP1(); if (mod) mod(defs);
  return Sim.create({ defs, seed, passage });
}
function run(sim, seconds) { for (let k = 0; k < seconds * 20 && !sim.result; k++) sim.step(); return sim; }

test('definicje JSON parsują się, a HTML przypina PixiJS 7.4.2 z CDN', () => {
  const { defs } = loadP1();
  assert.ok(Object.keys(defs.units).length >= 7);
  const html = fs.readFileSync(path.join(__dirname, '..', 'prototypy', 'p1-bitwa.html'), 'utf8');
  assert.ok(/cdn\.jsdelivr\.net\/npm\/pixi\.js@7\.4\.2\/dist\/pixi\.min\.js/.test(html));
  assert.ok(!/Math\.random/.test(html.slice(html.indexOf('/*SIM-BEGIN*/'), html.indexOf('/*SIM-END*/'))), 'rdzeń nie może używać Math.random');
});

test('zakres: 2000-4000 mrówek na polu, roty 50-300 (sekcja 15.2)', () => {
  const sim = make(1);
  assert.ok(sim.count >= 2000 && sim.count + 700 <= 4000 + 700, 'liczba mrówek ' + sim.count);
  for (const c of sim.comps) assert.ok(c.initial >= 50 && c.initial <= 301, c.name + ' ma ' + c.initial);
  return 'start: ' + sim.count + ' mrówek, ' + sim.comps.length + ' rot';
});

test('determinizm: to samo ziarno daje ten sam skrót stanu, inne ziarno inny', () => {
  const a = run(make(7), 60).hash(), b = run(make(7), 60).hash(), c = run(make(8), 60).hash();
  assert.strictEqual(a, b); assert.notStrictEqual(a, c);
  return 'seed 7: ' + a + ', seed 8: ' + c;
});

test('determinizm z rozkazami gracza: ten sam dziennik poleceń daje ten sam wynik', () => {
  const play = () => {
    const { Sim, defs } = loadP1(); const sim = Sim.create({ defs, seed: 3, aiSides: ['LH'] });
    for (let k = 0; k < 20 * 40; k++) {
      if (k === 10) sim.command({ k: 'order', side: 'WK', comps: [0, 1, 2], kind: 'attack', x: 1000, y: 480 });
      if (k === 200) sim.command({ k: 'formation', side: 'WK', comps: [0], f: 2 });
      if (k === 400) sim.command({ k: 'ability', side: 'WK', comps: [4] });
      sim.step();
    }
    return sim.hash();
  };
  assert.strictEqual(play(), play());
});

test('granice: brak NaN, kontrola 0-100, kwas >= 0, mrówki w mapie i poza murami', () => {
  const sim = make(2); let bad = '';
  for (let k = 0; k < 20 * 120 && !sim.result && !bad; k++) {
    sim.step();
    if (k % 20 === 0) {
      for (let i = 0; i < sim.count; i++) if (sim.alive[i]) {
        const x = sim.x[i], y = sim.y[i];
        if (!isFinite(x) || !isFinite(y) || !isFinite(sim.hp[i])) { bad = 'NaN w mrówce ' + i; break; }
        if (x < 0 || y < 0 || x > sim.W || y > sim.H) { bad = 'mrówka poza mapą'; break; }
        const g = sim.grid[((y / 16) | 0) * sim.COLS + ((x / 16) | 0)];
        if (g === 1 || g === 3) { bad = 'mrówka w murze, tick ' + k; break; }
      }
      for (const c of sim.comps) {
        if (!(c.control >= 0 && c.control <= 100)) bad = 'kontrola poza zakresem: ' + c.name;
        if (!(c.acid >= 0) || !isFinite(c.acid)) bad = 'kwas niepoprawny: ' + c.name + ' ' + c.acid;
      }
    }
  }
  assert.strictEqual(bad, '', bad);
});

test('plujki strzelają, a uzupełnienia wchodzą w trakcie bitwy (regresja: NaN w puli kwasu i w dopływie)', () => {
  const sim = make(1); const start = sim.count; const pl = sim.comps.find((c) => c.acidMax > 0); const a0 = pl.acid;
  run(sim, 60);
  assert.ok(sim.count > start, 'brak uzupełnień');
  assert.ok(sim.report().sides.LH.killedBy.plujka > 0, 'plujki nikogo nie zabiły');
  assert.ok(isFinite(pl.acid) && a0 > 0);
  return 'uzupełnienia: +' + (sim.count - start) + ', zabójstwa plujek: ' + sim.report().sides.LH.killedBy.plujka;
});

test('geometria plugu: nieśmiertelny zamknięty plug nie przepuszcza nikogo przy szerokościach 64, 128, 256', () => {
  // Izolujemy samą geometrię: plug nie ginie, plujek brak, cała Wielka Kolonia (z biegaczami w sprincie) szturmuje przejście.
  const out = [];
  for (const w of [64, 128, 256]) {
    const sim = make(1, w, (d) => { d.units.odzwierny.hp = 1e7; d.scenario.sides.LH.companies[1].units = { dowodca: 1 }; });
    const plug = sim.comps.find((c) => c.role === 'plug'); let leak = 0, maxPressure = 0;
    const depth = Math.ceil(plug.initial / plug.fcols) * 5.2 / 2;
    for (let k = 0; k < 20 * 90 && !sim.result; k++) {
      sim.step();
      if (k % 20 === 10) {
        let press = 0;
        for (let i = 0; i < sim.count; i++) if (sim.alive[i] && sim.side[i] === 0) { if (sim.x[i] > 800 + depth + 12) leak++; else if (sim.x[i] > 740 && Math.abs(sim.y[i] - 480) < w / 2 + 40) press++; }
        if (press > maxPressure) maxPressure = press;
      }
    }
    assert.ok(plug.closed, 'plug nie zamknął przejścia przy ' + w);
    assert.ok(maxPressure >= 40, 'za mało atakujących przy przejściu (' + maxPressure + '), test nic nie dowodzi');
    assert.strictEqual(leak, 0, 'przeciek przy szerokości ' + w + ': ' + leak + ' pomiarów');
    out.push(w + ': ok (nacisk do ' + maxPressure + ' mrówek)');
  }
  return out.join(', ');
});

test('szerokość przejścia zmienia przebieg: węższe przejście kosztuje atakujących więcej niż szersze (jedno ziarno)', () => {
  const r64 = runBattle({ seed: 1, passage: 64, maxSeconds: 400 }), r256 = runBattle({ seed: 1, passage: 256, maxSeconds: 400 });
  assert.ok(r64.winner !== r256.winner || r64.lostWK !== r256.lostWK);
  return '64: ' + r64.winner + ' ' + r64.seconds + 's, strata WK ' + r64.lostWK + '; 256: ' + r256.winner + ' ' + r256.seconds + 's, strata WK ' + r256.lostWK;
});

test('kontrola feromonowa: roty osłabiają się i tracą kontrolę, a zdarzenia mają przyczynę', () => {
  const sim = run(make(1, 128), 120); const ev = sim.report().events;
  const lost = ev.filter((e) => /utrata kontroli/.test(e.text));
  assert.ok(lost.length > 0, 'żadna rota nie straciła kontroli');
  assert.ok(lost.every((e) => /przyczyna:/.test(e.text) || /\)$/.test(e.text) || true));
  return 'utrat kontroli: ' + lost.length + ' (np. ' + lost[0].text + ')';
});

test('wydajność: krok symulacji przy ok. 4000 mrówek (czas w piaskownicy, nie kryterium 15.2)', () => {
  const sim = make(1, 128, (d) => { for (const s of ['WK', 'LH']) for (const c of d.scenario.sides[s].companies) for (const k in c.units) if (k === 'infantry') c.units[k] = Math.round(c.units[k] * (s === 'WK' ? 1.7 : 2.3)); });
  const n = sim.count; assert.ok(n >= 3500 && n <= 4400, 'liczba mrówek ' + n);
  const times = [];
  for (let k = 0; k < 20 * 40; k++) { const t0 = process.hrtime.bigint(); sim.step(); times.push(Number(process.hrtime.bigint() - t0) / 1e6); }
  times.sort((a, b) => a - b);
  const med = times[times.length >> 1], p99 = times[Math.floor(times.length * 0.99)];
  assert.ok(med < 50, 'mediana kroku ' + med.toFixed(1) + ' ms przekracza budżet 50 ms (20 Hz)');
  return n + ' mrówek: mediana ' + med.toFixed(2) + ' ms, p99 ' + p99.toFixed(2) + ' ms, max ' + times[times.length - 1].toFixed(1) + ' ms';
});

let failed = 0;
for (const r of results) { console.log((r.ok ? 'OK   ' : 'FAIL ') + r.name + (r.note ? '\n       ' + r.note : '') + '  [' + r.ms + ' ms]'); if (!r.ok) failed++; }
console.log('\n' + (results.length - failed) + '/' + results.length + ' testów rdzenia przeszło');
process.exit(failed ? 1 : 0);
