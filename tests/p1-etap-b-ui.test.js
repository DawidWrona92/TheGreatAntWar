// Test przeglądarkowy etapu B: karty oddziałów, panel szczegółów, podpowiedzi z prawdziwymi wartościami, minimapa, wskaźnik sił, odwrót na karcie.
const assert = require('assert');
const { openPage } = require('./browser-lib');

(async () => {
  const out = []; let failed = 0;
  const ok = (name, note) => out.push('OK   ' + name + (note ? '\n       ' + note : ''));
  const { browser, page, errors } = await openPage('autostart=1&side=WK&seed=1&scenario=bitwa&map=1&speed=1');
  const ev = (fn, arg) => page.evaluate(fn, arg);
  try {
    await page.waitForFunction(() => window.__P1 && __P1.S.sim && __P1.S.sim.tick > 10, null, { timeout: 120000 });
    await ev(() => { __P1.S.paused = true; __P1.S.selected.clear(); });
    const own = await ev(() => __P1.S.sim.comps.filter((c) => c.side === 0).map((c) => c.id));
    const A = own[0], B = own[1];
    // ---- 1. karta: "żywe/max", paski i stan zgodne z danymi symulacji
    const card = (id) => ev((id) => { const d = document.querySelector('#cards .card[data-id="' + id + '"]'), s = __P1.S.sim.compStats(__P1.S.sim.comps[id]); return { text: d.querySelector('.n').textContent, hp: d.querySelector('.hp').style.width, mo: d.querySelector('.mo').style.width, state: d.querySelector('.stl').textContent, cls: d.className, max: s.entities.max, cur: s.entities.current, hpFrac: s.health.current / s.health.max, morale: s.morale.value }; }, id);
    let k = await card(A); assert.strictEqual(k.text, k.cur + '/' + k.max); assert.ok(Math.abs(parseFloat(k.hp) - 100 * k.hpFrac) < 0.5); assert.ok(Math.abs(parseFloat(k.mo) - Math.max(2, k.morale)) < 0.5);
    // zranienie bez śmierci obniża pasek zdrowia, ale nie liczbę
    await ev((A) => { const s = __P1.S.sim, c = s.comps[A]; for (const i of c.ants.slice(0, 50)) s.hp[i] *= 0.4; }, A); await page.waitForTimeout(400); await ev(() => { __P1.S.sim.step(); }); await page.waitForTimeout(500);
    k = await card(A); assert.strictEqual(k.text, k.max + '/' + k.max, 'ranni nie są martwi'); assert.ok(parseFloat(k.hp) < 85, 'pasek zdrowia nie spadł: ' + k.hp);
    ok('1. karta pokazuje żywe/max, pasek zdrowia (suma HP) i morale zgodne z compStats; rany obniżają HP, nie liczebność', 'karta ' + k.text + ', HP ' + k.hp + ', morale ' + k.mo);
    // ---- 2. zaznaczenie: panel szczegółów po lewej z grupami; rozwijanie
    await ev((A) => { __P1.S.selected.add(A); }, A); await page.waitForTimeout(700);
    const panel = await ev(() => { const el = document.getElementById('unitPanel'); return { hidden: el.classList.contains('hidden'), groups: [...el.querySelectorAll('summary')].map((x) => x.textContent), text: el.innerText }; });
    assert.ok(!panel.hidden, 'panel szczegółów się nie pokazał'); for (const g of ['Stan', 'Atak', 'Obrona', 'Ruch', 'Aktywne efekty']) assert.ok(panel.groups.some((x) => x.toLowerCase().includes(g.toLowerCase())), 'brak grupy ' + g);
    await ev(() => { document.querySelector('#unitPanel details[data-g="atak"]').open = true; document.querySelector('#unitPanel details[data-g="obrona"]').open = true; }); await page.waitForTimeout(500);
    ok('2. zaznaczona rota pokazuje lewy panel: Stan, Atak, Obrona, Ruch, Aktywne efekty (grupy rozwijane)', panel.groups.join(', '));
    // ---- 3. podpowiedzi: wartości z mechaniki
    const hoverTip = async (sel) => { const box = await page.locator(sel).first().boundingBox(); await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await page.mouse.move(box.x + box.width / 2 + 1, box.y + box.height / 2 + 1); await page.waitForTimeout(150); return ev(() => { const t = document.getElementById('tip'); return t.classList.contains('hidden') ? '' : t.textContent; }); };
    const cs = await ev((A) => { const s = __P1.S.sim, st = s.compStats(s.comps[A]); return { hit: st.attack.melee, base: st.attack.baseDamage, arm: st.defence.armour, red: st.defence.armourReduction, mor: Math.round(st.morale.value), health: Math.round(st.health.current), hmax: Math.round(st.health.max), interval: st.attack.interval }; }, A);
    let tx = await hoverTip('#unitPanel .up-row[data-tip="health"]'); assert.ok(tx.includes(String(cs.health)) && tx.includes(String(cs.hmax)), 'podpowiedź zdrowia bez wartości: ' + tx);
    tx = await hoverTip('#unitPanel .up-row[data-tip="morale"]'); assert.ok(tx.includes('Morale ' + cs.mor) && /Ostatnia sekunda/.test(tx) && /regeneracja bazowa/.test(tx), 'podpowiedź morale bez składników: ' + tx);
    tx = await hoverTip('#unitPanel .up-row[data-tip="melee"]'); assert.ok(/50% \+ \(atak - obrona celu\)/.test(tx) || /50 % \+/.test(tx) || tx.includes('Szansa'), 'podpowiedź ataku bez wzoru: ' + tx); assert.ok(tx.includes(String(Math.round(cs.hit))), 'brak wartości ataku: ' + tx);
    tx = await hoverTip('#unitPanel .up-row[data-tip="armour"]'); assert.ok(tx.includes(String(Math.round(cs.arm))) && /Nie działa na obrażenia przebijające/.test(tx), 'podpowiedź pancerza: ' + tx);
    tx = await hoverTip('#unitPanel .up-row[data-tip="interval"]'); assert.ok(tx.includes(cs.interval.toFixed(1).replace('.', ',')), 'podpowiedź tempa ataku: ' + tx);
    await page.mouse.move(700, 400); await page.waitForTimeout(150); assert.ok(await ev(() => document.getElementById('tip').classList.contains('hidden')), 'podpowiedź nie znika po zjechaniu myszy');
    tx = await hoverTip('#force'); assert.ok(/orientacyjnie, nie prognoza/.test(tx), 'podpowiedź wskaźnika sił: ' + tx);
    ok('3. podpowiedzi pokazują wzory i rzeczywiste wartości (zdrowie, morale z rozbiciem składników, atak, pancerz, tempo ataku, siły), znikają po zjechaniu myszy');
    // ---- 4. odwrót: karta i znaczniki
    await ev((B) => { const s = __P1.S.sim, c = s.comps[B]; c.control = 3; for (const i of c.ants.slice(0, Math.ceil(c.ants.length * 0.6))) { s.hp[i] = 0; s.debug.hit(-1, i, 1, false, 'burst'); } for (let k = 0; k < 21; k++) s.step(); }, B);
    await page.waitForTimeout(900);
    const rt = await card(B); assert.ok(/\brt\b/.test(rt.cls), 'karta odwrotu bez klasy rt: ' + rt.cls); assert.ok(/SZAŁ|ODWRÓT/.test(rt.state), 'karta nie mówi o odwrocie/szale: ' + rt.state);
    ok('4. oddział w odwrocie (atakujący: szał) jest wyraźnie oznaczony na karcie', rt.state);
    // ---- 5. wskaźnik sił i minimapa
    const force = await ev(() => document.getElementById('forceTxt').textContent); assert.ok(/wróg nieznany|%/.test(force), 'brak wskaźnika sił: ' + force);
    const drawn0 = await ev(() => { __P1.S.sim.debug.vis(); return __P1.S.miniDrawn; }); await page.waitForTimeout(600);
    const mini = await ev(() => { const c = document.getElementById('mini'); return { w: c.width, h: c.height, drawn: __P1.S.miniDrawn, own: __P1.S.sim.comps.filter((q) => q.side === 0).reduce((t, q) => t + q.alive, 0) }; });
    assert.ok(mini.w > 50 && mini.h > 30, 'minimapa ma zły rozmiar'); assert.strictEqual(mini.drawn[1], 0, 'minimapa pokazuje wrogów, których gracz nie widzi: ' + mini.drawn[1]); assert.ok(mini.drawn[0] > 0 && mini.drawn[0] <= mini.own);
    const cam0 = await ev(() => ({ x: __P1.cam.x, y: __P1.cam.y })), r = await page.locator('#mini').boundingBox();
    await page.mouse.click(r.x + r.width * 0.8, r.y + r.height * 0.5); await page.waitForTimeout(300);
    const cam1 = await ev(() => ({ x: __P1.cam.x, y: __P1.cam.y })); assert.ok(Math.hypot(cam1.x - cam0.x, cam1.y - cam0.y) > 50, 'klik w minimapę nie przesunął kamery');
    ok('5. wskaźnik sił: ' + force + '; minimapa pokazuje tylko widoczne jednostki (wrogów 0, własnych ' + mini.drawn[0] + ') i przenosi kamerę po kliknięciu');
    // ---- 6. czytelność: wiele rot na ekranie, zrzut i brak błędów w konsoli
    await ev(() => { __P1.S.selected.clear(); }); await page.waitForTimeout(500); await page.screenshot({ path: process.env.UI_SHOT || '/tmp/p1-etap-b-ui.png' });
    assert.deepStrictEqual(errors, [], 'błędy w konsoli: ' + errors.join(' | '));
    ok('6. brak błędów w konsoli; zrzut ekranu z kartami, panelem, minimapą i wskaźnikiem sił');
  } catch (e) { failed++; out.push('FAIL ' + (e.stack || e.message)); }
  await browser.close();
  console.log(out.join('\n')); console.log('\n' + (failed ? 'BŁĄD' : 'wszystkie testy interfejsu etapu B przeszły')); process.exit(failed ? 1 : 0);
})();
