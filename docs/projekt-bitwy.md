# Wojna superkolonii: decyzje projektowe i pseudokod bitwy (P1)

Dokument opisuje, jak działa bitwa w prototypie `prototypy/p1-bitwa.html`, i jest pisany tak, żeby dało się ją odtworzyć w C++ lub C#. Źródłem prawdy dla liczb jest blok JSON `defs` na początku pliku (tabele poniżej są z niego wygenerowane), a dla zachowania blok `SIM-BEGIN`/`SIM-END`. Zasady kanoniczne: `docs/Dokument_0.5.pdf`. Dokument 0.5 się nie zmienia; tu są wnioski i decyzje z prototypu.

## 1. Decyzje projektowe

**Skala i czytelność**
1. Rój jest rzadki. Odstęp w szyku to 11 jednostek świata, ciało zwykłej mrówki ma promień 4. Na polu jest ok. 1900 mrówek w 23 rotach. To świadome zejście poniżej widełek 2000-4000 z sekcji 15.2 dokumentu: na prośbę użytkownika woleliśmy widzieć pojedyncze mrówki i więcej rot niż gęsty tłum. Test wydajności 10 tys. mrówek należy do etapu T, nie do P1.
2. Widok jest izometryczny 2:1 (rzut: `sx = (x - y) * 0.5 * S`, `sy = (x + y) * 0.25 * S`, S = 2). Symulacja zna tylko płaszczyznę (x, y); izometria to wyłącznie prezentacja.
3. Sprite'y są malowane w wysokiej rozdzielczości (atlas 2,4 razy większy niż na ekranie), 16 kierunków, cień rzucany w prawo-dół. Wielka Kolonia jest czarna, Lake Hodges czerwony; typy różnią się sylwetką.

**Fizyka ciał**
4. Mrówki mają ciało (okrąg o promieniu zależnym od typu) i masę. W walce nie mogą się przenikać ani stackować: tylny szereg czeka, aż przed nim zrobi się miejsce (poległy kolega, rozciągnięty szyk).
5. Ruch jest wyprzedzający: mrówka nie wchodzi w punkt, w którym nałożyłaby się na ciało wroga albo kolegi w kontakcie z wrogiem, do którego się zbliża (próbuje odchylić tor o ±0,9 rad, inaczej stoi). Po ruchu jest kilka przejść relaksacji nakładających się par.
6. W relaksacji lżejsza lub niewalcząca mrówka ustępuje cięższej i tej, która jest w kontakcie z wrogiem (masa walczącego jest mnożona przez `collision.fightMass`).
7. Zamknięty plug odźwiernych jest twardą przeszkodą: mrówka wraca na tę stronę, z której przyszła (pozycja sprzed kroku). Bez tego nacisk tłumu przepychał mrówki na drugą stronę szyku.
8. **Poza walką swoi się mijają**, jak w Total War: idąca mrówka przepycha się przez stojącą kolegę, a stojąca odsuwa się bokiem od jej toru i robi przejście. Dotyczy tylko swoich, którzy nie są w kontakcie z wrogiem, i tylko gdy mijana mrówka nie jest wyraźnie cięższa (masa do 2,5 razy większa niż mijającej). W walce ta reguła nie obowiązuje: ciało w kontakcie z wrogiem stoi, nikt go nie przesuwa. Mrówki przy zamkniętym plugu nie mijają się, żeby nic nie wślizgnęło się w szczelinę.
9. Walka wręcz wymaga kontaktu (`reach` to szczelina między ciałami, kilka jednostek), więc w kontakcie walczy pierwszy szereg, a nie stos mrówek.

**Roty, szyki, rozkazy**
10. Rota ma kotwicę (środek szyku), kierunek, szyk (linia, kolumna, klin) i sloty. Kotwica jedzie po polu przepływu (jedno na cel); mrówki idą do swoich slotów, a gdy slot jest za przeszkodą, podążają za polem przepływu.
11. Szyk układa się wg rangi typu (przód: taran i odźwierny; tył: plujki i dowódca) i rzadko, z odstępem zależnym od ciała (taran i ciężka elita mają większy). Plug ma ciasny odstęp, żeby zamykać przejście bez szczelin.
12. Rozkazy: atak-marsz (walczy po drodze), ruch (nie walczy), stój (broni się w promieniu 18), odwrót (broni się tylko w zasięgu kontaktu), szyk, umiejętność. Rozkazy można wydawać w pauzie.
13. Rozkaz z formowaniem: przeciągnięcie PPM przy wydawaniu rozkazu ustawia kierunek, w którym rota ma stanąć po dotarciu na miejsce, a kółko myszy w trakcie przeciągania zmienia szerokość szyku (a przez to głębokość: te same mrówki w mniejszej liczbie szerszych lub węższych rzędów). Podgląd to prostokąt szyku ze strzałką. Rozkaz niesie `face` i `cols`; po dotarciu kotwica obraca się do `face` i trzyma ten kierunek. Pozwala to na manewry typu oskrzydlenie pod Kannami.
14. Wizualizacja rozkazów: dla zaznaczonych rot rysowana jest linia od roty do celu: biała to ruch, czerwona to atak, jasnoniebieska to odwrót, żółty pierścień to stój; w miejscu docelowym widać prostokąt szyku i strzałkę kierunku, jeśli podano `face`.
15. Kilka zaznaczonych rot jedzie razem z zachowaniem wzajemnego rozmieszczenia (przesunięcie całego układu od środka grupy do celu, a przy przeciąganiu także obrót o różnicę między kierunkiem wskazanym a średnim kierunkiem rot); pojedyncza rota idzie dokładnie w kliknięty punkt.
16. Rota ma nazwę zależną od typu (Rota wojowników, Rota taranów...), z numerem porządkowym (`#n`) tylko do odróżnienia w interfejsie.

**Dowodzenie i morale**
17. Morale to kontrola feromonowa 0-100 w trzech stanach: pełna (≥ 60), osłabiona (25-60), utracona (< 25, powrót od 45). Utrata kontroli: Wielka Kolonia wpada w szał (atakuje najbliższego wroga, ignorując rozkazy), Lake Hodges się wycofuje.
18. Kontrola rośnie od regeneracji, bonusu za dowódcę w zasięgu i za zwartą masę, a maleje od strat w ostatnich 6 s (ułamek roty), alarmu w walce, braku dowódcy w zasięgu (silniej u Wielkiej Kolonii), odcięcia od innych rot, zmęczenia i śmierci kapitana.
19. Dowódca ma własną rotę (gwardię). Gwardia to elita: statystyki bazowe razy mnożniki elitarności (zdrowie, obrażenia, tempo ataku, pancerz). Typ gwardii jest dowolny i wybierany przy rekrutacji (w prezentacji domyślnie ciężka). Dowódca nie siedzi w zwykłych rotach.
20. Zasięg dowódcy (promień aury) jest rysowany na ziemi. Umiejętność dowódcy (Rozkaz) podnosi kontrolę rot w aurze.
21. Każda rota bez dowódcy ma kapitana: mrówkę najbliżej środka szyku. Jego śmierć zbija kontrolę o `captain.shock` i na `captain.dur` sekund obniża regenerację; potem awansuje następca. To odpowiednik śmierci princepsa.
22. Zmęczenie roty 0-100: rośnie w marszu i walce, spada na odpoczynku. Obniża tempo ataku, prędkość, obrażenia i kontrolę.

**Walka i frakcje**
23. Piechota jest wspólna. Specjalne: Taran (odporny na masę, odrzuca), Biegacz (szybki, poluje na plujki), Pękacz (jednorazowy, oblepia), Odźwierny (plug, zamykany), Plujka (kwas, ograniczona amunicja), dowódca. Ciężki wojownik jest wspólny dla obu stron i jest podstawą ciężkiej gwardii.
24. Kontry to mnożniki obrażeń (tabela poniżej). Elita dziedziczy kontry typu bazowego.
25. Kwas to wspólna pula roty plujek: start `acidStart` strzałów na plujkę, napływ zależny od suwaka zaopatrzenia. Uzupełnienia (wojownicy z rezerwy) wchodzą w tempie zależnym od suwaka zaopatrzenia i trafiają do roty z największym niedoborem.
26. Na mapie typu 3 plug zamyka główny przesmyk od startu. Szerokość przesmyku (32-320) zmienia przebieg bitwy. Mapa to „dno lasu” 2000 x 1200: pień z głównym przesmykiem i wąską bocznicą, kilka głazów, korzeni i kłód oraz plamy mchu (osłona) i gniazdo z wejściem od zachodu. Przeszkody są danymi w JSON.
27. Tempo walki ustawia jeden mnożnik `cdScale` (czas między atakami), niezależny od balansu między typami.
28. Przebieg jest deterministyczny: ziarno, stały krok 20 Hz, osobne strumienie losowe (mapa, uzupełnienia, walka), kolejka poleceń. Ten sam dziennik poleceń daje ten sam stan.

**Interfejs**
29. 0. Plujka jest jednostką dystansową (zasięg 80, plama kwasu o promieniu 10, ograniczona amunicja). Pocisk leci łukiem ponad własnymi mrówkami (własne ciała nie blokują strzału), a przy wyborze celu liczy się tylko to, czy teren (pień, głaz, korzenie) przesłania linię. Pociski i plamy to efekty prezentacji (`sim.fx`), niewpływające na stan gry. Wybuchy pękaczy są rysowane jako pierścień.
30. Nad rotą zawsze widać tylko chorągiew z literą typu. Po zaznaczeniu lub najechaniu pojawia się panel: nazwa, liczebność (aktualnie/max), pasek zdrowia podzielony na mrówki (cała = pełne, ranna = połowa, martwa = puste), pasek morale ze znacznikami progów i pasek zmęczenia.
31. Interfejs w stylu Warhammera na drewnianych panelach (tekstura desek generowana w kodzie): na dole wąskie karty rot (liczebność, ikona typu, pasek zdrowia, morale, zmęczenie), w lewym dolnym rogu portret zaznaczonej roty, po prawej siatka umiejętności 3x3 (obecnie 5 umiejętności i 4 puste pola na kolejne) z klawiszami Q, E, R, F, G, nad kartami pasek rozkazów (szyki, stój, ruch, odwrót).
32. Parametry są w jednym obiekcie i można je zmieniać suwakami na żywo, zapisać i wczytać.

**Mapy (etap 1 rozszerzenia P1)**
33. Przed bitwą wybiera się jeden z pięciu typów mapy (`world.mapTypes`, od najprostszego): 1 otwarta polana, 2 kilka przeszkód, 3 pień z kilkoma trasami, 4 gęsty i kręty podszyt, 5 chaparral (gąszcz wąskich przejść). Typy 1, 2, 4 i 5 są generowane z ziarna (osobny strumień losowy `mapgen`, więc nie przesuwa pozostałych strumieni). Typ 3 to dotychczasowa mapa „dno lasu” bez zmian: układ jest stały, a ziarno zmienia tylko plamy mchu. Dzięki temu wyniki z P1 nadal dotyczą typu 3 i test regresji sprawdza, że przebieg jest identyczny jak przed etapem 1.
34. Każdy typ ma gniazdo na wschodzie (`W - 200`, `H / 2`) i strefę startu atakującego na zachodzie. Układ rot w `scenario` jest zapisany dla mapy 2000 x 1200 i przy tworzeniu bitwy przesuwany: strona zachodnia o `dy = (H - 1200) / 2`, wschodnia o `dx = W - 2000` i `dy`. Strefy rozmieszczenia (zachodnia: x < 470; wschodnia: x > `W - 1100`, y w pasie 370 wokół osi) generator zostawia wolne od przeszkód.
35. Generatory: *open* to 4-6 drobnych kamyków; *scattered* to 8-11 głazów, korzeni i kłód z odstępem co najmniej 150 jednostek (brak wąskich gardeł); *thicket* to labirynt w pasie między strefami: siatka o kroku `pitch`, drzewo rozpinające (przeszukiwanie w głąb), część ścian usuwana (`braid`, daje pętle, czyli kilka tras), ściany jako kapsuły o promieniu `wallR` z losowym przesunięciem wierzchołków (`jitter`), ściany czołowe pasa z `doors` wejściami w losowych rzędach. Rodzaj ściany losowany z `mix`: zarośla (nowy typ komórki 6, blokuje jak pień), pnie, korzenie, kamienie. Po bokach pasa rozrzucone są zarośla i głazy.
36. Walidacja mapy: każdy kandydat jest rasteryzowany i mierzony (`mapMetrics`): musi istnieć trasa od strefy startu do wejścia do gniazda, a najszersza trasa musi mieć w najwęższym miejscu co najmniej `minWidth` (transformata odległości do ścian). Inaczej losowany jest kolejny wariant (do 12 prób). Metryki: odsetek otwartego terenu, szerokość najszerszej trasy w najwęższym miejscu, kręta droga (długość najkrótszej trasy przez odległość w linii prostej) oraz, w narzędziu `tools/mapa-metryki.js`, łączna szerokość przejść w najwęższym przekroju pasa środkowego (maksymalny przepływ).
37. Mapy bez głównego przesmyku (1, 2, 4, 5): `world.gap = null`; odźwierni stają jako zwykła linia obrony (`role: line`, bez zamykania, z ciała dobranego odstępem), a suwak szerokości przesmyku jest wyłączony. Zamknięcie szyku nadal jest dostępne jako umiejętność gracza.
38. Mapy z korytarzami (4 i 5, `world.followAnchor`): mrówka, która nie widzi swojego miejsca w szyku (albo miejsce leży w ścianie), idzie za kotwicą roty (pole przepływu do kotwicy, odświeżane co 0,5 s po zmianie jej komórki), a nie przed nią do celu rozkazu. Błąd szyku jest mierzony drogą do kotwicy ponad promień szyku. Bez tego rota w krętym korytarzu rozciągała się, spójność spadała do 0,1 i kotwica pełzła z 10% prędkości, a rota traciła kontrolę od zmęczenia. Na mapach 1-3 zachowanie jest dotychczasowe.
39. Duże mapy: tekstura terenu jest dzielona na kafle 2048 px z zakładką 2 px (limit tekstury GPU to zwykle 4096-8192 px), a minimalny zoom kamery zależy od rozmiaru mapy.

**Poza zakresem P1:** kampania, ekonomia, lotnictwo, wnętrze gniazda, splot, beczki, dźwięk, obrót całego układu rot przy marszu grupy, aktywne umiejętności gwardii innych niż dowódcy (gwardia typu Taran/Odźwierny ma tylko statystyki elity; gwardia pękaczy detonuje przy kontakcie).

## 2. Dane

### Świat
| Parametr | Wartość |
|---|---|
| `world.w` | 2000 |
| `world.h` | 1200 |
| `world.passage` | 192 |
| `world.timeLimit` | 900 |
| `world.gap` | [1000, 600] |
| `world.nest` | [1800, 600] |
| `world.nestR` | 64 |
| `world.retreatWK` | [110, 600] |

Mapa typu 3 („dno lasu”) 2000 x 1200 i jej przeszkody (poniżej). Siatka terenu 16x16 jednostek: 0 otwarte, 1 pień lub kłoda, 2 osłona (mech), 3 mur gniazda, 4 głaz, 5 korzenie, 6 zarośla; blokują wszystkie poza 0 i 2. Przeszkody są w `world.map.obstacles` jako kapsuły o promieniu `r` wzdłuż łamanej (`line`) albo dyski (`at`); `gapTop` i `gapBottom` oznaczają brzegi głównego przesmyku wyśrodkowanego w `world.gap` o szerokości `passage` (zawsze otwartego). W pniu jest też wąska bocznica: światło między kapsułami wynosi ok. 17 jednostek, czyli jedną komórkę siatki (wcześniejsze opisy podawały błędnie ok. 65). Gniazdo to pierścień murów z wejściem od zachodu. Dodatkowo `world.map.coverRandom` losowych plam mchu (osłona, ziarno `map`).

Przeszkody:
| Typ | Promień | Położenie |
|---|---|---|
| wood | 24 | [[1010, 0], [1000, 140]] |
| wood | 24 | [[1000, 205], [985, 300], [1015, 420], 'gapTop'] |
| wood | 24 | ['gapBottom', [1020, 820], [985, 1000], [1005, 1200]] |
| stone | 62 | [520, 330] |
| root | 72 | [570, 880] |
| wood | 14 | [[640, 520], [705, 700]] |
| stone | 55 | [560, 1090] |
| stone | 66 | [1350, 320] |
| stone | 72 | [1390, 900] |
| wood | 14 | [[1500, 470], [1570, 740]] |
| root | 60 | [1650, 200] |

### Typy map (`world.mapTypes`)
| Typ | Nazwa | Rozmiar | Generator | Parametry |
|---|---|---|---|---|
| 1 | Otwarta polana | 2000x1200 | open | `pebbles` [4, 6], `cover` 10 |
| 2 | Kilka przeszkód | 2000x1200 | scattered | `count` [8, 11], `sep` 150, `cover` 14 |
| 3 | Pień z kilkoma trasami | 2000x1200 | legacy |  |
| 4 | Gęsty i kręty podszyt | 2600x1400 | thicket | `pitch` 128, `wallR` 26, `jitter` 8, `braid` 0.1, `doors` 6, `follow` True, `cover` 40, `minWidth` 52, `mix` {'brush': 0.45, 'wood': 0.25, 'root': 0.15, 'stone': 0.15} |
| 5 | Chaparral: gąszcz wąskich przejść | 3000x1500 | thicket | `pitch` 116, `wallR` 28, `jitter` 6, `braid` 0.04, `doors` 4, `follow` True, `cover` 70, `minWidth` 44, `mix` {'brush': 0.62, 'wood': 0.18, 'root': 0.12, 'stone': 0.08} |

### Jednostki
Pola: zdrowie, prędkość (jedn./s), obrażenia, kontakt (`reach`, szczelina między ciałami w jedn.), czas między atakami (s, przed `cdScale`), zasięg wypatrywania, promień ciała, masa, pancerz (ułamek redukcji obrażeń wręcz), zasięg (plujka), umiejętność. Elita `gwardia_<typ>` jest generowana dla każdego typu poza dowódcą.

| Klucz | Nazwa | HP | Prędkość | Obr. | Kontakt | Czas ataku | Wzrok | Promień | Masa | Pancerz | Zasięg | Umiejętność |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| `infantry` | Wojownik | 10 | 30 | 2.0 | 2 | 1.0 | 28 | 4.0 | 1 | 0 |  |  |
| `ciezki` | Wojownik ciężki | 24 | 22 | 2.2 | 2 | 1.1 | 26 | 4.8 | 2.5 | 0.3 |  |  |
| `taran` | Taran | 50 | 16 | 3.5 | 2.5 | 1.3 | 24 | 6.2 | 5 | 0.3 |  | Szarża |
| `biegacz` | Biegacz | 6 | 62 | 1.6 | 1.8 | 0.8 | 40 | 3.2 | 0.7 | 0 |  | Rajd |
| `pekacz` | Pękacz | 8 | 26 | 0 | 2 | 1.0 | 0 | 4.6 | 1.2 | 0 |  | Pęknięcie |
| `odzwierny` | Odźwierny | 24 | 11 | 1.6 | 2 | 1.1 | 20 | 5.6 | 6 | 0.4 |  | Zamknij wejście |
| `plujka` | Plujka | 5 | 24 | 1.0 | 0 | 2.2 | 0 | 3.6 | 0.9 | 0 | 80 |  |
| `dowodca` | Dowódca | 70 | 30 | 3.0 | 2.5 | 1.0 | 24 | 5.4 | 3 | 0.2 |  | Rozkaz |

Dodatkowo: Taran odrzuca (`knock` 45), Pękacz ma `burst` (promień 22, obrażenia 3.5, oblepienie 6 s, wypatrywanie 120), Plujka ma `aoe` 10, Odźwierny jest `heavy` (nie odrzucany).

### Kontry (mnożnik obrażeń atakującego wobec obrońcy, domyślnie 1)
| Para | Mnożnik |
|---|---|
| taran → infantry | ×1.4 |
| taran → odzwierny | ×0.8 |
| infantry → taran | ×0.45 |
| biegacz → plujka | ×2.4 |
| biegacz → odzwierny | ×0.3 |
| biegacz → taran | ×0.3 |
| biegacz → infantry | ×0.9 |
| plujka → taran | ×1.6 |

### Parametry
| Ścieżka | Wartość domyślna |
|---|---|
| `params.cover` | 0.7 |
| `params.shieldMult` | 0.4 |
| `params.closedMult` | 0.7 |
| `params.cdScale` | 1.5 |
| `params.dmgVariance` | 0.3 |
| `params.collision.passes` | 6 |
| `params.collision.fightMass` | 8 |
| `params.captain.shock` | 20 |
| `params.captain.dur` | 15 |
| `params.captain.regenPenalty` | 4 |
| `params.elite.hp` | 1.7 |
| `params.elite.dmg` | 1.3 |
| `params.elite.cd` | 0.85 |
| `params.elite.armor` | 0.12 |
| `params.elite.speed` | 1.0 |
| `params.control.regen` | 5 |
| `params.control.cmdBonus` | 3 |
| `params.control.noCmdWK` | 6 |
| `params.control.noCmdLH` | 2 |
| `params.control.lossK` | 80 |
| `params.control.alarmK` | 2 |
| `params.control.weakAt` | 60 |
| `params.control.lostAt` | 25 |
| `params.control.recoverAt` | 45 |
| `params.control.weakCd` | 1.4 |
| `params.control.weakSpeed` | 0.9 |
| `params.control.massBonus` | 2 |
| `params.control.cutOff` | 2 |
| `params.control.orderBoost` | 25 |
| `params.supply.WK` | 60 |
| `params.supply.LH` | 60 |
| `params.supply.reinfPerSec` | 3 |
| `params.supply.acidRefill` | 0.02 |
| `params.supply.acidStart` | 3 |
| `params.supply.acidCap` | 6 |
| `params.fatigue.move` | 0.35 |
| `params.fatigue.fight` | 2 |
| `params.fatigue.rest` | 3 |
| `params.fatigue.effCd` | 0.6 |
| `params.fatigue.effSpeed` | 0.35 |
| `params.fatigue.effDmg` | 0.25 |
| `params.fatigue.effControl` | 4 |
| `params.aiPeriod` | 20 |

### Scenariusz (liczebność i role rot)
Rola steruje AI. Opóźnienie to sekundy do pierwszego rozkazu (tylko strona atakująca). `@guard` to gwardia dowódcy wybranego typu.

Wielka Kolonia (atakuje, rezerwa 150, promień aury 260):
| Rola | Skład | Pozycja | Opóźnienie |
|---|---|---|---|
| assault | infantry 100 | (340, 600) | 0 |
| assault | infantry 100 | (340, 370) | 5 |
| assault | infantry 100 | (340, 830) | 5 |
| command | @guard 50, dowodca 1 | (235, 600) | 0 |
| assault | infantry 100 | (235, 370) | 22 |
| assault | infantry 100 | (235, 830) | 22 |
| taran | taran 50 | (135, 520) | 0 |
| taran | taran 50 | (135, 680) | 2 |
| pekacz | pekacz 60 | (135, 360) | 10 |
| pekacz | pekacz 60 | (135, 840) | 12 |
| raider | biegacz 80 | (45, 440) | 18 |
| raider | biegacz 80 | (45, 760) | 22 |
| assault | infantry 100 | (45, 600) | 26 |
| command | @guard 50, dowodca 1 | (235, 1000) | 0 |

Lake Hodges (broni, rezerwa 150, promień aury 170, bonus regeneracji 2):
| Rola | Skład | Pozycja | Opóźnienie |
|---|---|---|---|
| plug | odzwierny 60 | (1000, 600) |  |
| artillery | plujka 60 | (1065, 520) |  |
| artillery | plujka 60 | (1065, 690) |  |
| reserve | infantry 180 | (1140, 390) |  |
| reserve | infantry 180 | (1140, 810) |  |
| reserve | infantry 180 | (1270, 490) |  |
| reserve | infantry 180 | (1270, 720) |  |
| reserve | @guard 50, dowodca 1 | (1150, 600) |  |
| reserve | @guard 50, dowodca 1 | (1370, 605) |  |

## 3. Struktury danych

```
const HZ = 20; const DT = 1 / HZ                  // stały krok
const CELL = 16                                   // komórka terenu
const HASH = 8                                    // komórka siatki do wypatrywania celów
const SPACING = 11                                // domyślny odstęp w szyku

// Mrówki: struktura tablic (SoA), indeks mrówki = jej stały identyfikator, martwe nie są usuwane
float32 x[], y[], vx[], vy[]      // pozycja i impuls odrzutu
float32 hp[], cooldown[], stuck[] // zdrowie, czas do ataku, czas oblepienia
float32 heading[], slotU[], slotV[]
int32   target[], shieldUntil[]
uint8   type[], side[], alive[], contact[]
int16   comp[]

struct Company {
  id, side, name, num, role, spacing
  ants: list<int>            // indeksy, czyszczone z martwych raz na sekundę
  alive, initial
  anchor(ax, ay), face(rad), formation(LINE|COLUMN|WEDGE), fcols
  order {kind: hold|move|attack|retreat, x, y}     // rozkaz gracza lub AI
  eff   {kind, x, y, engage}                       // rozkaz skuteczny (po uwzględnieniu utraty kontroli)
  control(0..100), cstate(FULL|WEAK|LOST), fatigue(0..100)
  cdMod, spMod, berserk, cohesion, engaged, moving
  captain(int), captainPenaltyUntil
  abilType, abilCdUntil, abilUntil, closed
  acid, acidMax
  deaths: list<tick>         // zgony z ostatnich 6 s
  field: int32[]             // pole przepływu do celu rozkazu
}
```

Typy są tablicami cech (`T.hp[type]`, `T.radius[type]`...), a `kinds[type]` mapuje elitę na typ bazowy, żeby zachowanie (pękacz, plujka, odźwierny, taran, biegacz) było wspólne. Macierz kontr to `mult[atakujący][obrońca]`.

## 4. Pseudokod

Konwencje: `hypot(a, b)` to długość wektora; `clamp(v, lo, hi)`; wszystkie pozycje w jednostkach świata; indeksy mrówek rosną tylko (nowe dostają kolejne numery).

### 4.1 Pętla główna
```
function step():
    if result != null: return
    apply_commands()                                  // kolejka poleceń gracza w kolejności nadejścia
    for side in [WK, LH] where side is AI and tick % aiPeriod == side * 7:
        ai_step(side)
    apply_commands()
    build_hash()                                      // siatka przestrzenna z pozycji z początku kroku
    if tick % 10 == 0: update_shields()
    if tick % HZ == 0: for c in companies where c.alive > 0: update_control(c)
    for c in companies where c.alive > 0: update_anchor(c)
    for i in 0..count-1: prev[i] = pos[i]
    update_ants()
    resolve_collisions()
    if tick % HZ == 10: reinforcements()              // raz na sekundę
    if tick % HZ == HZ - 1: check_end()
    if tick % (10 * HZ) == 0: timeline.push(counts)
    tick += 1
```
Kolejność ma znaczenie dla determinizmu: mrówki, roty i sąsiedzi są zawsze przetwarzane rosnąco po indeksie.

### 4.2 Siatka przestrzenna (sortowanie przez zliczanie)
```
function build_hash():
    cellStart[] = 0
    for i in ants where alive: cellStart[cell(i) + 1] += 1
    prefix_sum(cellStart)
    cursor = copy(cellStart)
    for i in ants where alive: items[cursor[cell(i)]++] = i
```

### 4.3 Rozkazy i umiejętności
```
function apply_command(cmd):
    list = [companies[id] for id in cmd.comps if alive and (cmd.side is null or c.side == cmd.side)]
    case cmd.k of
      'order':     for c in list: p = (cmd.kind == retreat) ? retreat_point(c) : nearest_open(cmd.x, cmd.y)
                                  c.order = {cmd.kind, p.x, p.y, face = cmd.face or null}
                                  if cmd.cols is set and c is not the plug: c.fcols = cmd.cols; c.dirty = true
      'formation': for c in list: c.formation = cmd.f; c.fcols = cmd.cols or 0; c.dirty = true
      'ability':   for c in list: use_ability(c)

function use_ability(c):
    if tick < c.abilCdUntil or c.abilType == null: return
    ab = units[c.abilType].ability
    if ab.id == 'close': c.closed = not c.closed; return        // plug przełączany bez czasu odnowienia
    c.abilCdUntil = tick + ab.cd * HZ
    c.abilUntil   = tick + ab.dur * HZ                          // szarża, rajd, pęknięcie trwają dur sekund
    if ab.id == 'order':                                        // Rozkaz dowódcy
        for o in companies of c.side where o.alive > 0 and distance(o.anchor, c.anchor) < aura_radius(c.side):
            o.control = min(100, o.control + params.control.orderBoost)
```
Umiejętność roty wybiera się przy tworzeniu: typ specjalny o największej liczebności z umiejętnością, a gdy go nie ma, Rozkaz dowódcy. Gwardia dowódcy ma więc przycisk Rozkaz.

### 4.4 Kontrola, zmęczenie, kapitan (raz na sekundę na rotę)
```
function update_control(c):
    prune dead from c.ants; drop c.deaths older than 6 s
    inCmd      = any alive commander of c.side within aura_radius of c.anchor
    f          = len(c.deaths) / max(1, c.alive + len(c.deaths))          // ułamek strat w 6 s
    eng        = min(1, c.engCnt / (max(1, c.alive) * HZ)); c.engCnt = 0   // ułamek roty w walce
    friendNear = any other company of c.side with alive > 0 within 200 of c.anchor
    noCmd      = (c.side == WK) ? control.noCmdWK : control.noCmdLH

    d  = control.regen
    d += inCmd ? control.cmdBonus : 0
    d -= control.lossK * f
    d -= control.alarmK * eng
    d -= inCmd ? 0 : noCmd
    d -= (not inCmd and not friendNear) ? control.cutOff : 0
    if c.alive >= 0.7 * c.initial and friendNear: d += control.massBonus
    d += side.regenBonus

    // zmęczenie
    fg = fatigue.fight * eng
    if c.moving: fg += fatigue.move * (c.abilUntil > tick ? 2.5 : 1)
    else if eng < 0.05: fg -= fatigue.rest
    c.fatigue = clamp(c.fatigue + fg, 0, 100)
    fat = c.fatigue / 100
    d -= fatigue.effControl * fat

    // kapitan
    capOut = tick < c.captainPenaltyUntil
    if capOut: d -= captain.regenPenalty
    if c.captain < 0 and not capOut and c.alive > 0 and c has no commander: c.captain = pick_captain(c)

    if c.cstate == LOST and nearest_enemy_distance(c) < 90: d = min(d, 0)  // uciekająca rota nie odzyskuje kontroli pod nosem wroga
    c.control = clamp(c.control + d, 0, 100)

    // stany z histerezą
    if      cstate == FULL and control < weakAt:               cstate = WEAK
    else if cstate == WEAK and control >= weakAt + 5:          cstate = FULL
    else if cstate == WEAK and control < lostAt:               cstate = LOST
    else if cstate == LOST and control >= recoverAt:           cstate = WEAK

    c.cdMod = (cstate == FULL ? 1 : control.weakCd)    * (1 + fatigue.effCd * fat)
    c.spMod = (cstate == FULL ? 1 : control.weakSpeed) * (1 - fatigue.effSpeed * fat)
    c.berserk = (cstate == LOST and c.side == WK)

    // rozkaz skuteczny
    if cstate == LOST:
        if c.side == LH: c.eff = {retreat, retreat_point(c), engage = true}
        else:            c.eff = {attack, anchor of nearest enemy company, engage = true}   // szał
    else:
        c.eff = {c.order.kind, c.order.x, c.order.y,
                 engage = kind in [attack, hold, retreat]}

    c.speed = speed of the most numerous unit type in c
    c.field = flow_field(c.eff.x, c.eff.y)
    if c.dirty or tick - c.repackTick > 5 * HZ: repack(c)

function pick_captain(c):                   // najbliżej środka szyku, nie dowódca
    return argmin over alive ants a (kind != commander) of |slotU[a]| + |slotV[a]|
```
Zdarzenia (do ekranu końcowego): zmiana stanu kontroli z przyczyną dominującą (największy składnik: straty, alarm, brak dowódcy, odcięcie, kapitan), śmierć kapitana, śmierć dowódcy, użycie umiejętności.

### 4.5 Szyk i sloty
```
function repack(c):
    list = alive ants of c, sorted by (T.rank[type], index)        // przód to mała ranga
    n = len(list); s = c.spacing
    if formation == WEDGE:
        rows = ceil(sqrt(n))
        for k in 0..n-1: r = floor(sqrt(k)); idx = k - r*r
                         slotV[list[k]] = (idx - r) * s
                         slotU[list[k]] = ((rows - 1)/2 - r) * s * 0.9
    else:
        cols = c.fcols > 0 ? c.fcols : (LINE ? max(4, round(sqrt(n * 2.5))) : max(3, round(sqrt(n / 2.5))))
        rows = ceil(n / cols)
        for k in 0..n-1: r = k / cols; col = k % cols
                         rc = (r < rows-1) ? cols : n - (rows-1)*cols            // liczba w ostatnim rzędzie
                         slotV[list[k]] = (col - (rc-1)/2) * s
                         slotU[list[k]] = ((rows - 1)/2 - r) * s
    c.dirty = false; c.repackTick = tick

function slot_world(c, i):  // u do przodu, v w bok; (fx, fy) = (cos face, sin face)
    return (c.ax + c.fx * slotU[i] - c.fy * slotV[i],  c.ay + c.fy * slotU[i] + c.fx * slotV[i])
```
Odstęp roty: `max(11, 2.1 * największy promień typu w rocie)`; plug ma jawny odstęp 10,4 i liczbę kolumn `ceil((passage - 2*promień odźwiernego) / spacing) + 1`, więc jego skrajne mrówki dotykają murów.

### 4.6 Kotwica roty i pole przepływu
```
function flow_field(x, y):                  // jedno pole na komórkę celu, buforowane
    dist[] = -1; dist[cell(x,y)] = 0; queue = [cell(x,y)]
    while queue not empty:                  // SPFA po 8 sąsiadach, koszt prosty 10, ukośny 14, bez cięcia rogów murów
        relax neighbours
    return dist

function flow_dir(field, px, py):           // gradient różnic centralnych, nieosiągalne = d0 + 30
    gx = d(left) - d(right); gy = d(up) - d(down); return normalize(gx, gy)

function update_anchor(c):
    o = c.eff; dist = distance(c.anchor, (o.x, o.y))
    attackHalt = o.engage and o.kind == attack and c.engaged > 0.2 and not c.berserk
    moved = false
    if dist > 3 and not attackHalt:
        dir = direction to (o.x, o.y)
        if not (dist < 2*CELL and line_of_sight(anchor, target)) and flow_dir(c.field, anchor) exists: dir = that
        step = min(dist, c.speed * c.spMod * ability_mult * c.cohesion * DT)
        try move anchor by dir*step (przy murze próbuj osobno osie x i y)
        if moved: c.targetFace = angle(dir)
    c.moving = moved
    if not moved:
        if c.order.face is set and c.eff.kind == c.order.kind and dist <= 3: c.targetFace = c.order.face   // kierunek wskazany przez gracza
        else: c.targetFace = angle to nearest enemy company if within 500
    if c.targetFace set and not c.closed: rotate c.face towards it by at most 0.12 rad per step
    // spójność: średnia odległość mrówek od slotów spowalnia kotwicę
    c.cohesion = clamp(1 - (avg_slot_error - 8) / 40, 0.1, 1)
```

### 4.7 Mrówka (co krok)
```
function update_ants():
    for i in 0..count-1 where alive[i]:
        c = companies[comp[i]]; k = kinds[type[i]]
        cooldown[i] -= DT; stuck[i] = max(0, stuck[i] - DT); contact[i] = 0
        tgt = target[i]; if tgt >= 0 and not alive[tgt]: tgt = -1
        engage = c.eff.engage
        slot = slot_world(c, i); slotErr = distance(pos[i], slot); c.errSum += slotErr

        // 1. wybór celu (przerwy: żeby nie liczyć co krok)
        if k == pekacz:
            if (c.abilUntil > tick or c.berserk or c has commander)   // gwardia z pękaczy detonuje przy kontakcie
                and (tick + i) % 4 == 0 and tgt < 0:
                    tgt = acquire(i, burst active ? burst.seek : 30)
        elif engage and ranged(type[i]) and c.eff.kind != retreat:
            if c.acid <= 0: tgt = -1
            elif tgt < 0 or (tick + i) % 8 == 0:
                if not (tgt valid and distance(i, tgt) <= range and line_of_sight): tgt = acquire(i, range)
        elif engage:
            ag = (kind == retreat or closed plug) ? reach + 5 : (kind == hold ? min(aggro, 18) : aggro)
            if (tgt < 0 ? (tick + i) % 4 == 0 : (tick + i) % 16 == 0): tgt = acquire(i, c.berserk ? 160 : ag)
            if tgt >= 0 and not c.berserk and slotErr > 70: tgt = -1       // smycz do slotu
        else: tgt = -1
        if c.eff.kind == retreat and ranged(type[i]): tgt = -1
        target[i] = tgt

        // 2. działanie wobec celu
        goalSet = false; fighting = false; speed = T.speed[type[i]] * c.spMod
        if tgt >= 0:
            d = distance(i, tgt); heading[i] = angle to tgt
            if k == pekacz:
                if d <= radius[i] + radius[tgt] + 3: burst(i); continue
                goal = pos[tgt]; speed *= 1.3; fighting = true
            elif ranged:
                if d <= range:                                              // stoi i strzela
                    speed = 0; contact[i] = 1; fighting = true
                    if cooldown[i] <= 0 and c.acid > 0:
                        acid_blast(i, pos[tgt]); c.acid = max(0, c.acid - 1)
                        cooldown[i] = T.cd * c.cdMod * cdScale
            else:
                if d <= reach[type] + radius[i] + radius[tgt]:              // kontakt
                    speed = 0; contact[i] = 1; fighting = true
                    if cooldown[i] <= 0: hit(i, tgt, T.dmg, melee = true); cooldown[i] = T.cd * c.cdMod * cdScale
                else: goal = pos[tgt]; fighting = true
            if fighting: c.engCnt += 1

        // 3. brak celu: do slotu (albo po polu przepływu, gdy slot jest za przeszkodą)
        if not goalSet:
            if slotErr > 12 and not line_of_sight(pos[i], slot) and flow_dir(c.field, pos[i]):
                goal = pos[i] + flowdir * 20
            else goal = slot

        // 4. prędkość
        if not fighting and slotErr > 14: speed *= 1.25                     // dogonić szyk
        if c.abilUntil > tick and c.abilType == k and k in [taran, biegacz]: speed *= ability.mult
        if stuck[i] > 0: speed = 0
        v = (goal - pos[i]) direction * min(speed, distance / DT)  (jeśli dystans > 1.2)
        v += knockback[i]; knockback[i] *= 0.8                              // impuls odrzutu
        if closed plug ant: knockback[i] = 0

        // 5. ruch wyprzedzający i teren
        if v != 0 and body_ahead(i, pos[i] + v*DT):
            try v rotated by +0.9 rad, then -0.9 rad; if both blocked: v = 0
        new = fround(pos[i] + v * DT)
        if blocked(new): try axis-wise slide; else stay
        pos[i] = new

function body_ahead(i, p):       // czy w p ciało i wejdzie w ciało j, do którego się zbliża
    for j in neighbours of p within 2 hash cells, j != i, alive:
        // poza walką swoi się mijają: kolega bez kontaktu z wrogiem i nie za ciężki (masa <= 2.5 * własna) nie blokuje,
        // chyba że jest elementem zamkniętego plugu
        if side[j] == side[i] and not contact[j] and T.mass[type[j]] <= 2.5 * T.mass[type[i]] and not closed_plug(j): continue
        md = 0.92 * (radius[i] + radius[j])
        if distance(p, pos[j]) < md and distance(p, pos[j]) < distance(pos[i], pos[j]): return true
    return false
```

### 4.8 Wypatrywanie celu
```
function acquire(i, range):
    best = none; bestScore = inf
    for j in neighbours within ceil(range / HASH) cells, alive, side[j] != side[i]:
        d2 = distance²(i, j); if d2 > range²: continue
        m  = mult[type[i]][type[j]]
        score = d2 - (m > 1.4 ? 900 : 0) + (m < 0.6 ? 900 : 0)       // preferuj kontry, unikaj złych starć
        if score < bestScore: best = j; bestScore = score
    if best exists and not line_of_sight(pos[i], pos[best]): return none  // przez mur się nie strzela ani nie atakuje
    return best
```

### 4.9 Obrażenia i umiejętności bojowe
```
function hit(attacker, defender, base, melee):
    dmg = base * (1 - variance/2 + variance * rng_combat())
    if attacker >= 0:
        dmg *= mult[type[attacker]][type[defender]]
        dmg *= 1 - fatigue.effDmg * company(attacker).fatigue / 100
    if melee: dmg *= 1 - T.armor[type[defender]]
    if terrain(defender) == COVER: dmg *= params.cover
    if shieldUntil[defender] > tick: dmg *= params.shieldMult              // osłona odźwiernych dla plujek
    if company(defender).closed and kind(defender) == odzwierny: dmg *= params.closedMult
    hp[defender] -= dmg
    if hp[defender] <= 0: kill(defender, attacker)
    elif melee and attacker >= 0 and T.knock[type[attacker]] > 0 and not T.heavy[type[defender]]:
        knockback[defender] += unit_vector(attacker -> defender) * knock * (szarża ? 2 : 1)

function kill(d, a):
    alive[d] = 0; c.alive -= 1; c.deaths.push(tick); update stats
    if c.closed: c.dirty = true                                            // plug od razu zamyka luki
    if d == c.captain: c.captain = -1; c.captainPenaltyUntil = tick + captain.dur*HZ
                       c.control = max(0, c.control - captain.shock); log event
    if kind(d) == commander: remove from commander list; log event; cmdDiedAt = tick for all companies of the side

function burst(i):     // Pękacz: obszar, oblepienie, ginie
    push_fx({kind: burst, pos[i], radius})                  // tylko prezentacja, bez wpływu na stan
    for j in enemies within burst.radius of pos[i]: stuck[j] = max(stuck[j], burst.stuck); hit(i, j, burst.dmg, melee = false)
    kill(i, -1)

function acid_blast(i, p):   // Plujka: plama o promieniu aoe, ignoruje pancerz
    push_fx({kind: acid, from pos[i], to p, radius: aoe})   // pocisk leci łukiem ponad swoimi; tylko prezentacja
    for j in enemies within aoe of p: hit(i, j, T.dmg[type[i]], melee = false)

function update_shields():   // co 10 kroków
    for each odzwierny ant of a closed company: for each friendly plujka within 3 hash cells: shieldUntil = tick + 12
```

### 4.10 Fizyka ciał
```
function resolve_collisions():
    for i: mass[i] = T.mass[type[i]]
           if closed plug ant: mass = 1e6 (nieruchomy)  elif contact[i]: mass *= collision.fightMass
    build a grid with cell 13 (>= największa średnica ciała), so only 3x3 cells need to be scanned
    near_plug[k] = 1 for every non-fixed ant within the 3x3 cells of a fixed (closed plug) ant
    repeat collision.passes times:
        for i ascending, for j > i in 3x3 cells:
            md = radius[i] + radius[j]; d = distance(i, j); if d >= md: continue
            if mass[i] >= 1e6 and mass[j] >= 1e6: continue               // dwa elementy plugu
            if mass[i] >= 1e6 or mass[j] >= 1e6:                         // plug jest przeszkodą twardą
                f = the heavy one; o = the other
                u = normalize(prev[o] - pos[f]); if |prev[o] - pos[f]| < 0.9*md: u = normalize(pos[o] - pos[f])
                new = pos[f] + u * md                                    // wróć na stronę, z której przyszła
                pos[o] = blocked(new) ? prev[o] : new
                continue
            if side[i] == side[j] and not contact[i] and not contact[j] and not near_plug[i] and not near_plug[j]:
                // swoi poza walką: idący (większa prędkość z tego kroku o > 1) nie ustępuje, stojący odsuwa się
                // bokiem od toru idącego i robi mu przejście (o ile nie jest wyraźnie cięższy)
                speedI = |vel[i]|; speedJ = |vel[j]|
                if speedI > speedJ + 1 or speedJ > speedI + 1:
                    m = faster one; y = the other
                    if T.mass[type[y]] <= 2.5 * T.mass[type[m]]:
                        perp = normalize(rotate90(vel[m])); sign = side of y relative to the mover's path
                        pos[y] += (perp * sign * 0.8 + normalize(pos[y] - pos[m]) * 0.3) * overlap * 1.1   // przeciwna strona, gdy to mur
                        continue
            overlap = md - d; u = normalize(pos[i] - pos[j])
            wi = mass[j] / (mass[i] + mass[j]); wj = 1 - wi              // lżejszy przesuwa się bardziej
            move i by u*overlap*wi, j by -u*overlap*wj, each only if the new point is not blocked
```

### 4.11 Uzupełnienia i kwas (raz na sekundę)
```
function reinforcements():
    for side:
        accum[side] += supply[side] / 100 * supply.reinfPerSec           // 1 s na wywołanie
        while accum >= 1 and reserve[side] > 0:
            c = company of side with alive > 0, not LOST, mostly warriors, largest deficit (initial - alive) > 0
            if none: accum = min(accum, 1); break
            spawn a warrior at the spawn zone, assign to c (c.dirty = true); reserve -= 1; accum -= 1
        for each company with plujka kind: nP = alive plujki
            acidMax = nP * acidCap
            acid = min(acidMax, acid + nP * supply[side]/100 * acidRefill)
```

### 4.12 AI (reguły, co `aiPeriod` kroków na stronę)
```
function ai_step(side):
    mine = alive companies of side; foes = alive companies of the other side
    for c in mine, skip if c.cstate == LOST:
        near = foes within 260 of c, sorted by distance
        if side is attacker:
            if t < c.delay: continue
            raider:  if tick >= c.aiUntil: order(attack, anchor of the first foe company with acid or foes[0], hold 3 s)
                     if nearest foe has acid and within 220: use_ability(c)         // rajd
            command: front = most advanced assault/taran company
                     if front: order(attack, front.ax - 170, midpoint of y, hold 2 s)  // gwardia za linią
            pekacz:  tgt = a closed foe company or nearest; if tick >= c.aiUntil: order(attack, nest, 3 s)
                     if tgt within 110: use_ability(c)                               // pęknięcie
            other:   if c.alive < 0.3*initial and cstate != FULL: order(retreat, 8 s)
                     elif tick >= c.aiUntil: order(attack, nest, 3 s)
                     taran: if nearest foe within 110: use_ability(c)                // szarża
            if c.abilType == commander and some company in aura is WEAK: use_ability(c)
        else (obrońca):
            home = remembered start position
            plug:      order(hold, home); if not closed: use_ability(c)             // zamknij od początku
            artillery: order(hold, home)
            reserve:   cand = first near foe with strength < 0.9*own or not FULL
                       if cand and c is FULL and c.alive > 0.35*initial: order(attack, cand.anchor, hold 10 s)
                       elif tick >= c.aiUntil: order(hold, home)
            if c.alive < 0.25*initial and cstate != FULL: order(retreat, 8 s)
            if commander ability condition as above: use_ability(c)
```
`order()` zmienia rozkaz tylko, gdy cel różni się o więcej niż 12 jednostek, i ustawia czas, przez który AI nie nadpisuje rozkazu (`aiUntil`). Siła roty to `alive * (LOST 0.3, WEAK 0.8, FULL 1)`.

### 4.13 Warunki końca
```
function check_end():               // raz na sekundę, idempotentne
    if result: return
    count alive per side; count WK and LH ants inside the nest circle
    nestTimer = (nestWK >= 15 and nestLH < 3) ? nestTimer + 1 : 0
    if nestTimer >= 8:                          WK wins "zajęcie gniazda"
    elif alive[LH] < 0.05 * start[LH]:          WK wins "zniszczenie obrońców"
    elif alive[WK] < 0.05 * start[WK]:          LH wins "rozbicie atakujących"
    elif seconds >= timeLimit:                  defender wins "minął czas, obrona utrzymana"
```
Raport bitwy (wejście dla P3, ten sam format wyniku): ziarno, szerokość przejścia, czas, wynik, straty i zabójstwa wg typu, ocalali wg typu, rezerwa, lista rot (liczebność początkowa i końcowa, straty, kontrola, stan) oraz dziennik zdarzeń z przyczynami.

### 4.14 Generowanie mapy (przed `Sim.create`)
```
applyMapType(defs, id, rng):
  mt = defs.world.mapTypes[id]; W = mt.w; H = mt.h
  dx = W - 2000; dy = (H - 1200) / 2
  world.nest = (1800 + dx, 600 + dy); world.retreatWK.y += dy
  dla WK: at += (0, dy), spawn += (0, dy);  dla LH: at += (dx, dy), spawn += (dx, dy)
  jeśli mt.gen == legacy: zostaw world.map (stały układ), policz metryki, koniec
  world.gap = null; role plug -> line (closed = false)
  strefy wolne: zachodnia x < 470, wschodnia x > W - 1100 (y w pasie 370 wokół osi), okolica gniazda
  dla próby 0..11:
    obstacles = GENERATORS[mt.gen](rng.fork("mapgen" + próba), mt, W, H, strefy)
    m = mapMetrics(rasterize(world, obstacles))
    jeśli m.reachable i m.bottleneck >= mt.minWidth: przyjmij, przerwij
  (po 12 próbach: najlepsza osiągalna)

thicket(rng, mt, ...):
  pas = [480, W - 1100] x [0, H]; nx = round(szerokość / pitch), ny = round(H / pitch)
  drzewo rozpinające komórek: przeszukiwanie w głąb od losowej komórki zachodniej ściany
  dla każdej zamkniętej ściany: z prawdopodobieństwem braid otwórz (pętla)
  wierzchołki siatki (i, j) przesuń o losowe (+-jitter, +-jitter); brzegi poziome zostają na y = 0 i y = H
  każda zamknięta ściana wewnętrzna -> kapsuła(wierzchołek A, wierzchołek B, r = wallR), rodzaj z mix
  ściany czołowe pasa (i = 0 i i = nx): kapsuły wszędzie poza doors losowymi rzędami
  poza pasem: kilka rozrzuconych zarośli i głazów (scatter), nie w strefach rot

rasterize(world, obstacles):  # pierwszy pasujący obiekt z listy wygrywa
  brzeg mapy = 1; dla każdej przeszkody: komórki, których środek leży bliżej niż r od odcinka lub punktu
  jeśli gap: wytnij otwarty przesmyk; wytnij wnętrze gniazda i pierścień muru (wejście od zachodu)

mapMetrics(world, grid):
  D = transformata odległości do ścian (chamfer 3-4)
  bottleneck = max po trasach (strefa startu -> przed wejściem do gniazda) z min po komórkach trasy z D, jako szerokość
  tortuosity = długość najkrótszej trasy (wagi 10/14) / odległość w linii prostej
```
Kotwica i pole przepływu na mapach z korytarzami (rozszerzenie 4.6 i 4.7, `followAnchor`):
```
raz na krok, po ruchu kotwicy: jeśli (tick + id roty) % 10 == 0 i komórka kotwicy się zmieniła: afield = pole_przepływu(komórka kotwicy)
w pętli mrówki, gdy mrówka nie walczy:
  jeśli sd > 12 i (slot w ścianie lub brak widoczności do slotu) i afield:
     kierunek = gradient(afield); błąd_szyku += max(0, droga_do_kotwicy - |slot|) - sd
  w przeciwnym razie idź do slotu
```

## 5. Uwagi do przeniesienia na C++ lub C#

- **Determinizm:** kolejność pętli jak wyżej, stały krok, jeden generator (mulberry32) z rodzinami strumieni `map`, `spawn`, `combat` (ziarno strumienia = hash tekstu `ziarno:etykieta`). W JavaScript pozycje są `float32` (`Math.fround` po każdej zmianie pozycji), reszta liczy w `double`; przy przenosinach trzeba wybrać jedną precyzję i trzymać ją wszędzie, bo wyniki z `float` i `double` rozjadą się po kilkuset krokach. Test regresji to skrót stanu (pozycje, zdrowie, tick) po N krokach.
- **Układ danych:** SoA jak wyżej, indeksy mrówek stałe. Siatki przestrzenne (`HASH` 8 do celów, 13 do kolizji) odbudowuje się co krok przez sortowanie przez zliczanie; bez alokacji w pętli.
- **Pułapki znalezione w prototypie** (każda ma test): `NaN` w puli kwasu przez zły parametr; dopływ liczony na krok zamiast na sekundę; mrówka lądująca na krawędzi muru po zaokrągleniu do `float32`; przenikanie przez szyk plugu pod naciskiem tłumu (rozwiązane rzutem na poprzednią pozycję); wskaźnik zaangażowania liczony na krok, a nie na sekundę; plug obracany za wrogiem.
- **Wydajność:** krok z ok. 2000 mrówek to kilka ms w JavaScript. Najdroższe są kolizje i wypatrywanie celów; oba są liniowe względem liczby mrówek dzięki siatkom. Wypatrywanie jest rozłożone w czasie (`(tick + i) % 4`, `% 8`, `% 16`).
- **Dane:** definicje jednostek, kontr i scenariusza są w JSON; przenosi się je bez zmian. Elita jest wyprowadzana z typu bazowego w czasie ładowania, więc zmiana statystyk bazowych (suwakiem) przelicza gwardię.
- **Prezentacja** (izometria, sprite'y, panele) jest oddzielona i tylko czyta stan; do przeniesienia zostaje rzut `(x, y) -> ekran` i kolejność rysowania.
