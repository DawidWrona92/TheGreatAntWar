# P1: wnioski (prototyp bitwy)

Dokument 0.5 kanonizuje zasady, to repozytorium kanonizuje liczby. Poniżej tylko to, co zostało wykonane i zmierzone, oraz to, czego nie sprawdzono.

## Co powstało
`prototypy/p1-bitwa.html`: jeden plik HTML (PixiJS 7.4.2 z CDN), rdzeń symulacji oddzielony od rysowania (blok `SIM-BEGIN`/`SIM-END`, bez dostępu do DOM, stały krok 20 Hz, ziarno, kolejka poleceń), definicje jednostek i scenariusza w JSON na początku pliku, panel parametrów na żywo (zapis/odczyt/eksport zestawu), panel diagnostyczny, pauza z wydawaniem rozkazów, przyspieszenie, restart z tym samym ziarnem.
Zakres 15.2 zrealizowany: mapa sektora z przejściem o regulowanej szerokości, osłonami i gniazdem z wejściem; obie frakcje (gracz wybiera stronę, druga pod AI opartym na regułach); piechota wspólna, Taran, Biegacz, Pękacz, Odźwierny, Plujka i dowódcy; ok. 2400 mrówek na starcie plus rezerwy (łącznie do ok. 3150); klik, ramka i grupy klawiszami, atak-marsz, ruch, stój, odwrót, szyk (linia, kolumna, klin), umiejętność roty; kontrola feromonowa w trzech stanach ze wskaźnikiem przy rocie i zasięgiem dowódcy na ziemi; kwas jako ograniczona amunicja i uzupełnienia zależne od suwaka zaopatrzenia; ekran końcowy ze stratami, ocalałymi rotami, zabójcami i przyczynami.

## Zmierzone (wykonane: `node tests/p1-experiment.js --seeds 20 --widths 64,128,160,192,256,320`)
Proxy w postaci AI przeciw AI, 20 ziaren na szerokość. Wynik to opis modelu, nie rzeczywistości, i nie zastępuje próby grą. Surowe dane: `docs/wyniki/p1-szerokosc-przejscia.json`.

| Szerokość przejścia | Wygrane WK | Czas bitwy s (min / mediana / p90 / max) | Strata WK (mediana) | Strata LH (min / mediana / max) |
|---|---|---|---|---|
| 64 | 6/20 | 135 / 248 / 306 / 408 | 1393 | 553 / 783 / 952 |
| 128 | 3/20 | 184 / 235 / 301 / 370 | 1389 | 682 / 746 / 889 |
| 160 | 1/20 | 193 / 222 / 252 / 342 | 1390 | 646 / 750 / 942 |
| 192 | 4/20 | 148 / 231 / 329 / 365 | 1390 | 550 / 767 / 866 |
| 256 | 10/20 | 214 / 264 / 327 / 477 | 1388 | 701 / 828 / 975 |
| 320 | 20/20 | 136 / 175 / 199 / 231 | 1167 | 854 / 892 / 915 |

Wnioski z liczb:
- Szerokość przejścia zmienia wynik od 192 w górę (256: połowa wygranych WK, 320: wszystkie). Poniżej 192 efekt nie jest monotoniczny (64: 6/20, 128: 3/20, 160: 1/20), więc kryterium „zmiana szerokości zmienia przebieg widocznie” jest spełnione tylko częściowo. Przyczyna do zbadania: przy bardzo wąskim przejściu mniej mrówek WK wpada w strefę kwasu naraz.
- Domyślna szerokość to 256, bo tam wygrane WK są najbliżej połowy (10/20). To balans proxy na tej mapie, nie dowód równowagi frakcji.
- Mediana czasu bitwy AI przeciw AI to 3,5-4,5 minuty. Kryterium 5-15 minut dotyczy gry z graczem i **nie zostało sprawdzone**; pokrętłem tempa jest `params.cdScale`.

## Błędy znalezione po drodze (i sprawdzane testami)
- Pula kwasu i dopływ uzupełnień były `NaN` (zła ścieżka parametru): plujki nigdy nie strzelały, a uzupełnienia nie wchodziły. Test regresji w `tests/p1-core.test.js`.
- Plug odźwiernych stał poza przejściem, był za wąski i obracał się za wrogiem, a szybkie mrówki przeciskały się przez szyk. Teraz jest zamknięty od startu, szerokość liczona z geometrii, a ruch w głąb zamkniętego szyku jest odrzucany. Test: nieśmiertelny plug nie przepuszcza nikogo przy 64, 128 i 256.
- Wskaźnik zaangażowania w walce rósł do 20 zamiast do 1, więc kontrola spadała do zera bez strat.
- Pozycje w `Float32Array` mogły wylądować na krawędzi muru.

## Testy
`npm install && npm test` (rdzeń w Node: determinizm, granice, plug, kwas i uzupełnienia, wydajność; przeglądarka: start, pauza z rozkazem, klawisze, grupy, ramka, restart, suwak, ekran końcowy). W piaskownicy: 10/10 testów rdzenia i test przeglądarkowy przeszły.

## Nie zweryfikowane
- Czy to jest fajne: czy dowodzenie rotami bawi, czy unikaty są czytelne w ruchu, czy po trzech bitwach da się powiedzieć, dlaczego się wygrało. Wymaga gry człowieka.
- Wydajność 50 klatek/s przy 4000 mrówek w Chrome na typowym PC. Zmierzono tylko krok symulacji w Node: ok. 3900 mrówek, mediana 22 ms, p99 63 ms przy budżecie 50 ms (20 Hz), czyli krok bywa blisko budżetu w największym tłoku. Renderer w piaskownicy jest programowy (kilka klatek/s), więc FPS tu nic nie mówi.
- Plik `wojna-superkolonii-prototyp-a-feromony.html` z 15.1 nie był dostępny, a użytkownik ocenił go jako słabej jakości, więc rysowanie izometryczne napisano od nowa (blok `ISO-BEGIN`/`ISO-END` w `p1-bitwa.html`, do skopiowania do P2 i P3): rzut 2:1, kafle 16x8 px, mury jako niskie krawężniki, mrówki w 16 kierunkach zbudowane z odkopanego sprite'a mrówki z prototypu A (przemalowanego na czerń i czerwień, z nakładkami per typ jednostki i obrotem pod rzut izometryczny) z cieniem rzucanym. Podgląd: `docs/wyniki/p1-widok-izometryczny.png`.
- Grafika zastępcza jest tymczasowa; AI jest proste (WK nie omija strefy kwasu, co jest główną przyczyną ich strat).
- Dźwięk, kampania, ekonomia, lotnictwo, wnętrze gniazda, splot i beczki są poza zakresem P1.
