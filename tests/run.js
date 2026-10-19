// Uruchamia wszystkie testy: rdzeń P1 w Node i test przeglądarkowy P1.
const { spawnSync } = require('child_process');
const path = require('path');
let failed = 0;
for (const f of ['p1-core.test.js', 'p1-browser.test.js']) {
  console.log('=== ' + f);
  const r = spawnSync(process.execPath, [path.join(__dirname, f)], { stdio: 'inherit' });
  if (r.status !== 0) failed++;
}
process.exit(failed ? 1 : 0);
