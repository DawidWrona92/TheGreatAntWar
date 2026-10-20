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

> Uwaga: wyniki AI w Oblężeniu z etapów 1-3 (wygrane WK, czasy marszu, tabele wzorców dla Oblężenia) zmierzono przed zmianą, po której uzupełnienia ma tylko obrońca (atakujący ich nie ma). Wyniki Bitwy i Przeprawy tej zmiany nie dotyczą. Pomiary w Oblężeniu wymagają powtórzenia.

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

## Etap 2 rozszerzenia: wybór scenariusza
Menu ma listę scenariuszy (parametr URL `scenario=bitwa|oblezenie|przeprawa`), niezależną od wyboru typu mapy. Domyślne Oblężenie to dotychczasowa gra (test regresji: identyczny przebieg i teren jak przed etapem 2, także na mapach z etapu 1).

| Scenariusz | Gniazdo | AI atakujących / obrońców | Koniec bitwy |
|---|---|---|---|
| Bitwa | nie | obie strony idą na najbliższą rotę przeciwnika | zniszczenie przeciwnika (< 5%), po czasie więcej ocalałych (odsetek) |
| Oblężenie | tak (mur z wejściem) | WK szturmuje, LH broni | zajęcie gniazda lub zniszczenie obrońców, po czasie wygrywa obrona |
| Przeprawa | nie | WK się przeprawia, LH trzyma drugi brzeg | jak w Bitwie |

Przeprawa ma własną, stałą mapę (potok z kamieniami, 3000×3200): woda blokuje ruch, ale nie zasłania strzału, a trzy brody to łańcuchy trzech dużych kamieni. W teście woda faktycznie blokuje (po zamianie kamieni na wodę strefy startu i obrońców są rozłączne), są dokładnie 3 brody, w trakcie bitwy nikt nie stał w wodzie, a atakujący przechodzą na drugi brzeg.

**Poprawka po teście ręcznym (brody za blisko).** Pierwsza mapa miała brody co ok. 330 jednostek: armia przechodziła między nimi w 5 s (biegacze) do 21 s (tarany), a AI w ogóle nie wybierało brodów. Teraz mapa jest większa (3000×3200, ok. 10 mln jedn.² zamiast 2,9), brody są oddalone o ok. 1200 jednostek, środkowy jest wąski i przy armiach, skrajne szerokie i odległe, a AI obu stron wybiera brody według przewagi i czasu dojścia (decyzja 46). Czas przejścia między sąsiednimi brodami (z prędkości jednostek): biegacz ok. 19 s, wojownik 39 s, ciężki 53 s, taran 73 s. Przyciski „Bród 1-3” na pasku przesuwają kamerę.

Czy brody są osobnymi starciami (wykonane: `node tests/p1-przeprawa.js --seeds 5`, 25 bitew AI przeciw AI po 600 s, `wyniki/p1-przeprawa-szybkosc.json`): w bazowym wariancie średnio na 2 z 3 brodów padło co najmniej po 60 mrówek z każdej strony, a największy bród zebrał 45% wszystkich strat (przy jednej wielkiej bitwie byłoby 100%). Atakujący rozdziela siły na wszystkie trzy brody, a obrońcy z środka przerzucają rezerwy na skrajne.

Czy szybkość daje przewagę (te same warianty, mnożnik prędkości jednej strony; średnie z 5 ziaren): obrońcy dochodzą na skrajne brody po atakujących. Po 90 s przy skrajnych brodach było średnio 88 i 121 obrońców wobec 296 i 287 atakujących; gdy Lake Hodges jest szybszy (x1,4), obrońców jest tam już 192 i 169, a gdy wolniejszy (x0,7) tylko 51 i 23. Szybsza Wielka Kolonia (x1,4) przechodzi pierwszy bród po 53 s zamiast 72 s, wolniejsza (x0,7) po 132 s. Szybkość więc rzeczywiście decyduje o tym, kto zdąży. Natomiast pełne bitwy AI nie zamieniają tego na zwycięstwa: Wielka Kolonia przegrała wszystkie 25 bitew we wszystkich wariantach (obrońca przy wyjściu z wąskich kamieni ma dużą przewagę), a straty atakujących przy skrajnych brodach przekraczają straty obrońców co najmniej 2,7:1 (799 do 279 w wariancie bazowym, 379 do 80 przy szybszej Wielkiej Kolonii). To ocena AI, nie balansu: AI atakujących nie potrafi wykorzystać przewagi w tempie (np. uderzyć szybkimi na odsłonięty bród i zabezpieczyć go, zanim dojdą rezerwy). To sprawdza się dopiero w grze człowieka.

AI przeciw AI (wykonane: `node tests/p1-experiment.js --seeds 4 --scenarios bitwa,oblezenie,przeprawa --map-type 2`, stara wersja mapy przeprawy; dane `wyniki/p1-scenariusze-bitwy.json`): wygrane Wielkiej Kolonii 3/4 w Bitwie i 0/4 w Oblężeniu (ten sam wynik co na mapie 2 w etapie 1). W Bitwie obie armie niemal się wzajemnie niszczą (po ok. 1100 strat) i połowa bitew kończy się dopiero przy limicie czasu. Wynik Przeprawy z tego przebiegu (0/4) dotyczy starej mapy; nowa: 0/25, jak wyżej.

Zrzuty: `wyniki/p1-scenariusz-bitwa.png`, `p1-scenariusz-oblezenie.png`, `p1-scenariusz-przeprawa.png`, `p1-przeprawa-brod.png` (kamera na brodzie 3).

## Etap 3 rozszerzenia: konfiguracja armii
Menu ma wybór budżetu (Mały 1200, Średni 2200, Duży 3500 punktów; parametr URL `budget=maly|sredni|duzy`), przycisk „Konfiguruj armię…” i wybór stylu armii przeciwnika. Bez budżetu obie strony mają armię ze scenariusza (jak dotąd, test regresji).

Czego brakowało i jak to rozwiązano. Dokument 0.5 nie podaje kosztów jednostek ani budżetów bitwy, więc zapytałem użytkownika: koszty to tabela wg roli (założenie prototypu, w bloku `army` w JSON): piechur 1, ciężki wojownik 3, biegacz 2, pękacz 2, plujka 4, odźwierny 7, taran 8, dowódca z gwardią 30 + 50 x koszt typu x 1,7. Budżety 1200/2200/3500 też wybrał użytkownik. Jednostek latających nie ma (użytkownik kazał je odłożyć; w dokumencie lotnik nie ma statystyk ani zasad), jest to na liście `TODO.md`.

Ekran konfiguracji: lista dostępnych jednostek frakcji (wspólne + własne unikaty) ze statystykami i kosztem, skład armii (typ i rozmiar roty 30-300, dowódcy z gwardią 1-3, typ gwardii), pasek wykorzystanego i pozostałego budżetu, wzorzec AI do zastosowania i edycji, ostrzeżenie o braku miejsca. W Bitwie i Przeprawie obie strony dostają równy budżet, w Oblężeniu atakujący x1,5 (3300 przy Średnim). Budżet jest twardym limitem w rdzeniu (błąd przy przekroczeniu, jednostce spoza puli, złym rozmiarze, braku dowódcy).

Dobór armii przez AI to nazwane wzorce, nie losowanie: zrównoważona, ciężka, lekka masa, flankująca (WK), szturmowa (WK), wytrwała i dystansowa (LH). Test sprawdza, że udziały kosztów zgadzają się z definicją wzorca (±13 punktów procentowych), a wzorce różnią się od siebie. `auto` dobiera wzorzec do scenariusza i roli (oblężenie: WK szturmowa, LH dystansowa lub wytrwała; przeprawa: WK flankująca, LH dystansowa) i do armii gracza (wobec plujek flankująca, wobec masy ciężka lub dystansowa); w Bitwie ziarno rozstrzyga między podobnie dobrymi.

Wzorce przeciw sobie (wykonane: `node tests/p1-armie.js --seeds 2`, Bitwa na mapie 2, budżet Średni, 2 ziarna, średnia różnica odsetka ocalałych WK i LH po 450 s lub końcu bitwy; dodatnia to przewaga WK, `wyniki/p1-armie-wzorce.json`):

| WK \ LH | zrównoważona | ciężka | lekka | wytrwała | dystansowa |
|---|---|---|---|---|---|
| zrównoważona | 0,01 | 0,14 | -0,14 | -0,03 | 0,05 |
| ciężka | -0,01 | 0,00 | -0,16 | 0,07 | 0,18 |
| lekka | 0,31 | 0,41 | -0,02 | 0,50 | 0,51 |
| flankująca | -0,01 | -0,14 | -0,32 | 0,10 | 0,11 |
| szturmowa | 0,03 | 0,05 | -0,01 | 0,03 | 0,07 |
| wytrwała | 0,06 | 0,05 | -0,17 | 0,08 | 0,22 |

Pomiar wykonany na ostatecznym kodzie rozmieszczenia (po poprawkach frontu 425, minimalnej rocie tarana i sprawdzaniu siatki). Wzorce dają różne wyniki (lekka masa wygrywa z większością, ale remisuje z LH-lekką, a flankująca przegrywa z lekką i ciężką LH), ale to tylko 2 ziarna i AI w bitwie, a miara „odsetek ocalałych” premiuje tanią, liczną piechotę (lekka masa ma najwięcej ciał). To nie jest pomiar balansu.

Ograniczenia: strefa startu Wielkiej Kolonii ma 470 jednostek szerokości, więc mieści najwyżej ok. 2000 mrówek (w budżecie Duży lekka masa WK i przewaga x1,5 atakującego w oblężeniu bywają ograniczone miejscem; interfejs wyłącza dodawanie, a rdzeń zgłasza „brak miejsca”). Rozmieszczenie jest automatyczne (gracz nie ustawia rot ręcznie) i omija przeszkody (stałe głazy mapy 3, ściany gąszczu). Podczas prac wyszły dwa błędy rozmieszczenia: ściany czołowe gąszczu wchodzą w strefę startu do ok. x = 440, a mapa 3 ma głazy w strefie obrońców; stąd front WK na 425 i sprawdzanie siatki terenu w `layoutArmy`.

## Błędy znalezione po drodze (każdy ma test)
- Pula kwasu i dopływ uzupełnień były `NaN` (zła ścieżka parametru); potem dopływ był liczony na krok zamiast na sekundę (1/20 zamierzonego tempa). Test: uzupełnienia wchodzą, plujki strzelają.
- Plug stał poza przejściem, był za wąski, obracał się za wrogiem, a szybkie mrówki i nacisk tłumu przepychały się przez szyk. Test: nieśmiertelny zamknięty plug nie przepuszcza nikogo przy 64, 128 i 256.
- Kapitan roty był wybierany w narożniku szyku (każda walka oznaczała natychmiastowy wstrząs morale); teraz najbliżej środka.
- `report()` zmieniał stan gry (wołał `checkEnd`); teraz jest tylko do odczytu, a koniec bitwy jest idempotentny.
- Mrówki blokowały się nawzajem także poza walką (tylne roty utykały w kolejce); dodano mijanie się swoich poza walką. Test: rota w marszu przechodzi przez stojącą bez strat, a ciała w kontakcie z wrogiem nie są przepychane.
- Pozycje w `Float32Array` mogły wylądować na krawędzi muru.
- Etap 2: w Bitwie na mapie 3 plug (zamknięty szyk odźwiernych) dostawał rozkaz ataku i stał jako nieruchomy mur w polu; nie wykrył tego żaden przebieg, bo wszystkie szły na mapach bez przesmyku. Teraz plug zostaje tylko w Oblężeniu na mapie z przesmykiem. Test postawy AI sprawdza Bitwę na mapie 3.
- Etap 1: rota w krętym korytarzu rozciągała się, a kotwica pełzła z 10% prędkości (naprawione: mrówka bez widoku na slot idzie za kotwicą, tylko na mapach 4 i 5).
- Pomiary czasu kroku w Node były zawyżone kilkukrotnie, bo rdzeń działał w `node:vm`; teraz jest wykonywany w głównym kontekście.

## Testy
`npm install && npm test`. Rdzeń (39 testów; etap 1 dodał: identyczność typu 3 względem wersji sprzed etapu, różnice strukturalne pięciu typów, 25 ziaren na typ pod względem osiągalności i wolnych stref, linia zamiast plugu na mapach bez przesmyku, przesunięcie układu rot, nawigacja atakujących; `ONLY=fragment node tests/p1-core.test.js` uruchamia wybrane testy). Pierwotnie rdzeń (18 testów): zakres i nazwy rot, gwardia dowolnego typu, w walce ciała nie nakładają się (najgorszy pomiar 2,6% mrówek w nakładającej się parze), swoi mijają się poza walką, ciało w kontakcie stoi, zmęczenie, kapitan, determinizm (także z rozkazami), granice, kwas i uzupełnienia, geometria plugu, wpływ szerokości, kontrola feromonowa, wydajność. Przeglądarka: start, kółko myszy, marsz grupy rot z zachowaniem rozmieszczenia, pauza z rozkazem, klawisze, grupy, ramka, restart, suwak, ekran końcowy.
Krok symulacji przy ok. 4200 mrówkach w Node: mediana 9 ms, p99 17 ms, max 50 ms przy budżecie 50 ms (20 Hz). To czas sandboxa, nie kryterium 15.2.

## Nie zweryfikowane
- Etap 3 (armie): koszty i budżety to założenia, nie dane z dokumentu; wzorce AI sprawdzone na 2 ziarnach; nie wiadomo, czy wybór armii jest ciekawy i czy ekran konfiguracji jest wygodny. Rezerwa uzupełnień (150 piechurów) jest poza budżetem, więc faktyczna siła armii jest nieco większa niż koszt. AI kontruje armię gracza, znając ją przed bitwą.
- Etap 2 (scenariusze): oblężenie nie ma jeszcze przewagi budżetowej atakującego (jednostki nie mają kosztów; budżety dopiero w etapie 3) ani wnętrza kopca (etap 5), więc różni się od Bitwy tylko gniazdem, postawą AI i warunkami końca. W Przeprawie nie ma celu terenowego (zdecydował użytkownik): przeprawa liczy się tylko przez teren. Zasada „po czasie wygrywa większy odsetek ocalałych” w Bitwie i Przeprawie jest założeniem projektowym. Przeprawa jest mocno po stronie obrońcy przy obecnym AI (0 wygranych WK w 25 bitwach), więc balans i to, czy człowiek jako atakujący ma realną szansę, wymaga testu ręcznego. Czas dojścia jest liczony z odległości w linii prostej, a nie z długości trasy.
- Etap 1 (mapy): czy mapy 4 i 5 są fajne do grania, czy gęstość i kręte korytarze sprawdzają się w walce, czy marsz przez gąszcz trwa za długo (ok. 4-7 minut dla całej armii; limit bitwy to 15 minut). Typ 3 jest dotychczasowym układem stałym (ziarno zmienia tylko mech). Nie ma elewacji, widoczności ani ukrywania się w mchu (etap 4): osłona (mech) tylko zmniejsza obrażenia. Zarośla (nowy typ komórki) blokują ruch jak pień i nie dają ukrycia.
- Etap 1: AI zna tylko jeden plan (atak na gniazdo najkrótszą trasą), więc na mapach z wieloma trasami nie oskrzydla. Sprawdzono tylko 4 ziarna na typ.
- Czy to jest fajne: czy dowodzenie rotami bawi, czy unikaty są czytelne w ruchu, czy po trzech bitwach da się powiedzieć, dlaczego się wygrało, czy zmęczenie i kapitan są zrozumiałe. Wymaga gry człowieka.
- Wydajność 50 klatek/s w Chrome na typowym PC. Renderer w piaskownicy jest programowy, więc FPS tu nic nie mówi.
- Gwardia typu Taran lub Odźwierny ma tylko statystyki elity (bez Szarży i Zamknięcia); gwardia pękaczy detonuje przy kontakcie.
- Marsz grupy tylko przesuwa układ rot, nie obraca go jak w Total War.
- Bitwy bez rozstrzygnięcia (upływ czasu, wygrywa obrońca) i brak monotonii względem szerokości są cechą obecnych liczb, nie planowanego balansu; do dostrojenia w teście ręcznym suwakami.
- Liczebność poniżej widełek 2000-4000 z 15.2 jest decyzją użytkownika (czytelność); test 10 tys. mrówek należy do etapu T.
- Dźwięk, kampania, ekonomia, lotnictwo, wnętrze gniazda, splot i beczki są poza zakresem P1.
