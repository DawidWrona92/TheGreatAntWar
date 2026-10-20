// Eksperyment: wzorce armii AI przeciw sobie (Bitwa, mapa 2, budżet średni). Każda para WK x LH, kilka ziaren.
// Użycie: node tests/p1-armie.js [--seeds 2] [--budget sredni] [--scenario bitwa] [--map 2] [--out plik.json]
const { spawn } = require('child_process');
const fs = require('fs');

function runOne({ seed, budget, scenario, map, styles, maxSeconds }) {
  const { loadP1 } = require('./load-core');
  const { Sim, defs } = loadP1(); const sim = Sim.create({ defs, seed, map, scenario, budget, styles });
  const st = { WK: 0, LH: 0 }; for (const c of sim.comps) st[c.side ? 'LH' : 'WK'] += c.initial;
  for (let k = 0; k <= (maxSeconds || 450) * 20 && !sim.result; k++) sim.step();
  const a = sim.count_alive();
  return { seed, styles, winner: sim.result ? sim.result.winner : null, seconds: sim.tick / 20, fracWK: a[0] / st.WK, fracLH: a[1] / st.LH, startWK: st.WK, startLH: st.LH, costWK: sim.armyInfo.WK.cost, costLH: sim.armyInfo.LH.cost };
}
module.exports = { runOne };
if (require.main === module) {
  if (process.argv[2] === '--worker') { process.stdout.write(JSON.stringify(runOne(JSON.parse(process.argv[3])))); return; }
  const args = process.argv.slice(2), opt = (n, d) => { const i = args.indexOf('--' + n); return i < 0 ? d : args[i + 1]; };
  const seeds = +opt('seeds', 2), budget = opt('budget', 'sredni'), scenario = opt('scenario', 'bitwa'), map = +opt('map', 2), out = opt('out', null);
  const { loadP1 } = require('./load-core'); const { Sim, defs } = loadP1();
  const wk = Sim.army.archetypes(defs, 'WK'), lh = Sim.army.archetypes(defs, 'LH');
  const jobs = []; for (const a of wk) for (const b of lh) for (let s = 1; s <= seeds; s++) jobs.push({ seed: s, budget, scenario, map, styles: { WK: a, LH: b }, maxSeconds: 450 });
  const results = []; let next = 0, running = 0;
  const pump = () => { while (running < 4 && next < jobs.length) { const job = jobs[next++]; running++; const p = spawn(process.execPath, [__filename, '--worker', JSON.stringify(job)]); let buf = ''; p.stdout.on('data', (d) => { buf += d; }); p.stderr.on('data', (d) => process.stderr.write(d)); p.on('close', () => { running--; try { results.push(JSON.parse(buf)); } catch (e) { console.error('błąd', JSON.stringify(job.styles)); } if (next >= jobs.length && !running) done(); else pump(); }); } };
  const done = () => {
    const rows = []; for (const a of wk) { const r = { WK: a }; for (const b of lh) { const x = results.filter((q) => q.styles.WK === a && q.styles.LH === b); r[b] = +(x.reduce((t, q) => t + (q.fracWK - q.fracLH), 0) / x.length).toFixed(2); } rows.push(r); }
    if (out) fs.writeFileSync(out, JSON.stringify({ generated: 'wykonane: node tests/p1-armie.js', seeds, budget, scenario, map, opis: 'wartość = średni (odsetek ocalałych WK - odsetek ocalałych LH) po ' + 450 + ' s lub końcu bitwy; dodatnia: przewaga WK', macierz: rows, runs: results }, null, 1));
    console.log('WK \\ LH', lh.join(' | ')); for (const r of rows) console.log(r.WK.padEnd(13), lh.map((b) => String(r[b]).padStart(6)).join(' '));
  };
  pump();
}
