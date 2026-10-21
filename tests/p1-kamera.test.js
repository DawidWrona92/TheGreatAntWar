// Test K0 (spike obrotu kamery, V2): rzut izometryczny w czterech obrotach, kierunki sprite'ów, wskazywanie i zaznaczanie myszą,
// niezależność symulacji od kamery, pomiary przerysowania terenu (liczby z piaskownicy z renderem programowym: nie reprezentatywne).
// Uruchamiany na V2: P1_FILE=$PWD/prototypy/p1-bitwa-v2.html node tests/p1-kamera.test.js
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { openPage } = require('./browser-lib');
const { loadP1 } = require('./load-core');
const OUT = path.join(__dirname, '..', 'docs', 'wyniki');

(async () => {
  const out = []; let failed = 0; const pomiary = {};
  const ok = (name, note) => out.push('OK   ' + name + (note ? '\n       ' + note : ''));
  try {
    // ---- mapa 4 (wzgórza i ściany): matematyka rzutu, kierunki, mysz, zrzuty
    let { browser, page, errors } = await openPage('autostart=1&side=WK&seed=1&scenario=bitwa&map=4&speed=1&camrot=1');
    const ev = (fn, arg) => page.evaluate(fn, arg);
    await page.waitForFunction(() => window.__P1 && __P1.S.sim && __P1.S.sim.tick > 10, null, { timeout: 120000 });
    await ev(() => { __P1.S.paused = true; });
    // 1. pełny cykl świat -> ekran -> świat dla czterech obrotów (teren ze wzgórzami: iteracja wysokości)
    const cyc = await ev(() => {
      const I = __P1.ISO, s = __P1.S.sim, res = []; let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
      for (let r = 0; r < 4; r++) { I.rot = r; let worst = 0; for (let k = 0; k < 200; k++) { const x = 20 + rnd() * (s.W - 40), y = 20 + rnd() * (s.H - 40), p = I.inv(I.sx(x, y), I.sy(x, y)); worst = Math.max(worst, Math.hypot(p[0] - x, p[1] - y)); } res.push(+worst.toFixed(4)); }
      I.rot = 0; return res;
    });
    assert.ok(cyc.every((w) => w < 0.5), 'cykl świat-ekran-świat: ' + cyc); ok('1. cykl świat -> ekran -> świat dla 4 obrotów na mapie ze wzgórzami (największy błąd w jednostkach świata: ' + cyc.join(', ') + ')');
    // 2. kierunki sprite'ów: wektor ekranowy ruchu wzdłuż kursu theta w obrocie r musi być równoległy do wektora ekranowego sprite'a dir = antDirIndex(theta) w obrocie 0
    const dirs = await ev(() => {
      const I = __P1.ISO, s = __P1.S.sim, bad = []; const hf = I.hf; I.hf = null;   // bez wzgórz, żeby porównywać czysty rzut
      const P0 = (th) => { const dx = Math.cos(th), dy = Math.sin(th); return [(dx - dy) * 0.5, (dx + dy) * 0.25]; };
      for (let r = 0; r < 4; r++) { I.rot = r; for (let d = 0; d < 16; d++) { const th = d * Math.PI * 2 / 16, x = 500, y = 400, sv = [I.sx(x + 6 * Math.cos(th), y + 6 * Math.sin(th)) - I.sx(x, y), I.sy(x + 6 * Math.cos(th), y + 6 * Math.sin(th)) - I.sy(x, y)];
        const dd = __P1.antDirIndex(th), t2 = dd * Math.PI * 2 / 16, e = (() => { I.rot = 0; const v = P0(t2); I.rot = r; return v; })(); const cr = sv[0] * e[1] - sv[1] * e[0], dt = sv[0] * e[0] + sv[1] * e[1]; if (Math.abs(cr) > 1e-6 * (Math.hypot(...sv) * Math.hypot(...e) + 1) || dt <= 0) bad.push([r, d, dd]); } }
      I.rot = 0; I.hf = hf; return bad;
    });
    assert.strictEqual(dirs.length, 0, 'kierunki sprite\'ów niezgodne z ruchem na ekranie: ' + JSON.stringify(dirs.slice(0, 6))); ok('2. kierunek sprite\'a zgodny z kierunkiem ruchu na ekranie dla 16 kursów w 4 obrotach (znak przesunięcia dir = -4 na 90°: sprawdzony)');
    // 3. zrzuty w czterech obrotach, pomiary przerysowania, wskazywanie i ramka w obróconym widoku
    const own = await ev(() => { const s = __P1.S.sim; const c = s.comps.find((q) => q.side === 0 && q.alive > 50); return { id: c.id, ant: c.ants.find((i) => s.alive[i]), x: c.ax, y: c.ay }; });
    const times = [];
    for (let r = 0; r < 4; r++) {
      await ev(([r, own]) => { __P1.centerOn(own.x, own.y); __P1.setRotation(r); __P1.centerOn(own.x, own.y); __P1.S.selected.clear(); }, [r, own]); await page.waitForTimeout(900);
      times.push(await ev(() => __P1.S.rebake));
      await page.screenshot({ path: path.join(OUT, 'p1-kamera-rot' + r + '.png') });
      // wskazanie myszą: klik w położenie mrówki wybiera jej rotę
      const pos = await ev(([i]) => { const s = __P1.S.sim, r = __P1.app.view.getBoundingClientRect(), p = __P1.toScreen(s.x[i], s.y[i]); return [r.left + p[0], r.top + p[1] - 4]; }, [own.ant]);
      await page.mouse.click(pos[0], pos[1]); await page.waitForTimeout(150);
      const sel = await ev(() => [...__P1.S.selected]); assert.ok(sel.includes(own.id), 'obrót ' + r + ': klik w mrówkę nie wybrał jej roty (' + sel + ')');
    }
    ok('3. klik w mrówkę wybiera jej rotę w każdym z 4 obrotów; zrzuty zapisane w docs/wyniki/p1-kamera-rot0..3.png'); pomiary.mapa4 = times;
    // ramka w obrocie 2: zaznaczenie rot, których mrówki leżą w prostokącie na ekranie
    await ev(([o]) => { __P1.setRotation(2); __P1.centerOn(o.x, o.y); __P1.S.selected.clear(); }, [own]); await page.waitForTimeout(600);
    const box = await ev(([o]) => { const s = __P1.S.sim, r = __P1.app.view.getBoundingClientRect(), p = __P1.toScreen(s.x[o.ant], s.y[o.ant]); return [r.left + p[0] - 30, r.top + p[1] - 30, r.left + p[0] + 30, r.top + p[1] + 20]; }, [own]);
    await page.mouse.move(box[0], box[1]); await page.mouse.down(); await page.mouse.move(box[2], box[3], { steps: 6 }); await page.mouse.up(); await page.waitForTimeout(150);
    const sel2 = await ev(() => [...__P1.S.selected]); assert.ok(sel2.includes(own.id), 'ramka w obrocie 2 nie zaznaczyła roty: ' + sel2); ok('3b. zaznaczanie ramką w obróconym widoku (obrót 180°) obejmuje mrówki w prostokącie ekranowym');
    await ev(() => __P1.setRotation(0));
    assert.deepStrictEqual(errors, [], 'błędy w konsoli: ' + errors.join(' | ')); ok('4. brak błędów w konsoli podczas obrotów na mapie 4');
    // 5. niezależność symulacji od kamery: skrót stanu po 300 krokach z obrotami i bez
    const run = async (rot) => {
      const b = await openPage('autostart=1&side=WK&seed=1&scenario=bitwa&map=1&speed=1&camrot=1'); await b.page.waitForFunction(() => window.__P1 && __P1.S.sim && __P1.S.sim.tick > 10, null, { timeout: 120000 });
      const h = await b.page.evaluate((rot) => { __P1.S.paused = true; const s = __P1.S.sim; while (s.tick < 300) { if (rot && s.tick % 60 === 0) __P1.setRotation((s.tick / 60) % 4); s.step(); } return s.hash(); }, rot);
      await b.browser.close(); return h;
    };
    const hA = await run(true), hB = await run(false); assert.strictEqual(hA, hB, 'obrót kamery zmienił stan symulacji: ' + hA + ' vs ' + hB); ok('5. skrót stanu symulacji po 300 krokach identyczny z obrotami kamery i bez (' + hA + ')');
    await browser.close();
    // 6. pomiary przerysowania dla map 1 i 5 (liczby z piaskownicy, render programowy)
    for (const map of [1, 5]) {
      const b = await openPage('autostart=1&side=WK&seed=1&scenario=bitwa&map=' + map + '&speed=1&camrot=1'); await b.page.waitForFunction(() => window.__P1 && __P1.S.sim && __P1.S.sim.tick > 2, null, { timeout: 240000 });
      const r = await b.page.evaluate(() => { __P1.S.paused = true; const o = []; for (const k of [1, 2, 3, 0]) { __P1.setRotation(k); o.push(__P1.S.rebake); } return o; });
      pomiary['mapa' + map] = r; await b.browser.close();
      ok('6. przerysowanie terenu, mapa ' + map + ' (piaskownica, render programowy; rysowanie canvasu / kafle / pierwsza klatka, ms)', r.map((x) => x.rot * 90 + '°: ' + x.drawMs + ' / ' + x.chunkMs + ' / ' + x.firstFrameMs + ' (tekstura ' + x.texW + 'x' + x.texH + ')').join('; '));
    }
    fs.writeFileSync(path.join(OUT, 'p1-kamera-pomiary.json'), JSON.stringify({ uwaga: 'Liczby z piaskownicy z renderem programowym (SwiftShader), NIE reprezentatywne dla sprzętu użytkownika; do powtórzenia na docelowym sprzęcie.', pomiary }, null, 1));
  } catch (e) { failed++; out.push('FAIL ' + (e.stack || e.message)); }
  console.log(out.join('\n')); console.log('\n' + (failed ? 'BŁĄD' : 'wszystkie testy K0 (kamera) przeszły')); process.exit(failed ? 1 : 0);
})();
