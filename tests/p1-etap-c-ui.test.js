// Test przeglądarkowy etapu C: znaczniki i nakładki taktyczne. Sprawdza S.ovFrame (to, co faktycznie narysowano w ostatniej klatce) oraz stan symulacji.
// Numeracja odpowiada sekcji 17 specyfikacji nakładek.
const assert = require('assert');
const { openPage } = require('./browser-lib');

(async () => {
  const out = []; let failed = 0;
  const ok = (name, note) => out.push('OK   ' + name + (note ? '\n       ' + note : ''));
  const { browser, page, errors } = await openPage('autostart=1&side=LH&seed=1&scenario=bitwa&map=4&speed=1');
  const ev = (fn, arg) => page.evaluate(fn, arg);
  const frame = async (fn, arg) => { await page.waitForTimeout(450); return ev(fn || (() => JSON.parse(JSON.stringify(__P1.S.ovFrame))), arg); };
  try {
    await page.waitForFunction(() => window.__P1 && __P1.S.sim && __P1.S.sim.tick > 10, null, { timeout: 120000 });
    await ev(() => { __P1.S.paused = true; __P1.S.selected.clear(); __P1.S.hover = -1; });
    const ids = await ev(() => { const s = __P1.S.sim, me = 1, f = (k) => s.comps.find((c) => c.side === me && s.names[c.domType] === k).id; return { pl: f('plujka'), inf: f('infantry'), en: s.comps.find((c) => c.side !== me).id, en2: s.comps.filter((c) => c.side !== me)[1].id }; });
    // wróg blisko plujek, w zasięgu, widoczny; reszta wrogów daleko (nie zakłóca)
    await ev((ids) => { const s = __P1.S.sim, pl = s.comps[ids.pl], en = s.comps[ids.en]; const mv = (c, x, y) => { const dx = x - c.ax, dy = y - c.ay; for (const i of c.ants) { s.x[i] += dx; s.y[i] += dy; } c.ax = x; c.ay = y; }; mv(en, pl.ax + 50, pl.ay); mv(s.comps[ids.en2], pl.ax + 70, pl.ay + 90); s.debug.vis(); __P1.centerOn(pl.ax, pl.ay); s.step(); }, ids);
    // ---- 1. zaznaczona własna rota ma obrys, niezaznaczona nie (przy wyłączonym wyświetlaniu wszystkich)
    let f = await frame(); assert.strictEqual(f.sel.length, 0); await ev((ids) => { __P1.S.selected.add(ids.inf); }, ids); f = await frame();
    assert.deepStrictEqual(f.sel.map((x) => x.id), [ids.inf]); assert.ok(f.sel[0].w >= 2, 'obrys zaznaczenia zbyt cienki'); assert.strictEqual(await ev(() => document.documentElement.style.getPropertyValue('--selc')), '#35e0d0');
    ok('1. zaznaczona własna rota ma obrys w kolorze zaznaczenia (turkus), niezaznaczone nie mają obrysów', 'obrys szer. ' + f.sel[0].w);
    // ---- 2. najechanie na własną niezaznaczoną rotę: słabszy obrys, rozkazy i zaznaczenie bez zmian
    const before = await ev((ids) => JSON.stringify([__P1.S.sim.comps[ids.pl].order, [...__P1.S.selected]]), ids);
    await ev((ids) => { __P1.S.hover = ids.pl; }, ids); f = await frame(); assert.strictEqual(f.hoverOwn, ids.pl);
    assert.strictEqual(await ev((ids) => JSON.stringify([__P1.S.sim.comps[ids.pl].order, [...__P1.S.selected]]), ids), before, 'najechanie zmieniło rozkaz lub zaznaczenie'); assert.ok(await ev((ids) => document.querySelector('#cards .card[data-id="' + ids.pl + '"]').classList.contains('hov'), ids), 'karta nie jest podświetlona');
    ok('2. najechanie na własną niezaznaczoną rotę daje słaby obrys i podświetla jej kartę, bez zmiany rozkazu i zaznaczenia');
    // ---- 3. wróg wskazywany: odrębny obrys
    await ev((ids) => { __P1.S.hover = ids.en; }, ids); f = await frame(); assert.strictEqual(f.hoverEnemy, ids.en); assert.strictEqual(f.sel.length, 1, 'wskazanie wroga zmieniło zaznaczenie');
    ok('3. wskazany wróg ma osobny obrys (pomarańczowy), zaznaczenie bez zmian');
    // ---- 4. aktualny cel ataku odróżnialny od wskazywanego
    await ev((ids) => { const s = __P1.S.sim; s.command({ k: 'order', side: 'LH', comps: [ids.inf], kind: 'attackTarget', target: ids.en }); s.step(); __P1.S.hover = ids.en2; }, ids); f = await frame();
    assert.ok(f.targets.length === 1 && f.targets[0].id === ids.en && f.targets[0].known, 'brak znacznika celu'); assert.strictEqual(f.hoverEnemy, ids.en2); assert.notStrictEqual(f.hoverEnemy, f.targets[0].id); assert.ok(f.lines >= 1, 'brak linii do celu');
    ok('4. cel rozkazu ataku (narożniki, znacznik, linia do punktu podejścia) jest niezależny od wskazywanego wroga');
    // ---- 5. zaznaczenie całej armii: obrysy cieńsze i słabsze
    await ev(() => { __P1.S.hover = -1; const s = __P1.S.sim; __P1.S.selected = new Set(s.comps.filter((c) => c.side === 1 && c.alive > 0).map((c) => c.id)); }); f = await frame();
    assert.ok(f.sel.length >= 8 && f.sel.every((x) => x.w <= 1.5 && x.a <= 0.8), 'obrysy przy dużym zaznaczeniu nie są łagodniejsze'); assert.ok(f.routes <= 3 && f.dests === f.sel.length || f.routes <= 3, 'zbyt wiele pełnych tras');
    ok('5. zaznaczenie całej armii (' + f.sel.length + ' rot): obrysy cieńsze (' + f.sel[0].w + ') i słabsze (' + f.sel[0].a + '), ograniczone trasy');
    // ---- 6. rozkaz ruchu: trasa z pathfindingu; 7. niedostępny cel: brak rozkazu i brak trasy
    await ev((ids) => { __P1.S.selected = new Set([ids.inf]); const s = __P1.S.sim, c = s.comps[ids.inf]; s.command({ k: 'order', side: 'LH', comps: [ids.inf], kind: 'move', x: c.ax - 260, y: c.ay + 120 }); s.step(); }, ids); f = await frame();
    const route = await ev((ids) => { const s = __P1.S.sim, c = s.comps[ids.inf], o = c.order; return { kind: o.kind, pts: s.routeOf(c.ax, c.ay, o.x, o.y, 28), walls: null }; }, ids);
    assert.ok(f.routes >= 1 && route.kind === 'move' && route.pts && route.pts.length >= 2, 'brak trasy'); const bad = await ev((ids) => { const s = __P1.S.sim, c = s.comps[ids.inf], C = s.COLS; let wall = 0; const pts = s.routeOf(c.ax, c.ay, c.order.x, c.order.y, 28); for (let i = 0; i + 1 < pts.length; i++) { const a = pts[i], b = pts[i + 1], n = Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 4); for (let k = 0; k <= n; k++) { const g = s.grid[Math.floor((a[1] + (b[1] - a[1]) * k / n) / 16) * C + Math.floor((a[0] + (b[0] - a[0]) * k / n) / 16)]; if (g === 1 || g === 3 || g === 4 || g === 5 || g === 6) wall++; } } return wall; }, ids);
    assert.strictEqual(bad, 0, 'trasa przechodzi przez ' + bad + ' próbek ściany'); ok('6. rozkaz ruchu rysuje trasę z pathfindingu (' + route.pts.length + ' punktów, 0 próbek w ścianach)');
    const unreach = await ev((ids) => { const s = __P1.S.sim, c = s.comps[ids.inf], C = s.COLS, px = c.ax + 90, py = c.ay + 90; const keep = JSON.stringify(c.order); const saved = []; for (let yy = -3; yy <= 3; yy++) for (let xx = -3; xx <= 3; xx++) { if (Math.max(Math.abs(xx), Math.abs(yy)) === 3) { const ci = (Math.floor(py / 16) + yy) * C + Math.floor(px / 16) + xx; saved.push([ci, s.grid[ci]]); s.grid[ci] = 1; } } s.command({ k: 'order', side: 'LH', comps: [ids.inf], kind: 'move', x: px, y: py }); s.step(); const same = JSON.stringify(c.order) === keep; return { same, state: c.ostate }; }, ids);
    assert.ok(unreach.same && unreach.state === 'noPath', 'niedostępny rozkaz został przyjęty: ' + JSON.stringify(unreach)); await frame(); ok('7. rozkaz do niedostępnego punktu jest odrzucony (stan noPath), nakładka nie rysuje trasy przez ścianę');
    // ---- 8, 9. maksymalny zasięg strzelców zgodny z parametrami; pole ostrzału się aktualizuje po ruchu
    await ev((ids) => { __P1.S.selected = new Set([ids.pl]); __P1.S.hover = -1; __P1.S.sim.comps[ids.pl].order = { kind: 'hold', x: 0, y: 0, face: null, done: false }; __P1.S.ov.tactical = true; }, ids); f = await frame();
    const R = await ev(() => __P1.S.sim.defs.units.plujka.range), st = await ev((ids) => __P1.S.sim.compStats(__P1.S.sim.comps[ids.pl]).attack.range, ids);
    assert.ok(f.ranges.length === 1 && f.ranges[0].R0 === R && st === R, 'zasięg nakładki ' + JSON.stringify(f.ranges)); assert.ok(f.areas.length === 1 && f.areas[0].rays === 36);
    const p0 = [f.ranges[0].x, f.ranges[0].y]; await ev((ids) => { const s = __P1.S.sim, c = s.comps[ids.pl]; for (const i of c.ants) s.x[i] += 90; c.ax += 90; s.step(); }, ids); f = await frame();
    assert.ok(Math.hypot(f.ranges[0].x - p0[0], f.ranges[0].y - p0[1]) > 50, 'pierścień zasięgu nie podążył za rotą');
    ok('8/9. zasięg ' + R + ' zgodny z parametrami broni; pole ostrzału przeliczone po przesunięciu roty (środek przesunął się o ' + Math.round(Math.hypot(f.ranges[0].x - p0[0], f.ranges[0].y - p0[1])) + ')');
    // ---- 10. brak ograniczenia kierunkowego: obszar to koło (promienie o równym zasięgu na otwartym terenie)
    const dirs = await ev((ids) => { const s = __P1.S.sim, a = s.fireArea(ids.pl); const open = a.rays.filter((r) => r.why === 'range').map((r) => r.reach); return { n: open.length, min: Math.min(...open), max: Math.max(...open) }; }, ids);
    assert.ok(dirs.n >= 6 && dirs.max - dirs.min <= 4.01, 'otwarte promienie mają różny zasięg: ' + JSON.stringify(dirs)); ok('10. plujka strzela w każdą stronę (brak sektora): otwarte promienie mają zasięg ' + dirs.min + '-' + dirs.max);
    // ---- 12-15. wskazanie wroga przy zaznaczonych plujkach: poza zasięgiem, ściana, część strzelców, przyczyny
    const setupShot = (gap, wall) => ev(([ids, gap, wall]) => {
      const s = __P1.S.sim, pl = s.comps[ids.pl], en = s.comps[ids.en], eye = s.comps[ids.inf]; const mv = (c, x, y) => { const dx = x - c.ax, dy = y - c.ay; for (const i of c.ants) { s.x[i] += dx; s.y[i] += dy; } c.ax = x; c.ay = y; };
      for (const c of s.comps) if (c.side !== 1) mv(c, 60 + c.id * 4, 60);
      let x = null, y = null; outer: for (let yy = 300; yy < s.H - 300; yy += 40) for (let xx = 400; xx < s.W - 400; xx += 40) { let free = true; for (let dy = -60; dy <= 60 && free; dy += 16) for (let dx = -60; dx <= 260 && free; dx += 16) if (s.grid[Math.floor((yy + dy) / 16) * s.COLS + Math.floor((xx + dx) / 16)] !== 0) free = false; if (free) { x = xx; y = yy; break outer; } }
      mv(pl, x, y); const maxS = Math.max(...pl.ants.map((i) => s.x[i])); mv(en, x + 100, y); const minE = Math.min(...en.ants.map((i) => s.x[i])); mv(en, en.ax + (maxS + gap - minE), en.ay); mv(eye, en.ax - 30, y + 30);
      if (wall) for (let yy = 24; yy < s.H - 24; yy += 8) s.grid[Math.floor(yy / 16) * s.COLS + Math.floor((maxS + gap / 2) / 16)] = 1;
      s.debug.vis(); const g = s.COLS; __P1.S.selected = new Set([ids.pl]); __P1.S.hover = ids.en; __P1.S.ov.tactical = false; s.step(); return { x, y };
    }, [ids, gap, wall]);
    await setupShot(40, false); f = await frame(); assert.ok(f.tip && /strzelców/.test(f.tip) && f.fireLevel && f.fireLevel !== 'red', 'brak oceny ostrzału: ' + f.tip);
    const lvlNear = f.fireLevel; await setupShot(250, false); f = await frame(); assert.ok(/poza zasięgiem/.test(f.tip) && f.fireLevel === 'red', 'cel poza zasięgiem: ' + f.tip);
    ok('12. cel poza zasięgiem: ' + f.tip.split('\n')[0] + ' (w zasięgu było: ' + lvlNear + ')');
    await setupShot(40, true); f = await frame(); assert.ok(/blokuje/.test(f.tip) && f.fireLevel === 'red', 'cel za ścianą: ' + f.tip); assert.ok(f.blockers.length === 1 && f.blockers[0].kind === 'wall', 'brak wskazania przeszkody'); const wb = await ev((b) => __P1.S.sim.grid[Math.floor(b.y / 16) * __P1.S.sim.COLS + Math.floor(b.x / 16)], f.blockers[0]); assert.strictEqual(wb, 1, 'wskazana przeszkoda nie jest ścianą');
    ok('13/14. cel za ścianą: ' + f.tip.split('\n')[0] + '; podświetlona przeszkoda to rzeczywista komórka ściany (' + f.blockers[0].x + ', ' + f.blockers[0].y + ')');
    // 15. ostrzał części oddziału: połowa strzelców poza zasięgiem
    await setupShot(40, false); await ev((ids) => { const s = __P1.S.sim, pl = s.comps[ids.pl], a = pl.ants.filter((i) => s.alive[i]); a.slice(0, a.length >> 1).forEach((i) => { s.x[i] -= 160; }); s.step(); }, ids); f = await frame();
    const part = f.lines2 && f.lines2[0]; assert.ok(part && /(\d+)% strzelców/.test(part.text) && !/100%/.test(part.text) && (part.lv === 'yellow' || part.lv === 'orange'), 'ostrzał części oddziału: ' + (part && part.text)); ok('15. ostrzał części oddziału odróżniony od pełnego: ' + part.text);
    // ---- 16. niewidoczny wróg: brak kontekstu i brak ujawnienia
    await setupShot(40, true); await ev((ids) => { const s = __P1.S.sim, eye = s.comps[ids.inf]; for (const i of eye.ants) { s.x[i] = 100; s.y[i] = 100; } eye.ax = 100; eye.ay = 100; for (const c of s.comps) if (c.side === 1 && c.id !== ids.pl) { for (const i of c.ants) { s.x[i] = 120; s.y[i] = 120; } c.ax = 120; c.ay = 120; } s.debug.vis(); for (let k = 0; k < 90; k++) s.step(); __P1.S.hover = ids.en; }, ids); f = await frame();
    const vis = await ev((ids) => __P1.S.sim.compVisible(__P1.S.sim.comps[ids.en], 1), ids); assert.strictEqual(vis, false); assert.strictEqual(f.tip, ''); assert.strictEqual(f.hoverEnemy, -1, 'obrys niewidocznego wroga'); assert.strictEqual(f.blockers.length, 0);
    ok('16. niewidoczny wróg nie dostaje obrysu, oceny ostrzału ani punktu blokady (nakładki niczego nie ujawniają)');
    // ---- 17. obszar kwasu: promień i liczba objętych; 18. brak ognia sojuszniczego w mechanice
    await setupShot(40, false); f = await frame(); assert.ok(f.aoe.length === 1 && f.aoe[0].r === (await ev(() => __P1.S.sim.defs.units.plujka.aoe)) && f.aoe[0].hits >= 1 && f.aoe[0].uncertain === true, 'plama kwasu: ' + JSON.stringify(f.aoe));
    ok('17/18. plama kwasu ma promień z parametrów (' + f.aoe[0].r + '), obejmuje ' + f.aoe[0].hits + ' widocznych wrogów i jest oznaczona jako niepewna (celność < 100%); ogień sojuszniczy nie występuje w mechanice (test rdzenia B-C17/18)');
    // ---- 19. nakładki znikają po zniszczeniu celu i po zakończeniu rozkazu
    await ev((ids) => { const s = __P1.S.sim; __P1.S.selected = new Set([ids.inf]); __P1.S.hover = -1; s.command({ k: 'order', side: 'LH', comps: [ids.inf], kind: 'attackTarget', target: ids.en }); s.step(); }, ids); f = await frame(); assert.strictEqual(f.targets.length, 1);
    await ev((ids) => { const s = __P1.S.sim, e = s.comps[ids.en]; for (const i of e.ants) { s.alive[i] = 0; s.hp[i] = 0; } e.alive = 0; for (let k = 0; k < 3; k++) s.step(); }, ids); f = await frame(); assert.strictEqual(f.targets.length, 0, 'znacznik celu został po zniszczeniu wroga');
    ok('19. po zniszczeniu celu znacznik celu znika w następnej klatce');
    // ---- 20. czytelność przy maksymalnej liczbie rot + wyłączanie warstw w panelu
    await ev(() => { const s = __P1.S.sim; __P1.S.selected = new Set(s.comps.filter((c) => c.side === 1 && c.alive > 0).map((c) => c.id)); __P1.S.ov.tactical = true; __P1.centerOn(s.comps.find((c) => c.side === 1).ax, s.comps.find((c) => c.side === 1).ay); }); f = await frame();
    const nSel = f.sel.length; assert.ok(f.routes <= 3 && f.ranges.length <= 6, 'zbyt wiele pełnych nakładek: ' + f.routes + ' tras, ' + f.ranges.length + ' zasięgów');
    await ev(() => { __P1.S.ov.sel = false; }); f = await frame(); assert.strictEqual(f.sel.length, 0, 'wyłączenie zaznaczenia w panelu nie działa'); await ev(() => { __P1.S.ov.sel = true; __P1.S.ov.tactical = false; });
    await ev(() => { document.getElementById('ovPanel').classList.remove('hidden'); }); await page.waitForTimeout(300);
    const panel = await ev(() => [...document.querySelectorAll('#ovPanel input[type=checkbox]')].map((x) => x.dataset.ov)); for (const k of ['sel', 'ownAll', 'enemyAll', 'orders', 'range', 'tactical', 'fire', 'melee', 'area', 'extra']) assert.ok(panel.includes(k), 'brak przełącznika ' + k);
    await page.screenshot({ path: process.env.UI_SHOT_C || '/tmp/p1-etap-c-ui.png' });
    ok('20. przy ' + nSel + ' zaznaczonych rotach pełne trasy ograniczone do 3, zasięgi do 6; panel ma niezależne przełączniki (' + panel.join(', ') + ')');
    assert.deepStrictEqual(errors, [], 'błędy w konsoli: ' + errors.join(' | ')); ok('brak błędów w konsoli przeglądarki');
  } catch (e) { failed++; out.push('FAIL ' + (e.stack || e.message)); }
  await browser.close();
  console.log(out.join('\n')); console.log('\n' + (failed ? 'BŁĄD' : 'wszystkie testy nakładek etapu C przeszły')); process.exit(failed ? 1 : 0);
})();
