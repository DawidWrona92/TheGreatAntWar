// Wycina rdzeń symulacji i definicje z prototypu HTML, żeby uruchomić go w Node bez grafiki.
const fs = require('fs');
const path = require('path');
const vm = require('vm');

function loadP1(file) {
  const html = fs.readFileSync(file || path.join(__dirname, '..', 'prototypy', 'p1-bitwa.html'), 'utf8');
  const defsText = /<script type="application\/json" id="defs">([\s\S]*?)<\/script>/.exec(html)[1];
  const core = html.slice(html.indexOf('/*SIM-BEGIN*/'), html.indexOf('/*SIM-END*/'));
  const sandbox = { module: { exports: {} } };
  vm.createContext(sandbox);
  vm.runInContext(core + '\nthis.__Sim = Sim;', sandbox, { filename: 'p1-core' });
  return { Sim: sandbox.__Sim, defs: JSON.parse(defsText) };
}
module.exports = { loadP1 };
