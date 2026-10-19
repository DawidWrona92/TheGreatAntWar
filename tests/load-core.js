// Wycina rdzeń symulacji i definicje z prototypu HTML, żeby uruchomić go w Node bez grafiki.
// Rdzeń jest wykonywany w głównym kontekście (new Function), a nie w node:vm: w osobnym kontekście vm
// wbudowane Math.* nie są optymalizowane tak jak w przeglądarce i symulacja działa wielokrotnie wolniej.
const fs = require('fs');
const path = require('path');

function loadP1(file) {
  const html = fs.readFileSync(file || process.env.P1_FILE || path.join(__dirname, '..', 'prototypy', 'p1-bitwa.html'), 'utf8');
  const defsText = /<script type="application\/json" id="defs">([\s\S]*?)<\/script>/.exec(html)[1];
  const core = html.slice(html.indexOf('/*SIM-BEGIN*/'), html.indexOf('/*SIM-END*/'));
  const Sim = new Function('module', 'process', core + '\nreturn Sim;')({ exports: {} }, process);
  return { Sim, defs: JSON.parse(defsText) };
}
module.exports = { loadP1 };
