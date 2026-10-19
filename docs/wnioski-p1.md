# P1: wnioski (prototyp bitwy)

Dokument 0.5 kanonizuje zasady, to repozytorium kanonizuje liczby. Poniżej tylko to, co wykonano i zmierzono, oraz to, czego nie sprawdzono. Decyzje projektowe i pseudokod bitwy: [projekt-bitwy.md](projekt-bitwy.md).

## Co powstało
`prototypy/p1-bitwa.html`: jeden plik HTML (PixiJS 7.4.2 z CDN), rdzeń symulacji oddzielony od rysowania (blok `SIM-BEGIN`/`SIM-END`, bez DOM, stały krok 20 Hz, ziarno, kolejka poleceń), definicje w JSON na początku pliku, panel parametrów na żywo (zapis, odczyt, eksport), diagnostyka, pauza z rozkazami, przyspieszenie, restart z tym samym ziarnem.
Zakres 15.2: mapa z przejściem o regulowanej szerokości, osłonami i gniazdem; obie frakcje (strona do wyboru, druga pod AI opartym na regułach); piechota wspólna i ciężka, Taran, Biegacz, Pękacz, Odźwierny, Plujka; dowódca z własną gwardią dowolnego typu; ok. 2000 mrówek w 23 rotach plus rezerwy; klik, ramka, grupy klawiszami, atak-marsz, ruch, stój, odwrót, szyki, umiejętność roty; marsz grupy rot z zachowaniem rozmieszczenia; kontrola feromonowa w trzech stanach; zmęczenie; kapitan roty; kwas jako ograniczona amunicja i uzupełnienia zależne od suwaka zaopatrzenia; ekran końcowy ze stratami, ocalałymi rotami, zabójcami i przyczynami.
Fizyka ciał: w walce mrówki mają masę i nie przenikają się (tylny szereg czeka na wolne miejsce); poza walką swoi się mijają (idąca przepycha się przez stojącą, a ta robi jej przejście).
Widok: izometria 2:1, sprite'y malowane w wysokiej rozdzielczości w 16 kierunkach, chorągwie rot zawsze widoczne, a panel (liczebność, pasek zdrowia z podziałem na mrówki, morale, zmęczenie) po zaznaczeniu lub najechaniu. Podglądy: `docs/wyniki/p1-widok-izometryczny.png`, `docs/wyniki/p1-panele-rot.png`.

## Zmierzone (wykonane: `node tests/p1-experiment.js --seeds 8 --widths 64,128,192,256,320`)
Proxy: AI przeciw AI, 8 ziaren na szerokość, kod i parametry jak w commicie z tymi wynikami. To opis modelu, nie rzeczywistości, i nie zastępuje gry. Surowe dane: `docs/wyniki/p1-szerokosc-przejscia.json`.

| Szerokość przejścia | Wygrane WK | Czas bitwy s (min / mediana / p90 / max) | Strata WK (mediana) | Strata LH (mediana) | Powody końca |
|---|---|---|---|---|---|
| 64 | 8/8 | 369 / 468 / 538 / 625 | 1088 | 1103 | zniszczenie obrońców: 7, Wielka Kolonia zajęła gniazdo: 1 |
| 128 | 6/8 | 392 / 596 / 901 / 901 | 1098 | 1034 | Wielka Kolonia zajęła gniazdo: 6, minął czas, obrona utrzymana: 2 |
| 192 | 6/8 | 400 / 624 / 901 / 901 | 1103 | 1047 | Wielka Kolonia zajęła gniazdo: 6, minął czas, obrona utrzymana: 2 |
| 256 | 7/8 | 386 / 511 / 704 / 901 | 1101 | 1099 | zniszczenie obrońców: 3, Wielka Kolonia zajęła gniazdo: 4, minął czas, obrona utrzymana: 1 |
| 320 | 4/8 | 449 / 901 / 901 / 901 | 1130 | 1076 | minął czas, obrona utrzymana: 4, Wielka Kolonia zajęła gniazdo: 2, zniszczenie obrońców: 2 |

- Łącznie Wielka Kolonia wygrywa 31/40 bitew (ok. 78%), więc w tych liczbach lekko przeważa. Domyślna szerokość to 192 (6/8). Zależność od szerokości **nie jest monotoniczna** i przy 8 ziarnach wynika w dużej części z szumu: najwęższe przejście (64) wygrywa WK zawsze (wybuchy pękaczy obejmują cały plug), a najszersze (320) tylko w połowie bitew. Kryterium „zmiana szerokości zmienia przebieg widocznie” widać w czasie i stratach, ale nie jako czysty kierunek.
- Czas bitwy: mediany 8-10 minut; część bitew kończy się upływem czasu (901 s) i wtedy wygrywa obrońca. Kryterium 15.2 (5-15 minut) dotyczy gry z graczem i nie jest sprawdzone.
- Obie strony tracą po ok. 1100 mrówek (z rezerwami), czyli bitwa jest wyrównana wyniszczająco.
- Suwak zaopatrzenia (192, 6 ziaren, zaopatrzenie obu stron równe): przy 0 WK wygrywa 6/6, przy 100 wygrywa 5/6; strata WK rośnie ze 929 do 1093. Wpływ jest widoczny w stratach, ale **słaby w wyniku**; wymaga testu ręcznego (np. zaopatrzenie tylko jednej strony). Dane: `docs/wyniki/p1-zaopatrzenie.json`.
- Mijanie się swoich poza walką (rota w marszu przechodzi przez stojącą) znacząco poprawiło przepływ: bez niego tylne roty utykały w kolejce i bitwa się nie rozstrzygała.

## Błędy znalezione po drodze (każdy ma test)
- Pula kwasu i dopływ uzupełnień były `NaN` (zła ścieżka parametru); potem dopływ był liczony na krok zamiast na sekundę (1/20 zamierzonego tempa). Test: uzupełnienia wchodzą, plujki strzelają.
- Plug stał poza przejściem, był za wąski, obracał się za wrogiem, a szybkie mrówki i nacisk tłumu przepychały się przez szyk. Test: nieśmiertelny zamknięty plug nie przepuszcza nikogo przy 64, 128 i 256.
- Kapitan roty był wybierany w narożniku szyku (każda walka oznaczała natychmiastowy wstrząs morale); teraz najbliżej środka.
- `report()` zmieniał stan gry (wołał `checkEnd`); teraz jest tylko do odczytu, a koniec bitwy jest idempotentny.
- Mrówki blokowały się nawzajem także poza walką (tylne roty utykały w kolejce); dodano mijanie się swoich poza walką. Test: rota w marszu przechodzi przez stojącą bez strat, a ciała w kontakcie z wrogiem nie są przepychane.
- Pozycje w `Float32Array` mogły wylądować na krawędzi muru.
- Pomiary czasu kroku w Node były zawyżone kilkukrotnie, bo rdzeń działał w `node:vm`; teraz jest wykonywany w głównym kontekście.

## Testy
`npm install && npm test`. Rdzeń (16 testów): zakres i nazwy rot, gwardia dowolnego typu, w walce ciała nie nakładają się (najgorszy pomiar 2,6% mrówek w nakładającej się parze), swoi mijają się poza walką, ciało w kontakcie stoi, zmęczenie, kapitan, determinizm (także z rozkazami), granice, kwas i uzupełnienia, geometria plugu, wpływ szerokości, kontrola feromonowa, wydajność. Przeglądarka: start, kółko myszy, marsz grupy rot z zachowaniem rozmieszczenia, pauza z rozkazem, klawisze, grupy, ramka, restart, suwak, ekran końcowy.
Krok symulacji przy ok. 4200 mrówkach w Node: mediana 9 ms, p99 17 ms, max 50 ms przy budżecie 50 ms (20 Hz). To czas sandboxa, nie kryterium 15.2.

## Nie zweryfikowane
- Czy to jest fajne: czy dowodzenie rotami bawi, czy unikaty są czytelne w ruchu, czy po trzech bitwach da się powiedzieć, dlaczego się wygrało, czy zmęczenie i kapitan są zrozumiałe. Wymaga gry człowieka.
- Wydajność 50 klatek/s w Chrome na typowym PC. Renderer w piaskownicy jest programowy, więc FPS tu nic nie mówi.
- Gwardia typu Taran lub Odźwierny ma tylko statystyki elity (bez Szarży i Zamknięcia); gwardia pękaczy detonuje przy kontakcie.
- Marsz grupy tylko przesuwa układ rot, nie obraca go jak w Total War.
- Bitwy bez rozstrzygnięcia (upływ czasu, wygrywa obrońca) i brak monotonii względem szerokości są cechą obecnych liczb, nie planowanego balansu; do dostrojenia w teście ręcznym suwakami.
- Liczebność poniżej widełek 2000-4000 z 15.2 jest decyzją użytkownika (czytelność); test 10 tys. mrówek należy do etapu T.
- Dźwięk, kampania, ekonomia, lotnictwo, wnętrze gniazda, splot i beczki są poza zakresem P1.
