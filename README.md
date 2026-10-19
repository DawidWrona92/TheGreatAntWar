# The Great Ant War (Wojna superkolonii)

Strategia o pierwszej wojnie światowej mrówek argentyńskich (San Diego). Kanon zasad i decyzji: [docs/Dokument_0.5.pdf](docs/Dokument_0.5.pdf). Kanon liczb: to repozytorium (dane, testy, wyniki pomiarów z ziarnami).

## Plan prac (sekcja 14 dokumentu)
P1 prototyp bitwy (HTML) → P2 prototyp kampanii (HTML) ‖ T test Godot 4 / C++17 → P3 połączenie → R rdzeń → V wycinek pionowy.

## Układ
- `prototypy/` – jednorazowe prototypy, każdy to jeden plik HTML (PixiJS z CDN)
- `tests/` – testy rdzenia symulacji i przeglądarkowe
- `docs/` – dokument projektowy, wnioski z prototypów

## P1: prototyp bitwy
Otwórz `prototypy/p1-bitwa.html` w przeglądarce (wymaga internetu dla PixiJS z CDN). Parametry URL: `?autostart=1&side=WK|LH&seed=N&passage=32..320&speed=1|2|4|8&observe=1`.
Sterowanie jest w grze (przycisk `?`). Testy: `npm install && npm test`. Eksperyment: `node tests/p1-experiment.js --seeds 20 --widths 64,128,256`. Wnioski i wyniki: [docs/wnioski-p1.md](docs/wnioski-p1.md).
