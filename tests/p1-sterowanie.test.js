// Test akceptacyjny sterowania wzorowanego na Total War (przeglądarka, prawdziwe zdarzenia myszy i klawiatury).
// Przypadki numerowane jak w sekcji 13 specyfikacji sterowania (docs/sterowanie-total-war.md).
const assert = require('assert');
const { openPage } = require('./browser-lib');

(async () => {
  const out = []; let failed = 0;
  const ok = (name, note) => out.push('OK   ' + name + (note ? '\n       ' + note : ''));
  const { browser, page, errors } = await openPage('autostart=1&side=WK&seed=1&scenario=bitwa&map=1&speed=1');
  const ev = (fn, arg) => page.evaluate(fn, arg);
  // pozycja na stronie dla punktu świata
  const at = async (x, y) => ev(([x, y]) => { const r = __P1.app.view.getBoundingClientRect(), p = __P1.toScreen(x, y); return [r.left + p[0], r.top + p[1]]; }, [x, y]);
  const comp = (id) => ev((id) => { const c = __P1.S.sim.comps[id]; return { id: c.id, ax: c.ax, ay: c.ay, face: c.face, alive: c.alive, order: JSON.parse(JSON.stringify(c.order)), queue: JSON.parse(JSON.stringify(c.queue)), fcols: c.fcols, spacing: c.spacing, name: c.name, abil: c.abilType }; }, id);
  const sel = () => ev(() => [...__P1.S.selected].sort((a, b) => a - b));
  const flush = (steps) => ev((n) => { const s = __P1.S.sim; s.flush(); for (let k = 0; k < (n || 0); k++) s.step(); }, steps);
  const click = async (x, y, opt) => { await page.mouse.click(x, y, opt); };
  try {
    await page.waitForFunction(() => window.__P1 && __P1.S.sim && __P1.S.sim.tick > 10, null, { timeout: 120000 });
    await ev(() => { __P1.S.paused = true; __P1.S.selected.clear(); __P1.ctl.doubleClickMs = 4000; });   // renderer programowy w piaskownicy daje kilka klatek na sekundę, więc okno dwukrotnego kliknięcia jest dłuższe niż domyślne 350 ms
    const own = await ev(() => __P1.S.sim.comps.filter((c) => c.side === 0).map((c) => c.id));
    const A = own[0], B = own[1], C = own[2], T = own.find((id) => true);
    // ustawienie: wróg blisko roty A i widoczny dla gracza (test sprawdza sterowanie, a nie widoczność)
    const E = await ev((A) => {
      const s = __P1.S.sim, a = s.comps[A], e = s.comps.find((c) => c.side === 1 && c.role === 'reserve') || s.comps.find((c) => c.side === 1);
      const dx = a.ax + 140 - e.ax, dy = a.ay - e.ay; for (const i of e.ants) { s.x[i] += dx; s.y[i] += dy; } e.ax += dx; e.ay += dy; e.order = { kind: 'hold', x: e.ax, y: e.ay, face: null, done: false };
      s.debug.vis(); return e.id;
    }, A);
    await flush(1);
    // ---- 1. LPM na własnej jednostce zaznacza ją bez zmiany zachowania
    const aPos = await at((await comp(A)).ax, (await comp(A)).ay), orderBefore = (await comp(A)).order;
    await click(aPos[0], aPos[1]); await page.waitForTimeout(50);
    assert.deepStrictEqual(await sel(), [A], 'LPM nie zaznaczył roty'); assert.deepStrictEqual((await comp(A)).order, orderBefore, 'LPM zmienił rozkaz');
    ok('1. LPM na własnej jednostce zaznacza ją bez zmiany jej rozkazu');
    // ---- 2. LPM na przeciwniku nie wywołuje ataku (i nie zmienia zaznaczenia)
    const ePos = await at((await comp(E)).ax, (await comp(E)).ay);
    await click(ePos[0], ePos[1]); await page.waitForTimeout(50); await flush(1);
    const afterEnemy = await comp(A); assert.strictEqual(afterEnemy.order.kind, orderBefore.kind, 'LPM na wrogu zmienił rozkaz'); assert.deepStrictEqual(await sel(), [A], 'LPM na wrogu zmienił zaznaczenie');
    assert.strictEqual(await ev(() => __P1.S.pinned), E, 'LPM na wrogu nie pokazał informacji o przeciwniku');
    ok('2. LPM na przeciwniku nie wydaje ataku ani nie zmienia zaznaczenia, pokazuje informacje o przeciwniku');
    // ---- 3. LPM na pustym terenie odznacza
    const empty = await at(300, 150); await click(empty[0], empty[1]); await page.waitForTimeout(50);
    assert.deepStrictEqual(await sel(), [], 'LPM na pustym terenie nie odznaczył'); assert.strictEqual((await comp(A)).order.kind, orderBefore.kind);
    ok('3. LPM na pustym terenie odznacza jednostki bez rozkazu ruchu');
    // ---- 4. Ctrl + LPM dodaje i usuwa
    const bPos = await at((await comp(B)).ax, (await comp(B)).ay), aPos2 = await at((await comp(A)).ax, (await comp(A)).ay);
    await click(aPos2[0], aPos2[1]); await page.keyboard.down('Control'); await click(bPos[0], bPos[1]); await page.keyboard.up('Control'); await page.waitForTimeout(50);
    assert.deepStrictEqual(await sel(), [A, B].sort((x, y) => x - y), 'Ctrl+LPM nie dodał');
    await page.keyboard.down('Control'); await click(bPos[0], bPos[1]); await page.keyboard.up('Control'); await page.waitForTimeout(50);
    assert.deepStrictEqual(await sel(), [A], 'Ctrl+LPM nie usunął');
    ok('4. Ctrl + LPM dodaje jednostkę do zaznaczenia, a drugi raz usuwa');
    // ---- 5. ramka zaznacza wiele, nie zaznacza wrogów; próg 6 px: poniżej to kliknięcie
    const pts = []; for (const id of [A, B, C]) { const c = await comp(id); pts.push(await at(c.ax, c.ay)); }
    const p0 = [Math.min(...pts.map((q) => q[0])) - 90, Math.min(...pts.map((q) => q[1])) - 90], p1 = [Math.max(...pts.map((q) => q[0])) + 90, Math.max(...pts.map((q) => q[1])) + 90];
    await page.mouse.move(p0[0], p0[1]); await page.mouse.down(); await page.mouse.move((p0[0] + p1[0]) / 2, (p0[1] + p1[1]) / 2, { steps: 4 }); await page.mouse.move(p1[0], p1[1], { steps: 4 });
    const during = await ev(() => __P1.S.sim && true); await page.mouse.up(); await page.waitForTimeout(50);
    const picked = await sel(), enemyPicked = await ev(() => [...__P1.S.selected].some((id) => __P1.S.sim.comps[id].side !== 0));
    assert.ok(picked.length >= 2 && !enemyPicked, 'ramka: ' + picked); void during;
    ok('5. Przeciągnięcie LPM zaznacza wiele rot, bez wrogów (' + picked.length + ' rot)');
    // ---- Ctrl + A
    await page.keyboard.down('Control'); await page.keyboard.press('KeyA'); await page.keyboard.up('Control'); await page.waitForTimeout(50);
    assert.strictEqual((await sel()).length, own.length, 'Ctrl+A nie zaznaczył całej armii'); ok('2.3 Ctrl + A zaznacza wszystkie własne roty (' + own.length + ')');
    // ---- 6. PPM na terenie = rozkaz ruchu (bez walki po drodze)
    await click(aPos2[0], aPos2[1]); await page.waitForTimeout(30);
    const a0 = await comp(A), dest = [a0.ax - 120, a0.ay + 90], dp = await at(dest[0], dest[1]);
    await click(dp[0], dp[1], { button: 'right' }); await flush(1);
    const mv = await comp(A); assert.strictEqual(mv.order.kind, 'move', 'PPM na terenie nie wydał ruchu: ' + mv.order.kind); assert.ok(Math.hypot(mv.order.x - dest[0], mv.order.y - dest[1]) < 20, 'zły cel ruchu');
    ok('6. PPM na terenie wydaje rozkaz ruchu (kind=move, bez walki po drodze)');
    // ---- 7. dwukrotny PPM = szybki ruch (jeden efektywny rozkaz)
    const dest2 = [620, 250], d2 = await at(dest2[0], dest2[1]);
    await page.mouse.click(d2[0], d2[1], { button: 'right' }); await page.mouse.click(d2[0], d2[1], { button: 'right' }); await flush(1);
    const rn = await comp(A); assert.strictEqual(rn.order.kind, 'move'); assert.strictEqual(rn.order.run, true, 'dwukrotny PPM nie dał szybkiego ruchu'); assert.strictEqual(rn.queue.length, 0, 'dwukrotny PPM dodał rozkaz do kolejki');
    ok('7. Dwukrotny PPM na terenie: jeden rozkaz szybkiego ruchu (run=true, kolejka pusta)');
    // ---- 8. PPM na przeciwniku = atak na wskazaną rotę
    const e0 = await comp(E), ep = await at(e0.ax, e0.ay);
    await click(ep[0], ep[1], { button: 'right' }); await flush(1);
    const at1 = await comp(A); assert.strictEqual(at1.order.kind, 'attackTarget', 'PPM na wrogu nie wydał ataku'); assert.strictEqual(at1.order.target, E);
    const x0 = at1.ax; await flush(60); const at2 = await comp(A); assert.ok(Math.hypot(at2.ax - e0.ax, at2.ay - e0.ay) < Math.hypot(x0 - e0.ax, a0.ay - e0.ay) + 5, 'rota nie podchodzi do celu');
    ok('8. PPM na przeciwniku: rozkaz ataku na wskazaną rotę, rota podchodzi do celu');
    // ---- 9. dwukrotny PPM na przeciwniku = szarża, jeśli rota ją ma; inaczej zwykły atak
    const tar = await ev(() => { const c = __P1.S.sim.comps.find((q) => q.side === 0 && q.abilType === 'taran'); return c ? c.id : -1; });
    await ev((id) => { __P1.S.selected.clear(); if (id >= 0) __P1.S.selected.add(id); }, tar);
    if (tar >= 0) { await ev(() => { __P1.S.lastR = null; }); await page.mouse.click(ep[0], ep[1], { button: 'right' }); await page.mouse.click(ep[0], ep[1], { button: 'right' }); await flush(1); const tc = await comp(tar); assert.strictEqual(tc.order.kind, 'attackTarget'); assert.strictEqual(tc.order.charge, true, 'dwukrotny PPM nie zlecił szarży'); }
    ok('9. Dwukrotny PPM na przeciwniku zleca szarżę rocie z umiejętnością szarży (rota taranów); pozostałe używają zwykłego ataku');
    // ---- 14. Shift + PPM dodaje do kolejki; wykonanie po kolei
    await ev((id) => { __P1.S.selected.clear(); __P1.S.selected.add(id); const s = __P1.S.sim; s.command({ k: 'order', side: 'WK', comps: [id], kind: 'hold', x: s.comps[id].ax, y: s.comps[id].ay }); s.flush(); }, B);
    const b0 = await comp(B), pA = [300, 170], pB = [430, 170];   // wolny teren z dala od rot i wroga
    const sA = await at(pA[0], pA[1]), sB = await at(pB[0], pB[1]);
    await click(sA[0], sA[1], { button: 'right' }); await page.keyboard.down('Shift'); await click(sB[0], sB[1], { button: 'right' }); await page.keyboard.up('Shift'); await flush(1);
    const q1 = await comp(B); assert.strictEqual(q1.order.kind, 'move', 'kolejka: ' + JSON.stringify({ o: q1.order, hit: await ev(() => __P1.R.hit), b0, sA, sB, sel: await sel() })); assert.strictEqual(q1.queue.length, 1, 'Shift+PPM nie dodał do kolejki'); assert.ok(Math.hypot(q1.queue[0].x - pB[0], q1.queue[0].y - pB[1]) < 20);
    await flush(20 * 12); const q2 = await comp(B); assert.ok(Math.hypot(q2.ax - pB[0], q2.ay - pB[1]) < 8, 'rota nie doszła do drugiego punktu kolejki: ' + [q2.ax, q2.ay, pB]); assert.strictEqual(q2.queue.length, 0);
    // nowy rozkaz bez Shift czyści kolejkę
    await click(sA[0], sA[1], { button: 'right' }); await page.keyboard.down('Shift'); await click(sB[0], sB[1], { button: 'right' }); await page.keyboard.up('Shift'); await flush(1);
    const sC = await at(560, 170); await click(sC[0], sC[1], { button: 'right' }); await flush(1); assert.strictEqual((await comp(B)).queue.length, 0, 'nowy rozkaz bez Shift nie wyczyścił kolejki');
    ok('14. Shift + PPM dodaje rozkazy do kolejki, wykonywane po kolei; rozkaz bez Shift anuluje kolejkę');
    // ---- 11. gest PPM z przeciąganiem: środek, kierunek, szerokość z długości gestu; podgląd w trakcie
    await ev((id) => { __P1.S.selected.clear(); __P1.S.selected.add(id); }, C);
    const c0 = await comp(C), gc = [c0.ax + 60, c0.ay + 60], s0 = await at(gc[0], gc[1]), s1 = await at(gc[0] + 120, gc[1]);
    await page.mouse.move(s0[0], s0[1]); await page.mouse.down({ button: 'right' }); await page.mouse.move(s1[0], s1[1], { steps: 5 });
    const prev = await ev(() => ({ moved: __P1.R.moved, face: __P1.R.face, width: __P1.R.width })); assert.ok(prev.moved && Math.abs(prev.width - 120) < 25, 'podgląd: ' + JSON.stringify(prev));
    await page.mouse.up({ button: 'right' }); await flush(1);
    const fo = await comp(C); assert.ok(Math.abs(Math.cos(fo.order.face) - 1) < 0.2 || Math.abs(fo.order.face) < 0.3, 'kierunek frontu: ' + fo.order.face);
    const expectCols = Math.round(prev.width / fo.spacing) + 1; assert.ok(Math.abs(fo.fcols - Math.max(3, Math.min(fo.alive, expectCols))) <= 1, 'szerokość szyku z długości gestu: ' + fo.fcols + ' vs ' + expectCols);
    ok('11. Gest PPM z przeciąganiem: podgląd w trakcie, po zwolnieniu rozkaz ruchu z kierunkiem frontu i szerokością z długości gestu', 'długość ' + Math.round(prev.width) + ' -> kolumn ' + fo.fcols);
    // ---- 12/13. Alt + LPM: przesunięcie grupy z zachowaniem układu; Ctrl obraca
    await ev(() => { __P1.S.selected.clear(); const ids = __P1.S.sim.comps.filter((c) => c.side === 0).slice(0, 3).map((c) => c.id); ids.forEach((id) => { __P1.S.selected.add(id); const s = __P1.S.sim, c = s.comps[id]; s.command({ k: 'order', side: 'WK', comps: [id], kind: 'hold', x: c.ax, y: c.ay }); }); __P1.S.sim.flush(); });
    const grp = await sel(); const before = []; for (const id of grp) before.push(await comp(id));
    const gs = await at(before[0].ax, before[0].ay), ge = await at(before[0].ax + 100, before[0].ay + 20);
    await page.keyboard.down('Alt'); await page.mouse.move(gs[0], gs[1]); await page.mouse.down(); await page.mouse.move(ge[0], ge[1], { steps: 6 });
    assert.ok(await ev(() => __P1.G && __P1.G.type === 'group' && __P1.G.moved), 'Alt+LPM nie rozpoczął przesuwania grupy');
    await page.mouse.up(); await page.keyboard.up('Alt'); await flush(1);
    const after = []; for (const id of grp) after.push(await comp(id));
    const rel = (arr, key) => arr.map((c) => [c.ax - arr[0].ax, c.ay - arr[0].ay]); void rel;
    const tgt = after.map((c) => [c.order.x, c.order.y]); const d0 = [tgt[0][0] - before[0].ax, tgt[0][1] - before[0].ay];
    for (let i = 1; i < grp.length; i++) { const dx = tgt[i][0] - before[i].ax, dy = tgt[i][1] - before[i].ay; assert.ok(Math.hypot(dx - d0[0], dy - d0[1]) < 14, 'grupa nie zachowała układu przy przesunięciu: ' + [dx, dy, d0]); }
    ok('12. Alt + LPM i przeciągnięcie przesuwa grupę o ten sam wektor (układ rot zachowany)', 'wektor ' + d0.map(Math.round));
    // obrót: Alt+Ctrl
    await ev((ids) => { ids.forEach((id) => { const s = __P1.S.sim, c = s.comps[id]; s.command({ k: 'order', side: 'WK', comps: [id], kind: 'hold', x: c.ax, y: c.ay }); }); __P1.S.sim.flush(); }, grp);
    const bf = []; for (const id of grp) bf.push(await comp(id)); const cx0 = bf.reduce((t, c) => t + c.ax, 0) / bf.length, cy0 = bf.reduce((t, c) => t + c.ay, 0) / bf.length;
    const rs = await at(cx0 + 120, cy0), re = await at(cx0, cy0 + 120);
    await page.keyboard.down('Alt'); await page.keyboard.down('Control'); await page.mouse.move(rs[0], rs[1]); await page.mouse.down(); await page.mouse.move(re[0], re[1], { steps: 6 }); await page.mouse.up(); await page.keyboard.up('Control'); await page.keyboard.up('Alt'); await flush(1);
    const af = []; for (const id of grp) af.push(await comp(id));
    for (let i = 0; i < grp.length; i++) for (let j = i + 1; j < grp.length; j++) { const d1 = Math.hypot(bf[i].ax - bf[j].ax, bf[i].ay - bf[j].ay), d2 = Math.hypot(af[i].order.x - af[j].order.x, af[i].order.y - af[j].order.y); assert.ok(Math.abs(d1 - d2) < 14, 'obrót grupy zmienił odstępy: ' + d1 + ' -> ' + d2); }
    assert.ok(af.every((c, i) => c.fcols === bf[i].fcols), 'obrót zmienił szerokość szyku');
    ok('13. Alt + Ctrl + przeciągnięcie obraca grupę wokół środka: odstępy między rotami i szerokość szyków bez zmian');
    // ---- 17. brak drogi: rozkaz odrzucony, czerwony krzyżyk i komunikat, rozkaz roty bez zmian (15 i 16: trasa z pathfindingu omija ściany i ich nie przekracza, testy rdzenia)
    await ev(() => { __P1.S.selected.clear(); __P1.S.selected.add(0); const s = __P1.S.sim, px = 1400, py = 300, C = s.COLS; for (let yy = Math.floor(py / 16) - 3; yy <= Math.floor(py / 16) + 3; yy++) for (let xx = Math.floor(px / 16) - 3; xx <= Math.floor(px / 16) + 3; xx++) if (Math.max(Math.abs(yy - Math.floor(py / 16)), Math.abs(xx - Math.floor(px / 16))) === 3) s.grid[yy * C + xx] = 1; __P1.markers.length = 0; });
    const keepOrder = JSON.stringify((await comp(0)).order); const pocket = await at(1400, 300);
    await ev(() => { __P1.S.lastR = null; }); await click(pocket[0], pocket[1], { button: 'right' }); await flush(1);
    assert.strictEqual(JSON.stringify((await comp(0)).order), keepOrder, 'rozkaz bez drogi został przyjęty');
    assert.ok(await ev(() => __P1.markers.some((m) => m.kind === 'bad')), 'brak czerwonego krzyżyka dla niedostępnego celu'); assert.ok(await ev(() => /Brak drogi/.test(document.getElementById('ticker').textContent)), 'brak komunikatu o braku drogi');
    ok('17. Rozkaz ruchu do niedostępnego punktu: czerwony krzyżyk i komunikat, rozkaz roty bez zmian (bez trasy przez ścianę)');
    // ---- 19. usunięcie jednostki z gry nie psuje zapisanych grup
    await ev(() => { __P1.S.selected.clear(); __P1.S.sim.comps.filter((c) => c.side === 0).slice(0, 2).forEach((c) => __P1.S.selected.add(c.id)); });
    await page.keyboard.down('Control'); await page.keyboard.press('Digit4'); await page.keyboard.up('Control');
    const gsel = await ev(() => __P1.S.groups['4'].slice()); assert.strictEqual(gsel.length, 2);
    await ev((id) => { const s = __P1.S.sim, c = s.comps[id]; for (const i of c.ants) { s.alive[i] = 0; s.hp[i] = 0; } c.alive = 0; }, gsel[0]);
    await page.waitForTimeout(200);
    const gafter = await ev(() => (__P1.S.groups['4'] || []).slice()); assert.ok(!gafter.includes(gsel[0]), 'martwa rota została w zapisanej grupie');
    await page.keyboard.press('Digit4'); await page.waitForTimeout(50); assert.ok(!(await sel()).includes(gsel[0]));
    ok('19. Zniszczenie roty usuwa ją z zapisanych grup i zaznaczenia (bez błędów)');
    // ---- 18. zniszczenie celu usuwa rozkaz ataku i przechodzi do następnego z kolejki
    const live = await ev(() => __P1.S.sim.comps.filter((c) => c.side === 0 && c.alive > 0).map((c) => c.id)); const F = live[live.length - 1];
    await ev(([id, e]) => { const s = __P1.S.sim; s.debug.vis(); s.command({ k: 'order', side: 'WK', comps: [id], kind: 'attackTarget', target: e }); const c = s.comps[id]; s.command({ k: 'order', side: 'WK', comps: [id], kind: 'move', x: c.ax + 30, y: c.ay, queue: true }); s.flush(); }, [F, E]);
    const hasAtk = await ev((id) => __P1.S.sim.comps[id].order.kind, F); assert.strictEqual(hasAtk, 'attackTarget');
    await ev((e) => { const s = __P1.S.sim, c = s.comps[e]; for (const i of c.ants) { s.alive[i] = 0; s.hp[i] = 0; } c.alive = 0; }, E); await flush(30);
    const gone = await comp(F); assert.ok(gone.order.kind !== 'attackTarget' || gone.order.done, 'rozkaz ataku zniszczonego celu został aktywny'); assert.strictEqual(gone.order.kind, 'move', 'po zniszczeniu celu nie wykonano następnego rozkazu z kolejki: ' + JSON.stringify({ o: gone.order, q: gone.queue, st: await ev((id) => [__P1.S.sim.comps[id].cstate, __P1.S.sim.comps[id].alive], F) }));
    ok('18. Zniszczenie celu kończy rozkaz ataku i uruchamia następny z kolejki');
    // ---- 20. Backspace zatrzymuje i czyści kolejkę; G grupuje; Ctrl+G blokuje
    await ev((id) => { __P1.S.selected.clear(); __P1.S.selected.add(id); const s = __P1.S.sim, c = s.comps[id]; s.command({ k: 'order', side: 'WK', comps: [id], kind: 'move', x: c.ax + 200, y: c.ay }); s.command({ k: 'order', side: 'WK', comps: [id], kind: 'move', x: c.ax + 200, y: c.ay + 100, queue: true }); s.flush(); }, F);
    await page.keyboard.press('Backspace'); await flush(1); const st = await comp(F); assert.strictEqual(st.order.kind, 'hold'); assert.strictEqual(st.queue.length, 0);
    await ev(() => { __P1.S.selected.clear(); __P1.S.sim.comps.filter((c) => c.side === 0 && c.alive > 0).slice(0, 3).forEach((c) => __P1.S.selected.add(c.id)); });
    await page.keyboard.press('KeyG'); assert.strictEqual(await ev(() => __P1.S.cgroups.length), 1, 'G nie zgrupowało');
    await page.keyboard.down('Control'); await page.keyboard.press('KeyG'); await page.keyboard.up('Control'); assert.strictEqual(await ev(() => __P1.S.cgroups[0].locked), true, 'Ctrl+G nie zablokowało formacji');
    const one = await ev(() => [...__P1.S.cgroups[0].ids][0]); await ev((id) => { __P1.S.selected.clear(); }, one); const ps = await at((await comp(one)).ax, (await comp(one)).ay); await click(ps[0], ps[1]);
    assert.strictEqual((await sel()).length, 3, 'wybór jednej roty zgrupowanej nie zaznaczył całej grupy');
    await page.keyboard.press('KeyG'); assert.strictEqual(await ev(() => __P1.S.cgroups.length), 0, 'G nie rozgrupowało');
    ok('20. Backspace zatrzymuje i czyści kolejkę; G grupuje i rozgrupowuje (grupa zaznacza się razem); Ctrl+G blokuje układ');
    // ---- 10. wiele rot atakuje jeden cel: rozkład po celu i brak trwałego zablokowania (test rdzenia: tests/p1-core.test.js)
    assert.deepStrictEqual(errors.filter((e) => !/favicon/.test(e)), [], 'błędy w konsoli: ' + errors.join(' | '));
    ok('brak błędów w konsoli przeglądarki');
  } catch (e) { failed++; out.push('FAIL ' + e.message.split('\n').slice(0, 6).join('\n'));  }
  console.log(out.join('\n')); await browser.close();
  console.log(failed ? '\nTEST STEROWANIA: NIEPOWODZENIE' : '\nTEST STEROWANIA: wszystko przeszło'); process.exit(failed ? 1 : 0);
})();
