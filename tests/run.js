// Uruchamia wszystkie testy: rdzeń P1 w Node, test przeglądarkowy P1 i test sterowania.
const { spawnSync } = require('child_process');
const path = require('path');
let failed = 0;
for (const f of ['p1-core.test.js', 'p1-etap-b.test.js', 'p1-browser.test.js', 'p1-sterowanie.test.js', 'p1-etap-b-ui.test.js', 'p1-etap-c.test.js', 'p1-etap-c-ui.test.js']) {
  console.log('=== ' + f);
  const r = spawnSync(process.execPath, [path.join(__dirname, f)], { stdio: 'inherit' });
  if (r.status !== 0) failed++;
}
process.exit(failed ? 1 : 0);
