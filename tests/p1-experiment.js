// Eksperyment: AI przeciw AI, wiele ziaren i szerokości przejścia.
// Użycie: node tests/p1-experiment.js --seeds 20 --widths 64,128,256 [--set path=wartość ...] [--out plik.json]
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const args = process.argv.slice(2);
const opt = (n, d) => { const i = args.indexOf('--' + n); return i < 0 ? d : args[i + 1]; };
const seeds = +opt('seeds', 20), widths = opt('widths', '64,128,256').split(',').map(Number), out = opt('out', null);
const overrides = {};
args.forEach((a, i) => { if (a === '--set') { const [k, v] = args[i + 1].split('='); overrides[k] = +v; } });
const jobs = []; for (const w of widths) for (let s = 1; s <= seeds; s++) jobs.push({ seed: s, passage: w, overrides });
const results = []; let next = 0, running = 0; const par = +opt('par', 4);
function pump() {
  while (running < par && next < jobs.length) {
    const job = jobs[next++]; running++;
    const p = spawn(process.execPath, [path.join(__dirname, 'p1-run.js'), JSON.stringify(job)]); let buf = '';
    p.stdout.on('data', (d) => { buf += d; }); p.stderr.on('data', (d) => process.stderr.write(d));
    p.on('close', () => { running--; try { results.push(JSON.parse(buf)); } catch (e) { console.error('błąd przebiegu', job); } if (next >= jobs.length && !running) done(); else pump(); });
  }
}
const q = (arr, p) => { const s = arr.slice().sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.floor(p * (s.length - 1) + 0.5))]; };
const stat = (arr) => ({ min: Math.round(q(arr, 0)), median: Math.round(q(arr, 0.5)), p90: Math.round(q(arr, 0.9)), max: Math.round(q(arr, 1)) });
function done() {
  results.sort((a, b) => a.passage - b.passage || a.seed - b.seed);
  const summary = {};
  for (const w of widths) {
    const r = results.filter((x) => x.passage === w), wk = r.filter((x) => x.winner === 'WK').length;
    summary[w] = { runs: r.length, winsWK: wk, winRateWK: +(wk / r.length).toFixed(2), reasons: r.reduce((a, x) => { a[x.reason] = (a[x.reason] || 0) + 1; return a; }, {}),
      seconds: stat(r.map((x) => x.seconds)), lostWK: stat(r.map((x) => x.lostWK)), lostLH: stat(r.map((x) => x.lostLH)), stepMeanMs: +(r.reduce((a, x) => a + x.stepMeanMs, 0) / r.length).toFixed(2), stepMaxMs: +Math.max(...r.map((x) => x.stepMaxMs)).toFixed(1) };
  }
  const doc = { generated: 'wykonane: node tests/p1-experiment.js', seeds, widths, overrides, summary, runs: results };
  if (out) fs.writeFileSync(out, JSON.stringify(doc, null, 1));
  console.log(JSON.stringify(summary, null, 1));
}
pump();
