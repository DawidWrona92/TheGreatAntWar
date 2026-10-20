// Test przeglądarkowy P1: prawdziwy plik HTML w Chromium (PixiJS z node_modules zamiast CDN).
// Uwaga: FPS w piaskownicy (renderer programowy) nie mówi nic o kryterium 50 FPS na typowym PC.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { openPage, ROOT } = require('./browser-lib');

(async () => {
  const out = [], shots = path.join(ROOT, 'docs', 'wyniki'); fs.mkdirSync(shots, { recursive: true });
  const ok = (name, note) => { out.push('OK   ' + name + (note ? '\n       ' + note : '')); };
  let failed = 0;
  const { browser, page, errors } = await openPage('autostart=1&side=WK&seed=1&speed=4&autoselect=1');
  try {
    await page.waitForFunction(() => window.__P1 && __P1.S.sim && __P1.S.sim.tick > 40, null, { timeout: 30000 });
    ok('gra startuje bez błędów, symulacja idzie, rysowanie działa', 'tick ' + await page.evaluate(() => __P1.S.sim.tick));
    const png = await page.screenshot({ path: path.join(shots, 'p1-ekran-start.png') });
    const nonBg = await page.evaluate(() => { const c = __P1.app.view; const t = document.createElement('canvas'); t.width = 64; t.height = 40; t.getContext('2d').drawImage(c, 0, 0, 64, 40); const d = t.getContext('2d').getImageData(0, 0, 64, 40).data; let n = 0; for (let i = 0; i < d.length; i += 4) if (d[i] > 120) n++; return n; }).catch(() => -1);
    assert.ok(png.length > 20000, 'zrzut ekranu wygląda na pusty');

    // kółko myszy: punkt pod kursorem zostaje pod kursorem, a mapa nie ucieka z ekranu (regresja: zoom przy widoku izometrycznym)
    const under = () => page.evaluate(([mx, my]) => { const c = __P1.cam; return [(mx - c.x) / c.z, (my - c.y) / c.z, c.z, c.x, c.y]; }, [700, 380]);
    const u0 = await under(); await page.mouse.move(700, 380);
    for (let i = 0; i < 5; i++) await page.mouse.wheel(0, -240);
    await page.waitForTimeout(200); const u1 = await under();
    assert.ok(u1[2] > u0[2] * 1.5, 'zoom nie działa');
    assert.ok(Math.abs(u1[0] - u0[0]) < 1 && Math.abs(u1[1] - u0[1]) < 1, 'punkt pod kursorem uciekł: ' + u0 + ' → ' + u1);
    for (let i = 0; i < 12; i++) await page.mouse.wheel(0, 300);
    await page.waitForTimeout(200);
    const u2 = await page.evaluate(() => { const c = __P1.cam, w = __P1.app.screen; return [c.x, c.y, w.width, w.height]; });
    assert.ok(u2[0] < u2[2] && u2[1] < u2[3], 'kamera uciekła poza ekran');
    ok('kółko myszy przybliża wokół kursora i nie gubi mapy', 'zoom ' + u0[2].toFixed(2) + ' → ' + u1[2].toFixed(2));
    await page.evaluate(() => __P1.S.sim && (function () { const c = __P1.cam; }()));

    // pauza + rozkaz w pauzie
    await page.keyboard.press('Space');
    const t0 = await page.evaluate(() => __P1.S.sim.tick);
    await page.waitForTimeout(400);
    const t1 = await page.evaluate(() => __P1.S.sim.tick);
    assert.strictEqual(t0, t1, 'pauza nie zatrzymała symulacji');
    const before = await page.evaluate(() => JSON.stringify(__P1.S.sim.comps[0].order));
    await page.mouse.click(900, 300, { button: 'right' });
    const after = await page.evaluate(() => JSON.stringify(__P1.S.sim.comps[0].order));
    assert.notStrictEqual(before, after, 'rozkaz wydany w pauzie nie zadziałał');
    assert.strictEqual(await page.evaluate(() => __P1.S.sim.tick), t1);
    ok('pauza zatrzymuje czas, a rozkaz PPM działa w pauzie', before + ' → ' + after);

    // kilka zaznaczonych rot jedzie w szyku (zachowują wzajemne rozmieszczenie), pojedyncza idzie dokładnie w wskazany punkt
    const g = await page.evaluate(() => { const S = __P1.S, cs = [0, 1, 2].map((i) => S.sim.comps[i]); S.selected.clear(); cs.forEach((c) => S.selected.add(c.id)); return cs.map((c) => [c.ax, c.ay]); });
    await page.mouse.click(760, 420, { button: 'right' }); await page.waitForTimeout(300);
    const og = await page.evaluate(() => [0, 1, 2].map((i) => { const o = __P1.S.sim.comps[i].order; return [o.x, o.y]; }));
    for (let i = 1; i < 3; i++) assert.ok(Math.abs((og[i][0] - og[0][0]) - (g[i][0] - g[0][0])) < 2 && Math.abs((og[i][1] - og[0][1]) - (g[i][1] - g[0][1])) < 2, 'grupa nie zachowała szyku: ' + JSON.stringify([g, og]));
    const one = await page.evaluate(() => { const S = __P1.S; S.selected.clear(); S.selected.add(5); return null; });
    await page.mouse.click(760, 420, { button: 'right' }); await page.waitForTimeout(300);
    const o1 = await page.evaluate(() => { const o = __P1.S.sim.comps[5].order, c = __P1.cam; const cx = (760 - c.x) / c.z, cy = (420 - c.y) / c.z; return [o.x, o.y, __P1.ISO.wx(cx, cy), __P1.ISO.wy(cx, cy)]; });
    assert.ok(Math.hypot(o1[0] - o1[2], o1[1] - o1[3]) < 2, 'pojedyncza rota nie idzie w kliknięty punkt: ' + o1);
    ok('grupa rot zachowuje szyk, pojedyncza rota idzie w wskazany punkt');

    // formacje, umiejętność, odwrót, stój klawiszami
    await page.evaluate(() => { const S = __P1.S; S.selected.clear(); S.sim.comps.filter((c) => c.side === 0).forEach((c) => S.selected.add(c.id)); });
    await page.keyboard.press('KeyC');
    assert.strictEqual(await page.evaluate(() => __P1.S.sim.comps[0].formation), 2, 'klin');
    await page.keyboard.press('KeyZ');
    assert.strictEqual(await page.evaluate(() => __P1.S.sim.comps[0].formation), 0, 'linia');
    await page.keyboard.press('KeyV');
    assert.strictEqual(await page.evaluate(() => __P1.S.sim.comps[0].order.kind), 'retreat');
    await page.keyboard.press('KeyH');
    assert.strictEqual(await page.evaluate(() => __P1.S.sim.comps[0].order.kind), 'hold');
    ok('formacje (Z/X/C), odwrót (V) i stój (H) zmieniają stan rot');

    // umiejętności: siatka po prawej, klik wywołuje umiejętność zaznaczonych rot
    const abOk = await page.evaluate(() => { const S = __P1.S; S.selected.clear(); const g = S.sim.comps.find((c) => c.side === 0 && /^Gwardia/.test(c.name)); S.selected.add(g.id); return g.id; });
    await page.waitForTimeout(300);
    const cell = await page.$('#abGrid .ab:not(.off):not(.lock)'); assert.ok(cell, 'brak aktywnej umiejętności dla zaznaczonej gwardii');
    const before2 = await page.evaluate((id) => __P1.S.sim.comps[id].abilCdUntil, abOk); await cell.click(); await page.waitForTimeout(300);
    assert.ok(await page.evaluate((id) => __P1.S.sim.comps[id].abilCdUntil, abOk) > before2, 'klik w umiejętność nie zadziałał');
    const g2 = await page.evaluate(() => { const S = __P1.S; S.selected.clear(); const gs = S.sim.comps.filter((c) => c.side === 0 && /^Gwardia/.test(c.name)); S.selected.add(gs[1].id); return [gs[1].id, gs[1].abilCdUntil]; });
    await page.keyboard.press('KeyQ'); await page.waitForTimeout(300);
    assert.ok(await page.evaluate((id) => __P1.S.sim.comps[id].abilCdUntil, g2[0]) > g2[1], 'klawisz Q nie uruchomił umiejętności');
    assert.strictEqual(await page.$$eval('#abGrid .ab', (els) => els.length), 9, 'siatka umiejętności ma mieć 9 pól');
    ok('siatka umiejętności 3x3: klik uruchamia umiejętność roty, są 9 pól (5 umiejętności + miejsca na kolejne)');

    // przeciągnięcie PPM ustawia kierunek szyku, kółko w trakcie przeciągania zmienia szerokość
    await page.evaluate(() => { const S = __P1.S; S.selected.clear(); S.selected.add(0); });
    const colsBefore = await page.evaluate(() => __P1.S.sim.comps[0].fcols);
    await page.mouse.move(600, 380); await page.mouse.down({ button: 'right' }); await page.mouse.move(690, 340, { steps: 6 });
    await page.mouse.wheel(0, -100); await page.mouse.wheel(0, -100); await page.mouse.up({ button: 'right' }); await page.waitForTimeout(300);
    const od = await page.evaluate(() => { const c = __P1.S.sim.comps[0]; return { face: c.order.face, cols: c.fcols }; });
    assert.ok(od.face != null && isFinite(od.face), 'przeciągnięcie nie ustawiło kierunku');
    assert.ok(od.cols > (colsBefore || 0) && od.cols >= 4, 'kółko w trakcie przeciągania nie zmieniło szerokości: ' + JSON.stringify(od));
    ok('przeciągnięcie PPM: kierunek szyku i szerokość (kółko)', 'kierunek ' + od.face.toFixed(2) + ' rad, kolumny ' + od.cols);

    // grupy: Ctrl+1 zapisuje, 1 przywołuje
    await page.evaluate(() => { __P1.S.selected.clear(); __P1.S.selected.add(0); __P1.S.selected.add(1); });
    await page.keyboard.press('Control+Digit1');
    await page.evaluate(() => __P1.S.selected.clear());
    await page.keyboard.press('Digit1');
    assert.strictEqual(await page.evaluate(() => __P1.S.selected.size), 2, 'grupa 1 nie wróciła');
    ok('grupy pod klawiszami (Ctrl+1, 1)');

    // zaznaczanie ramką
    await page.evaluate(() => { __P1.startBattle(); __P1.S.selected.clear(); }); // startBattle ustawia kamerę na całą mapę
    await page.mouse.move(120, 120); await page.mouse.down(); await page.mouse.move(520, 800); await page.mouse.up();
    const nsel = await page.evaluate(() => __P1.S.selected.size);
    assert.ok(nsel >= 4, 'ramka zaznaczyła ' + nsel + ' rot');
    ok('zaznaczanie ramką', nsel + ' rot');

    // restart z tym samym ziarnem: ten sam skrót po tej samej liczbie kroków
    const h = async () => page.evaluate(() => { __P1.startBattle(); const s = __P1.S.sim; for (let i = 0; i < 400; i++) s.step(); return s.hash(); });
    const h1 = await h(), h2 = await h();
    assert.strictEqual(h1, h2, 'restart nie odtwarza przebiegu');
    ok('restart z tym samym ziarnem odtwarza przebieg', 'skrót ' + h1);

    // parametr na żywo działa
    await page.evaluate(() => { __P1.startBattle(); });
    await page.click('#bPanel');
    const ok1 = await page.evaluate(() => { const S = __P1.S; const before = S.sim.defs.units.infantry.dmg; const det = [...document.querySelectorAll('#params details')][0]; det.open = true; const row = [...det.querySelectorAll('.row')].find((r) => /Obrażenia/.test(r.textContent)); const inp = row.querySelector('input'); inp.value = (before * 2).toString(); inp.dispatchEvent(new Event('input')); return [before, S.sim.defs.units.infantry.dmg, S.sim.T.dmg[S.sim.ti.infantry]]; });
    assert.ok(ok1[1] === ok1[0] * 2 && Math.abs(ok1[2] - ok1[0] * 2) < 1e-4, 'suwak nie zmienił parametru w działającej symulacji');
    ok('suwak parametru zmienia wartość w działającej symulacji', ok1.join(' → '));

    // ekran końcowy
    await page.evaluate(() => { __P1.S.defs = JSON.parse(JSON.stringify(__P1.S.defs)); __P1.startBattle(); const s = __P1.S.sim; s.aiSides.add('WK'); let n = 0; while (!s.result && n++ < 20 * 910) s.step(); });
    await page.waitForSelector('#end:not(.hidden)', { timeout: 15000 });
    const endText = await page.textContent('#endBody');
    assert.ok(/Straty/.test(endText) && /Ocalałe roty/.test(endText) && /Przyczyny/.test(endText));
    await page.screenshot({ path: path.join(shots, 'p1-ekran-koniec.png') });
    ok('ekran końcowy pokazuje straty, ocalałe roty i przyczyny', endText.slice(0, 80).replace(/\s+/g, ' '));
    // etap 1: wybór typu mapy w menu, każdy typ startuje, nazwa w pasku, teren dzielony na kafle, zrzut ekranu każdej mapy
    await page.evaluate(() => { document.getElementById('end').classList.add('hidden'); document.getElementById('menu').classList.remove('hidden'); });
    const opts = await page.$$eval('#mMap option', (o) => o.map((x) => x.textContent));
    assert.strictEqual(opts.length, 5, 'menu powinno mieć 5 typów mapy: ' + opts);
    for (const id of [1, 2, 3, 4, 5]) {
      await page.selectOption('#mMap', String(id));
      const dis = await page.$eval('#mPass', (e) => e.disabled);
      assert.strictEqual(dis, id !== 3, 'suwak przesmyku powinien działać tylko na mapie 3 (typ ' + id + ')');
      await page.evaluate(() => { document.getElementById('mSeed').value = 1; });
      await page.click('#mStart');
      await page.evaluate(() => { __P1.S.paused = false; });
      await page.waitForFunction(() => __P1.S.sim && __P1.S.sim.tick > 10, null, { timeout: 30000 });
      const info = await page.evaluate(() => ({ id: __P1.S.sim.mapInfo.id, w: __P1.S.sim.W, h: __P1.S.sim.H, name: document.getElementById('mapName').textContent, chunks: __P1.world.children[0].children.length, z: __P1.cam.z, ants: __P1.S.sim.count }));
      assert.strictEqual(info.id, String(id)); assert.ok(info.name.startsWith('Oblężenie · ' + id + '. '), 'nazwa mapy w pasku: ' + info.name); assert.ok(info.chunks >= 1 && info.z > 0.1, JSON.stringify(info));
      if (id >= 4) assert.ok(info.chunks > 1, 'duża mapa powinna mieć kilka kafli terenu: ' + info.chunks);
      await page.evaluate(() => { __P1.S.paused = true; }); await page.waitForTimeout(250);
      await page.screenshot({ path: path.join(shots, 'p1-mapa-' + id + '.png') });
      await page.evaluate(() => { __P1.S.paused = false; });
      ok('mapa typu ' + id + ' startuje i jest rysowana (' + info.w + '×' + info.h + ', kafli terenu: ' + info.chunks + ', zoom ' + info.z.toFixed(2) + ')');
      await page.evaluate(() => { document.getElementById('menu').classList.remove('hidden'); });
    }
    // etap 2: wybór scenariusza w menu; przeprawa ma własną mapę, więc lista typów map jest wtedy wyłączona
    const scs = await page.$$eval('#mScen option', (o) => o.map((x) => x.value));
    assert.deepStrictEqual(scs, ['bitwa', 'oblezenie', 'przeprawa']);
    for (const [sc, mapId] of [['bitwa', 2], ['oblezenie', 3], ['przeprawa', 3]]) {
      await page.evaluate(() => { document.getElementById('end').classList.add('hidden'); document.getElementById('menu').classList.remove('hidden'); });
      await page.selectOption('#mScen', sc); if (sc !== 'przeprawa') await page.selectOption('#mMap', String(mapId));
      const dis = await page.$eval('#mMap', (e) => e.disabled); assert.strictEqual(dis, sc === 'przeprawa', 'lista map wyłączona tylko w przeprawie (' + sc + ')');
      await page.click('#mStart'); await page.evaluate(() => { __P1.S.paused = false; });
      await page.waitForFunction(() => __P1.S.sim && __P1.S.sim.tick > 10, null, { timeout: 30000 });
      const si = await page.evaluate(() => ({ sc: __P1.S.sim.scenarioInfo.id, label: document.getElementById('mapName').textContent, w: __P1.S.sim.W }));
      assert.strictEqual(si.sc, sc); assert.ok(si.label.length > 5, si.label);
      const nb = await page.$$eval('#fordBtns button', (b) => b.length); assert.strictEqual(nb, sc === 'przeprawa' ? 3 : 0, 'przyciski brodów: ' + nb);

      await page.evaluate(() => { __P1.S.speedIdx = 4; }); await page.waitForTimeout(2500); await page.evaluate(() => { __P1.S.paused = true; });
      await page.screenshot({ path: path.join(shots, 'p1-scenariusz-' + sc + '.png') });
      if (sc === 'przeprawa') {
        const c0 = await page.evaluate(() => [__P1.cam.x, __P1.cam.y]); await page.click('#fordBtns button:nth-child(3)'); const c1 = await page.evaluate(() => [__P1.cam.x, __P1.cam.y, __P1.cam.z]);
        assert.ok(Math.abs(c1[0] - c0[0]) + Math.abs(c1[1] - c0[1]) > 100 && c1[2] >= 0.5, 'przycisk brodu nie przesunął kamery');
        await page.waitForTimeout(300); await page.screenshot({ path: path.join(shots, 'p1-przeprawa-brod.png') });
      }
      await page.evaluate(() => { __P1.S.paused = false; __P1.S.speedIdx = 1; });
      ok('scenariusz ' + sc + ' startuje i jest rysowany (' + si.label + ', ' + si.w + ' szerokości)');
    }
    assert.deepStrictEqual(errors, [], 'błędy w konsoli: ' + errors.join('; '));
    ok('brak błędów w konsoli przeglądarki');
  } catch (e) { failed++; out.push('FAIL ' + e.message + '\n' + (errors.length ? '       błędy: ' + errors.join('; ') : '')); }
  await browser.close();
  console.log(out.join('\n')); console.log(failed ? '\nTEST PRZEGLĄDARKOWY: NIEPOWODZENIE' : '\nTEST PRZEGLĄDARKOWY: wszystko przeszło');
  process.exit(failed ? 1 : 0);
})();
