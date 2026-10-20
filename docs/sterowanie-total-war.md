# Sterowanie wzorowane na Total War: zgodność ze specyfikacją i decyzje

Specyfikacja użytkownika jest nadrzędna. Wszystkie skróty, progi i konwencje poniżej to **reguły projektu tej gry**, a nie potwierdzone odwzorowanie Total War: WARHAMMER III. Źródła wskazane w specyfikacji (Total War Academy, Xbox Wire, Creative Assembly, GRYOnline) **nie zostały sprawdzone**: środowisko, w którym pracowałem, nie ma dostępu do tych stron (błąd rozwiązywania nazwy). Niczego z nich nie przytaczam jako faktu.

## 1. Analiza stanu przed zmianą (sekcja 14.1-14.2 specyfikacji)
Istniejący system: sterowalną jednostką jest **rota** (oddział wielu mrówek), nie pojedyncza mrówka; zaznaczanie działało na rotach (klik wybiera rotę najbliższej mrówki, ramka, karty, grupy Ctrl/Alt+cyfra, Shift dodawał), PPM na terenie dawał rozkaz marszu z walką po drodze (`attack`), Shift+PPM sam ruch (`move`), przeciągnięcie PPM ustawiało kierunek, kółko myszy szerokość; był jeden mechanizm rozkazów (`sim.command`, `c.order`), pola przepływu jako pathfinding oddzielony od wejścia, rozkazy wykonywała logika roty (`updateAnchor`) i mrówek (`updateAnts`). Nie było: kolejki rozkazów, rozkazu ataku na wskazaną rotę, szybkiego ruchu, grupowania i blokady formacji, Ctrl+A, Backspace, odrzucania rozkazu bez drogi, wykrywania braku postępu, podglądu trasy z pathfindingu.
Nie utworzyłem drugiego systemu rozkazów: rozszerzyłem istniejący (`c.order` + `c.queue`).

## 2. Konflikty z wcześniejszymi ustaleniami (zgłoszone i rozstrzygnięte przez użytkownika)
- PPM na terenie: było atak-marsz, jest ruch bez walki po drodze; atak-marsz zostaje jako **B + klik** (klawisz A jest zajęty przez przesuwanie kamery WASD) (dodatek poza specyfikacją, bo AI i gra go używają).
- Shift: było dodawanie do zaznaczenia (LPM) i „sam ruch” (PPM); jest Ctrl+LPM do zaznaczania i Shift+PPM do kolejki.
- G: było „Zamknij wejście” odźwiernych, jest grupowanie; **Zamknij wejście przeniesione na T**.
- Szerokość szyku: była z kółka myszy, jest z długości gestu PPM.
- Wiele rot: wcześniejsze życzenie użytkownika (zachowanie formacji przy zaznaczeniu kilku) zostaje; specyfikacja „rozdziel na pozycje docelowe” jest spełniona przez rozmieszczenie rot po miejscach w zachowanym układzie (nie wszystkie w jeden punkt).

## 3. Macierz wymagań
| Wymaganie | Stan |
|---|---|
| 2.1 LPM zaznacza własną rotę bez zmiany rozkazu; Ctrl+LPM dodaje lub usuwa; LPM na pustym terenie odznacza | wdrożone, test przeglądarkowy 1, 3, 4 |
| 2.1 LPM na wrogu: bez ataku, informacje, bez zmiany zaznaczenia i celu | wdrożone (panel informacji roty wroga przypięty), test 2 |
| 2.2 prostokąt zaznaczania, próg 6 px (`ui.controls.dragPx`), bez wrogów, gest zaczęty na jednostce nie uruchamia ramki | wdrożone, test 5 |
| 2.3 Ctrl+A | wdrożone, test |
| 3 PPM na terenie: ruch przez pathfinding, osiągalny punkt, brak drogi: komunikat bez ponawiania | wdrożone (odrzucenie rozkazu, czerwony krzyżyk, komunikat), testy 6, 17 |
| 3.1 dwukrotny PPM: szybki ruch (jeden efektywny rozkaz, mnożnik prędkości `params.run.mult` 1,5, zmęczenie `params.run.fatigue` 2,5) | wdrożone, test 7 i rdzeń |
| 4 PPM na wrogu: rozkaz ataku na wskazaną rotę, podejście, utrzymanie celu, koniec po zniszczeniu | wdrożone (`attackTarget`), testy 8, 18 |
| 4.1 dwukrotny PPM na wrogu: szarża tylko dla rot z umiejętnością szarży lub rajdu (taran, biegacz); pozostałe zwykły atak | wdrożone, test 9 |
| 5 wiele rot na jeden cel: bez wspólnego punktu, wykrywanie braku pozycji | **częściowo**: każda mrówka wybiera najbliższego wroga, mrówki wskazanej roty są preferowane; rozłożenie wynika z kolizji i podejścia; brak jawnego przydziału miejsc wokół celu; brak postępu wykrywany jak brak drogi. Test rdzenia: trzy roty na jeden cel bez zakleszczenia |
| 6 interakcje z obiektami | cel: teren, wroga rota; własna rota: komunikat „brak interakcji”; budynki wroga, surowce, własne gniazdo: gra ich nie ma jako celów rozkazów (nie dodano) |
| 7 przeciąganie PPM: środek, kierunek, szerokość z długości, podgląd, zatwierdzenie | wdrożone dla pojedynczej roty (szerokość) i grupy (obrót), test 11; gest krótszy niż próg to zwykłe kliknięcie z dotychczasową szerokością |
| 8 Alt+LPM przesuwa grupę z zachowaniem układu, Ctrl obraca, podgląd | wdrożone, testy 12, 13; w Linuksie i Windowsie menedżer okien może przechwytywać Alt+przeciągnięcie |
| 9 grupy: Ctrl+1-9, 1-9, G, Ctrl+G, Ctrl+A, Backspace; usuwanie zniszczonych | wdrożone, testy 19, 20; Ctrl+cyfra może być przechwycona przez przeglądarkę (przełączanie kart) |
| 10 kolejka (Shift+PPM): podgląd punktów, pomijanie nieprawidłowych, anulowanie rozkazem bez Shift | wdrożone, podgląd jako linie przerywane i kółka, testy 14 i rdzeń |
| 11 pathfinding oddzielony od wejścia, brak postępu, brak teleportowania | pola przepływu i poprawka korytarzy (decyzja 70); dodano wykrywanie braku postępu (po 4 s raz przeliczenie trasy, potem koniec rozkazu z komunikatem) |
| 12 informacja zwrotna: trasa, cel ataku, podgląd formacji, kolejka, stan roty, komunikat | trasa dokładnie z pathfindingu (`sim.routeOf`), narożniki celu ataku, podgląd formacji (czerwony, gdy nieosiągalna), kolejka, stan roty w opisie karty i portrecie (bezczynna, w ruchu, w walce, zablokowana, brak drogi, szał, odwrót), komunikaty w dzienniku zdarzeń |

## 4. Mapa przypisań (`ui.controls.keys` w JSON, jedno miejsce)
Ctrl+A zaznacz wszystko, G grupuj, Ctrl+G zablokuj układ, Backspace i H stój, V odwrót, M ruch (pending), B atak-marsz (pending), Z/X/C szyk, Spacja pauza, +/- prędkość, Esc anuluj, / pomoc; umiejętności Q/E/R/F/T.

## 5. Ograniczenia i luki
- Pojedyncze mrówki nie są sterowalne (zgodnie z zasadą: nie przebudowywać roty w pojedyncze jednostki).
- Atak wielu rot: patrz tabela (brak jawnego przydziału pozycji bojowych).
- Podwójne kliknięcie wydaje najpierw zwykły rozkaz, a drugie kliknięcie zastępuje go wersją szybką (efektywnie jeden rozkaz; w dzienniku poleceń są dwa).
- Okno dwukrotnego kliknięcia to 350 ms (`ui.controls.doubleClickMs`); w piaskownicy z renderowaniem programowym (kilka klatek na sekundę) test zwiększa je.
- Alt+LPM i Ctrl+cyfra mogą kolidować ze skrótami systemu lub przeglądarki.
- Nakładki strzelania i wykonalność ataku to osobna specyfikacja (jeszcze niewdrożona).
