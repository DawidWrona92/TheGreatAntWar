# The Great Ant War (Wojna superkolonii)

Strategia o pierwszej wojnie światowej mrówek argentyńskich (San Diego). Kanon zasad i decyzji: [docs/Dokument_0.5.pdf](docs/Dokument_0.5.pdf). Kanon liczb: to repozytorium (dane, testy, wyniki pomiarów z ziarnami).

## Plan prac (sekcja 14 dokumentu)
P1 prototyp bitwy (HTML) → P2 prototyp kampanii (HTML) ‖ T test Godot 4 / C++17 → P3 połączenie → R rdzeń → V wycinek pionowy.

## Układ
- `prototypy/` – jednorazowe prototypy, każdy to jeden plik HTML (PixiJS z CDN)
- `tests/` – testy rdzenia symulacji i przeglądarkowe
- `docs/` – dokument projektowy, wnioski z prototypów

## P1: prototyp bitwy
Otwórz `prototypy/p1-bitwa.html` w przeglądarce (wymaga internetu dla PixiJS z CDN). Parametry URL: `?autostart=1&side=WK|LH&seed=N&map=1..5&scenario=bitwa|kopiec|przeprawa&budget=maly|sredni|duzy&passage=32..320&speed=1|2|4|8&observe=1`. Typ mapy (od otwartej polany do chaparralu) wybiera się też w menu; `passage` działa tylko na mapie typu 3. Scenariusz (Bitwa, Oblężenie, Przeprawa) i budżet armii (Mały, Średni, Duży, z ekranem konfiguracji armii i wzorcami AI) też wybiera się w menu; Przeprawa ma własną mapę (potok z kamieniami), a Oblężenie to szturm na wielopoziomowy kopiec (stała mapa, korytarze i rampy, serce gniazda); dawne płaskie Oblężenie zostaje jako ukryty scenariusz `scenario=oblezenie`.
Znaczniki i nakładki taktyczne (obrysy, trasy, zasięg i wykonalność ostrzału): decyzja 73 w [docs/projekt-bitwy.md](docs/projekt-bitwy.md), sekcja „Etap C” w [docs/wnioski-p1.md](docs/wnioski-p1.md); panel pod przyciskiem Nakładki (K), tryb taktyczny J.
Interfejs bitwy (karty rot, panel szczegółów z podpowiedziami, minimapa, pasek sił), system walki i morale: decyzja 72 w [docs/projekt-bitwy.md](docs/projekt-bitwy.md) i sekcja „Etap B” w [docs/wnioski-p1.md](docs/wnioski-p1.md); model walki i morale można wyłączyć w JSON (`params.combat.on`, `params.morale.spec`).
Sterowanie wzorowane na Total War jest opisane w grze (przycisk `?`) i w [docs/sterowanie-total-war.md](docs/sterowanie-total-war.md). Testy: `npm install && npm test`. Eksperyment: `node tests/p1-experiment.js --seeds 20 --widths 64,128,256` (albo `--maps 1,2,3,4,5`). Metryki map: `node tools/mapa-metryki.js`. Wnioski i wyniki: [docs/wnioski-p1.md](docs/wnioski-p1.md). Decyzje projektowe i pseudokod bitwy (do przeniesienia na C++ lub C#): [docs/projekt-bitwy.md](docs/projekt-bitwy.md).
