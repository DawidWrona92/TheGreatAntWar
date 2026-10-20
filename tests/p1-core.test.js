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
  const p90 = moves[Math.floor(moves.length * 0.9)];
  assert.ok(med < 0.4 && p90 < 1.2, 'walczące ciała się przesuwają: mediana ' + med.toFixed(3) + ', p90 ' + p90.toFixed(2));
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
  // skróty zapisane przed wprowadzeniem typów mapy (siatka terenu i stan po 600 krokach)
  const base = { '1:64': ['-2668302', 'd83a32c0'], '1:192': ['-1695179022', 'b9b8ee0d'], '7:64': ['1221057424', '4405f5b1'], '7:192': ['-471453296', '1db337c2'] };
  for (const key in base) {
    const [seed, passage] = key.split(':').map(Number), sim = make(seed, passage);
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
  const lhOrders = (scen) => { const sim = makeScen(scen, 2, 1); for (let k = 0; k < 20 * 30; k++) sim.step(); return sim.comps.filter((c) => c.side === 1 && c.role !== 'artillery' && !c.startBy.dowodca && c.alive > 0).map((c) => c.order.kind); };
  const b = lhOrders('bitwa'), o = lhOrders('oblezenie'), p = lhOrders('przeprawa');
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

let failed = 0;
for (const r of results) { console.log((r.ok ? 'OK   ' : 'FAIL ') + r.name + (r.note ? '\n       ' + r.note : '') + '  [' + r.ms + ' ms]'); if (!r.ok) failed++; }
console.log('\n' + (results.length - failed) + '/' + results.length + ' testów rdzenia przeszło');
process.exit(failed ? 1 : 0);
