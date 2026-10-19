#!/usr/bin/env python3
"""Przepisuje sekcję 2 (Dane) w docs/projekt-bitwy.md na podstawie bloku JSON `defs` z prototypes/p1-bitwa.html,
żeby liczby w dokumencie nie rozjeżdżały się z prototypem. Użycie: python3 tools/aktualizuj-tabele-bitwy.py"""
import json, re, pathlib
root = pathlib.Path(__file__).resolve().parent.parent
html = (root / 'prototypy' / 'p1-bitwa.html').read_text(encoding='utf8')
defs = json.loads(re.search(r'<script type="application/json" id="defs">([\s\S]*?)</script>', html).group(1))
U = defs['units']; P = defs['params']; W = defs['world']; sc = defs['scenario']['sides']

def flat(d, pre=''):
    out = []
    for k, v in d.items():
        if isinstance(v, dict): out += flat(v, pre + k + '.')
        else: out.append((pre + k, v))
    return out

def unit_row(k, u):
    return f"| `{k}` | {u['name']} | {u['hp']} | {u['speed']} | {u['dmg']} | {u['reach']} | {u['cd']} | {u['aggro']} | {u['radius']} | {u['mass']} | {u['armor']} | {u.get('range','')} | {u.get('ability',{}).get('name','')} |"

def comp_rows(side):
    return "\n".join(f"| {c['role']} | {', '.join(f'{k} {v}' for k, v in c['units'].items())} | ({c['at'][0]}, {c['at'][1]}) | {c.get('delay','')} |" for c in sc[side]['companies'])

burst = U['pekacz']['burst']
sec = f'''## 2. Dane

### Świat
| Parametr | Wartość |
|---|---|
{chr(10).join(f"| `world.{k}` | {v} |" for k, v in W.items())}

Siatka terenu 16x16 jednostek: 0 otwarte, 1 mur (ludzki), 2 osłona, 3 mur gniazda. Mur biegnie pionowo w `x = wallX` na całej wysokości z jednym przejściem o szerokości `passage` wyśrodkowanym w `y = h/2`. Gniazdo to pierścień murów z wejściem od zachodu. Osłony to 12 losowych plam (ziarno `map`).

### Jednostki
Pola: zdrowie, prędkość (jedn./s), obrażenia, kontakt (`reach`, szczelina między ciałami w jedn.), czas między atakami (s, przed `cdScale`), zasięg wypatrywania, promień ciała, masa, pancerz (ułamek redukcji obrażeń wręcz), zasięg (plujka), umiejętność. Elita `gwardia_<typ>` jest generowana dla każdego typu poza dowódcą.

| Klucz | Nazwa | HP | Prędkość | Obr. | Kontakt | Czas ataku | Wzrok | Promień | Masa | Pancerz | Zasięg | Umiejętność |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
{chr(10).join(unit_row(k, u) for k, u in U.items())}

Dodatkowo: Taran odrzuca (`knock` {U['taran']['knock']}), Pękacz ma `burst` (promień {burst['radius']}, obrażenia {burst['dmg']}, oblepienie {burst['stuck']} s, wypatrywanie {burst['seek']}), Plujka ma `aoe` {U['plujka']['aoe']}, Odźwierny jest `heavy` (nie odrzucany).

### Kontry (mnożnik obrażeń atakującego wobec obrońcy, domyślnie 1)
| Para | Mnożnik |
|---|---|
{chr(10).join(f"| {a} → {d} | ×{v} |" for a, m in defs['counters'].items() for d, v in m.items())}

### Parametry
| Ścieżka | Wartość domyślna |
|---|---|
{chr(10).join(f"| `params.{k}` | {v} |" for k, v in flat(P))}

### Scenariusz (liczebność i role rot)
Rola steruje AI. Opóźnienie to sekundy do pierwszego rozkazu (tylko strona atakująca). `@guard` to gwardia dowódcy wybranego typu.

Wielka Kolonia (atakuje, rezerwa {sc['WK']['reserve']}, promień aury {sc['WK']['auraR']}):
| Rola | Skład | Pozycja | Opóźnienie |
|---|---|---|---|
{comp_rows('WK')}

Lake Hodges (broni, rezerwa {sc['LH']['reserve']}, promień aury {sc['LH']['auraR']}, bonus regeneracji {sc['LH']['regenBonus']}):
| Rola | Skład | Pozycja | Opóźnienie |
|---|---|---|---|
{comp_rows('LH')}

'''
doc_path = root / 'docs' / 'projekt-bitwy.md'
doc = doc_path.read_text(encoding='utf8')
i0 = doc.index('## 2. Dane'); i1 = doc.index('## 3. Struktury danych')
doc_path.write_text(doc[:i0] + sec + doc[i1:], encoding='utf8')
print('zaktualizowano sekcję 2 w', doc_path)
