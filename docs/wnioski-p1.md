# P1: wnioski (prototyp bitwy)

Dokument 0.5 kanonizuje zasady, to repozytorium kanonizuje liczby. Poniżej tylko to, co wykonano i zmierzono, oraz to, czego nie sprawdzono. Decyzje projektowe i pseudokod bitwy: [projekt-bitwy.md](projekt-bitwy.md).

## Co powstało
`prototypy/p1-bitwa.html`: jeden plik HTML (PixiJS 7.4.2 z CDN), rdzeń symulacji oddzielony od rysowania (blok `SIM-BEGIN`/`SIM-END`, bez DOM, stały krok 20 Hz, ziarno, kolejka poleceń), definicje w JSON na początku pliku, panel parametrów na żywo (zapis, odczyt, eksport), diagnostyka, pauza z rozkazami, przyspieszenie, restart z tym samym ziarnem.
Zakres 15.2: mapa „dno lasu” (pień z głównym przesmykiem o regulowanej szerokości i wąską bocznicą, głazy, korzenie, kłody, mech jako osłona, gniazdo); obie frakcje (strona do wyboru, druga pod AI opartym na regułach); piechota wspólna i ciężka, Taran, Biegacz, Pękacz, Odźwierny, Plujka; dowódca z własną gwardią dowolnego typu; ok. 2100 mrówek w 23 rotach plus rezerwy; klik, ramka, grupy klawiszami, atak-marsz, ruch, stój, odwrót, szyki, umiejętność roty; marsz grupy rot z zachowaniem rozmieszczenia; kontrola feromonowa w trzech stanach; zmęczenie; kapitan roty; kwas jako ograniczona amunicja i uzupełnienia zależne od suwaka zaopatrzenia; ekran końcowy ze stratami, ocalałymi rotami, zabójcami i przyczynami.
Fizyka ciał: w walce mrówki mają masę i nie przenikają się (tylny szereg czeka na wolne miejsce); poza walką swoi się mijają (idąca przepycha się przez stojącą, a ta robi jej przejście).
Interfejs w stylu Warhammera na drewnianych panelach: wąskie karty rot, portret zaznaczonej roty, siatka umiejętności 3x3, pasek rozkazów; rozkaz ruchu z formowaniem (przeciągnięcie PPM: kierunek szyku, kółko: szerokość), linie rozkazów (biała ruch, czerwona atak), pociski kwasu i wybuchy pękaczy.
Widok: izometria 2:1, sprite'y malowane w wysokiej rozdzielczości w 16 kierunkach, chorągwie rot zawsze widoczne, a panel (liczebność, pasek zdrowia z podziałem na mrówki, morale, zmęczenie) po zaznaczeniu lub najechaniu. Podglądy: `docs/wyniki/p1-widok-izometryczny.png`, `docs/wyniki/p1-panele-rot.png`.

## Zmierzone (wykonane: `node tests/p1-experiment.js --seeds 6 --widths 64,128,192,256,320`)
Proxy: AI przeciw AI na mapie „dno lasu” 2000 x 1200, 6 ziaren na szerokość głównego przesmyku, kod i parametry jak w commicie z tymi wynikami. To opis modelu, nie rzeczywistości. Surowe dane: `docs/wyniki/p1-szerokosc-przejscia.json`. Tester ręczny ocenił balans jako dobry i napisał, że o wyniku decyduje strategia (manewr „gate intake”, atak z trzech stron).

| Szerokość przesmyku | Wygrane WK | Czas bitwy s (min / mediana / p90 / max) | Strata WK (mediana) | Strata LH (mediana) | Powody końca |
|---|---|---|---|---|---|
| 64 | 0/6 | 501 / 617 / 731 / 731 | 1179 | 795 | rozbicie atakujących: 6 |
| 128 | 4/6 | 409 / 416 / 477 / 477 | 1128 | 1012 | rozbicie atakujących: 2, Wielka Kolonia zajęła gniazdo: 4 |
| 192 | 4/6 | 413 / 471 / 578 / 578 | 1150 | 1088 | rozbicie atakujących: 2, Wielka Kolonia zajęła gniazdo: 3, zniszczenie obrońców: 1 |
| 256 | 3/6 | 287 / 524 / 901 / 901 | 1152 | 926 | Wielka Kolonia zajęła gniazdo: 3, rozbicie atakujących: 2, minął czas, obrona utrzymana: 1 |
| 320 | 2/6 | 228 / 430 / 849 / 849 | 1178 | 951 | rozbicie atakujących: 4, Wielka Kolonia zajęła gniazdo: 2 |

- Łącznie WK wygrywa 13/30 bitew (ok. 43%). Domyślna szerokość to 192 (4/6). Najwęższy przesmyk (64) daje obrońcy pełną przewagę (WK 0/6), dalej zależność jest słaba i przy 6 ziarnach głównie szumem.
- Czas bitwy: mediany 7-10 minut; w nielicznych bitwach upływa limit 901 s i wygrywa obrońca. Kryterium 15.2 (5-15 minut) dotyczy gry z graczem.
- Suwak zaopatrzenia ma teraz wyraźny wpływ (192, 6 ziaren): przy WK 100 i LH 0 wygrywa WK 6/6, przy WK 0 i LH 100 wygrywa WK 1/6, przy 60 i 60 jest 4/6. Dane: `docs/wyniki/p1-zaopatrzenie.json`.
- Mapa z bocznicą i kilkoma przeszkodami daje wyraźniej decydujące bitwy niż poprzednia z jednym murem: obie strony tracą po ok. 1000-1150 mrówek, a rozstrzygnięcie zapada przed końcem czasu.

## Etap 1 rozszerzenia: wybór typu mapy
Menu ma listę pięciu typów mapy (parametr URL `map=1..5`). Struktura map (wykonane: `node tools/mapa-metryki.js 12`, 12 ziaren na typ; surowe dane w `wyniki/p1-mapy-metryki.json`):

| typ | nazwa | rozmiar | powierzchnia do chodzenia | otwarty teren | najwęższe miejsce najszerszej trasy | kręta droga | przekrój pasa środkowego | równoległe przejścia (średnio) |
|---|---|---|---|---|---|---|---|---|
| 1 | Otwarta polana | 2000×1200 | 2,29 mln | 99% | 229 | 1,00 | 1076 | 1,3 |
| 2 | Kilka przeszkód | 2000×1200 | 2,25 mln | 98% | 211 | 1,01 | 771 | 1,9 |
| 3 | Pień z kilkoma trasami | 2000×1200 | 2,15 mln | 94% | 176 | 1,09 | 224 | 2,0 |
| 4 | Gęsty i kręty podszyt | 2600×1400 | 2,98 mln | 84% | 75 | 1,24 | 196 | 5,7 |
| 5 | Chaparral: gąszcz wąskich przejść | 3000×1500 | 3,37 mln | 77% | 48 | 1,55 | 99 | 6,7 |

Jak to czytać: „najwęższe miejsce” to szerokość trasy, którą da się przejść najszerzej, w jej najwęższym punkcie (jednostki świata, ciało zwykłej mrówki ma średnicę 8, taran 12); „kręta droga” to długość najkrótszej trasy do wejścia do gniazda przez odległość w linii prostej; „przekrój” to łączna szerokość wszystkich przejść w najwęższym przekroju (maksymalny przepływ komórek); „równoległe przejścia” to średnia liczba osobnych otwartych odcinków (co najmniej 48) w przekrojach poprzecznych pasa (typ 3 liczy tylko zachodnią połowę, bez przesmyku). Powierzchnia do chodzenia rośnie z 2,15 mln (typ 3) do 2,98 i 3,37 mln (typy 4 i 5): strefy rozmieszczenia armii są stałe, więc mapy gęste musiały być większe o 40-57%, a nie o tyle, ile zajmują zarośla.

Nawigacja (wykonane: test `nawigacja` i skrypt z obroną zastąpioną niezniszczalnym manekinem; roty WK zmniejszone do 60%): na mapie 4 90% atakujących stoi przy gnieździe po ok. 215 s, na mapie 5 po ok. 385 s (przy pełnych rotach: mapa 4 90% po 320 s, mapa 5 80% po 450 s). Na otwartej mapie 1 to ok. 115 s dla 95%. Nikt nigdy nie stał w ścianie w żadnej próbce.

AI przeciw AI (wykonane: `node tests/p1-experiment.js --seeds 4 --maps 1,2,3,4,5`, 4 ziarna, to nie jest pomiar balansu): wygrane Wielkiej Kolonii 0/4, 0/4, 3/4, 2/4, 2/4 dla typów 1-5; bitwy kończą się rozstrzygnięciem na wszystkich typach (żadna nie utknęła). Na otwartej polanie AI atakujących przegrywa, bo nie manewruje: wchodzi czołowo w linię plujek. To cecha obecnego AI, nie błąd mapy. Wyniki: `wyniki/p1-mapy-bitwy.json`.

Przy pierwszej wersji gąszczu rota rozciągała się w korytarzu: mrówki, które nie widziały swojego miejsca w szyku, biegły przed kotwicą do celu, spójność spadała do 0,1, kotwica pełzła z 10% prędkości, a rota padała ze zmęczenia i traciła kontrolę (na mapie 4 po 300 s tylko ok. 40% atakujących było przy gnieździe). Naprawa: na mapach 4 i 5 mrówka bez widoku na swoje miejsce idzie za kotwicą (decyzja 38).

Zrzuty: `wyniki/p1-mapa-1.png` ... `p1-mapa-5.png`.

## Błędy znalezione po drodze (każdy ma test)
- Pula kwasu i dopływ uzupełnień były `NaN` (zła ścieżka parametru); potem dopływ był liczony na krok zamiast na sekundę (1/20 zamierzonego tempa). Test: uzupełnienia wchodzą, plujki strzelają.
- Plug stał poza przejściem, był za wąski, obracał się za wrogiem, a szybkie mrówki i nacisk tłumu przepychały się przez szyk. Test: nieśmiertelny zamknięty plug nie przepuszcza nikogo przy 64, 128 i 256.
- Kapitan roty był wybierany w narożniku szyku (każda walka oznaczała natychmiastowy wstrząs morale); teraz najbliżej środka.
- `report()` zmieniał stan gry (wołał `checkEnd`); teraz jest tylko do odczytu, a koniec bitwy jest idempotentny.
- Mrówki blokowały się nawzajem także poza walką (tylne roty utykały w kolejce); dodano mijanie się swoich poza walką. Test: rota w marszu przechodzi przez stojącą bez strat, a ciała w kontakcie z wrogiem nie są przepychane.
- Pozycje w `Float32Array` mogły wylądować na krawędzi muru.
- Pomiary czasu kroku w Node były zawyżone kilkukrotnie, bo rdzeń działał w `node:vm`; teraz jest wykonywany w głównym kontekście.

## Testy
`npm install && npm test`. Rdzeń (24 testy; etap 1 dodał: identyczność typu 3 względem wersji sprzed etapu, różnice strukturalne pięciu typów, 25 ziaren na typ pod względem osiągalności i wolnych stref, linia zamiast plugu na mapach bez przesmyku, przesunięcie układu rot, nawigacja atakujących; `ONLY=fragment node tests/p1-core.test.js` uruchamia wybrane testy). Pierwotnie rdzeń (18 testów): zakres i nazwy rot, gwardia dowolnego typu, w walce ciała nie nakładają się (najgorszy pomiar 2,6% mrówek w nakładającej się parze), swoi mijają się poza walką, ciało w kontakcie stoi, zmęczenie, kapitan, determinizm (także z rozkazami), granice, kwas i uzupełnienia, geometria plugu, wpływ szerokości, kontrola feromonowa, wydajność. Przeglądarka: start, kółko myszy, marsz grupy rot z zachowaniem rozmieszczenia, pauza z rozkazem, klawisze, grupy, ramka, restart, suwak, ekran końcowy.
Krok symulacji przy ok. 4200 mrówkach w Node: mediana 9 ms, p99 17 ms, max 50 ms przy budżecie 50 ms (20 Hz). To czas sandboxa, nie kryterium 15.2.

## Nie zweryfikowane
- Etap 1 (mapy): czy mapy 4 i 5 są fajne do grania, czy gęstość i kręte korytarze sprawdzają się w walce, czy marsz przez gąszcz trwa za długo (ok. 4-7 minut dla całej armii; limit bitwy to 15 minut). Typ 3 jest dotychczasowym układem stałym (ziarno zmienia tylko mech). Nie ma elewacji, widoczności ani ukrywania się w mchu (etap 4): osłona (mech) tylko zmniejsza obrażenia. Zarośla (nowy typ komórki) blokują ruch jak pień i nie dają ukrycia.
- Etap 1: AI zna tylko jeden plan (atak na gniazdo najkrótszą trasą), więc na mapach z wieloma trasami nie oskrzydla. Sprawdzono tylko 4 ziarna na typ.
- Czy to jest fajne: czy dowodzenie rotami bawi, czy unikaty są czytelne w ruchu, czy po trzech bitwach da się powiedzieć, dlaczego się wygrało, czy zmęczenie i kapitan są zrozumiałe. Wymaga gry człowieka.
- Wydajność 50 klatek/s w Chrome na typowym PC. Renderer w piaskownicy jest programowy, więc FPS tu nic nie mówi.
- Gwardia typu Taran lub Odźwierny ma tylko statystyki elity (bez Szarży i Zamknięcia); gwardia pękaczy detonuje przy kontakcie.
- Marsz grupy tylko przesuwa układ rot, nie obraca go jak w Total War.
- Bitwy bez rozstrzygnięcia (upływ czasu, wygrywa obrońca) i brak monotonii względem szerokości są cechą obecnych liczb, nie planowanego balansu; do dostrojenia w teście ręcznym suwakami.
- Liczebność poniżej widełek 2000-4000 z 15.2 jest decyzją użytkownika (czytelność); test 10 tys. mrówek należy do etapu T.
- Dźwięk, kampania, ekonomia, lotnictwo, wnętrze gniazda, splot i beczki są poza zakresem P1.
