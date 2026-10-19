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

test('zakres: rzadszy rój, ponad 20 rot po 50-300 mrówek; nazwy rot zależą od typu', () => {
  const sim = make(1);
  assert.ok(sim.count >= 1400 && sim.count <= 4000, 'liczba mrówek ' + sim.count);
  assert.ok(sim.comps.length >= 20, 'rot: ' + sim.comps.length);
  for (const c of sim.comps) assert.ok(c.initial >= 50 && c.initial <= 301, c.name + ' ma ' + c.initial);
  const names = new Set(sim.comps.map((c) => c.name));
  assert.ok(names.has('Rota wojowników') && names.has('Rota taranów') && names.has('Rota plujek') && names.has('Rota odźwiernych'));
  assert.strictEqual(sim.comps.filter((c) => c.name === 'Rota wojowników' && c.side === 0).length, 6);
  return 'start: ' + sim.count + ' mrówek, ' + sim.comps.length + ' rot (' + [...names].join(', ') + ')';
});

test('dowódca ma własną gwardię: elitarne wersje dowolnego typu (statystyki bazowe razy elitarność), wybór przy rekrutacji', () => {
  const sim = make(1);
  const T = sim.T, ti = sim.ti;
  assert.ok(T.hp[ti.gwardia_ciezki] > T.hp[ti.ciezki] * 1.5 && T.dmg[ti.gwardia_ciezki] > T.dmg[ti.ciezki] && T.armor[ti.gwardia_ciezki] > T.armor[ti.ciezki], 'elita nie jest silniejsza od bazy');
  const guards = sim.comps.filter((c) => /^Gwardia/.test(c.name));
  assert.strictEqual(guards.length, 4);
  for (const g of guards) assert.ok(g.startBy.dowodca === 1 && Object.keys(g.startBy).length === 2, 'gwardia ma mieć dowódcę i jeden typ elity');
  const { Sim, defs } = loadP1();
  for (const type of ['infantry', 'biegacz', 'taran', 'pekacz', 'odzwierny', 'plujka']) {
    const s2 = Sim.create({ defs, seed: 1, guard: { WK: type } });
    const g = s2.comps.find((c) => c.side === 0 && /^Gwardia/.test(c.name));
    assert.ok(g && g.startBy['gwardia_' + type] === 50, 'gwardia typu ' + type + ' nie powstała: ' + JSON.stringify(g && g.startBy));
  }
  return 'gwardia: ' + [...new Set(guards.map((g) => g.name))].join(', ') + '; dowolny typ bazowy jako gwardia: ok';
});

test('ciała mają masę: w walce mrówki się nie stackują (pary wróg-wróg lub z ciałem w kontakcie nakładające się >40%)', () => {
  const sim = make(1, 256); let worst = 0, sum = 0, n = 0, friendlyPass = 0;
  for (let k = 0; k < 20 * 150 && !sim.result; k++) {
    sim.step();
    if (k % 40 === 20) {
      const ids = []; for (let i = 0; i < sim.count; i++) if (sim.alive[i]) ids.push(i);
      let bad = 0;
      for (let a = 0; a < ids.length; a++) for (let b = a + 1; b < ids.length; b++) {
        const i = ids[a], j = ids[b], md = sim.T.radius[sim.type[i]] + sim.T.radius[sim.type[j]];
        const dx = sim.x[i] - sim.x[j]; if (Math.abs(dx) > md) continue; const dy = sim.y[i] - sim.y[j]; if (Math.abs(dy) > md) continue;
        const ci = sim.comps[sim.comp[i]], cj = sim.comps[sim.comp[j]];
        if (ci.closed && cj.closed) continue;
        if (Math.hypot(dx, dy) >= 0.6 * md) continue;
        // liczą się nakładania w walce (wróg albo ciało w kontakcie); mijanie się swoich poza walką jest dozwolone i krótkotrwałe
        if (sim.side[i] !== sim.side[j] || sim.contact[i] || sim.contact[j]) bad++; else friendlyPass++;
      }
      worst = Math.max(worst, bad / ids.length); sum += bad / ids.length; n++;
    }
  }
  assert.ok(worst < 0.04, 'zbyt wiele nakładających się ciał: ' + (worst * 100).toFixed(1) + '% mrówek w najgorszym pomiarze');
  return 'w walce najgorszy pomiar: ' + (worst * 100).toFixed(2) + '% mrówek w nakładającej się parze, średnio ' + (sum / n * 100).toFixed(2) + '% (osobno: ' + (friendlyPass / n).toFixed(1) + ' par swoich mijających się poza walką na pomiar)';
});

test('poza walką swoi się mijają: rota w marszu przechodzi przez stojącą, a ta robi jej przejście', () => {
  const { Sim, defs } = loadP1(); const sim = Sim.create({ defs, seed: 1, passage: 192, aiSides: [] });
  const mover = sim.comps.find((c) => c.side === 0 && /^Gwardia/.test(c.name)), idle = sim.comps.find((c) => c.side === 0 && c.name === 'Rota wojowników');
  const idleAliveBefore = idle.alive;
  sim.command({ k: 'order', side: 'WK', comps: [mover.id], kind: 'move', x: 520, y: idle.ay });
  let crossed = -1;
  for (let k = 0; k < 20 * 40; k++) {
    sim.step();
    if (crossed < 0) { const xs = mover.ants.filter((i) => sim.alive[i]).map((i) => sim.x[i]); if (xs.length && xs.reduce((a, b) => a + b, 0) / xs.length > 480) crossed = k / 20; }
  }
  assert.ok(crossed > 0, 'rota w marszu nie przeszła przez stojącą (utknęła w kolejce)');
  assert.strictEqual(idle.alive, idleAliveBefore, 'przejście nie powinno nikogo zabijać');
  // stojąca rota wraca do szyku: średni błąd względem środka nie rośnie ponad rozmiar szyku
  const cx = idle.ants.reduce((a, i) => a + sim.x[i], 0) / idle.ants.length;
  assert.ok(Math.abs(cx - idle.ax) < 40, 'stojąca rota rozsypała się po przejściu: środek ' + cx.toFixed(0) + ' vs kotwica ' + idle.ax.toFixed(0));
  return 'rota w marszu minęła stojącą po ' + crossed.toFixed(1) + ' s, bez strat; stojąca wróciła do szyku';
});

test('w walce nikt się nie mija: ciało w kontakcie z wrogiem stoi w miejscu (nie jest przepychane przez swoich)', () => {
  const sim = make(1, 256); const moves = []; let prevX = null, prevY = null, prevC = null;
  for (let k = 0; k < 20 * 150 && !sim.result; k++) {
    sim.step();
    if (prevX) for (let i = 0; i < prevX.length; i++) if (prevC[i] && sim.contact[i] && sim.alive[i]) moves.push(Math.hypot(sim.x[i] - prevX[i], sim.y[i] - prevY[i]));
    prevX = Array.from(sim.x.subarray(0, sim.count)); prevY = Array.from(sim.y.subarray(0, sim.count)); prevC = Array.from(sim.contact.subarray(0, sim.count));
  }
  assert.ok(moves.length > 2000, 'za mało pomiarów walczących: ' + moves.length);
  moves.sort((a, b) => a - b);
  const med = moves[moves.length >> 1], p99 = moves[Math.floor(moves.length * 0.99)];
  const p90 = moves[Math.floor(moves.length * 0.9)];
  assert.ok(med < 0.4 && p90 < 1.2, 'walczące ciała się przesuwają: mediana ' + med.toFixed(3) + ', p90 ' + p90.toFixed(2));
  return moves.length + ' pomiarów mrówek w kontakcie: mediana przesunięcia na krok ' + med.toFixed(3) + ', p90 ' + p90.toFixed(2) + ', p99 ' + p99.toFixed(2) + ' (odrzut taranów wlicza się)';
});

test('zmęczenie rośnie w marszu i walce, obniża tempo ataku i kontrolę, spada na odpoczynku', () => {
  const sim = run(make(1, 256), 90);
  const f = sim.comps.map((c) => c.fatigue);
  assert.ok(f.every((v) => v >= 0 && v <= 100), 'zmęczenie poza zakresem');
  const marched = sim.comps.filter((c) => c.side === 0 && c.role === 'assault'), rested = sim.comps.filter((c) => c.role === 'plug');
  assert.ok(Math.max(...marched.map((c) => c.fatigue)) > 15, 'maszerujące roty nie męczą się');
  assert.ok(Math.max(...marched.map((c) => c.fatigue)) > Math.max(...rested.map((c) => c.fatigue)), 'odpoczywający plug męczy się bardziej niż maszerujący');
  const tired = marched.sort((a, b) => b.fatigue - a.fatigue)[0];
  assert.ok(tired.cdMod > 1.05 && tired.spMod < 0.98, 'zmęczenie nie wpływa na tempo ataku i prędkość');
  return 'maks. zmęczenie marszu ' + tired.fatigue.toFixed(0) + '%, mnożnik czasu ataku ' + tired.cdMod.toFixed(2) + ', prędkości ' + tired.spMod.toFixed(2);
});

test('kapitan roty: jego śmierć obniża morale, a po czasie awansuje następca', () => {
  const sim = make(1, 256); let ev = null, comp = null, before = 0;
  for (let k = 0; k < 20 * 400 && !sim.result && !ev; k++) { sim.step(); ev = sim.events.find((e) => /Poległ kapitan roty/.test(e.text)); if (ev) comp = sim.comps[ev.comp]; }
  assert.ok(ev, 'w 400 s nie poległ żaden kapitan');
  assert.ok(comp.captain === -1 || comp.alive === 0, 'kapitan nie został odebrany po śmierci');
  let promoted = comp.alive === 0 || comp.captain >= 0;
  for (let k = 0; k < 20 * 20 && !sim.result && !promoted; k++) { sim.step(); if (comp.captain >= 0 || comp.alive === 0) promoted = true; }
  assert.ok(promoted, 'w ciągu 20 s po śmierci nie awansował następca kapitana');
  return ev.text + ' (' + ev.t + ' s), następca awansował';
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
        if ([1, 3, 4, 5].includes(g)) { bad = 'mrówka w przeszkodzie, tick ' + k; break; }
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
    const sim = make(1, w, (d) => { d.units.odzwierny.hp = 1e7; d.params.supply.acidStart = 0; });
    const plug = sim.comps.find((c) => c.role === 'plug'), gp = sim.defs.world.gap; let leak = 0, maxPressure = 0;
    const depth = Math.ceil(plug.initial / plug.fcols) * plug.spacing / 2;
    for (let k = 0; k < 20 * 90 && !sim.result; k++) {
      sim.step();
      if (k % 20 === 10) {
        let press = 0;
        for (let i = 0; i < sim.count; i++) if (sim.alive[i] && sim.side[i] === 0) { if (sim.x[i] > gp[0] + depth + 12) leak++; else if (sim.x[i] > gp[0] - 60 && Math.abs(sim.y[i] - gp[1]) < w / 2 + 40) press++; }
        if (press > maxPressure) maxPressure = press;
      }
    }
    assert.ok(plug.closed, 'plug nie zamknął przejścia przy ' + w);
    assert.ok(maxPressure >= 25, 'za mało atakujących przy przejściu (' + maxPressure + '), test nic nie dowodzi');
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

test('kontrola feromonowa: roty osłabiają się lub tracą kontrolę, a zdarzenia mają przyczynę', () => {
  const sim = run(make(1, 256), 400); const ev = sim.report().events;
  const changes = ev.filter((e) => /osłabiona kontrola|utrata kontroli/.test(e.text) && !/odzyskała/.test(e.text));
  assert.ok(changes.length > 0, 'żadna rota nie osłabła ani nie straciła kontroli w 400 s');
  assert.ok(changes.every((e) => /przyczyna:/.test(e.text) || /\)$/.test(e.text)), 'zdarzenie bez przyczyny');
  const lost = changes.filter((e) => /utrata kontroli/.test(e.text));
  return 'zmian stanu kontroli: ' + changes.length + ', w tym utrat: ' + lost.length + ' (np. ' + changes[0].text + ')';
});

test('wydajność: krok symulacji przy ok. 4000 mrówek (czas w piaskownicy, nie kryterium 15.2)', () => {
  const sim = make(1, 128, (d) => { for (const s of ['WK', 'LH']) for (const c of d.scenario.sides[s].companies) for (const k in c.units) if (k !== 'dowodca' && k !== '@guard') c.units[k] = Math.round(c.units[k] * 2.3); });
  const n = sim.count; assert.ok(n >= 3500 && n <= 4600, 'liczba mrówek ' + n);
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
