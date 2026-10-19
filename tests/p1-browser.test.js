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

    // formacje, umiejętność, odwrót, stój klawiszami
    await page.keyboard.press('KeyC');
    assert.strictEqual(await page.evaluate(() => __P1.S.sim.comps[0].formation), 2, 'klin');
    await page.keyboard.press('KeyZ');
    assert.strictEqual(await page.evaluate(() => __P1.S.sim.comps[0].formation), 0, 'linia');
    await page.keyboard.press('KeyV');
    assert.strictEqual(await page.evaluate(() => __P1.S.sim.comps[0].order.kind), 'retreat');
    await page.keyboard.press('KeyH');
    assert.strictEqual(await page.evaluate(() => __P1.S.sim.comps[0].order.kind), 'hold');
    await page.keyboard.press('KeyQ');
    ok('formacje (Z/X/C), odwrót (V), stój (H) i umiejętność (Q) zmieniają stan rot');

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
    await page.evaluate(() => { __P1.S.defs = JSON.parse(JSON.stringify(__P1.S.defs)); __P1.startBattle(); const s = __P1.S.sim; s.aiSides.add('WK'); let n = 0; while (!s.result && n++ < 20 * 900) s.step(); });
    await page.waitForSelector('#end:not(.hidden)', { timeout: 15000 });
    const endText = await page.textContent('#endBody');
    assert.ok(/Straty/.test(endText) && /Ocalałe roty/.test(endText) && /Przyczyny/.test(endText));
    await page.screenshot({ path: path.join(shots, 'p1-ekran-koniec.png') });
    ok('ekran końcowy pokazuje straty, ocalałe roty i przyczyny', endText.slice(0, 80).replace(/\s+/g, ' '));
    assert.deepStrictEqual(errors, [], 'błędy w konsoli: ' + errors.join('; '));
    ok('brak błędów w konsoli przeglądarki');
  } catch (e) { failed++; out.push('FAIL ' + e.message + '\n' + (errors.length ? '       błędy: ' + errors.join('; ') : '')); }
  await browser.close();
  console.log(out.join('\n')); console.log(failed ? '\nTEST PRZEGLĄDARKOWY: NIEPOWODZENIE' : '\nTEST PRZEGLĄDARKOWY: wszystko przeszło');
  process.exit(failed ? 1 : 0);
})();
