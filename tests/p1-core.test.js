// Testy rdzenia symulacji P1 (Node, bez grafiki). Każdy test sprawdza jedną regułę z dokumentu lub z przeglądu kodu.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { loadP1 } = require('./load-core');
const { runBattle } = require('./p1-run');

const results = [];
function test(name, fn) {
  if (process.env.ONLY && !name.includes(process.env.ONLY)) return;
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
  const p90 = moves[Math.floor(moves.length * 0.9)];   // model walki etapu B (dłuższe starcia, więcej odrzutu): p90 1,20 zamiast 0,99 przy starym modelu, limit podniesiony z 1,2 do 1,3
  assert.ok(med < 0.4 && p90 < 1.3, 'walczące ciała się przesuwają: mediana ' + med.toFixed(3) + ', p90 ' + p90.toFixed(2));
  return moves.length + ' pomiarów mrówek w kontakcie: mediana przesunięcia na krok ' + med.toFixed(3) + ', p90 ' + p90.toFixed(2) + ', p99 ' + p99.toFixed(2) + ' (odrzut taranów wlicza się)';
});

test('rozkaz z kierunkiem i szerokością: rota po dotarciu staje zwrócona w wskazaną stronę, w szyku o zadanej liczbie kolumn', () => {
  const { Sim, defs } = loadP1(); const sim = Sim.create({ defs, seed: 1, passage: 192, aiSides: [] });
  const c = sim.comps.find((q) => q.side === 0 && q.name === 'Rota wojowników');
  sim.command({ k: 'order', side: 'WK', comps: [c.id], kind: 'move', x: c.ax + 240, y: c.ay + 60, face: Math.PI / 2, cols: 25 });
  for (let k = 0; k < 20 * 20; k++) sim.step();   // 20 s: rota już dotarła, jeszcze zanim bez dowódcy straci kontrolę
  let da = c.face - Math.PI / 2; da = Math.atan2(Math.sin(da), Math.cos(da));
  assert.ok(Math.abs(da) < 0.15, 'rota nie obróciła się w wskazaną stronę: różnica ' + da.toFixed(2) + ' rad');
  assert.strictEqual(c.fcols, 25);
  // szyk jest wyraźnie szeroki wzdłuż osi prostopadłej do kierunku (kierunek = w dół, więc szerokość wzdłuż x)
  const xs = c.ants.filter((i) => sim.alive[i]).map((i) => sim.x[i]), w = Math.max(...xs) - Math.min(...xs);
  assert.ok(w > 24 * 9, 'szyk nie jest szeroki: ' + w.toFixed(0));
  return 'kierunek: różnica ' + da.toFixed(3) + ' rad, szerokość szyku ' + w.toFixed(0) + ' jedn. przy 25 kolumnach';
});

test('plujka jest jednostką dystansową: pociski kwasu są zapisywane jako efekty, lecą ponad swoimi i mają cel poza zasięgiem kontaktu', () => {
  const sim = make(1, 192); let shot = null;
  for (let k = 0; k < 20 * 300 && !shot; k++) { sim.step(); shot = sim.fx.find((e) => e.k === 'acid'); }
  assert.ok(shot, 'w 300 s żadna plujka nie strzeliła');
  const d = Math.hypot(shot.x1 - shot.x0, shot.y1 - shot.y0);
  assert.ok(d > 20 && d <= sim.T.range[sim.ti.plujka] + 1, 'dystans strzału ' + d.toFixed(0) + ' poza zasięgiem plujki');
  return 'pierwszy strzał kwasu po ' + (shot.t / 20).toFixed(1) + ' s, dystans ' + d.toFixed(0) + ' (zasięg ' + sim.T.range[sim.ti.plujka] + ')';
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
  const changes = ev.filter((e) => /morale spadło|morale na zerze/.test(e.text) && !/odzyskała/.test(e.text));
  assert.ok(changes.length > 0, 'żadna rota nie osłabła ani nie straciła kontroli w 400 s');
  assert.ok(changes.every((e) => /przyczyna:/.test(e.text) || /\)$/.test(e.text)), 'zdarzenie bez przyczyny');
  const lost = changes.filter((e) => /morale na zerze/.test(e.text));
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

// ---------- etap 1: typy mapy ----------
const SIDEN = ['WK', 'LH'];
function makeMap(map, seed, mod) { const { Sim, defs } = loadP1(); if (mod) mod(defs); return Sim.create({ defs, seed, map }); }
const avgOf = (a) => a.reduce((x, y) => x + y, 0) / a.length;
// flood fill 8-kierunkowy (bez ścinania narożników) od komórki; używany do sprawdzania osiągalności
function reachableFrom(sim, x, y) {
  const C = sim.CELL, COLS = sim.COLS, ROWS = sim.ROWS, g = sim.grid, seen = new Uint8Array(COLS * ROWS);
  const bl = (i) => g[i] === 1 || g[i] === 3 || g[i] === 4 || g[i] === 5 || g[i] === 6 || g[i] === 7;
  let s = Math.floor(y / C) * COLS + Math.floor(x / C); const q = [s]; seen[s] = 1;
  for (let h = 0; h < q.length; h++) {
    const c = q[h] % COLS, r = (q[h] / COLS) | 0;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
      const nx = c + dx, ny = r + dy; if (nx < 0 || ny < 0 || nx >= COLS || ny >= ROWS) continue;
      const ni = ny * COLS + nx; if (seen[ni] || bl(ni)) continue;
      if (dx && dy && (bl(r * COLS + nx) || bl(ny * COLS + c))) continue;
      seen[ni] = 1; q.push(ni);
    }
  }
  return (px, py) => seen[Math.floor(py / C) * COLS + Math.floor(px / C)] === 1;
}

test('typ mapy 3 to dotychczasowa mapa: ten sam teren i ten sam przebieg co przed etapem 1', () => {
  // skróty zapisane przed wprowadzeniem typów mapy (siatka terenu i stan po 600 krokach); dla szerokości 192 przeliczone po zmianie: w oblężeniu uzupełnienia ma tylko obrońca
  const base = { '1:64': ['-2668302', 'd83a32c0'], '1:192': ['-1695179022', '36d141ed'], '7:64': ['1221057424', '4405f5b1'], '7:192': ['-471453296', '575f40d9'] };
  for (const key in base) {
    const [seed, passage] = key.split(':').map(Number), sim = make(seed, passage, (d) => { d.params.visibility.on = false; d.params.facing.on = false; d.params.elevation.on = false; d.params.combat.on = false; d.params.morale.spec = false; d.params.reaction.on = false; d.units.plujka.range = 80; }); // mechaniki etapów 4 i B wyłączone, dawny zasięg plujki: stary rdzeń bez zmian
    let h = 0; for (let i = 0; i < sim.grid.length; i++) h = (Math.imul(h, 31) + sim.grid[i]) | 0;
    for (let k = 0; k < 600; k++) sim.step();
    assert.strictEqual(String(h), base[key][0], 'teren zmienił się dla ' + key);
    assert.strictEqual(sim.hash(), base[key][1], 'przebieg zmienił się dla ' + key);
  }
  return 'siatka i skrót stanu po 600 krokach identyczne dla 4 przypadków';
});

test('pięć typów mapy różni się strukturą: otwarty teren i najwęższe miejsce maleją, kręta droga i przekrój rosną', () => {
  const rows = {};
  for (const map of [1, 2, 3, 4, 5]) {
    const ms = [1, 2, 3, 4, 5, 6].map((seed) => makeMap(map, seed)); const m = ms.map((x) => x.mapInfo.metrics);
    rows[map] = { open: avgOf(m.map((x) => x.open)), bn: avgOf(m.map((x) => x.bottleneck)), tort: avgOf(m.map((x) => x.tortuosity)), area: avgOf(ms.map((x) => { let f = 0; for (const v of x.grid) if (v === 0 || v === 2) f++; return f * 256; })) };
  }
  for (let t = 2; t <= 5; t++) {
    assert.ok(rows[t].open <= rows[t - 1].open + 0.005, 'otwarty teren rośnie przy typie ' + t);
    assert.ok(rows[t].bn <= rows[t - 1].bn + 1, 'najwęższe miejsce rośnie przy typie ' + t);
    assert.ok(rows[t].tort >= rows[t - 1].tort - 0.005, 'kręta droga maleje przy typie ' + t);
  }
  assert.ok(rows[1].bn >= 150 && rows[2].bn >= 150, 'mapy otwarte mają wąskie gardła');
  assert.ok(rows[4].bn < rows[3].bn * 0.6 && rows[5].bn < rows[4].bn * 0.8, 'typy 4 i 5 nie są wyraźnie węższe');
  assert.ok(rows[5].open < rows[3].open - 0.1 && rows[5].tort > rows[3].tort + 0.2, 'typ 5 nie jest wyraźnie gęstszy i bardziej kręty od typu 3');
  for (const t of [1, 2, 3, 4, 5]) assert.ok(rows[t].area > 2.0e6 && rows[t].area < 3.6e6, 'powierzchnia do chodzenia typu ' + t + ' = ' + rows[t].area);
  return Object.keys(rows).map((t) => t + ': otwarte ' + (rows[t].open * 100).toFixed(0) + '%, gardło ' + rows[t].bn.toFixed(0) + ', kręta ' + rows[t].tort.toFixed(2)).join(' | ');
});

test('generator: 25 ziaren na typ daje mapy osiągalne, z wolnymi strefami rot i minimalną szerokością trasy', () => {
  let worst = 1e9, retries = 0, n = 0;
  for (const map of [1, 2, 4, 5]) for (let seed = 1; seed <= 25; seed++) {
    const sim = makeMap(map, seed), mi = sim.mapInfo, m = mi.metrics, mt = sim.defs.world.mapTypes[map];
    assert.ok(m.reachable, 'brak trasy: mapa ' + map + ' ziarno ' + seed);
    if (mt.minWidth) { assert.ok(m.bottleneck >= mt.minWidth, 'trasa za wąska: mapa ' + map + ' ziarno ' + seed + ' ' + m.bottleneck); worst = Math.min(worst, m.bottleneck); }
    retries += mi.attempts - 1; n++;
    const reach = reachableFrom(sim, sim.defs.world.nest[0] - 130, sim.defs.world.nest[1]);
    assert.ok(reach(sim.defs.world.nest[0], sim.defs.world.nest[1]), 'wnętrze gniazda nieosiągalne: mapa ' + map + ' ziarno ' + seed);
    for (const c of sim.comps) assert.ok(reach(c.ax, c.ay), 'rota ' + c.name + ' (' + SIDEN[c.side] + ') stoi w miejscu nieosiągalnym: mapa ' + map + ' ziarno ' + seed);
    const bad = sim.comps.filter((c) => { for (const i of c.ants) if (sim.grid[Math.floor(sim.y[i] / 16) * sim.COLS + Math.floor(sim.x[i] / 16)] > 0 && sim.grid[Math.floor(sim.y[i] / 16) * sim.COLS + Math.floor(sim.x[i] / 16)] !== 2) return true; return false; });
    assert.strictEqual(bad.length, 0, 'mrówki startują w ścianach: mapa ' + map + ' ziarno ' + seed);
  }
  return n + ' map, najwęższa trasa ' + worst.toFixed(0) + ', powtórzeń losowania: ' + retries;
});

test('mapy bez głównego przesmyku: odźwierni stają jako zwykła linia (nie zamykają), mapa z przesmykiem zachowuje plug', () => {
  for (const map of [1, 2, 4, 5]) {
    const sim = makeMap(map, 1);
    assert.ok(!sim.comps.some((c) => c.role === 'plug' || c.closed), 'mapa ' + map + ' ma zamknięty plug');
    assert.ok(sim.comps.some((c) => c.role === 'line' && c.name === 'Rota odźwiernych'), 'mapa ' + map + ' bez linii odźwiernych');
  }
  const sim3 = makeMap(3, 1); assert.ok(sim3.comps.some((c) => c.role === 'plug' && c.closed));
  return 'typy 1, 2, 4, 5: linia obrony; typ 3: plug zamykający przesmyk';
});

test('układ rot jest przesunięty razem z gniazdem: atakujący przy zachodnim brzegu, obrońcy przy gnieździe na każdej mapie', () => {
  for (const map of [1, 2, 3, 4, 5]) {
    const sim = makeMap(map, 1), nest = sim.defs.world.nest;
    assert.ok(Math.abs(nest[0] - (sim.W - 200)) < 1e-6 && Math.abs(nest[1] - sim.H / 2) < 1e-6, 'gniazdo nie jest na wschodzie, w połowie wysokości: mapa ' + map);
    for (const c of sim.comps) {
      if (c.side === 0) assert.ok(c.ax < 500 && Math.abs(c.ay - sim.H / 2) < 520, 'WK poza strefą startu: ' + c.name + ' ' + c.ax + ',' + c.ay);
      else assert.ok(c.ax > nest[0] - 1000 && c.ax < nest[0] + 100 && Math.abs(c.ay - nest[1]) < 300, 'LH poza strefą obrony: ' + c.name + ' ' + c.ax + ',' + c.ay);
    }
  }
  return 'sprawdzono 5 typów map';
});

test('determinizm na mapach z korytarzami (ścieżka za kotwicą): to samo ziarno daje ten sam skrót mapy i przebiegu, inne ziarno inny', () => {
  const out = [];
  for (const map of [4, 5]) {
    const hashOf = (seed) => { const sim = makeMap(map, seed); let g = 0; for (let i = 0; i < sim.grid.length; i++) g = (Math.imul(g, 31) + sim.grid[i]) | 0; for (let k = 0; k < 600; k++) sim.step(); return g + ':' + sim.hash(); };
    const a = hashOf(3), b = hashOf(3), c = hashOf(4);
    assert.strictEqual(a, b, 'mapa ' + map + ': to samo ziarno dało różne wyniki');
    assert.notStrictEqual(a, c, 'mapa ' + map + ': inne ziarno dało ten sam wynik');
    out.push('mapa ' + map + ': ' + a.split(':')[1]);
  }
  return out.join(', ');
});

test('uzupełnienia: ma je tylko obrońca w oblężeniu, w Bitwie i Przeprawie nikt', () => {
  const at = (scen) => { const sim = makeScen(scen, 3, 1); return { WK: sim.reserve.WK, LH: sim.reserve.LH }; };
  assert.deepStrictEqual(at('oblezenie'), { WK: 0, LH: 150 }); assert.deepStrictEqual(at('bitwa'), { WK: 0, LH: 0 }); assert.deepStrictEqual(at('przeprawa'), { WK: 0, LH: 0 });
  const sim = makeScen('oblezenie', 3, 1); const wk0 = sim.count_alive()[0]; let maxWK = wk0; for (let k = 0; k < 20 * 200; k++) { sim.step(); maxWK = Math.max(maxWK, sim.count_alive()[0]); } assert.strictEqual(maxWK, wk0, 'atakujący dostaje uzupełnienia w oblężeniu');
  for (const sc of ['bitwa', 'przeprawa']) { const b = makeScen(sc, 3, 1), n0 = b.count; for (let k = 0; k < 20 * 120; k++) b.step(); assert.strictEqual(b.count, n0, 'w scenariuszu ' + sc + ' pojawiły się uzupełnienia'); }
  return 'rezerwa w oblężeniu: WK 0, LH 150; w Bitwie i Przeprawie 0, po 120 s nikt nie dołączył';
});

test('poprawki po przeglądzie: mapy 4 i 5 zawsze spełniają minimalną szerokość, duża lekka armia nie rzuca wyjątku, rota przed brodem nie zostaje pod wodą', () => {
  let n = 0; for (const map of [4, 5]) for (let seed = 1; seed <= 40; seed++) { const sim = makeMap(map, seed); assert.ok(sim.mapInfo.widthOk, 'mapa ' + map + ' ziarno ' + seed + ': trasa węższa niż minWidth'); n++; }
  const { Sim, defs } = loadP1(); for (const scen of ['oblezenie', 'bitwa']) for (const side of ['WK', 'LH']) { const sim = makeArmy(scen, 3, 1, 'duzy', { styles: { [side]: 'lekka' } }); assert.ok(sim.armyInfo[side].cost <= sim.armyInfo[side].budget); }
  // przeprawa: po 80 s żadna mrówka rot, których kotwica jest już za potokiem, nie tkwi przy krawędzi wody z dala od brodów (wcześniej tkwiły, bo omijanie zależało od widoczności, a woda nie zasłania widoku)
  const sim = makeScen('przeprawa', 3, 1), cx = sim.W - 1180, F = sim.defs.world.fords; let stranded = 0, past = 0;
  for (let k = 0; k < 20 * 80; k++) sim.step();
  for (const c of sim.comps) if (c.side === 0 && c.ax > cx + 20) for (const i of c.ants) if (sim.alive[i]) { past++; const fy = Math.min(...F.map((f) => Math.abs(sim.y[i] - f.y))); if (sim.x[i] < cx - 85 && sim.x[i] > cx - 150 && fy > 150) stranded++; }
  assert.ok(past > 100 && stranded <= 2, 'przy wodzie z dala od brodów utknęło ' + stranded + ' z ' + past);
  return n + ' map 4 i 5 z poprawną szerokością; lekka armia na Dużym bez wyjątku; po 80 s przy wodzie z dala od brodów utknęło ' + stranded + ' z ' + past + ' mrówek rot za potokiem';
});

// ---------- etap 4: elewacja, balistyka, widoczność, ciosy z tyłu ----------
const flat = (sim) => sim.height.fill(0);
function openSpot(sim, x, y, r) { // sprawdza, że w promieniu r nie ma ściany (dla ustawiania mrówek ręcznie)
  for (let a = 0; a < 16; a++) for (const rr of [r / 2, r]) { const px = x + Math.cos(a * Math.PI / 8) * rr, py = y + Math.sin(a * Math.PI / 8) * rr; const g = sim.grid[Math.floor(py / 16) * sim.COLS + Math.floor(px / 16)]; if (g !== 0 && g !== 2) return false; }
  return true;
}
function antOf(sim, side, type) { for (let i = 0; i < sim.count; i++) if (sim.side[i] === side && sim.names[sim.type[i]] === type) return i; return -1; }
function put(sim, i, x, y, heading) { sim.x[i] = x; sim.y[i] = y; if (heading != null) sim.heading[i] = heading; }

test('balistyka: zasięg z różnicy wysokości zgodny ze wzorem R = R0 sqrt(1 + 2 dh / R0), kąt dowolny, cel o 40 wyżej poza zasięgiem', () => {
  const { Sim } = loadP1(), B = Sim.ballistic; const reach = (dh) => { let lo = 0; for (let d = 1; d <= 140; d += 0.5) if (B(80, 1, d, dh)) lo = d; return lo; };
  assert.ok(Math.abs(reach(0) - 80) <= 1, 'płaski zasięg ' + reach(0));
  assert.ok(Math.abs(reach(-20) - 80 * Math.sqrt(1 - 0.5)) > 0 && Math.abs(reach(-20) - 98) <= 1.5, 'strzał z góry o 20: ' + reach(-20));
  assert.ok(Math.abs(reach(20) - 57) <= 1.5, 'strzał pod górę o 20: ' + reach(20));
  assert.strictEqual(B(80, 1, 5, 40), null, 'cel 40 wyżej powinien być poza zasięgiem');
  const sol = B(80, 1, 50, 0); assert.ok(Math.atan(sol[0]) < Math.PI / 4 && Math.atan(sol[1]) > Math.PI / 4, 'tor niski poniżej 45 stopni, stromy powyżej');
  const d = 40; assert.ok(Math.abs(Math.atan(B(80, 1, d, 0)[0]) + Math.atan(B(80, 1, d, 0)[1]) - Math.PI / 2) < 1e-9, 'kąty uzupełniają się do 90 stopni na płaskim');
  return 'zasięg płaski ' + reach(0) + ', z góry o 20: ' + reach(-20) + ', pod górę o 20: ' + reach(20) + ', cel 40 wyżej: poza zasięgiem';
});

test('strzał kwasem: wzgórze blokuje tor niski, stromy przechodzi nad nim, zbyt wysokie blokuje oba, wyższa pozycja daje dalszy zasięg', () => {
  const sim = makeScen('bitwa', 2, 1, (d) => { d.units.plujka.range = 80; }), p = antOf(sim, 1, 'plujka'), t = antOf(sim, 0, 'infantry');   // geometria testu zakłada zasięg 80 (domyślny jest większy)
  assert.ok(sim.hills && p >= 0 && t >= 0); flat(sim); const C = sim.COLS;
  let X = 0, Y = 0; for (let y = 300; y < 900 && !X; y += 40) for (let x = 560; x < 880 && !X; x += 16) if (openSpot(sim, x, y, 110)) { X = Math.floor(x / 16) * 16 + 8; Y = Math.floor(y / 16) * 16 + 8; }
  assert.ok(X, 'brak otwartego miejsca');
  const k = Math.floor(X / 16), row = Math.floor(Y / 16), setH = (c0, c1, h) => { for (let r = row - 5; r <= row + 5; r++) for (let c = c0; c <= c1; c++) sim.height[r * C + c] = h; };
  // mrówki stoją dokładnie w środkach komórek (wysokość tam równa wartości komórki), cel 64 dalej
  put(sim, p, X, Y); put(sim, t, X + 64, Y); assert.ok(sim.shotApex(p, t) >= 0, 'płaski strzał na 64 powinien być możliwy');
  setH(k + 1, k + 3, 22); const ap = sim.shotApex(p, t); assert.ok(ap > 22, 'stromy tor powinien przejść nad wzgórzem 22 (wierzchołek ' + ap + ')');
  setH(k + 1, k + 3, 48); assert.strictEqual(sim.shotApex(p, t), -1, 'wzgórze 48 (powyżej najwyższego toru 36 + oczy) powinno zablokować oba tory');
  setH(k + 1, k + 3, 0); put(sim, t, X + 90, Y); assert.strictEqual(sim.shotApex(p, t), -1, 'na płaskim 90 jest poza zasięgiem 80');
  setH(k - 2, k + 2, 20); assert.ok(sim.shotApex(p, t) >= 0, 'z wzgórza o 20 zasięg powinien sięgać 90 (wzór: ok. 98)');
  put(sim, p, X + 90, Y); put(sim, t, X, Y); assert.strictEqual(sim.shotApex(p, t), -1, 'pod górę o 20 zasięg to ok. 59, cel na 90 poza zasięgiem');
  return 'płasko 64: ok; wzgórze 22: tor stromy (wierzchołek ' + ap.toFixed(1) + '); wzgórze 48: blokada obu torów; z wzgórza +20 sięga 90; pod górę 90 nie';
});

test('elewacja: pod górę wolniej i bardziej męcząco, z góry szybciej i mniej; mnożniki w granicach', () => {
  const sim = makeScen('bitwa', 2, 1); assert.ok(sim.hills);
  assert.strictEqual(sim.slopeMul(0), 1); assert.ok(sim.slopeMul(0.2) < 1 && sim.slopeMul(0.2) >= 0.45 && sim.slopeMul(-0.2) > 1 && sim.slopeMul(-0.2) <= 1.35 && sim.slopeMul(0.5) >= 0.45 && sim.slopeMul(-0.9) <= 1.35);
  // ta sama rota idzie 150 jednostek z góry i z powrotem pod górę po tym samym zboczu
  const hill = () => {
    for (let y = 120; y < sim.H - 120; y += 16) for (let x = 560; x < sim.W - 560; x += 16) { const gx = sim.slopeAt(x, y, 1, 0), gy = sim.slopeAt(x, y, 0, 1), m = Math.hypot(gx, gy); if (m < 0.1) continue; const dx = -gx / m, dy = -gy / m; let ok = true; for (let k = -120; k <= 120; k += 20) if (!openSpot(sim, x + dx * k, y + dy * k, 50)) ok = false; if (ok && sim.slopeAt(x - dx * 75, y - dy * 75, dx, dy) < -0.04 && sim.slopeAt(x + dx * 75, y + dy * 75, dx, dy) < -0.04) return { x, y, dx, dy }; }
    return null;
  };
  const h = hill(); assert.ok(h, 'brak zbocza do testu');
  const walk = (dir) => {
    const { Sim, defs } = loadP1(); defs.units.dummy = { name: 'M', hp: 1e9, speed: 1, dmg: 0, reach: 1, cd: 1, aggro: 0, radius: 4, mass: 1, rank: 2, armor: 0, size: 0.5 };
    defs.params.visibility.on = false; defs.scenario.sides.LH.companies = [{ role: 'reserve', at: [1900, 1150], units: { dummy: 3 } }]; defs.scenario.sides.LH.reserve = 0;
    const s2 = Sim.create({ defs, seed: 1, map: 2, scenario: 'bitwa', aiSides: [] }), c = s2.comps[0], x0 = h.x - dir * h.dx * 75, y0 = h.y - dir * h.dy * 75, x1 = h.x + dir * h.dx * 75, y1 = h.y + dir * h.dy * 75;
    c.ax = x0; c.ay = y0; c.delayTick = 0; c.face = Math.atan2(y1 - y0, x1 - x0); c.fx = Math.cos(c.face); c.fy = Math.sin(c.face);
    for (const i of c.ants) { s2.x[i] = x0 + (Math.random() * 0 + (i % 5) * 3); s2.y[i] = y0 + ((i / 5 | 0) % 5) * 3; }
    c.order = { kind: 'hold', x: x0, y: y0, face: null };
    for (const o of s2.comps) if (o !== c) o.order = { kind: 'hold', x: o.ax, y: o.ay };
    for (let k = 0; k < 20 * 8; k++) s2.step();   // szyk zbiera się w miejscu startu
    c.order = { kind: 'move', x: x1, y: y1, face: null }; c.fatigue = 0;
    let t = 0; for (; t < 20 * 40; t++) { s2.step(); if (Math.hypot(c.ax - x1, c.ay - y1) < 4) break; } return { t: t / 20, fat: c.fatigue };
  };
  const down = walk(1), up = walk(-1);
  assert.ok(up.t > down.t * 1.15, 'pod górę ' + up.t + ' s, z góry ' + down.t + ' s'); assert.ok(up.fat > down.fat, 'zmęczenie pod górę ' + up.fat.toFixed(2) + ', z góry ' + down.fat.toFixed(2));
  return 'zbocze 150 jedn.: z góry ' + down.t.toFixed(1) + ' s (zmęczenie ' + down.fat.toFixed(1) + '), pod górę ' + up.t.toFixed(1) + ' s (' + up.fat.toFixed(1) + ')';
});

test('widoczność: promień 125, mech ukrywa (28), wzgórze zasłania, atak ujawnia, niewidocznego nie da się namierzyć', () => {
  const sim = makeScen('bitwa', 2, 1); flat(sim); const C = sim.COLS;
  const o = (() => { for (let i = 0; i < sim.count; i++) if (sim.side[i] === 0 && i % 4 === 0) return i; })(), tg = antOf(sim, 1, 'infantry');
  let X = 0, Y = 0; for (let y = 200; y < 1000 && !X; y += 40) for (let x = 560; x < 880 && !X; x += 20) if (openSpot(sim, x, y, 160)) { X = x; Y = y; }
  assert.ok(X, 'brak otwartego miejsca');
  const upd = () => sim.debug.vis(); // natychmiastowa aktualizacja widoczności bez kroku symulacji (mrówki stoją tam, gdzie je ustawiono)
  // pozostałe mrówki daleko, żeby nie przeszkadzały
  for (let i = 0; i < sim.count; i++) if (i !== o && i !== tg) put(sim, i, sim.side[i] === 0 ? 100 + (i % 20) : 1900 + (i % 20), 1100 + (i % 10));
  for (const c of sim.comps) { c.order = { kind: 'hold', x: c.ax, y: c.ay }; }
  put(sim, o, X, Y); put(sim, tg, X + 100, Y); upd(); assert.ok(sim.visibleTo(0, tg), 'wróg 100 od obserwatora na otwartym terenie powinien być widoczny');
  put(sim, tg, X + 150, Y); upd(); assert.ok(!sim.visibleTo(0, tg), 'wróg 150 od obserwatora jest poza promieniem 125');
  // mech: ukrywa z daleka, ujawnia z bliska
  let mx = -1, my = -1; for (let r = 5; r < sim.ROWS - 5 && mx < 0; r++) for (let c = 40; c < sim.COLS - 40; c++) if (sim.grid[r * C + c] === 2 && sim.grid[r * C + c + 1] === 2 && sim.grid[(r + 1) * C + c] === 2) { mx = (c + 0.5) * 16; my = (r + 0.5) * 16; break; }
  assert.ok(mx > 0, 'brak mchu'); put(sim, tg, mx, my); put(sim, o, mx - 60, my); upd(); assert.ok(!sim.visibleTo(0, tg), 'mrówka na mchu widoczna z 60');
  put(sim, o, mx - 20, my); upd(); assert.ok(sim.visibleTo(0, tg), 'mrówka na mchu niewidoczna z 20');
  put(sim, o, mx - 60, my); upd(); assert.ok(!sim.visibleTo(0, tg)); sim.debug.hit(tg, o, 1, true); assert.ok(sim.visibleTo(0, tg), 'mrówka, która zaatakowała, powinna być ujawniona');
  for (let k = 0; k < 20 * 4; k++) sim.step(); // po revealSec (3 s) znowu ukryta (mrówki się ruszą, więc ustawiamy je od nowa)
  put(sim, tg, mx, my); put(sim, o, mx - 60, my); upd(); assert.ok(!sim.visibleTo(0, tg), 'ujawnienie powinno wygasnąć po 3 s');
  // wzgórze zasłania widok
  put(sim, tg, X + 100, Y); put(sim, o, X, Y); upd(); assert.ok(sim.visibleTo(0, tg));
  const cx = Math.floor((X + 50) / 16); for (let r = Math.floor((Y - 90) / 16); r <= Math.floor((Y + 90) / 16); r++) for (let c = cx - 1; c <= cx + 1; c++) sim.height[r * C + c] = 40;
  upd(); assert.ok(!sim.visibleTo(0, tg), 'wzgórze powinno zasłonić widok'); 
  // namierzanie: bliski wróg za wzgórzem lub w niewidoczności nie jest celem
  put(sim, o, X, Y); put(sim, tg, X + 20, Y); for (let r = Math.floor((Y - 40) / 16); r <= Math.floor((Y + 40) / 16); r++) sim.height[r * C + Math.floor((X + 10) / 16)] = 40; upd();
  assert.strictEqual(sim.debug.acquire(o, 40, sim.comps[sim.comp[o]]), -1, 'acquire nie powinno wskazać wroga za wzgórzem');
  flat(sim); upd(); assert.strictEqual(sim.debug.acquire(o, 40, sim.comps[sim.comp[o]]), tg, 'bez wzgórza wróg 20 dalej jest celem');
  return 'promień 125, mech 28, atak ujawnia na 3 s, wzgórze zasłania widok i namierzanie';
});

test('ciosy: z tyłu x1,5, z boku x1,25, z przodu x1', () => {
  const sim = makeScen('bitwa', 2, 1, (dd) => { dd.params.combat.hitBase = 100; dd.params.combat.hitMax = 100; }); flat(sim);   // trafienie pewne: test mierzy tylko mnożnik kierunku
  const a = antOf(sim, 0, 'infantry'), d = antOf(sim, 1, 'infantry'); let X = 0, Y = 0; for (let y = 200; y < 1000 && !X; y += 40) for (let x = 560; x < 880 && !X; x += 20) if (openSpot(sim, x, y, 60) && sim.grid[Math.floor(y / 16) * sim.COLS + Math.floor(x / 16)] === 0) { X = x; Y = y; }
  const avg = (deg) => { let tot = 0; const N = 400; for (let k = 0; k < N; k++) { sim.hp[d] = 1e6; put(sim, d, X, Y, 0); put(sim, a, X + Math.cos(deg * Math.PI / 180) * 6, Y + Math.sin(deg * Math.PI / 180) * 6); sim.comps[sim.comp[a]].fatigue = 0; sim.debug.hit(a, d, 2, true); tot += 1e6 - sim.hp[d]; } return tot / N; };
  const front = avg(0), flank = avg(90), rear = avg(180), diag = avg(30);
  assert.ok(Math.abs(flank / front - 1.25) < 0.06, 'flanka ' + (flank / front).toFixed(3)); assert.ok(Math.abs(rear / front - 1.5) < 0.07, 'tył ' + (rear / front).toFixed(3)); assert.ok(Math.abs(diag / front - 1) < 0.06, 'kąt 30 stopni to wciąż przód');
  return 'przód ' + front.toFixed(2) + ', flanka x' + (flank / front).toFixed(2) + ', tył x' + (rear / front).toFixed(2);
});

test('AI gra uczciwie: bez widocznych wrogów nadal idzie do przodu (cel zastępczy), a bitwa na mapie ze wzgórzami jest deterministyczna', () => {
  const sim = makeScen('bitwa', 4, 3); for (let k = 0; k < 20 * 20; k++) sim.step();
  const att = sim.comps.filter((c) => c.role === 'assault' && c.alive > 0 && c.delay <= 5); assert.ok(att.length && att.every((c) => c.order.kind === 'attack'), 'WK bez widocznych wrogów nie atakuje: ' + att.map((c) => c.order.kind));
  const lh = sim.comps.filter((c) => c.side === 1 && c.role !== 'artillery' && !c.startBy.dowodca && c.alive > 0); assert.ok(lh.every((c) => c.order.kind === 'attack'), 'LH nie idzie do przodu');
  const h = (seed) => { const s2 = makeScen('bitwa', 4, seed); for (let k = 0; k < 600; k++) s2.step(); return s2.hash(); };
  assert.strictEqual(h(5), h(5)); assert.notStrictEqual(h(5), h(6));
  return 'rozkazy ataku bez widocznych wrogów; skrót ze wzgórzami i mgłą powtarzalny';
});

test('wydajność ze wzgórzami i widocznością: krok symulacji przy ok. 4500 mrówek na mapie ze wzgórzami (czas w piaskownicy)', () => {
  const sim = makeScen('bitwa', 2, 1, (d) => { for (const s of ['WK', 'LH']) for (const c of d.scenario.sides[s].companies) for (const k in c.units) if (k !== 'dowodca' && k !== '@guard') c.units[k] = Math.round(c.units[k] * 2.3); });
  const n = sim.count; assert.ok(sim.hills && n >= 3500 && n <= 4800, 'mrówek ' + n);
  const times = []; for (let k = 0; k < 20 * 40; k++) { const t0 = process.hrtime.bigint(); sim.step(); times.push(Number(process.hrtime.bigint() - t0) / 1e6); }
  times.sort((a, b) => a - b); const med = times[times.length >> 1], p99 = times[Math.floor(times.length * 0.99)];
  assert.ok(med < 50, 'mediana kroku ' + med.toFixed(1) + ' ms przekracza budżet 50 ms');
  return n + ' mrówek: mediana ' + med.toFixed(2) + ' ms, p99 ' + p99.toFixed(2) + ' ms, max ' + times[times.length - 1].toFixed(1) + ' ms';
});

function dummyDefenders(d) {
  for (const c of d.scenario.sides.WK.companies) for (const k in c.units) if (k !== 'dowodca' && k !== '@guard') c.units[k] = Math.round(c.units[k] * 0.6); // mniejsze roty: test sprawdza nawigację, nie przepustowość
  d.units.dummy = { name: 'Manekin', hp: 1e9, speed: 1, dmg: 0, reach: 1, cd: 1, aggro: 0, radius: 4, mass: 1, rank: 2, armor: 0, size: 0.5 };
  d.scenario.sides.LH.companies = [{ role: 'reserve', at: [1800, 600], units: { dummy: 3 } }]; d.scenario.sides.LH.reserve = 0;
}
test('nawigacja: bez obrony atakujący docierają do gniazda na mapach krętej i bardzo gęstej, nikt nie stoi w ścianie', () => {
  const out = [];
  for (const [map, tmax, need] of [[4, 400, 0.9], [5, 450, 0.9]]) {
    const sim = makeMap(map, 1, dummyDefenders), nest = sim.defs.world.nest; let wall = 0, tReach = null;
    const near = () => { let a = 0, t = 0; for (let i = 0; i < sim.count; i++) if (sim.alive[i] && sim.side[i] === 0) { t++; if (Math.hypot(sim.x[i] - nest[0], sim.y[i] - nest[1]) < 250) a++; } return a / t; };
    for (let k = 0; k < tmax * 20; k++) {
      sim.step(); if (sim.result) sim.result = null; // zakończenie bitwy nie jest tu celem
      if (k % 100 === 0) { for (let i = 0; i < sim.count; i++) if (sim.alive[i]) { const g = sim.grid[Math.floor(sim.y[i] / 16) * sim.COLS + Math.floor(sim.x[i] / 16)]; if (g === 1 || g === 3 || g === 4 || g === 5 || g === 6 || g === 7) wall++; } if (tReach === null && near() >= need) tReach = k / 20; }
    }
    assert.strictEqual(wall, 0, 'mrówki w ścianach na mapie ' + map);
    assert.ok(tReach !== null, 'mapa ' + map + ': mniej niż ' + need * 100 + '% atakujących doszło do gniazda w ' + tmax + ' s (doszło ' + (near() * 100).toFixed(0) + '%)');
    out.push('mapa ' + map + ': ' + need * 100 + '% przy gnieździe po ' + tReach + ' s');
  }
  return out.join('; ');
});

// ---------- etap 2: scenariusze ----------
function makeScen(scenario, map, seed, mod) { const { Sim, defs } = loadP1(); if (mod) mod(defs); return Sim.create({ defs, seed, map, scenario }); }
const ringCells = (sim) => { let n = 0; for (const v of sim.grid) if (v === 3) n++; return n; };

test('scenariusze: oblężenie ma gniazdo z murem (domyślne), bitwa i przeprawa go nie mają', () => {
  assert.strictEqual(make(1).scenarioInfo.id, 'oblezenie');
  assert.ok(ringCells(makeScen('oblezenie', 3, 1)) > 20, 'oblężenie bez muru gniazda');
  assert.strictEqual(ringCells(makeScen('bitwa', 3, 1)), 0); assert.strictEqual(ringCells(makeScen('przeprawa', 3, 1)), 0);
  assert.throws(() => makeScen('nieznany', 3, 1), /scenariusz/i);
  return 'mur gniazda: oblężenie ' + ringCells(makeScen('oblezenie', 3, 1)) + ' komórek, bitwa 0, przeprawa 0';
});

test('postawa AI: w bitwie obie strony idą na siebie, w oblężeniu i przeprawie obrońca trzyma pozycję', () => {
  const lhOrders = (scen, sec) => { const sim = makeScen(scen, 2, 1); for (let k = 0; k < 20 * sec; k++) sim.step(); return sim.comps.filter((c) => c.side === 1 && c.role !== 'artillery' && !c.startBy.dowodca && c.alive > 0).map((c) => c.order.kind); };
  const b = lhOrders('bitwa', 30), o = lhOrders('oblezenie', 6), p = lhOrders('przeprawa', 6);   // obrońca trzyma pozycję, dopóki nie zobaczy słabszego wroga w pobliżu (kontratak)
  assert.ok(b.length && b.every((k) => k === 'attack'), 'w bitwie LH nie atakuje: ' + b);
  assert.ok(o.every((k) => k === 'hold') && p.every((k) => k === 'hold'), 'obrońca nie trzyma pozycji: ' + o + ' / ' + p);
  for (const map of [2, 3]) { const sim = makeScen('bitwa', map, 1); assert.ok(!sim.comps.some((c) => c.closed || c.role === 'plug'), 'bitwa na mapie ' + map + ' ma zamknięty plug'); }
  assert.ok(makeScen('oblezenie', 3, 1).comps.some((c) => c.role === 'plug' && c.closed), 'oblężenie na mapie 3 straciło plug');
  return 'LH w bitwie: ' + b[0] + ' (bez plugu także na mapie 3); w oblężeniu i przeprawie: ' + o[0];
});

test('warunki końca: bitwa i przeprawa kończą się zniszczeniem lub większym odsetkiem ocalałych, oblężenie dalej obroną gniazda', () => {
  const short = (d) => { d.world.timeLimit = 30; };
  for (const scen of ['bitwa', 'przeprawa']) {
    const sim = makeScen(scen, 2, 1, short); for (let k = 0; k < 20 * 40 && !sim.result; k++) sim.step();
    const r = sim.result, a = sim.count_alive(), st = [0, 0]; for (const c of sim.comps) st[c.side] += c.initial;
    assert.ok(r && /minął czas, więcej ocalałych/.test(r.reason), scen + ': ' + JSON.stringify(r));
    assert.strictEqual(r.winner, a[0] / st[0] > a[1] / st[1] ? 'WK' : 'LH', scen + ': zwycięzca niezgodny z odsetkiem ocalałych');
  }
  const o = makeScen('oblezenie', 3, 1, short); for (let k = 0; k < 20 * 40 && !o.result; k++) o.step();
  assert.ok(o.result && o.result.reason === 'minął czas, obrona utrzymana' && o.result.winner === 'LH');
  const w = makeScen('bitwa', 2, 1, (d) => { for (const c of d.scenario.sides.LH.companies) for (const k in c.units) c.units[k] = k === 'dowodca' ? 1 : Math.max(1, Math.round(c.units[k] * 0.03)); d.scenario.sides.LH.reserve = 0; });
  for (let k = 0; k < 20 * 400 && !w.result; k++) w.step();
  assert.ok(w.result && w.result.winner === 'WK' && w.result.reason === 'zniszczenie przeciwnika', JSON.stringify(w.result));
  return 'upływ czasu i zniszczenie przeciwnika działają w bitwie i przeprawie; oblężenie: obrona utrzymana';
});

test('przeprawa: woda blokuje ruch, kamienie dają trzy przeprawy, a woda nie zasłania strzału', () => {
  const sim = makeScen('przeprawa', 3, 1), W = sim.W, H = sim.H, C = sim.CELL, g = sim.grid, COLS = sim.COLS;
  let water = 0, ford = 0; for (const v of g) { if (v === 7) water++; if (v === 8) ford++; }
  assert.ok(water > 1500 && ford > 100, 'woda ' + water + ', kamienie ' + ford);
  assert.ok(sim.mapInfo.metrics.reachable && sim.mapInfo.metrics.bottleneck >= 44, 'przeprawa nieosiągalna lub za wąska');
  // bez kamieni nie ma przejścia: zamieniamy je na wodę i sprawdzamy, że strefa startu nie sięga strefy obrońców
  const fords = []; for (let i = 0; i < g.length; i++) if (g[i] === 8) { fords.push(i); g[i] = 7; }
  const reach = reachableFrom(sim, 230, H / 2);
  assert.ok(!reach(W - 400, H / 2), 'woda nie blokuje ruchu: obrońcy osiągalni bez kamieni');
  for (const i of fords) g[i] = 8;
  assert.ok(reachableFrom(sim, 230, H / 2)(W - 400, H / 2), 'po przywróceniu kamieni brak przejścia');
  // liczba przepraw: komórki kamieni tworzą trzy rozłączne skupiska wzdłuż potoku
  const seen = new Set(); let groups = 0;
  for (const i0 of fords) if (!seen.has(i0)) { groups++; const q = [i0]; seen.add(i0); for (let h = 0; h < q.length; h++) for (const j of [q[h] + 1, q[h] - 1, q[h] + COLS, q[h] - COLS]) if (g[j] === 8 && !seen.has(j)) { seen.add(j); q.push(j); } }
  assert.strictEqual(groups, 3, 'liczba przepraw: ' + groups);
  // widoczność: strzał przez wodę przechodzi, przez ścianę nie
  let found = null;
  for (let r = 4; r < sim.ROWS - 4 && !found; r++) { let wx = -1; for (let c = 0; c < COLS; c++) if (g[r * COLS + c] === 7) { wx = c; break; } if (wx > 8 && g[r * COLS + wx - 6] === 0 && g[r * COLS + wx + 20] === 0) { let ok = true; for (let c = wx - 6; c <= wx + 20; c++) if (g[r * COLS + c] !== 0 && g[r * COLS + c] !== 7) ok = false; if (ok) found = [(wx - 6) * C, r * C + C / 2, (wx + 20) * C]; } }
  assert.ok(found, 'brak odcinka brzeg-woda-brzeg do testu widoczności');
  assert.ok(sim.losClear(found[0], found[1], found[2], found[1]), 'woda zasłania strzał');
  const wall = sim.losClear(5, 5, 400, 5); assert.ok(!wall, 'brzeg mapy nie zasłania strzału');
  return 'woda ' + water + ' komórek, kamienie ' + ford + ' komórek w ' + groups + ' przeprawach, szerokość najszerszej trasy ' + sim.mapInfo.metrics.bottleneck.toFixed(0);
});

test('przeprawa w grze: atakujący przechodzą potok po kamieniach, nikt nie stoi w wodzie ani w ścianie', () => {
  const sim = makeScen('przeprawa', 3, 1), cxs = W_STREAM(sim); let inWater = 0, over = 0;
  for (let k = 0; k < 20 * 200; k++) {
    sim.step();
    if (k % 20 === 0) for (let i = 0; i < sim.count; i++) if (sim.alive[i]) {
      const v = sim.grid[Math.floor(sim.y[i] / 16) * sim.COLS + Math.floor(sim.x[i] / 16)]; if (v === 7 || v === 1 || v === 3 || v === 4 || v === 5 || v === 6) inWater++;
      if (sim.side[i] === 0 && sim.x[i] > cxs + 110) over++;
    }
  }
  assert.strictEqual(inWater, 0, 'ciała w wodzie lub ścianie: ' + inWater);
  assert.ok(over > 100, 'atakujący nie przeprawiają się (próbki na wschodnim brzegu: ' + over + ')');
  return 'próbki atakujących na drugim brzegu: ' + over + ', w wodzie: 0';
});
function W_STREAM(sim) { return sim.W - 1180; }

test('przeprawa: brody leżą daleko od siebie (osobne starcia), skrajne są szerokie, środkowy wąski, a czas dojścia zależy od prędkości', () => {
  const sim = makeScen('przeprawa', 3, 1), F = sim.defs.world.fords;
  assert.strictEqual(F.length, 3);
  const gaps = [F[1].y - F[0].y, F[2].y - F[1].y]; for (const d of gaps) assert.ok(d >= 1100, 'bród za blisko sąsiedniego: ' + d);
  const sp = (k) => sim.defs.units[k].speed, eta = (d, k) => d / sp(k);
  const d = Math.min(...gaps);
  assert.ok(eta(d, 'biegacz') >= 17, 'biegacz zdąży za szybko: ' + eta(d, 'biegacz'));
  assert.ok(eta(d, 'infantry') >= 35 && eta(d, 'taran') >= 65, 'wojownik/taran zdążą za szybko');
  assert.ok(eta(d, 'taran') / eta(d, 'biegacz') >= 3.5, 'różnica prędkości biegacz/taran za mała');
  // kształt brodów: promienie kamieni skrajnych (58-64) większe niż środkowego (44-48)
  const stones = sim.defs.world.map.obstacles.filter((o) => o.type === 'ford'), rOf = (f) => Math.max(...stones.filter((o) => Math.abs(o.at[1] - f.y) < 40).map((o) => o.r));
  assert.ok(rOf(F[0]) >= 58 && rOf(F[2]) >= 58 && rOf(F[1]) <= 48, 'szerokości brodów: ' + [rOf(F[0]), rOf(F[1]), rOf(F[2])]);
  // armie stoją przy środkowym brodzie: do skrajnych jest daleko także z linii startu
  const wk = sim.comps.filter((c) => c.side === 0), lh = sim.comps.filter((c) => c.side === 1);
  const ay = wk.reduce((a, c) => a + c.ay, 0) / wk.length; assert.ok(Math.abs(ay - F[1].y) < 300, 'WK nie stoi na wysokości środkowego brodu');
  const far = Math.min(Math.hypot(wk[0].ax - F[0].wx, wk[0].ay - F[0].wy), Math.hypot(wk[0].ax - F[2].wx, wk[0].ay - F[2].wy));
  assert.ok(far / sp('infantry') > 45, 'skrajny bród za blisko linii startu');
  return 'odstępy brodów ' + gaps.join(' i ') + ' jedn.; czas przejścia między sąsiednimi: biegacz ' + eta(d, 'biegacz').toFixed(0) + ' s, wojownik ' + eta(d, 'infantry').toFixed(0) + ' s, ciężki ' + eta(d, 'ciezki').toFixed(0) + ' s, taran ' + eta(d, 'taran').toFixed(0) + ' s';
});

test('AI przeprawy: atakujący rozdzielają siły na kilka brodów, obrońcy przerzucają rezerwy tam, gdzie rośnie zagrożenie', () => {
  const sim = makeScen('przeprawa', 3, 1); const F = sim.defs.world.fords;
  for (let k = 0; k < 20 * 150; k++) sim.step();
  const wkF = new Set(sim.comps.filter((c) => c.side === 0 && c.role !== 'command' && c.alive > 0).map((c) => c.ford)); wkF.delete(undefined);
  assert.ok(wkF.size >= 2, 'atakujący poszli tylko na ' + [...wkF].length + ' bród');
  const lhFlank = sim.comps.filter((c) => c.side === 1 && c.ford !== undefined && c.ford !== 1 && c.alive > 0).length;
  assert.ok(lhFlank >= 1, 'obrońcy nie przerzucili nikogo na skrajny bród');
  const start = makeScen('przeprawa', 3, 1); assert.ok(start.comps.filter((c) => c.side === 1).every((c) => Math.abs(c.ay - F[1].y) < 400), 'obrońcy nie startują przy środkowym brodzie');
  return 'WK: brody ' + [...wkF].map((k) => k + 1).sort().join(',') + '; LH przy skrajnych brodach: ' + lhFlank + ' rot po 150 s';
});

test('determinizm scenariuszy: bitwa, oblężenie i przeprawa dają ten sam skrót dla tego samego ziarna', () => {
  const out = [];
  for (const [scen, map] of [['bitwa', 2], ['oblezenie', 4], ['przeprawa', 3]]) {
    const h = (seed) => { const sim = makeScen(scen, map, seed); for (let k = 0; k < 600; k++) sim.step(); return sim.hash(); };
    const a = h(5), b = h(5), c = h(6); assert.strictEqual(a, b, scen + ': to samo ziarno dało różne wyniki'); assert.notStrictEqual(a, c, scen + ': inne ziarno dało ten sam wynik'); out.push(scen + ' ' + a);
  }
  return out.join(', ');
});

// ---------- etap 3: konfiguracja armii ----------
function makeArmy(scen, map, seed, budget, extra) { const { Sim, defs } = loadP1(); return Sim.create(Object.assign({ defs, seed, map, scenario: scen, budget }, extra || {})); }
const POOL = { WK: ['infantry', 'ciezki', 'taran', 'biegacz', 'pekacz'], LH: ['infantry', 'ciezki', 'odzwierny', 'plujka'] };
const shareOf = (sim, side) => { const info = sim.armyInfo[side], d = sim.defs.army, cost = {}; let tot = 0; for (const c of info.army.companies) { cost[c.type] = (cost[c.type] || 0) + c.size * d.costs[c.type]; tot += c.size * d.costs[c.type]; } for (const k in cost) cost[k] /= tot; return cost; };

test('budżety: trzy poziomy, w Bitwie i Przeprawie równe dla obu stron, w Oblężeniu atakujący ma x1,5', () => {
  const { Sim, defs } = loadP1(); const A = defs.army;
  assert.deepStrictEqual([A.budgets.maly, A.budgets.sredni, A.budgets.duzy], [1200, 2200, 3500]);
  for (const tier of ['maly', 'sredni', 'duzy']) {
    for (const scen of ['bitwa', 'przeprawa']) assert.strictEqual(Sim.army.budgetFor(defs, scen, 'WK', tier), Sim.army.budgetFor(defs, scen, 'LH', tier), scen + ' ' + tier + ': budżety nierówne');
    assert.strictEqual(Sim.army.budgetFor(defs, 'oblezenie', 'WK', tier), Math.round(A.budgets[tier] * 1.5)); assert.strictEqual(Sim.army.budgetFor(defs, 'oblezenie', 'LH', tier), A.budgets[tier]);
  }
  for (const t of POOL.WK.concat(POOL.LH)) assert.ok(A.costs[t] > 0, 'brak kosztu ' + t);
  const sim = makeArmy('oblezenie', 3, 1, 'sredni'); assert.strictEqual(sim.armyInfo.WK.budget, 3300); assert.strictEqual(sim.armyInfo.LH.budget, 2200);
  return 'średni: bitwa/przeprawa 2200 vs 2200, oblężenie WK 3300 vs LH 2200';
});

test('budżet jest twardym limitem, a pula frakcji i rozmiary rot są egzekwowane', () => {
  const ok = { guard: 'ciezki', commanders: 1, companies: [{ type: 'infantry', size: 100 }] };
  assert.doesNotThrow(() => makeArmy('bitwa', 2, 1, 'maly', { armies: { WK: ok } }));
  const { Sim, defs } = loadP1(); const exact = { guard: 'infantry', commanders: 1, companies: [] }; exact.companies.push({ type: 'infantry', size: 300 }, { type: 'infantry', size: 300 }, { type: 'infantry', size: 300 }); const used = Sim.army.cost(defs, exact);
  exact.companies.push({ type: 'infantry', size: 300 - 0 }); assert.throws(() => makeArmy('bitwa', 2, 1, 'maly', { armies: { WK: exact } }), /przekracza budżet/);
  assert.throws(() => makeArmy('bitwa', 2, 1, 'maly', { armies: { WK: { guard: 'ciezki', commanders: 1, companies: [{ type: 'odzwierny', size: 50 }] } } }), /spoza puli/);
  assert.throws(() => makeArmy('bitwa', 2, 1, 'maly', { armies: { LH: { guard: 'ciezki', commanders: 1, companies: [{ type: 'taran', size: 50 }] } } }), /spoza puli/);
  assert.throws(() => makeArmy('bitwa', 2, 1, 'maly', { armies: { WK: { guard: 'ciezki', commanders: 1, companies: [{ type: 'infantry', size: 10 }] } } }), /rozmiar/);
  assert.throws(() => makeArmy('bitwa', 2, 1, 'maly', { armies: { WK: { guard: 'ciezki', commanders: 0, companies: [] } } }), /dowódców/);
  assert.throws(() => makeArmy('bitwa', 2, 1, undefined, { armies: { WK: ok } }), /budget/);
  // dokładnie na limicie
  const atLimit = { guard: 'infantry', commanders: 1, companies: [{ type: 'infantry', size: 300 }, { type: 'infantry', size: 300 }, { type: 'infantry', size: 300 }] };
  const room = 1200 - Sim.army.cost(defs, atLimit); atLimit.companies.push({ type: 'infantry', size: Math.max(30, Math.min(300, room)) });
  assert.ok(Sim.army.cost(defs, atLimit) <= 1200); assert.doesNotThrow(() => makeArmy('bitwa', 2, 1, 'maly', { armies: { WK: atLimit } }));
  return 'przekroczenie budżetu, jednostki spoza puli, zły rozmiar roty i brak dowódcy są odrzucane; skład na limicie przechodzi';
});

test('AI dobiera armię wg wzorców: w budżecie, z puli frakcji, każdy wzorzec ma swoją sygnaturę i różni się od pozostałych', () => {
  const { Sim, defs } = loadP1(); const profiles = {};
  for (const side of ['WK', 'LH']) for (const id of Sim.army.archetypes(defs, side)) {
    const sim = makeArmy('bitwa', 2, 1, 'sredni', { styles: { [side]: id } }), i = sim.armyInfo[side], sh = shareOf(sim, side);
    assert.ok(i.cost <= i.budget && i.cost >= 0.9 * i.budget, side + ' ' + id + ': koszt ' + i.cost + '/' + i.budget);
    assert.ok(i.army.companies.every((c) => POOL[side].includes(c.type)) && i.army.commanders >= 1, side + ' ' + id + ': jednostki spoza puli');
    const arch = defs.army.archetypes[id]; for (const t in arch.shares[side]) assert.ok(Math.abs((sh[t] || 0) - arch.shares[side][t]) < 0.13, side + ' ' + id + ' ' + t + ': udział ' + (sh[t] || 0).toFixed(2) + ' zamiast ' + arch.shares[side][t]);
    profiles[side + ':' + id] = sh;
  }
  const keys = Object.keys(profiles), L1 = (a, b) => [...new Set(Object.keys(a).concat(Object.keys(b)))].reduce((t, k) => t + Math.abs((a[k] || 0) - (b[k] || 0)), 0);
  for (const side of ['WK', 'LH']) { const ks = keys.filter((k) => k.startsWith(side)); for (let x = 0; x < ks.length; x++) for (let y = x + 1; y < ks.length; y++) assert.ok(L1(profiles[ks[x]], profiles[ks[y]]) > 0.2, ks[x] + ' i ' + ks[y] + ' prawie identyczne'); }
  assert.ok(profiles['LH:dystansowa'].plujka >= 0.3 && profiles['WK:flankujaca'].biegacz >= 0.3 && profiles['WK:szturmowa'].taran >= 0.2 && profiles['WK:ciezka'].ciezki >= 0.4 && profiles['WK:lekka'].infantry >= 0.6);
  return 'wzorce WK: ' + Object.keys(profiles).filter((k) => k.startsWith('WK')).length + ', LH: ' + Object.keys(profiles).filter((k) => k.startsWith('LH')).length + '; udziały zgodne z definicją (±13 pp)';
});

test('wzorzec auto: dobór zależy od scenariusza i roli, uwzględnia kontrę wobec armii gracza i jest deterministyczny', () => {
  const { Sim, defs } = loadP1(); const pick = (scen, side, seed, opp) => Sim.army.pick(defs, side, scen, opp, Sim.createRng(seed));
  for (let seed = 1; seed <= 6; seed++) {
    assert.strictEqual(pick('oblezenie', 'WK', seed), 'szturmowa'); assert.strictEqual(pick('przeprawa', 'WK', seed), 'flankujaca'); assert.strictEqual(pick('przeprawa', 'LH', seed), 'dystansowa');
    assert.ok(['dystansowa', 'wytrwala'].includes(pick('oblezenie', 'LH', seed)), 'obrońca w oblężeniu');
  }
  const set = new Set(); for (let seed = 1; seed <= 12; seed++) set.add(pick('bitwa', 'WK', seed)); assert.ok(set.size >= 2, 'w Bitwie ziarno nie zmienia wzorca');
  const plujki = { guard: 'ciezki', commanders: 1, companies: [{ type: 'plujka', size: 300 }, { type: 'plujka', size: 200 }, { type: 'odzwierny', size: 60 }] };
  for (let seed = 1; seed <= 6; seed++) assert.strictEqual(pick('bitwa', 'WK', seed, plujki), 'flankujaca', 'WK nie kontruje plujek biegaczami');
  const masa = { guard: 'infantry', commanders: 1, companies: Array.from({ length: 6 }, () => ({ type: 'infantry', size: 200 })) };
  for (let seed = 1; seed <= 6; seed++) assert.ok(['ciezka', 'dystansowa'].includes(pick('bitwa', 'LH', seed, masa)), 'LH nie kontruje masy');
  assert.strictEqual(pick('bitwa', 'LH', 4), pick('bitwa', 'LH', 4));
  return 'oblężenie WK: szturmowa, LH: dystansowa/wytrwała; przeprawa WK: flankująca, LH: dystansowa; wobec plujek flankująca, wobec masy ciężka/dystansowa';
});

test('rozmieszczenie armii: dla trzech budżetów, scenariuszy i map nikt nie startuje w ścianie ani na sobie, a zbyt duża armia daje czytelny błąd', () => {
  let n = 0, worstOverlap = 0;
  for (const tier of ['maly', 'sredni', 'duzy']) for (const [scen, map] of [['bitwa', 1], ['bitwa', 5], ['oblezenie', 2], ['oblezenie', 3], ['oblezenie', 4], ['przeprawa', 3]]) {
    const sim = makeArmy(scen, map, 3, tier); n++;
    for (let i = 0; i < sim.count; i++) { const g = sim.grid[Math.floor(sim.y[i] / 16) * sim.COLS + Math.floor(sim.x[i] / 16)]; assert.ok(!(g === 1 || g === 3 || g === 4 || g === 5 || g === 6 || g === 7), tier + ' ' + scen + ' ' + map + ': mrówka w ścianie'); }
    const cell = new Map(); let close = 0; for (let i = 0; i < sim.count; i++) { const k = Math.floor(sim.x[i] / 6) + ',' + Math.floor(sim.y[i] / 6); (cell.get(k) || cell.set(k, []).get(k)).push(i); }
    for (let i = 0; i < sim.count; i++) { const cx = Math.floor(sim.x[i] / 6), cy = Math.floor(sim.y[i] / 6); for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) for (const j of cell.get((cx + dx) + ',' + (cy + dy)) || []) if (j > i && Math.hypot(sim.x[i] - sim.x[j], sim.y[i] - sim.y[j]) < 5) close++; }
    worstOverlap = Math.max(worstOverlap, close / sim.count); assert.ok(close / sim.count < 0.02, tier + ' ' + scen + ' ' + map + ': rozmieszczenie nakłada rotę na rotę (' + (100 * close / sim.count).toFixed(1) + '% mrówek)');
  }
  const huge = { guard: 'infantry', commanders: 1, companies: Array.from({ length: 11 }, () => ({ type: 'infantry', size: 300 })) };
  assert.throws(() => makeArmy('bitwa', 2, 1, 'duzy', { armies: { WK: huge } }), /brak miejsca/);
  return n + ' konfiguracji, najgorsze nałożenie ' + (100 * worstOverlap).toFixed(2) + '% mrówek; 3300 piechurów nie mieści się w strefie startu (błąd „brak miejsca”)';
});

test('bitwa z armiami z budżetu: liczebność zgodna ze składem, determinizm, a inny wzorzec daje inny przebieg', () => {
  const run = (styles) => { const sim = makeArmy('bitwa', 2, 5, 'maly', { styles }); const n = sim.count; for (let k = 0; k < 600; k++) sim.step(); return { n, h: sim.hash(), sim }; };
  const a = run({ WK: 'lekka', LH: 'dystansowa' }), b = run({ WK: 'lekka', LH: 'dystansowa' }), c = run({ WK: 'ciezka', LH: 'dystansowa' });
  assert.strictEqual(a.h, b.h, 'ten sam wzorzec i ziarno dały różne wyniki'); assert.notStrictEqual(a.h, c.h, 'inny wzorzec dał ten sam wynik');
  const sim = a.sim; for (const sn of ['WK', 'LH']) { const info = sim.armyInfo[sn], ants = info.army.companies.reduce((t, x) => t + x.size, 0) + info.army.commanders * (sim.defs.army.guardSize + 1); assert.strictEqual(sim.comps.filter((x) => x.sideName === sn).reduce((t, x) => t + x.initial, 0), ants, sn + ': liczebność niezgodna ze składem'); }
  for (let i = 0; i < sim.count; i++) assert.ok(Number.isFinite(sim.x[i]) && Number.isFinite(sim.y[i]));
  return 'liczebność zgodna ze składem; skróty: lekka/dystansowa ' + a.h + ', ciężka/dystansowa ' + c.h;
});


// ---------- etap 5: Szturm kopca ----------
const BLKC = [0, 1, 0, 1, 1, 1, 1, 1, 0];
const mound = (seed, extra) => { const { Sim, defs } = loadP1(); return Sim.create(Object.assign({ defs, seed: seed || 1, scenario: 'kopiec' }, extra || {})); };
// odległość (komórki, 4-sąsiedztwo) od komórki startowej po podłodze; blocked(i) może dodatkowo zamykać komórki (np. rampy)
function moundBfs(sim, src, blocked) {
  const C = sim.COLS, N = C * sim.ROWS, D = new Int32Array(N).fill(-1), q = [src]; D[src] = 0;
  for (let h = 0; h < q.length; h++) { const i = q[h]; for (const j of [i - 1, i + 1, i - C, i + C]) if (j >= 0 && j < N && D[j] < 0 && !BLKC[sim.grid[j]] && !(blocked && blocked(j))) { D[j] = D[i] + 1; q.push(j); } }
  return D;
}
const cellOf = (sim, x, y) => Math.floor(y / 16) * sim.COLS + Math.floor(x / 16);
const cellXY = (sim, i) => [((i % sim.COLS) + 0.5) * 16, (Math.floor(i / sim.COLS) + 0.5) * 16];

test('kopiec: menu ma Oblężenie (kopiec), stare płaskie jest ukryte, a mapa jest stała z sercem w środku', () => {
  const { defs } = loadP1(); const vis = Object.keys(defs.world.scenarioTypes).filter((k) => defs.world.scenarioTypes[k].posture && !defs.world.scenarioTypes[k].hidden);
  assert.deepStrictEqual(vis, ['bitwa', 'kopiec', 'przeprawa']); assert.strictEqual(defs.world.scenarioTypes.kopiec.name, 'Oblężenie');
  const sim = mound(); assert.strictEqual(sim.scenarioInfo.id, 'kopiec'); assert.ok(sim.mound);
  const M = sim.defs.world.mound, hx = M.center[0] * 16, hy = M.center[1] * 16;
  assert.ok(Math.hypot(sim.defs.world.nest[0] - hx, sim.defs.world.nest[1] - hy) < 1);
  assert.strictEqual(sim.levelAt(hx, hy), M.rings, 'serce leży na najwyższym poziomie');
  const old = Sim_oblezenie(); assert.strictEqual(old.scenarioInfo.id, 'oblezenie', 'stare płaskie oblężenie nadal działa pod wewnętrzną nazwą');
  return 'widoczne scenariusze: ' + vis.join(', ') + '; serce (' + hx + ', ' + hy + '), poziom ' + M.rings;
});
function Sim_oblezenie() { const { Sim, defs } = loadP1(); return Sim.create({ defs, seed: 1, scenario: 'oblezenie' }); }

test('kopiec: poziomy łączą się wyłącznie rampami (bez ramp wyższy poziom jest nieosiągalny), a podłoga jest w całości osiągalna', () => {
  const sim = mound(), M = sim.defs.world.mound, src = cellOf(sim, 400, sim.H / 2);
  const D = moundBfs(sim, src); let floor = 0, un = 0; for (let i = 0; i < D.length; i++) if (!BLKC[sim.grid[i]]) { floor++; if (D[i] < 0) un++; }
  assert.strictEqual(un, 0, 'nieosiągalna podłoga: ' + un);
  const hh = M.heights, rampOf = (i, k) => { const [x, y] = cellXY(sim, i), h = sim.heightAt(x, y); return sim.levelAt(x, y) < 0 && h > hh[k] && h < hh[k + 1]; };
  const lines = [];
  for (let k = 0; k < M.rings; k++) {
    const E = moundBfs(sim, src, (j) => rampOf(j, k)); let reach = 0, above = 0;
    for (let i = 0; i < E.length; i++) { if (E[i] < 0 || BLKC[sim.grid[i]]) continue; const [x, y] = cellXY(sim, i), lv = sim.levelAt(x, y); if (lv > k) above++; if (lv > k && E[i] >= 0) reach++; }
    assert.strictEqual(reach, 0, 'bez ramp z poziomu ' + k + ' dało się wejść wyżej: ' + reach + ' komórek');
    let total = 0; for (let i = 0; i < D.length; i++) if (!BLKC[sim.grid[i]]) { const [x, y] = cellXY(sim, i); if (sim.levelAt(x, y) > k) total++; }
    assert.ok(total > 100, 'za mało komórek powyżej poziomu ' + k); lines.push('poziom>' + k + ': ' + total + ' komórek, osiągalne bez ramp ' + reach);
  }
  return 'podłoga ' + floor + ' komórek, wszystkie osiągalne; ' + lines.join('; ');
});

test('kopiec: droga do serca przechodzi przez wszystkie poziomy i jest znacznie dłuższa niż linia prosta; podłoga pierścieni jest płaska, rampy mają zadane nachylenie', () => {
  const sim = mound(), M = sim.defs.world.mound, src = cellOf(sim, 400, sim.H / 2), D = moundBfs(sim, src), hx = M.center[0] * 16, hy = M.center[1] * 16;
  const path = D[cellOf(sim, hx, hy)] * 16, straight = Math.hypot(hx - 400, hy - sim.H / 2);
  assert.ok(path > 1.5 * straight, 'droga ' + path + ' nie jest wyraźnie dłuższa niż prosta ' + straight.toFixed(0));
  // z serca schodzimy po gradiencie odległości i zbieramy odwiedzone poziomy
  let i = cellOf(sim, hx, hy); const seen = new Set(); while (D[i] > 0) { const [x, y] = cellXY(sim, i); seen.add(sim.levelAt(x, y)); const C = sim.COLS; i = [i - 1, i + 1, i - C, i + C].filter((j) => D[j] >= 0).reduce((a, b) => (D[b] < D[a] ? b : a)); }
  for (let k = 0; k <= M.rings; k++) assert.ok(seen.has(k), 'droga omija poziom ' + k); assert.ok(seen.has(-1), 'droga nie używa rampy');
  // nachylenie: środek pierścienia płaski (mnożnik prędkości 1), rampa ok. Δh / grubość ściany
  let flat = 0, maxFlat = 0, ramp = 0, minR = 1e9, maxR = 0;
  for (let j = 0; j < D.length; j++) { if (BLKC[sim.grid[j]] || D[j] < 0) continue; const [x, y] = cellXY(sim, j), lv = sim.levelAt(x, y);
    for (const [dx, dy] of [[1, 0], [0, 1], [-1, 0], [0, -1]]) { const sl = Math.abs(sim.slopeAt(x, y, dx, dy));
      if (lv >= 0) { flat++; maxFlat = Math.max(maxFlat, sl); } else { ramp++; minR = Math.min(minR, sl); maxR = Math.max(maxR, sl); } } }
  assert.ok(maxFlat < 0.2, 'najwyższe nachylenie podłogi pierścienia ' + maxFlat.toFixed(3)); // komórki przy samej rampie mają gradient jednostronny
  const expected = (M.heights[1] - M.heights[0]) / (M.wall * 16); assert.ok(maxR > expected * 0.8 && maxR < expected * 1.3, 'nachylenie rampy ' + maxR.toFixed(3) + ' wobec oczekiwanego ' + expected.toFixed(3));
  assert.ok(sim.slopeMul(expected) < 0.75 && sim.slopeMul(-expected) > 1.15, 'rampa spowalnia pod górę i przyspiesza z góry');
  return 'droga ' + path.toFixed(0) + ' jedn. wobec prostej ' + straight.toFixed(0) + ' (x' + (path / straight).toFixed(2) + '); rampa nachylenie ' + maxR.toFixed(3) + ', mnożnik pod górę ' + sim.slopeMul(expected).toFixed(2);
});

test('kopiec: rozmieszczenie (armia ze scenariusza i z budżetów, także największy atakujący): atakujący w strefie przed kopcem, obrońca w korytarzach i sercu, nikt w ścianie ani na sobie', () => {
  let n = 0, worst = 0; const M0 = mound().defs.world.mound, st = M0.staging;
  const cfgs = [{}, { budget: 'maly' }, { budget: 'sredni' }, { budget: 'duzy' }, { budget: 'duzy', styles: { WK: 'lekka', LH: 'dystansowa' } }, { budget: 'duzy', styles: { WK: 'ciezka', LH: 'wytrwala' } }];
  for (const cfg of cfgs) {
    const sim = mound(3, cfg); n++;
    // dobór armii nie może po cichu zmniejszyć budżetu, żeby zmieścić się w strefie startu lub w korytarzach (composeArmy powtarza z mniejszym budżetem przy błędzie „brak miejsca”)
    if (cfg.budget) for (const sn of ['WK', 'LH']) { const ai = sim.armyInfo[sn]; assert.ok(ai.cost >= 0.97 * ai.budget, JSON.stringify(cfg) + ' ' + sn + ': armia ' + ai.cost + ' z budżetu ' + ai.budget + ' (zmniejszona, bo się nie mieści)'); }
    for (let i = 0; i < sim.count; i++) { assert.ok(!BLKC[sim.grid[cellOf(sim, sim.x[i], sim.y[i])]], JSON.stringify(cfg) + ': mrówka w ścianie');
      if (sim.side[i] === 0) assert.ok(sim.x[i] >= st[0] - 10 && sim.x[i] <= st[2] + 10 && sim.y[i] >= st[1] - 10 && sim.y[i] <= st[3] + 10, JSON.stringify(cfg) + ': atakujący poza strefą startu (' + sim.x[i].toFixed(0) + ', ' + sim.y[i].toFixed(0) + ')');
      else assert.ok(sim.x[i] > st[2] + 300, JSON.stringify(cfg) + ': obrońca poza kopcem'); }
    const cell = new Map(); let close = 0; for (let i = 0; i < sim.count; i++) { const k = Math.floor(sim.x[i] / 6) + ',' + Math.floor(sim.y[i] / 6); (cell.get(k) || cell.set(k, []).get(k)).push(i); }
    for (let i = 0; i < sim.count; i++) { const cx = Math.floor(sim.x[i] / 6), cy = Math.floor(sim.y[i] / 6); let hit = false; for (let dx = -1; dx <= 1 && !hit; dx++) for (let dy = -1; dy <= 1 && !hit; dy++) for (const j of cell.get((cx + dx) + ',' + (cy + dy)) || []) if (j > i && Math.hypot(sim.x[i] - sim.x[j], sim.y[i] - sim.y[j]) < 2.5) { hit = true; break; } if (hit) close++; }
    worst = Math.max(worst, close / sim.count); assert.ok(close / sim.count < 0.02, JSON.stringify(cfg) + ': nałożenie ' + (100 * close / sim.count).toFixed(1) + '%');
    // elitarna gwardia dowódcy obrońcy stoi w sercu
    const hx = M0.center[0] * 16, hy = M0.center[1] * 16; const gd = sim.comps.filter((c) => c.side === 1 && c.startBy.dowodca); assert.ok(gd.length >= 1);
    for (const c of gd) assert.ok(Math.hypot(c.ax - hx, c.ay - hy) < M0.heartHalf * 16, 'gwardia dowódcy obrońcy nie stoi w sercu');
  }
  return n + ' konfiguracji (armie z budżetu wykorzystują co najmniej 97% budżetu), najgorsze nałożenie ' + (100 * worst).toFixed(2) + '% mrówek';
});

test('kopiec: w marszu nikt nie przechodzi przez ścianę, a atakujący wchodzą kolejno na wyższe poziomy (AI przeciw AI, 150 s)', () => {
  const sim = mound(1); const lv = [0, 0, 0, 0, 0]; let maxLevel = 0, wall = 0;
  for (let k = 1; k <= 20 * 150; k++) { sim.step(); if (k % 20 === 0) for (let i = 0; i < sim.count; i++) if (sim.alive[i]) { if (BLKC[sim.grid[cellOf(sim, sim.x[i], sim.y[i])]]) wall++; if (sim.side[i] === 0) { const l = sim.levelAt(sim.x[i], sim.y[i]); maxLevel = Math.max(maxLevel, l); } } }
  assert.strictEqual(wall, 0, 'mrówki w ścianach: ' + wall); assert.ok(maxLevel >= 1, 'po 150 s nikt z atakujących nie wszedł na poziom 1');
  void lv; return 'po 150 s najwyższy poziom atakujących: ' + maxLevel + ', mrówek w ścianach 0';
});

test('kopiec: spanikowana rota obrońcy cofa się do serca po korytarzach i rampach, nie wchodząc w ściany', () => {
  const sim = mound(1, { aiSides: [] }), M = sim.defs.world.mound, hx = M.center[0] * 16, hy = M.center[1] * 16, heart = cellOf(sim, hx, hy);
  const D = moundBfs(sim, heart);   // odległość do serca po podłodze
  const cands = sim.comps.filter((c) => c.side === 1 && !c.startBy.dowodca && Math.hypot(c.ax - hx, c.ay - hy) > 250);
  assert.ok(cands.length >= 3);
  const lines = [];
  for (const c of cands.slice(0, 3)) {
    const d0 = D[cellOf(sim, c.ax, c.ay)], lvl0 = sim.levelAt(c.ax, c.ay); c.control = 0; c.cstate = sim.CS_LOST; c.retreating = true;   // odwrót zatrzaskuje się jak po spadku morale do zera (model morale etapu B)
    let wall = 0, worstBack = 0, prev = d0;
    for (let k = 1; k <= 20 * 60; k++) { c.control = Math.min(c.control, 5); sim.step(); if (k % 10 === 0) { const d = D[cellOf(sim, c.ax, c.ay)]; worstBack = Math.max(worstBack, d - prev); prev = Math.min(prev, d); for (const i of c.ants) if (sim.alive[i] && BLKC[sim.grid[cellOf(sim, sim.x[i], sim.y[i])]]) wall++; } }
    const d1 = D[cellOf(sim, c.ax, c.ay)];
    assert.strictEqual(wall, 0, c.name + ': mrówki w ścianie podczas odwrotu'); const expected = c.speed * c.spMod * 60 / 16;   // komórek do przejścia w 60 s, gdyby nic nie spowalniało
    assert.ok(d0 - d1 >= 0.4 * Math.min(expected, d0) || d1 * 16 < 140, c.name + ': po 60 s odległość do serca ' + d1 + ' z ' + d0 + ' komórek (prędkość roty pozwala na ok. ' + expected.toFixed(0) + ')');
    assert.ok(worstBack <= 3, c.name + ': rota wycofywała się drogą pod prąd (cofnięcie o ' + worstBack + ' komórek)');
    lines.push(c.name + ' (poziom ' + lvl0 + '): ' + d0 + ' -> ' + d1 + ' komórek do serca');
  }
  return lines.join('; ');
});

test('kopiec: zajęcie serca (co najmniej 15 atakujących przy mniej niż 3 obrońcach przez 8 s) kończy bitwę, uzupełnienia obrońcy pojawiają się w sercu, a atakujący ich nie ma', () => {
  const sim = mound(1, { aiSides: [] }), M = sim.defs.world.mound, hx = M.center[0] * 16, hy = M.center[1] * 16;
  assert.strictEqual(sim.reserve.WK, 0); assert.strictEqual(sim.reserve.LH, 150);
  const wk = sim.comps.find((c) => c.side === 0 && c.alive >= 20); let k = 0;
  for (const i of wk.ants) if (k++ < 30) { sim.x[i] = hx + (k % 6) * 6 - 15; sim.y[i] = hy + Math.floor(k / 6) * 6 - 15; }
  wk.ax = hx; wk.ay = hy; wk.order = { kind: 'hold', x: hx, y: hy };
  for (const c of sim.comps) if (c.side === 1) for (const i of c.ants) if (sim.alive[i] && Math.hypot(sim.x[i] - hx, sim.y[i] - hy) < 130) { sim.hp[i] = 0; sim.alive[i] = 0; c.alive--; }
  const inf = sim.comps.find((c) => c.side === 1 && c.startBy.infantry); let kk = 0; for (const i of inf.ants) if (sim.alive[i] && kk++ < 30) { sim.hp[i] = 0; sim.alive[i] = 0; inf.alive--; }   // ubytek w rocie piechoty, który uzupełnienia wyrównują
  const before = sim.count; let checked = before, far = 0;
  for (let t = 0; t < 20 * 6; t++) { sim.step(); for (; checked < sim.count; checked++) if (Math.hypot(sim.x[checked] - hx, sim.y[checked] - hy) > M.heartHalf * 16) far++; }   // pozycja tuż po pojawieniu się
  const spawnedInHeart = far === 0;
  assert.ok(sim.count > before, 'brak uzupełnień obrońcy'); assert.ok(spawnedInHeart, 'uzupełnienia nie pojawiły się w sercu');
  // bez uzupełnień zajęcie serca kończy bitwę zwycięstwem atakującego po 8 s
  const s2 = mound(1, { aiSides: [] }); s2.reserve.LH = 0; const wk2 = s2.comps.find((c) => c.side === 0 && c.alive >= 20); let k2 = 0;
  for (const i of wk2.ants) if (k2++ < 30) { s2.x[i] = hx + (k2 % 6) * 6 - 15; s2.y[i] = hy + Math.floor(k2 / 6) * 6 - 15; }
  wk2.ax = hx; wk2.ay = hy; wk2.order = { kind: 'hold', x: hx, y: hy };
  for (const c of s2.comps) if (c.side === 1) for (const i of c.ants) if (s2.alive[i] && Math.hypot(s2.x[i] - hx, s2.y[i] - hy) < 130) { s2.alive[i] = 0; c.alive--; }
  for (let t = 0; t < 20 * 40 && !s2.result; t++) s2.step();   // obrońcy z sąsiednich pierścieni najpierw kontratakują
  assert.ok(s2.result && s2.result.winner === 'WK' && /gniazdo/.test(s2.result.reason), 'zajęcie serca nie zakończyło bitwy: ' + JSON.stringify(s2.result));
  return 'uzupełnienia obrońcy w sercu: +' + (sim.count - before) + ' w 6 s; bez uzupełnień zajęcie serca kończy bitwę po ' + (s2.result.tick / 20).toFixed(0) + ' s';
});

test('kopiec: determinizm (to samo ziarno, ten sam skrót) i czas kroku przy dużej armii', () => {
  const a = mound(2), b = mound(2); for (let k = 0; k < 600; k++) { a.step(); b.step(); } assert.strictEqual(a.hash(), b.hash());
  const big = mound(2, { budget: 'duzy' }); const ms = []; for (let k = 0; k < 400; k++) { const t = process.hrtime.bigint(); big.step(); ms.push(Number(process.hrtime.bigint() - t) / 1e6); }
  ms.sort((p, q) => p - q); const med = ms[200], p99 = ms[Math.floor(ms.length * 0.99)];
  return 'skrót ' + a.hash() + '; krok przy ' + big.count + ' mrówkach: mediana ' + med.toFixed(1) + ' ms, p99 ' + p99.toFixed(1) + ' ms';
});


test('korytarze: rota po zakręcie o 90°, na rampie i przy wejściu wraca do szyku (wcześniej 15-50% mrówek zostawało w kupce przy kotwicy)', () => {
  const { TRIALS, trial } = require('./p1-korytarze'); const lines = [];
  for (const t of TRIALS) {
    const before = trial(t, false), after = trial(t, true);
    assert.ok(after.frac >= 0.95, t.name + ': po poprawce na miejscu ' + after.ok + '/' + after.n);
    if (!/kontrola/.test(t.name)) assert.ok(before.frac <= 0.9, t.name + ': bez poprawki test nie wykrywa problemu (' + before.ok + '/' + before.n + ')');
    lines.push(Math.round(100 * before.frac) + '% -> ' + Math.round(100 * after.frac) + '%');
  }
  return 'odsetek mrówek na miejscu w szyku przed i po poprawce: ' + lines.join(', ');
});


// ---------- sterowanie wzorowane na Total War: logika rozkazów w symulacji ----------
const ctl = (extra) => { const { Sim, defs } = loadP1(); return Sim.create(Object.assign({ defs, seed: 1, scenario: 'bitwa', map: 1, aiSides: [] }, extra || {})); };
const BLKS = [0, 1, 0, 1, 1, 1, 1, 1, 0];
test('sterowanie: rozkaz ruchu z kolejką (Shift) wykonuje punkty po kolei, a nowy rozkaz bez kolejki ją czyści; szybki ruch jest szybszy i bardziej męczy', () => {
  const sim = ctl(), c = sim.comps.find((q) => q.side === 0 && q.role === 'assault'), A = [c.ax + 200, c.ay], B = [c.ax + 200, c.ay + 200];
  sim.command({ k: 'order', side: 'WK', comps: [c.id], kind: 'move', x: A[0], y: A[1] }); sim.command({ k: 'order', side: 'WK', comps: [c.id], kind: 'move', x: B[0], y: B[1], queue: true });
  sim.step(); assert.strictEqual(c.queue.length, 1, 'kolejka nie ma punktu B'); let reachedA = false;
  for (let k = 0; k < 20 * 40 && !(Math.hypot(c.ax - B[0], c.ay - B[1]) < 4); k++) { sim.step(); if (Math.hypot(c.ax - A[0], c.ay - A[1]) < 6) reachedA = true; }
  assert.ok(reachedA, 'rota nie odwiedziła punktu A'); assert.ok(Math.hypot(c.ax - B[0], c.ay - B[1]) < 4, 'rota nie doszła do B'); assert.strictEqual(c.queue.length, 0);
  sim.command({ k: 'order', side: 'WK', comps: [c.id], kind: 'move', x: A[0], y: A[1] }); sim.command({ k: 'order', side: 'WK', comps: [c.id], kind: 'move', x: B[0], y: B[1], queue: true }); sim.command({ k: 'order', side: 'WK', comps: [c.id], kind: 'move', x: A[0] - 50, y: A[1] }); sim.step();
  assert.strictEqual(c.queue.length, 0, 'rozkaz bez Shift nie wyczyścił kolejki');
  const t = (run) => { const s2 = ctl(), d = s2.comps.find((q) => q.side === 0 && q.role === 'assault'), tx = d.ax + 400; s2.command({ k: 'order', side: 'WK', comps: [d.id], kind: 'move', x: tx, y: d.ay, run }); let tt = null, fat = 0; for (let k = 1; k <= 20 * 60; k++) { s2.step(); if (tt === null && Math.abs(d.ax - tx) < 4) tt = k / 20; if (tt !== null && k > 20 * 30) { fat = d.fatigue; break; } } return { tt, fat }; };
  const walk = t(false), run = t(true); assert.ok(run.tt < walk.tt * 0.9, 'szybki ruch nie jest szybszy: ' + run.tt + ' vs ' + walk.tt);
  const f = (run2) => { const s2 = ctl(), d = s2.comps.find((q) => q.side === 0 && q.role === 'assault'); s2.command({ k: 'order', side: 'WK', comps: [d.id], kind: 'move', x: d.ax + 900, y: d.ay, run: run2 }); for (let k = 0; k < 20 * 20; k++) s2.step(); return d.fatigue; };
  const fw = f(false), fr = f(true); assert.ok(fr > fw * 1.5, 'szybki ruch nie zwiększa zmęczenia: ' + fr.toFixed(1) + ' vs ' + fw.toFixed(1));
  return 'punkty A i B po kolei; 400 jedn.: marsz ' + walk.tt + ' s, szybki ruch ' + run.tt + ' s; zmęczenie po 20 s: ' + fw.toFixed(1) + ' vs ' + fr.toFixed(1);
});

test('sterowanie: rozkaz ataku na wskazaną rotę ściga cel, wiele rot atakuje bez trwałego zakleszczenia, po zniszczeniu celu rozkaz się kończy i idzie następny z kolejki', () => {
  const defsMod = (d) => { d.params.visibility.on = false; };
  const { Sim, defs } = loadP1(); defsMod(defs); const sim = Sim.create({ defs, seed: 1, scenario: 'bitwa', map: 1, aiSides: [] });
  const foe = sim.comps.find((q) => q.side === 1 && q.role === 'reserve'), mine = sim.comps.filter((q) => q.side === 0 && q.role === 'assault').slice(0, 3);
  // wróg blisko, żeby test dotyczył podejścia i walki, a nie długiego marszu
  const dx = mine[0].ax + 220 - foe.ax, dy = mine[0].ay - foe.ay; for (const i of foe.ants) { sim.x[i] += dx; sim.y[i] += dy; } foe.ax += dx; foe.ay += dy; foe.order = { kind: 'hold', x: foe.ax, y: foe.ay, face: null, done: false };
  for (const m of mine) sim.command({ k: 'order', side: 'WK', comps: [m.id], kind: 'attackTarget', target: foe.id });
  sim.command({ k: 'order', side: 'WK', comps: [mine[0].id], kind: 'move', x: mine[0].ax + 40, y: mine[0].ay, queue: true });
  sim.step(); for (const m of mine) assert.strictEqual(m.order.kind, 'attackTarget');
  let stuck = 0, fighting = 0; for (let k = 0; k < 20 * 90 && foe.alive > 0; k++) { sim.step(); if (k % 20 === 19) for (const m of mine) { if (m.ostate === 'blocked' || m.ostate === 'noPath') stuck++; if (m.ostate === 'fighting') fighting++; } }
  assert.ok(foe.alive < foe.initial * 0.5 || foe.alive === 0, 'cel prawie nietknięty po 90 s: ' + foe.alive + '/' + foe.initial); assert.strictEqual(stuck, 0, 'rota była zablokowana lub bez drogi (' + stuck + ' próbek)'); assert.ok(fighting > 0, 'żadna rota nie weszła w walkę');
  // zniszczenie celu: rozkaz kończy się, pierwsza rota przechodzi do ruchu z kolejki (osobna, świeża bitwa, żeby rota nie była po walce w stanie utraty kontroli)
  const { Sim: S2, defs: d2 } = loadP1(); d2.params.visibility.on = false; const s2 = S2.create({ defs: d2, seed: 1, scenario: 'bitwa', map: 1, aiSides: [] });
  const f2 = s2.comps.find((q) => q.side === 1 && q.role === 'reserve'), m2 = s2.comps.filter((q) => q.side === 0 && q.role === 'assault').slice(0, 2);
  const ddx = m2[0].ax + 220 - f2.ax, ddy = m2[0].ay - f2.ay; for (const i of f2.ants) { s2.x[i] += ddx; s2.y[i] += ddy; } f2.ax += ddx; f2.ay += ddy;
  for (const m of m2) s2.command({ k: 'order', side: 'WK', comps: [m.id], kind: 'attackTarget', target: f2.id });
  s2.command({ k: 'order', side: 'WK', comps: [m2[0].id], kind: 'move', x: m2[0].ax + 40, y: m2[0].ay, queue: true });
  for (let k = 0; k < 20 * 3; k++) s2.step();
  for (const i of f2.ants) { s2.alive[i] = 0; s2.hp[i] = 0; } f2.alive = 0; for (let k = 0; k < 40; k++) s2.step();
  assert.ok(m2.every((m) => m.order.kind !== 'attackTarget' || m.order.done), 'rozkaz ataku martwego celu pozostał aktywny'); assert.strictEqual(m2[0].order.kind, 'move', 'po zniszczeniu celu nie ruszył następny rozkaz z kolejki'); assert.strictEqual(m2[0].queue.length, 0);
  return 'trzy roty atakują jedną; cel ' + foe.initial + ' -> ' + foe.alive + ' w 90 s, próbek zakleszczenia 0, rot w walce ' + fighting + ' próbek; zniszczenie celu kończy rozkaz i uruchamia następny z kolejki';
});

test('sterowanie: trasa z pathfindingu omija ściany i nie przechodzi przez nie, a rozkaz bez drogi jest odrzucony z komunikatem; brak postępu kończy rozkaz zamiast pętli', () => {
  const sim = mound(1, { aiSides: [] }), c = sim.comps.find((q) => q.side === 0), M = sim.defs.world.mound, hx = M.center[0] * 16, hy = M.center[1] * 16;
  // trasa z pola startu do serca musi obejść mur, rampy i pierścienie: każdy punkt na podłodze, odcinki bez ścian, trasa dłuższa niż prosta
  const route = sim.routeOf(c.ax, c.ay, hx, hy, 24); assert.ok(route && route.length > 20, 'brak trasy do serca');
  let len = 0; for (let i = 0; i + 1 < route.length; i++) { const a = route[i], b = route[i + 1]; len += Math.hypot(b[0] - a[0], b[1] - a[1]); assert.ok(!BLKS[sim.grid[cellOf(sim, a[0], a[1])]], 'punkt trasy w ścianie');
    const n = Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 4); for (let k = 1; k < n; k++) assert.ok(!BLKS[sim.grid[cellOf(sim, a[0] + (b[0] - a[0]) * k / n, a[1] + (b[1] - a[1]) * k / n)]], 'odcinek trasy przecina ścianę'); }
  const straight = Math.hypot(c.ax - hx, c.ay - hy); assert.ok(len > 1.5 * straight, 'trasa nie obchodzi ścian: ' + len.toFixed(0) + ' vs prosta ' + straight.toFixed(0));
  // zamknięta kieszeń: cel osiągalny tylko dla punktu, więc rozkaz jest odrzucony, rota stoi, jest komunikat
  const s2 = ctl(), d = s2.comps.find((q) => q.side === 0 && q.role === 'assault'), px = 1400, py = 300, C2 = s2.COLS; const keep = JSON.stringify(d.order);
  for (let yy = Math.floor(py / 16) - 3; yy <= Math.floor(py / 16) + 3; yy++) for (let xx = Math.floor(px / 16) - 3; xx <= Math.floor(px / 16) + 3; xx++) if (Math.max(Math.abs(yy - Math.floor(py / 16)), Math.abs(xx - Math.floor(px / 16))) === 3) s2.grid[yy * C2 + xx] = 1;
  s2.command({ k: 'order', side: 'WK', comps: [d.id], kind: 'move', x: px, y: py }); s2.step();
  assert.strictEqual(JSON.stringify(d.order), keep, 'rozkaz bez drogi został przyjęty'); assert.strictEqual(d.ostate, 'noPath'); assert.ok(/brak drogi/.test(d.notice), 'brak komunikatu: ' + d.notice); assert.ok(!s2.reachable(d, px, py));
  // brak postępu: po wydaniu rozkazu droga zostaje zamknięta murem, rota nie może iść; po przeliczeniu trasy kończy rozkaz z komunikatem (bez pętli)
  const s3 = ctl(), e = s3.comps.find((q) => q.side === 0 && q.role === 'assault'), C3 = s3.COLS, gx = Math.floor((e.ax + 200) / 16);
  s3.command({ k: 'order', side: 'WK', comps: [e.id], kind: 'move', x: e.ax + 500, y: e.ay }); s3.step();
  for (let yy = 1; yy < s3.ROWS - 1; yy++) for (let dx = 0; dx < 3; dx++) s3.grid[yy * C3 + gx + dx] = 1;
  let ended = null; for (let k = 0; k < 20 * 40; k++) { s3.step(); if (e.order.kind === 'hold' && e.ostate === 'noPath') { ended = k / 20; break; } }
  assert.ok(ended !== null, 'rozkaz bez postępu nie został zakończony'); assert.ok(/brak postępu/.test(e.notice), e.notice); for (let k = 0; k < 40; k++) s3.step(); assert.strictEqual(e.order.kind, 'hold', 'rota ponawia próby bez końca');
  return 'trasa do serca ' + len.toFixed(0) + ' jedn. (prosta ' + straight.toFixed(0) + '), bez drogi: rozkaz odrzucony z komunikatem, brak postępu: koniec rozkazu po ' + ended + ' s';
});

let failed = 0;
for (const r of results) { console.log((r.ok ? 'OK   ' : 'FAIL ') + r.name + (r.note ? '\n       ' + r.note : '') + '  [' + r.ms + ' ms]'); if (!r.ok) failed++; }
console.log('\n' + (results.length - failed) + '/' + results.length + ' testów rdzenia przeszło');
process.exit(failed ? 1 : 0);
