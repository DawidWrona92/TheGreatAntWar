// Metryki pięciu typów mapy P1: rozmiar, powierzchnia do chodzenia, odsetek otwartego terenu, szerokość najszerszej trasy
// w jej najwęższym miejscu, kręta droga oraz łączna szerokość przejść w najwęższym przekroju pasa środkowego (maksymalny przepływ).
// Użycie: node tools/mapa-metryki.js [liczba_ziaren=12]  (zapisuje docs/wyniki/p1-mapy-metryki.json)
const fs = require('fs');
const path = require('path');
const { loadP1 } = require('../tests/load-core');

// maksymalna liczba rozłącznych (po komórkach) dróg od linii x0 do linii x1; wynik razy komórka = łączna szerokość przekroju
function cutWidth(sim, xSrc, xDst) {
  const C = sim.CELL, COLS = sim.COLS, ROWS = sim.ROWS, g = sim.grid, N = COLS * ROWS;
  const open = (i) => g[i] === 0 || g[i] === 2;
  const cin = (i) => 2 * i, cout = (i) => 2 * i + 1, S = 2 * N, T = 2 * N + 1;
  const adj = Array.from({ length: 2 * N + 2 }, () => []), to = [], cap = [];
  const edge = (a, b) => { adj[a].push(to.length); to.push(b); cap.push(1); adj[b].push(to.length); to.push(a); cap.push(0); };
  for (let r = 1; r < ROWS - 1; r++) for (let c = 1; c < COLS - 1; c++) {
    const i = r * COLS + c; if (!open(i)) continue;
    edge(cin(i), cout(i));
    for (const j of [i + 1, i - 1, i + COLS, i - COLS]) if (open(j)) edge(cout(i), cin(j));
    const x = (c + 0.5) * C;
    if (x >= xSrc && x < xSrc + C) edge(S, cin(i));
    if (x >= xDst && x < xDst + C) edge(cout(i), T);
  }
  let flow = 0;
  for (;;) {
    const prev = new Int32Array(2 * N + 2).fill(-1), q = [S]; prev[S] = -2;
    for (let h = 0; h < q.length && prev[T] === -1; h++) for (const e of adj[q[h]]) if (cap[e] > 0 && prev[to[e]] === -1) { prev[to[e]] = e; q.push(to[e]); }
    if (prev[T] === -1) break;
    for (let v = T; v !== S;) { const e = prev[v]; cap[e]--; cap[e ^ 1]++; v = to[e ^ 1]; }
    flow++;
  }
  return flow * C;
}

// średnia liczba równoległych przejść (ciągłych otwartych odcinków co najmniej 3 komórek) w przekrojach poprzecznych pasa środkowego
function lanes(sim, x0, x1) {
  const C = sim.CELL, COLS = sim.COLS, ROWS = sim.ROWS, g = sim.grid; let tot = 0, n = 0;
  for (let x = x0; x < x1; x += 64) {
    const c = Math.floor(x / C); let run = 0, cnt = 0;
    for (let r = 1; r < ROWS - 1; r++) { const v = g[r * COLS + c]; if (v === 0 || v === 2) run++; else { if (run >= 3) cnt++; run = 0; } }
    if (run >= 3) cnt++; tot += cnt; n++;
  }
  return tot / n;
}

function collect(seeds) {
  const out = {};
  for (const map of [1, 2, 3, 4, 5]) {
    const rows = [];
    for (let seed = 1; seed <= seeds; seed++) {
      const { Sim, defs } = loadP1(); const sim = Sim.create({ defs, seed, map }), m = sim.mapInfo.metrics;
      let free = 0; for (let i = 0; i < sim.grid.length; i++) if (sim.grid[i] === 0 || sim.grid[i] === 2) free++;
      rows.push({ seed, area: free * sim.CELL * sim.CELL, open: m.open, bottleneck: m.bottleneck, tortuosity: m.tortuosity, cut: cutWidth(sim, 476, sim.defs.world.gap ? sim.defs.world.gap[0] + 60 : sim.W - 1100 - sim.CELL), routes: lanes(sim, 500, sim.W - 1100), attempts: sim.mapInfo.attempts, w: sim.W, h: sim.H, name: sim.mapInfo.name });
    }
    out[map] = rows;
  }
  return out;
}
const avg = (a, k) => a.reduce((s, r) => s + r[k], 0) / a.length;
if (require.main === module) {
  const seeds = +(process.argv[2] || 12), res = collect(seeds);
  fs.writeFileSync(path.join(__dirname, '..', 'docs', 'wyniki', 'p1-mapy-metryki.json'), JSON.stringify(res, null, 1));
  console.log('| typ | nazwa | rozmiar | powierzchnia do chodzenia | otwarty teren | najwęższe miejsce najszerszej trasy | kręta droga | przekrój pasa środkowego | równoległe przejścia w przekroju (średnio) |');
  console.log('|---|---|---|---|---|---|---|---|---|');
  for (const map in res) {
    const r = res[map];
    console.log(`| ${map} | ${r[0].name} | ${r[0].w}×${r[0].h} | ${(avg(r, 'area') / 1e6).toFixed(2)} mln | ${(avg(r, 'open') * 100).toFixed(0)}% | ${avg(r, 'bottleneck').toFixed(0)} | ${avg(r, 'tortuosity').toFixed(2)} | ${avg(r, 'cut').toFixed(0)} | ${avg(r, 'routes').toFixed(1)} |`);
  }
}
module.exports = { cutWidth, collect };
