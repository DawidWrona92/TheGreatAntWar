# Wojna superkolonii: decyzje projektowe i pseudokod bitwy (P1)

Dokument opisuje, jak działa bitwa w prototypie `prototypy/p1-bitwa.html`, i jest pisany tak, żeby dało się ją odtworzyć w C++ lub C#. Źródłem prawdy dla liczb jest blok JSON `defs` na początku pliku (tabele poniżej są z niego wygenerowane), a dla zachowania blok `SIM-BEGIN`/`SIM-END`. Zasady kanoniczne: `docs/Dokument_0.5.pdf`. Dokument 0.5 się nie zmienia; tu są wnioski i decyzje z prototypu.

## 1. Decyzje projektowe

**Skala i czytelność**
1. Rój jest rzadki. Odstęp w szyku to 11 jednostek świata, ciało zwykłej mrówki ma promień 4. Na polu jest ok. 1900 mrówek w 23 rotach. To świadome zejście poniżej widełek 2000-4000 z sekcji 15.2 dokumentu: na prośbę użytkownika woleliśmy widzieć pojedyncze mrówki i więcej rot niż gęsty tłum. Test wydajności 10 tys. mrówek należy do etapu T, nie do P1.
2. Widok jest izometryczny 2:1 (rzut: `sx = (x - y) * 0.5 * S`, `sy = (x + y) * 0.25 * S`, S = 2). Symulacja zna tylko płaszczyznę (x, y); izometria to wyłącznie prezentacja.
3. Sprite'y są malowane w wysokiej rozdzielczości (atlas 2,4 razy większy niż na ekranie), 16 kierunków, cień rzucany w prawo-dół. Wielka Kolonia jest czerwona (w stylu ZSRR, ze złotym wykończeniem), Lake Hodges czarny (niebieski wariant odrzucony przez użytkownika jako nienaturalny); typy różnią się sylwetką.

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
13. Rozkaz z formowaniem: przeciągnięcie PPM przy wydawaniu rozkazu ustawia kierunek, w którym rota ma stanąć po dotarciu na miejsce, a kółko myszy w trakcie przeciągania zmienia szerokość szyku (a przez to głębokość: te same mrówki w mniejszej liczbie szerszych lub węższych rzędów). Podgląd to prostokąt szyku ze strzałką. Rozkaz niesie `face` i `cols`; po dotarciu kotwica obraca się do `face` i trzyma ten kierunek. Pozwala to na manewry typu oskrzydlenie pod Kannami. (Zastąpione decyzją 71: szerokość szyku wynika teraz z długości gestu PPM, a nie z kółka myszy.)
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

**Scenariusze (etap 2 rozszerzenia P1)**
40. Przed bitwą wybiera się scenariusz (`world.scenarioTypes`, parametr URL `scenario=bitwa|oblezenie|przeprawa`). Domyślne jest Oblężenie (od etapu 5 szturm na kopiec; płaskie Oblężenie z etapów 1-4 zostaje jako ukryty scenariusz `oblezenie`, test regresji: ten sam przebieg co przed etapem 2). Scenariusz określa trzy rzeczy: czy jest gniazdo (cel i mur), postawę AI każdej strony (`advance`: idzie do celu, `hold`: broni pozycji) i sposób zakończenia (`nest` albo `annihilate`).
41. **Bitwa**: standardowe starcie dwóch armii na dowolnym z pięciu typów map. Nie ma gniazda (ani muru, ani celu terenowego); obie strony mają postawę `advance`: cel marszu to najbliższa rota przeciwnika. Gwardia dowódcy idzie 170 jednostek za najbardziej wysuniętą rotą swojej strony (dla Lake Hodges kierunek jest odwrócony). Wygrywa zniszczenie przeciwnika (poniżej 5% stanu początkowego), a po upływie czasu strona z większym odsetkiem ocalałych (to założenie projektowe, nie zapis z dokumentu).
42. **Oblężenie**: atakujący (Wielka Kolonia, `advance`) szturmuje gniazdo, obrońca (Lake Hodges, `hold`) broni go i uzupełnia straty; atakujący wygrywa, zajmując gniazdo (co najmniej 15 mrówek przy najwyżej 2 obrońcach przez 8 s) albo niszcząc obrońców, a po upływie czasu wygrywa obrona. Uzupełnienia ma tylko obrońca (decyzja użytkownika; atakujący walczy tym, co przyprowadził). Na etapie 2 to tylko wybór scenariusza i podstawowe reguły: atakujący **nie** ma jeszcze przewagi budżetowej (jednostki nie mają kosztów, budżety wprowadza etap 3, i tam atakujący dostanie większy) i nie ma wnętrza kopca (etap 5).
43. **Przeprawa**: scenariusz z własną, stałą mapą `stream` (3000 x 3200, wybór typu mapy jest wyłączony). Potok o szerokości ok. 176 jednostek przecina mapę z północy na południe. Nowe komórki terenu: woda (7, blokuje ruch jak ściana, ale nie zasłania widoku ani strzału: w ruchu `BLK`, w widoczności osobna tabela `SIGHT`) oraz duży kamień w potoku (8, przejezdny). Trzy brody to łańcuchy trzech dużych kamieni, oddalone od siebie o ok. 1200 jednostek (wcześniejsza wersja miała ok. 330 i armia przechodziła między brodami w 5-20 s). Środkowy bród jest wąski (kamienie 44-48, szyjka ok. 60-70 jednostek) i leży przy armiach, skrajne są szerokie (kamienie 58-64, szyjka ok. 100-110) i odległe. Czas przejścia między sąsiednimi brodami: biegacz ok. 19 s, wojownik 39 s, ciężki 53 s, taran 73 s; dojście obrońców ze środka do skrajnego brodu to ok. 45-60 s. Obrońca trzyma wschodni brzeg (wojownicy tuż za kamieniami, plujki ok. 40 jednostek dalej: strzelają w wyjścia z brodów, 24 z 1784 strzałów w teście padło na same kamienie). Cel starcia zadał użytkownik: zniszczenie przeciwnika jak w Bitwie (zajęcia przyczółka nie ma); brody mają znaczenie przez przepustowość kamieni i czas dojścia.
44. Plug (zamknięty szyk odźwiernych) zostaje tylko tam, gdzie jest główny przesmyk i obrońca ma postawę `hold` (Oblężenie na mapie 3); w pozostałych przypadkach (mapy bez przesmyku, a także Bitwa na mapie 3) odźwierni stają jako zwykła linia, bo nieruchomy zamknięty mur nie może iść do ataku (błąd znaleziony w przeglądzie: w Bitwie na mapie 3 plug dostawał rozkaz ataku i stał zablokowany).
45. Kolejność generowania: `applyScenario` (nest, tryb), potem `applyMapType` (przeprawa wymusza mapę `stream`), więc scenariusz i mapa są niezależnymi osiami. Mur gniazda w `rasterize` powstaje tylko gdy `world.nestWall != false`.
46. **AI brodów** (tylko gdy mapa ma `world.fords`): co sekundę AI każdej strony przypisuje roty do brodów, z minimalnym czasem utrzymania przydziału 10 s i premią 35% za dotychczasowy przydział. Atakujący ocenia bród jako siłę roty / (obrońcy już przy lądowisku + 0,6 x obrońcy, którzy zdążą dojść w czasie krótszym od mojego o co najwyżej 8 s + 60), zmniejszoną o połowę za każdą własną rotę już przydzieloną do tego brodu (przepustowość kamieni) i podzieloną przez (1 + czas dojścia / 90 s); wolna rota widzi więc, że obrońcy zdążą wszędzie, a szybka nie. Biegacze liczą bez kary za tłok i z krótszym horyzontem (45 s), więc wybierają najsłabiej obsadzony bród. Atakujący idzie do wschodniego lądowiska brodu, a po przekroczeniu potoku na najbliższego przeciwnika. Obrońca ocenia zagrożenie brodu z pozycji atakujących (waga (1 - odległość od zachodniego brzegu / 1600)^2) i dzieli je przez własną załogę i czas dojścia; odźwierni (linia) nie przerzucają się. Czas dojścia to odległość w linii prostej dzielona przez prędkość roty (z mnożnikiem zmęczenia i morale) razy 0,85.
47. Pola przepływu (jedno na cel) są trzymane w pamięci podręcznej o rozmiarze 80 (najstarsze wypada): na dużych mapach z ruchomymi celami nieograniczona pamięć rosła zbyt szybko, a brakujące pole jest liczone ponownie (wynik ten sam).
48. Mnożnik prędkości strony (`opts.speedMult`, domyślnie 1) istnieje tylko do eksperymentów z szybkością (`tests/p1-przeprawa.js`); nie ma go w interfejsie.

**Armie i budżety (etap 3 rozszerzenia P1)**
49. Przed bitwą można wybrać budżet armii: Mały 1200, Średni 2200, Duży 3500 punktów (`army.budgets`). Bez budżetu (domyślnie) obie strony dostają armię ze scenariusza, jak dotąd (test regresji: identyczny przebieg). Obie strony dostają ten sam budżet w Bitwie i Przeprawie, niezależnie od tego, czy przeciwnikiem jest AI; w Oblężeniu atakujący dostaje budżet razy `siegeAttackerRatio` (1,5). Rezerwa uzupełnień (150 piechurów na stronę) zostaje poza budżetem; w Oblężeniu uzupełnienia ma tylko obrońca (`scenarioTypes.oblezenie.reinforce`), w Bitwie i Przeprawie obie strony.
50. **Koszty to założenie prototypu**: Dokument 0.5 nie podaje kosztów jednostek ani budżetów bitwy (zasoby kampanii nie mają przełożenia na koszt mrówki w bitwie). Za radą użytkownika przyjęto tabelę wg roli (punkty za mrówkę): piechur 1, ciężki wojownik 3, biegacz 2, pękacz 2, plujka 4, odźwierny 7, taran 8; dowódca z gwardią = 30 + 50 x koszt typu gwardii x 1,7. Prosty wzór ze statystyk dawał absurdy (plujka wychodziła tańsza od piechura, bo pomija zasięg i obszar rażenia), więc nie został użyty. Tabela jest w bloku `army` w JSON i jest do poprawy po testach.
51. Pula: jednostki wspólne (piechur, ciężki wojownik) i własne unikaty frakcji (WK: taran, biegacz, pękacz; LH: odźwierny, plujka). Każda armia ma 1-3 roty dowódcy z gwardią dowolnego typu z puli. Rota to typ i rozmiar 30-300 (krok 10); domyślne rozmiary jak w scenariuszu. Jednostek latających nie ma (odłożone na prośbę użytkownika; w dokumencie lotnik jest tylko wspomniany, bez statystyk).
52. Budżet jest twardym limitem: `Sim.create` odrzuca armię o koszcie wyższym niż budżet, jednostki spoza puli, rozmiar roty poza zakresem i brak dowódcy; interfejs wyłącza dodawanie, gdy nie starcza budżetu lub miejsca. AI nie dostaje niczego ponad budżet.
53. Rozmieszczenie jest automatyczne (`layoutArmy`): rota po rocie w strefie startu strony, klasy razem w kolumnach od frontu do tyłu (WK: piechota i ciężcy, dowódcy, tarany i pękacze, biegacze; LH: odźwierni, plujki, piechota i ciężcy, dowódcy), szerokość rot dobrana tak, by kolumna wypełniła strefę. Gdy armia się nie mieści, odstęp w szyku maleje z 11 do 9,5, a potem jest błąd „brak miejsca w strefie startu”. Strefa zachodnia ma 470 jednostek szerokości, więc Wielka Kolonia mieści najwyżej ok. 2000 mrówek (lekka masa w budżecie Duży jest tym ograniczona; w oblężeniu przewaga atakującego x1,5 też bywa ograniczona miejscem). Pierwsza rota odźwiernych staje jako plug, jeśli mapa ma przesmyk i obrońca broni pozycji.
54. **AI dobiera armię wg nazwanych wzorców** (`army.archetypes`, nie losowo): zrównoważona, ciężka, lekka masa, flankująca (WK, biegacze), szturmowa (WK, tarany i pękacze), wytrwała (na wyczerpanie: odźwierni, ciężcy, plujki, pękacze) i dystansowa (LH, plujki). Wzorzec to udział budżetu na typ jednostki, typ gwardii i przydatność w scenariuszu i roli (atakujący/obrońca). Przeciwnika (AI) można ustawić w menu na konkretny wzorzec albo `auto`; gracz też może zastosować wzorzec do swojej armii w ekranie konfiguracji i dalej ją edytować.
55. Wzorzec `auto`: bierze wzorzec o najwyższym wyniku przydatności w scenariuszu i roli, z premią z tabeli `army.counters`, jeśli znana jest armia przeciwnika (np. wobec co najmniej 25% plujek flankująca x1,5, bo biegacze polują na plujki; wobec 45% ciężkich dystansowa x1,4, bo kwas ignoruje pancerz). Wzorce w granicach 8% od najlepszego rozstrzyga ziarno, więc różne ziarna dają różne, ale rozsądne armie. Armię przeciwnika AI zna tylko wtedy, gdy ją skonfigurował gracz (zwiad przed bitwą); gdy obie strony dobiera AI, żadna nie kontruje drugiej.

**Elewacja, widoczność, balistyka i kierunek ciosu (etap 4 rozszerzenia P1)**
56. **Wzgórza**: siatka wysokości w środkach komórek (Float32) z gładkich wzgórz (funkcje Gaussa), generowana z osobnego strumienia `terrain`. Mają je typy map 2, 4, 5 i potok (na potoku dodatkowo podwyższone brzegi przy brodach: wschodni +26, zachodni +16); typ 1 zostaje płaski (z etapu 1), typ 3 płaski (kotwica regresji). Szczyty 20-38 jednostek, nachylenie do ok. 0,25. Skala wynika z balistyki (decyzja 58): najwyższy punkt toru w ogóle to R0/2 = 40 jednostek, więc wzgórze 40 byłoby już nie do przestrzelenia. Gniazdo stoi na płaskim.
57. **Ruch i zmęczenie**: nachylenie `s` liczone z gradientu wzdłuż kierunku ruchu mrówki. Mnożnik prędkości: pod górę `1/(1+2,5 s)` (nie mniej niż 0,45), z góry `1+1,2 |s|` (nie więcej niż 1,35); kotwica roty ma ten sam mnożnik. Zmęczenie marszu x`(1 + 3 s)` pod górę lub x`(1 - 0,5 |s|)` z góry (średnia z poruszających się mrówek roty w ciągu sekundy). W teście ta sama rota przechodzi 150 jednostek zbocza z góry w 4,7 s, a pod górę w 6,5 s, z dwukrotnie większym przyrostem zmęczenia. Pola przepływu nie liczą kosztu nachylenia (obchodzenie stromych zboczy jest w TODO).
58. **Balistyka plujki**: pocisk leci po paraboli, prędkość wylotu z zasięgu na płaskim (`v^2 = g R0`, `R0 = 80`). Dla odległości `d` i różnicy wysokości `dh` (cel minus strzelec, z oczami +4 i +2) kąt wynika ze wzoru `tan θ = (v^2 ± sqrt(v^4 - g (g d^2 + 2 dh v^2))) / (g d)`; ujemny wyróżnik oznacza cel poza zasięgiem. Z tego wynika zasięg `R = R0 sqrt(1 + 2 Δh / R0)` (Δh = strzelec minus cel): z wzgórza o 20 wyżej 98, z dołu o 20 tylko 57, cel 40 wyżej jest nieosiągalny. Najpierw sprawdzany jest tor niski (poniżej 45 stopni), a gdy zasłania go wzgórze, tor stromy (powyżej 45 stopni: krótszy zasięg, ale przechodzi nad wzgórzem); gdy oba są zablokowane, strzału nie ma. Ściany (pnie, kamienie, korzenie, zarośla, mur gniazda) nadal blokują tory całkowicie (strzał łukiem nie przechodzi nad ścianą; to możliwa późniejsza opcja). Obrażenia są zadawane natychmiast (czas lotu pominięty, TODO); wyliczony wierzchołek toru służy do narysowania łuku. Mapy bez wzgórz (typy 1 i 3) używają dotychczasowej reguły (zasięg 80 i linia wzroku 2D).
59. **Widoczność** (`params.visibility`, wspólna dla gracza i AI; AI gra uczciwie): wróg jest widoczny dla strony, gdy któryś z próbkowanych własnych obserwatorów (co czwarta mrówka) widzi go w promieniu 125 (więcej niż zasięg plujki) z czystą linią wzroku 3D (ściany, zarośla i teren zasłaniają, woda nie). Mrówka na mchu (komórka osłony) jest widoczna tylko z 28 jednostek: mech to dla mrówek gęste krzaki, ale sam nie blokuje widoku między innymi komórkami. Trawa i ściółka to dekoracja. Mrówka, która zaatakowała (wręcz albo kwasem), jest widoczna dla wszystkich przez 3 s. Nie ma bonusu obrażeń za zasadzkę (decyzja użytkownika: wystarczy niewidoczność). Widoczność jest liczona co 5 kroków w stałej kolejności (część stanu symulacji, deterministyczna).
60. **AI a widoczność**: AI i namierzanie mrówek używają tylko widocznych wrogów; AI zna rotę wroga przez 15 s od ostatniego zobaczenia (ostatnia widziana pozycja środka widocznych mrówek, liczebność znana naprawdę: uproszczenie). Ukryty cel jest gubiony. Gdy AI nikogo nie widzi, jego cel zastępczy to środek rozstawienia wroga (publiczna wiedza), w Oblężeniu gniazdo, w Przeprawie lądowisko wybranego brodu. Interfejs nie rysuje niewidocznych wrogów, ich chorągwi, kart ani paneli; tryb obserwatora (AI przeciw AI) pokazuje wszystko.
61. **Kierunek ciosu** (`params.facing`): kąt między kierunkiem mrówki (`heading`) a kierunkiem do atakującego: do 60 stopni przód (x1), 60-120 flanka (x1,25), powyżej 120 tył (x1,5). Dotyczy ciosów wręcz i kwasu (kierunek z miejsca strzału). Mnożniki są założeniem prototypu (użytkownik: od tyłu największe, z flanki mniejsze, z przodu mrówka jest przygotowana). Obrażenia wręcz z wysokości nie są zmieniane.
62. **Bezpieczniki**: `params.elevation.on`, `params.visibility.on`, `params.facing.on` (domyślnie włączone); z wyłączonymi mechanikami etapu 4 przebieg typu 3 jest identyczny jak przed etapem (test regresji). Domyślnie włączone wpływają też na typ 3 (widoczność i kierunek ciosu).
63. **Uzupełnienia** (`scenarioTypes.*.reinforce`): poza oblężeniem obie strony wchodzą do bitwy z tym, co mają, bez uzupełnień (Bitwa, Przeprawa); w oblężeniu uzupełnia tylko obrońca (decyzja użytkownika).

**Szturm kopca (etap 5 rozszerzenia P1)**
64. **Oblężenie w menu to teraz szturm na wielopoziomowy kopiec** (scenariusz `kopiec`, własna stała mapa `kopiec` 2600 x 1500, wybór typu mapy wyłączony). Dotychczasowe płaskie Oblężenie zostaje pod wewnętrzną nazwą `oblezenie` (ukryte w menu przez `hidden`, dostępne przez `?scenario=oblezenie`), bo jest kotwicą regresji typu 3 (decyzja użytkownika: kopiec zastępuje Oblężenie; poziomy jako tarasy wokół serca).
65. **Struktura**: poziomy to pierścienie-korytarze (4 pierścienie licząc serce) wokół serca gniazda, każdy na własnej wysokości (podłoga 0, 12, 24, 36), oddzielone ścianami grubości 4 komórek (ziemia). Przejścia między poziomami to wyłącznie rampy-tunele przez ściany (szerokość 3 komórki, nachylenie ok. 0,19: mnożnik prędkości pod górę 0,68, z góry 1,22, zmęczenie rośnie jak na wzgórzach z etapu 4). Do kopca prowadzą dwa wejścia (4 komórki) w murze zewnętrznym od zachodu. Rampy: poziom 0->1 północ i południe, 1->2 wschód i zachód, 2->serce północ i południe, więc droga do serca musi okrążać pierścienie (ok. 2,6 razy dłuższa niż linia prosta). Wszystko wynika z `world.mound` (komórki; pasma liczone od środka normą maksimum), czyli układ jest w danych. Siatka i wysokości to zwykła siatka terenu i wysokości z etapu 4, więc ruch, pola przepływu, kolizje, widoczność 3D, balistyka, nachylenie i rysowanie działają bez osobnej logiki; gradient w komórkach przy ścianach liczony tylko z sąsiadów, którzy są podłogą (ściana między poziomami nie daje fałszywego nachylenia).
66. **Rozmieszczenie**: atakujący na małym polu przed kopcem (840 x 1100, `mound.staging`; musi mieścić armię x1,5 budżetu Duży także we wzorcu lekkim), obrońcy w prostych odcinkach korytarzy kolumną wzdłuż korytarza twarzą do strony, z której nadejdą atakujący (odległość po podłodze od pola startu), z przerwami na ujścia ramp i wejścia; ciężka piechota i odźwierni w pierścieniu zewnętrznym i pierwszym, plujki głębiej; elitarna gwardia dowódcy (istniejąca rota dowódcy z gwardią; osobnej jednostki królowej w grze nie ma) i, gdy zabraknie miejsca w korytarzach, duże roty rezerwy stoją w sercu jako swobodne bloki. Rota, która nie mieści się w żadnym odcinku, daje błąd „brak miejsca w kopcu” (budżetowa kompozycja zmniejsza wtedy budżet jak przy strefie startu).
67. **Panika**: używa istniejącego systemu morale (`control`, stany pełna, słaba, utracona). Spanikowana rota obrońcy cofa się do punktu odwrotu, którym teraz jest serce gniazda, a trasę wyznacza pole przepływu po prawdziwych korytarzach i rampach (rota nie przechodzi przez ściany ani omija rampy). Nie dodano nowych mechanik morale.
68. **Cel i koniec**: jak w płaskim Oblężeniu, ale celem jest serce: atakujący wygrywa, zajmując serce (co najmniej 15 mrówek w promieniu 96 przy mniej niż 3 obrońcach przez 8 s) albo niszcząc obrońców, a po czasie wygrywa obrońca; uzupełnienia ma tylko obrońca i pojawiają się w sercu (obrońcy z sąsiednich pierścieni kontratakują, uzupełnienia resetują licznik zajęcia). Limit czasu kopca to 1500 s (`scenarioTypes.kopiec.timeLimit`, zamiast 900 s płaskich map): w pomiarach (16 bitew AI przeciw AI) bitwy trwały 399-1048 s, więc przy 900 s co najmniej jedna z 16 kończyłaby się upływem czasu.
69. **Założenia liczbowe kopca (do korekty po testach)**: limit czasu 1500 s, wymiary (korytarz 5 komórek = 80 jedn., ściana 4, rampa 3, wejście 4, serce 16 x 16 komórek), wysokości poziomów, położenie ramp i wejść, pole startu 840 x 1100, rozmieszczenie obrońców.
70. **Ruch w korytarzach** (`params.corridor`, mapy z `followAnchor`: 4, 5 i kopiec; poprawka po zgłoszeniu blokowania się w wąskich przejściach). Diagnoza: szyk to prosta siatka miejsc wokół kotwicy, więc po zakręcie o 90° tylne rzędy miały miejsca w ścianach; mrówki z takim miejscem szły do kotwicy i zlewały się w kupkę, której nic nie rozsuwało (15-50% roty nigdy nie wracało do szyku). Rozwiązanie jest ogólne: (a) pola przepływu mają dodatkowy koszt komórek przy ścianie (9 dla odległości 1 komórki, 4 dla 2), więc kotwica idzie środkiem korytarza i nie ściera narożników; (b) rota, której szyk nie mieści się w korytarzu (miejsca w ścianach, albo za mało szerokości), zmniejsza liczbę kolumn do wynikającej z najwęższego miejsca wzdłuż szyku i układa się po śladzie kotwicy: miejsce o głębokości U < 0 leży na śladzie U jednostek za kotwicą (z bocznym przesunięciem V), więc kolumna skręca razem z korytarzem; z przodu miejsce proste albo kotwica. Poza korytarzem (szyk się mieści) nic się nie zmienia, a mapy 1-3 nie są dotknięte (kotwica regresji bez zmian). Pomiar (`tests/p1-korytarze.js`): odsetek mrówek na miejscu w szyku po dojściu do celu wzrósł z 49-85% do 100% dla zakrętu N->W i N->E, bliskiego celu za rogiem, rampy i wejścia do kopca.
71. **Sterowanie wzorowane na Total War** (specyfikacja użytkownika, szczegóły i macierz zgodności w `sterowanie-total-war.md`): LPM zaznacza (Ctrl dodaje, ramka z progiem 6 px, Ctrl+A całą armię), PPM na terenie to ruch bez walki (dwukrotny: szybki ruch), PPM na wrogiej rocie to rozkaz ataku `attackTarget` (dwukrotny: szarża rot z umiejętnością), Shift+PPM dodaje do kolejki (`c.queue`), przeciągnięcie PPM ustawia środek, kierunek i szerokość szyku, Alt+LPM przesuwa grupę (z Ctrl obraca), G grupuje, Ctrl+G blokuje układ, Backspace zatrzymuje. Rozkaz jest przekazywany do tego samego mechanizmu co dotychczas (`c.order`); symulacja odrzuca rozkaz bez drogi (komunikat), wykrywa brak postępu (raz przelicza trasę, potem kończy rozkaz) i kończy rozkaz ataku po zniszczeniu celu, przechodząc do następnego z kolejki. Dotychczasowy atak-marsz zostaje pod B + klik (A przesuwa kamerę). Zamknięcie wejścia przeniesione z G na T. Wartości (próg, okno dwukrotnego kliknięcia, mnożnik szybkiego ruchu 1,5, zmęczenie 2,5) to reguły projektu, nie wartości z Total War.
72. **Interfejs bitwy, statystyki i system walki (etap B, specyfikacja użytkownika)**. Wszystkie liczby to założenia projektu w JSON (`units.*.combat`, `params.combat`, `params.morale`), nie są wartościami z gier Total War (źródła nie dało się pobrać). Walka: szansa trafienia wręcz = `clamp(50 + (atak - obrona) x 1, 5, 95)` pp (zmęczenie obniża atak o `fatigueAtk` x zmęczenie); trafienie liczy się osobno dla każdego ciosu, chybiony cios nie zadaje obrażeń. Obrażenia: `(podstawowe x (1 - min(75%, pancerz x 0,75%)) + przebijające pancerz) x mnożniki` (kontra typu, zmęczenie, kierunek ciosu), potem odporność rodzaju obrażeń i osłony jako jeden mnożnik z dolnym ograniczeniem (łącznie najwyżej 85% redukcji), minimum 1 HP na trafienie. Kwas ma celność i amunicję (pula roty), wybuchy omijają pancerz. Zdrowie roty to suma HP żywych mrówek (maksimum = suma początkowa), ranna mrówka jest żywa. Odstęp między ciosami jest liczony w krokach symulacji, więc nie zależy od klatek. **Morale to istniejąca kontrola roty** (decyzja użytkownika: przemapować, nie dublować): te same źródła (regeneracja, dowódca, masa, straty, presja walki, brak dowódcy, odcięcie, zmęczenie, kapitan) plus dwa nowe z specyfikacji (atak z boku lub od tyłu, ucieczka sąsiedniego oddziału w promieniu `allyRadius`), mnożone przez `1 - odporność psychiczna roty`; pasma 70/40/20/1/0 z histerezą 3 pkt i mnożnikami tempa ataku i prędkości; odwrót przy morale 0 (zatrzask), zebranie po `noThreatSec` s bez zagrożenia i morale >= `rallyMin`, potem rota czeka na rozkaz. Atakujący nadal wpada w szał zamiast uciekać (`attackerRage`), obrońca się wycofuje. **Bezpiecznik**: `params.combat.on` i `params.morale.spec` (domyślnie włączone); przy wyłączeniu rdzeń liczy po staremu (kotwica regresji typu 3 jest liczona przy wyłączonych). Interfejs: karta roty (żywe/max, pasek HP z sumy, pasek morale w kolorze pasma, amunicja lub zmęczenie, stan, błysk po obrażeniach, wyróżnienie odwrotu), lewy panel szczegółów zaznaczonej (lub podglądanej wrogiej) roty w grupach Stan, Atak, Obrona, Ruch, Aktywne efekty, podpowiedzi z wzorami i prawdziwymi wartościami z `sim.compStats`, kompaktowe wskaźniki nad rotą (pasek HP, kształt i kolor morale, strzałka odwrotu), pasek sił (orientacyjny: HP x waga morale; wróg tylko wg wiedzy strony, ostatnio widziane roty), minimapa (tylko widoczne jednostki, prostokąt widoku, klik i przeciąganie przenoszą kamerę). Decyzje użytkownika: model walki za bezpiecznikiem i domyślnie włączony; morale jako przemapowana kontrola; specyfikacja przyjęta w całości; etapy po kolei z przystankiem po każdym.
73. **Znaczniki i nakładki taktyczne (etap C, specyfikacja użytkownika)**. Zasada: każdy znacznik pochodzi z tych samych zapytań co symulacja (`sim.shotAt`, `sim.fireCheck`, `sim.fireArea`, `sim.reachable`, `sim.compHull`, `sim.approachPoint`), a nie z osobnej logiki graficznej; `shotAt` daje ten sam wynik co rdzeń (`shotApex`, test na 400 parach), z dodatkową przyczyną odmowy (`range`, `wall`, `terrain`) i punktem blokady. Warstwy: zaznaczenie (obrys otoczką wypukłą rzeczywistych mrówek, domyślnie turkus, grubość i intensywność maleją z liczbą zaznaczonych rot), kursor (słaby obrys własnej roty + podświetlenie jej karty; wróg: pomarańczowy obrys), cel rozkazu ataku (czerwone narożniki, znacznik nad rotą, linie do punktów podejścia na obrysie celu, osobne dla każdej atakującej roty, do `maxTargetLines`; poza widocznością tylko ostatnia znana pozycja), rozkazy (pełna trasa z pola przepływu dla pierwszych `maxRoutes` rot, pozostałe uproszczony znacznik celu), zasięg plujek (cienki okrąg z rzeczywistej pozycji przedstawicielskiej mrówki; w trybie taktycznym J także pole faktycznego ostrzału z 36 promieni i klinowe obszary zablokowane ścianą lub terenem), wykonalność ostrzału po wskazaniu widocznego wroga (✔ pełny >= 80% strzelców z poprawnym torem, ◐ częściowy 50-79%, ▲ ograniczony 1-49%, ✖ brak, z etykietami i przyczyną; progi w `ui.overlays.fire.thresholds`), podświetlenie rzeczywistej przeszkody (komórka ściany albo punkt toru nad terenem), plama kwasu (promień z parametrów, liczba objętych widocznych wrogów, niepewna przy celności < 100%), kontakt walki wręcz (opcja), wybuch pękaczy w trybie wybuchu. Mechanika plujki nie ma kierunku strzału ani blokowania przez jednostki, więc nakładka pokazuje koło, a nie stożek, i nigdy nie pisze o zasłonięciu przez własną piechotę; ogień sojuszniczy nie występuje (kwas i wybuch trafiają tylko wrogów), więc nie ma oznaczeń zagrożonych swoich. Mgła wojny: tylko widoczne mrówki celu są brane do wykonalności, niewidoczny wróg nie dostaje obrysu, oceny ani punktu blokady; pole zasięgu to geometria własnych strzelców. Panel nakładek (przycisk Nakładki, K): niezależne przełączniki, kolor zaznaczenia i kolory zasięgu, wroga i celu, tryb łagodny; ustawienia w localStorage. Podgląd ostrzału z miejsca docelowego podczas przeciągania PPM jest oznaczony jako niepotwierdzony. Wydajność: wykonalność przeliczana przy zmianie pozycji lub co 8 kroków, pole ostrzału co 16 kroków lub po przesunięciu o 8 jednostek, obrys raz na krok i rotę.
74. **Poprawki po etapie C (zgłoszenia po testach bitew)**: (a) zasięg plujki 80 -> 120 (założenie projektu; promień widzenia 125, więc plujka strzela do tego, co rota widzi; plama kwasu bez zmian); (b) automatyczny kontratak zaatakowanej roty gracza (`params.reaction`, opis w `sterowanie-total-war.md` sekcja 6; agresor zapamiętany w `c.lastAttacker` przy każdym trafieniu, jawne Stój ma `order.explicit`); (c) gest PPM: pierwszy punkt to kotwica (skraj frontu), kursor to drugi skraj, kierunek prostopadle do linii na ekranie, środek roty o pół głębokości za środkiem frontu; (d) błąd rdzenia: skuteczny rozkaz roty (`c.eff`) był odświeżany tylko raz na sekundę, więc nowy rozkaz ruchu wydany stojącej rocie widział stary skuteczny rozkaz „stój” w miejscu (odległość 0) i był oznaczany jako wykonany w kroku wydania: rota ruszała do sekundy później, bez wykrywania braku postępu, z kolejką ruszającą od razu i bez linii trasy w nakładce. Teraz `setOrder` odświeża `c.eff` od razu dla stron sterowanych przez gracza (strony AI zachowują dotychczasowe zachowanie, bo kotwica regresji typu 3 jest liczona na AI-AI).

**Poza zakresem P1:** kampania, ekonomia, lotnictwo, zniszczalne ściany i bramy kopca, nakładające się piętra kopca, splot, beczki, dźwięk, obrót całego układu rot przy marszu grupy, aktywne umiejętności gwardii innych niż dowódcy (gwardia typu Taran/Odźwierny ma tylko statystyki elity; gwardia pękaczy detonuje przy kontakcie).

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
| `world.scenarioTypes` | {'comment': 'Rodzaj scenariusza: czy jest gniazdo (cel i mur), jak zachowuje się AI każdej strony (advance: idzie do celu, hold: broni pozycji) i jak kończy się bitwa (nest: zajęcie gniazda lub zniszczenie, z upływem czasu wygrywa obrońca; annihilate: zniszczenie przeciwnika, z upływem czasu wygrywa strona z większym odsetkiem ocalałych).', 'bitwa': {'name': 'Bitwa', 'nest': False, 'posture': {'WK': 'advance', 'LH': 'advance'}, 'end': 'annihilate', 'reinforce': {'WK': False, 'LH': False}, 'desc': 'Standardowe starcie dwóch armii na wybranej mapie. Nie ma gniazda ani celu terenowego: obie strony idą na siebie, wygrywa ten, kto zniszczy przeciwnika, a po upływie czasu ten, kto ma większy odsetek ocalałych.'}, 'oblezenie': {'name': 'Oblężenie płaskie (stare)', 'hidden': True, 'nest': True, 'posture': {'WK': 'advance', 'LH': 'hold'}, 'end': 'nest', 'reinforce': {'WK': False, 'LH': True}, 'desc': 'Atakujący (Wielka Kolonia) szturmuje gniazdo, obrońca (Lake Hodges) broni go i jako jedyny uzupełnia straty (atakujący nie ma uzupełnień). Atakujący wygrywa, zajmując gniazdo lub niszcząc obrońców, obrońca wygrywa po upływie czasu. Na tym etapie bez przewagi budżetowej atakującego (budżety są w etapie 3) i bez wnętrza kopca (etap 5).'}, 'kopiec': {'name': 'Oblężenie', 'nest': True, 'wall': False, 'posture': {'WK': 'advance', 'LH': 'hold'}, 'end': 'nest', 'reinforce': {'WK': False, 'LH': True}, 'map': 'kopiec', 'timeLimit': 1500, 'desc': 'Szturm na wielopoziomowy kopiec. Atakujący (Wielka Kolonia) startuje na niewielkim obszarze przed kopcem i musi przedostać się przez wąskie wejścia, korytarze i rampy na kolejne poziomy do serca gniazda; obrońca (Lake Hodges) siedzi wewnątrz, jako jedyny uzupełnia straty, a spanikowane roty cofają się do serca po korytarzach. Atakujący wygrywa, zajmując serce lub niszcząc obrońców, obrońca wygrywa po upływie czasu. Mapa jest stała (kopiec), wybór typu mapy nie działa.'}, 'przeprawa': {'name': 'Przeprawa', 'nest': False, 'map': 'stream', 'posture': {'WK': 'advance', 'LH': 'hold'}, 'end': 'annihilate', 'reinforce': {'WK': False, 'LH': False}, 'desc': 'Potok przecina pole bitwy. Woda jest nieprzejezdna, a przejść można tylko po łańcuchach dużych kamieni (trzy przeprawy o różnej szerokości). Atakujący przeprawia się, obrońca trzyma drugi brzeg; woda nie zasłania strzału. Wygrywa zniszczenie przeciwnika, a po upływie czasu większy odsetek ocalałych. Mapa jest stała (potok), wybór typu mapy nie działa.'}} |

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
| 2 | Kilka przeszkód | 2000x1200 | scattered | `count` [8, 11], `sep` 150, `cover` 14, `hills` {'n': [2, 3], 'h': [22, 36], 'r': [220, 340]} |
| 3 | Pień z kilkoma trasami | 2000x1200 | legacy |  |
| 4 | Gęsty i kręty podszyt | 2600x1400 | thicket | `hills` {'n': [3, 4], 'h': [22, 38], 'r': [260, 400]}, `pitch` 128, `wallR` 26, `jitter` 8, `braid` 0.1, `doors` 6, `follow` True, `cover` 40, `minWidth` 52, `mix` {'brush': 0.45, 'wood': 0.25, 'root': 0.15, 'stone': 0.15} |
| stream | Potok z kamieniami | 3000x3200 | stream | `hidden` True, `hills` {'n': [3, 5], 'h': [20, 34], 'r': [260, 400], 'banks': {'east': [26, 300], 'west': [16, 280]}}, `cover` 40, `minWidth` 44, `scatter` 26, `fords` [{'dy': -1200, 'stoneR': [58, 64]}, {'dy': 0, 'stoneR': [44, 48]}, {'dy': 1200, 'stoneR': [58, 64]}] |
| kopiec | Kopiec (wielopoziomowe gniazdo) | 2600x1500 | mound | `hidden` True, `mound` {'center': [116, 47], 'heartHalf': 8, 'corridor': 5, 'wall': 4, 'rings': 3, 'heights': [0, 12, 24, 36], 'gates': [-14, 14], 'gateW': 4, 'rampW': 3, 'ramps': [{'from': 0, 'sides': ['N', 'S'], 'at': 0.5}, {'from': 1, 'sides': ['E', 'W'], 'at': 0.5}, {'from': 2, 'sides': ['N', 'S'], 'at': 0.5}], 'staging': [60, 200, 900, 1300], 'captureR': 96} |
| 5 | Chaparral: gąszcz wąskich przejść | 3000x1500 | thicket | `hills` {'n': [3, 5], 'h': [22, 38], 'r': [260, 400]}, `pitch` 116, `wallR` 28, `jitter` 6, `braid` 0.04, `doors` 4, `follow` True, `cover` 70, `minWidth` 44, `mix` {'brush': 0.62, 'wood': 0.18, 'root': 0.12, 'stone': 0.08} |

### Scenariusze (`world.scenarioTypes`)
| Scenariusz | Gniazdo | Postawa AI (WK / LH) | Koniec |
|---|---|---|---|
| Bitwa | nie | advance / advance | annihilate |
| Oblężenie płaskie (stare) | tak | advance / hold | nest |
| Oblężenie | tak | advance / hold | nest (mapa: Kopiec (wielopoziomowe gniazdo)) |
| Przeprawa | nie | advance / hold | annihilate (mapa: Potok z kamieniami) |

### Armie (`army`, założenia prototypu)
Koszt za mrówkę: infantry 1, ciezki 3, biegacz 2, pekacz 2, plujka 4, odzwierny 7, taran 8, dowodca 30. Budżety: Mały 1200, Średni 2200, Duży 3500; atakujący w oblężeniu x1.5. Rota: 30-300 mrówek (krok 10), dowódców 1-3, gwardia 50 mrówek x koszt typu x 1.7.

| Wzorzec | Frakcje | Udział budżetu WK | Udział budżetu LH | Gwardia |
|---|---|---|---|---|
| zrownowazona: Zrównoważona | WK, LH | infantry 50%, ciezki 10%, taran 12%, pekacz 10%, biegacz 18% | infantry 30%, ciezki 20%, plujka 25%, odzwierny 25% | ciezki, ciezki |
| ciezka: Ciężka | WK, LH | ciezki 50%, taran 22%, infantry 18%, pekacz 10% | ciezki 50%, odzwierny 20%, infantry 15%, plujka 15% | ciezki, ciezki |
| lekka: Lekka masa | WK, LH | infantry 72%, pekacz 13%, biegacz 15% | infantry 75%, plujka 25% | infantry, infantry |
| flankujaca: Flankująca (szybka) | WK | biegacz 42%, infantry 33%, ciezki 10%, pekacz 15% | - | biegacz |
| szturmowa: Szturmowa (tarany i pękacze) | WK | taran 32%, pekacz 20%, infantry 38%, ciezki 10% | - | ciezki |
| wytrwala: Wytrwała (na wyczerpanie) | WK, LH | ciezki 40%, infantry 40%, pekacz 20% | odzwierny 30%, ciezki 30%, plujka 25%, infantry 15% | ciezki, ciezki |
| dystansowa: Dystansowa (plujki) | LH | - | plujka 40%, odzwierny 20%, ciezki 25%, infantry 15% | ciezki |

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
| `params.elite.meleeAttack` | 8 |
| `params.elite.meleeDefence` | 8 |
| `params.elite.armour` | 16 |
| `params.elite.moraleResistance` | 0.1 |
| `params.combat.comment` | Model walki (własne reguły projektu, nie wzory Total War). Szansa trafienia wręcz = clamp(hitBase + (atak - obrona) * hitPerPoint, hitMin, hitMax) %. Redukcja pancerza = min(armourCap, pancerz * armourScale) % tylko dla obrażeń podstawowych; obrażenia przebijające pancerz ją omijają. Odporności i sytuacyjne osłony (mech, tarcza odźwiernych, zamknięty szyk) mnożą wynik; łączna redukcja nie przekracza maxReduction. Trafienie zadaje co najmniej minDamage. fatigueAtk: spadek ataku wręcz o tyle punktów przy 100% zmęczenia. Gdy on = false, działa dawny model (kotwica regresji). |
| `params.combat.on` | True |
| `params.combat.hitBase` | 50 |
| `params.combat.hitPerPoint` | 1 |
| `params.combat.hitMin` | 5 |
| `params.combat.hitMax` | 95 |
| `params.combat.armourScale` | 0.75 |
| `params.combat.armourCap` | 75 |
| `params.combat.minDamage` | 1 |
| `params.combat.maxReduction` | 0.85 |
| `params.combat.fatigueAtk` | 15 |
| `params.morale.comment` | Morale = istniejąca kontrola roty (params.control) z progami i konsekwencjami ze specyfikacji (własne reguły projektu). Pasma: stabilne od bands[0].min, pod presją, chwieje się, na granicy ucieczki; przy morale <= retreatAt odwrót (atakujący: szał, gdy attackerRage). Zebranie: noThreatSec bez zagrożenia i morale >= rallyMin, po zebraniu rota czeka na rozkaz (hold). Źródła strat i regeneracji bez zmian względem dawnej kontroli (bazowa regeneracja params.control.regen, premie dowódcy, masy i strony); dochodzą tylko kary jednorazowe ze specyfikacji i odporność psychiczna. Kary jednorazowe: flank (atak z boku lub tyłu, najwyżej raz na flankCooldown s) i ally (ucieczka sojuszniczej roty w promieniu allyRadius). Odporność psychiczna roty zmniejsza każdą karę. Gdy spec = false, działa dawna kontrola. |
| `params.morale.spec` | True |
| `params.morale.retreatAt` | 0 |
| `params.morale.rallyMin` | 35 |
| `params.morale.noThreatSec` | 4 |
| `params.morale.flank` | 12 |
| `params.morale.flankCooldown` | 8 |
| `params.morale.ally` | 8 |
| `params.morale.allyRadius` | 220 |
| `params.morale.hyst` | 3 |
| `params.morale.threatRadius` | 130 |
| `params.morale.attackerRage` | True |
| `params.morale.bands` | [{'min': 70, 'name': 'Stabilne', 'icon': '●', 'color': '#6fbf4a', 'cd': 1.0, 'speed': 1.0}, {'min': 40, 'name': 'Pod presją', 'icon': '▲', 'color': '#e6c22a', 'cd': 1.15, 'speed': 0.95}, {'min': 20, 'name': 'Chwieje się', 'icon': '⚠', 'color': '#f0902a', 'cd': 1.4, 'speed': 0.9}, {'min': 1, 'name': 'Na granicy ucieczki', 'icon': '✖', 'color': '#e0483a', 'cd': 1.7, 'speed': 0.85}, {'min': 0, 'name': 'Odwrót', 'icon': '↩', 'color': '#e0483a', 'cd': 1.7, 'speed': 0.85}] |
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
| `params.elevation.comment` | Etap 4. Wartości liczbowe to założenia prototypu. Mnożnik prędkości: pod górę 1/(1+upK*s) (nie mniej niż minUp), z góry 1+downK*|s| (nie więcej niż maxDown), s = nachylenie wzdłuż ruchu; zmęczenie marszu x(1+fatUp*s_pod_górę) lub x(1-fatDown*|s|_z_góry). |
| `params.elevation.on` | True |
| `params.elevation.upK` | 2.5 |
| `params.elevation.downK` | 1.2 |
| `params.elevation.minUp` | 0.45 |
| `params.elevation.maxDown` | 1.35 |
| `params.elevation.fatUp` | 3 |
| `params.elevation.fatDown` | 0.5 |
| `params.ballistics.comment` | Pocisk kwasu leci po paraboli: prędkość wylotu z zasięgu na płaskim (v^2 = g*R0), kąt dowolny; tor płaski, a gdy zablokuje go wzgórze, stromy (>45 stopni, krótszy zasięg). Wysokość oczu strzelca i celu nad terenem, krok próbkowania toru. |
| `params.ballistics.R0` | 80 |
| `params.ballistics.g` | 1 |
| `params.ballistics.eyeShooter` | 4 |
| `params.ballistics.eyeTarget` | 2 |
| `params.ballistics.step` | 8 |
| `params.ballistics.clearance` | 0.5 |
| `params.visibility.comment` | Widoczność wspólna dla strony: wróg jest widoczny, gdy widzi go któryś z próbkowanych własnych obserwatorów (1 na every mrówek) w promieniu radius z czystą linią wzroku 3D. Mrówka na mchu jest widoczna tylko z mossRadius. Mrówka, która zaatakowała, jest widoczna revealSec sekund. AI zna rotę wroga przez memorySec sekund od ostatniego zobaczenia. |
| `params.visibility.on` | True |
| `params.visibility.radius` | 125 |
| `params.visibility.mossRadius` | 28 |
| `params.visibility.revealSec` | 3 |
| `params.visibility.period` | 5 |
| `params.visibility.every` | 4 |
| `params.visibility.memorySec` | 15 |
| `params.visibility.eyeHeight` | 3 |
| `params.facing.comment` | Obrażenia zależne od kierunku ciosu względem kierunku mrówki (heading): przód x1, flanka x flank, tył x rear. frontDeg i rearDeg to progi w stopniach. |
| `params.facing.on` | True |
| `params.facing.flank` | 1.25 |
| `params.facing.rear` | 1.5 |
| `params.facing.frontDeg` | 60 |
| `params.facing.rearDeg` | 120 |
| `params.run.comment` | Szybki ruch (dwukrotny PPM na terenie): mnożnik prędkości i mnożnik przyrostu zmęczenia w marszu. Wartości są założeniem projektu. |
| `params.run.mult` | 1.5 |
| `params.run.fatigue` | 2.5 |
| `params.orders.comment` | Rozkazy gracza: sekundy bez postępu zanim rota próbuje przeliczyć trasę, a potem kończy rozkaz z komunikatem o braku drogi; odstęp odświeżania celu ataku (kroki). |
| `params.orders.stuckSec` | 4 |
| `params.orders.retargetTicks` | 5 |
| `params.orders.chargeRange` | 160 |
| `params.corridor.comment` | Ruch w korytarzach (mapy z followAnchor: 4, 5 i kopiec). Pole przepływu omija ściany (koszt komórek przy ścianie: penalty dla odległości 1 i 2 komórek), a szyk, którego miejsca wpadają w ściany lub jest za szeroki dla korytarza, zmienia się w kolumnę o liczbie kolumn dopasowanej do szerokości korytarza i podąża śladem kotwicy (miejsce o głębokości U leży na śladzie U jednostek za kotwicą, a nie na prostej). |
| `params.corridor.on` | True |
| `params.corridor.penalty` | [9, 4] |
| `params.corridor.trailStep` | 3 |
| `params.corridor.trailMax` | 400 |
| `params.corridor.holdSec` | 3 |
| `params.corridor.probe` | 40 |
| `params.corridor.margin` | 2 |
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

### 4.15 Scenariusz: postawa AI i koniec bitwy
```
applyScenario(defs, id):  # przed applyMapType
  cfg = world.scenarioTypes[id]; world.nestWall = cfg.nest
  scenario.mode = { id, nest, posture: {WK, LH}, end }

aiStep(s):
  advance = mode.posture[strona] == advance
  goal(c) = mode.nest ? nest : pozycja najbliższej roty przeciwnika
  jeśli advance: jak dotychczasowy atakujący, z celem goal(c) zamiast gniazda i odwrotem retreatPoint(c);
     gwardia dowódcy (rota z dowodca) idzie dir * 170 za najbardziej wysuniętą rotą (dir = +1 WK, -1 LH)
  w przeciwnym razie: jak dotychczasowy obrońca (plug, artyleria, kontratak, odwrót do gniazda)

checkEnd():
  jeśli mode.end == annihilate:
     fr = żywi / stan początkowy dla obu stron
     fr[LH] < 0.05 -> WK; fr[WK] < 0.05 -> LH; limit czasu -> strona z większym fr
  w przeciwnym razie: zajęcie gniazdo (15+ WK, < 3 LH, 8 s) / zniszczenie obrońców / rozbicie atakujących / limit czasu: wygrywa obrońca

widoczność: losClear sprawdza tablicę SIGHT (woda 0), ruch i pola przepływu tablicę BLK (woda 1)

przeprawa (world.fords = [{ y, wx, wy, ex, ey }]; w = zachodnie, e = wschodnie lądowisko):
  eta(c, x, y) = odległość(c, (x, y)) / (c.speed * c.spMod * 0.85)
  atakujący, co 10 s lub przy zmianie: wybierz bród k maksymalizujący
     siła(c) / (obrońcy w 350 od e_k + 0.6 * obrońcy z eta <= eta(c, e_k) + 8 + 60) / (1 + 0.5 * własne roty przy k) * (1.35 jeśli to bieżący) / (1 + eta / 90)
  rozkaz: atak na e_k, a po przekroczeniu (x > środek brodu) atak na najbliższego przeciwnika
  obrońca, co 10 s lub przy zmianie: wybierz bród k maksymalizujący
     (zagrożenie_k + 4) / (załoga_k + siła(c) + 80) * (1.35 jeśli bieżący) / (1 + eta(c, e_k) / 120),
     zagrożenie_k = suma siła(w) * max(0, 1 - odległość(w, w_k) / 1600)^2
  rozkaz: stój przy e_k (+20 jednostek; plujki +60, gwardia dowódcy +90)
```

### 4.16 Armie z budżetu
```
create(opts):  # po applyScenario i applyMapType
  jeśli opts.budget:
    dla strony: budget = budgetFor(scenariusz, strona, poziom)          # w oblężeniu atakujący x1.5
      a = opts.armies[strona]  (walidacja: pula, rozmiary, dowódcy, koszt <= budget, inaczej błąd)
          albo composeArmy(strona, budget, styl, armia przeciwnika jeśli podana)
      companies[strona] = layoutArmy(strona, a)

composeArmy(styl):
  id = styl == auto ? pickArchetype : styl
  pickArchetype: score = fit[scenariusz][rola] * produkt premii counters (profil armii przeciwnika);
                 spośród wzorców z score >= 0.92 * max wybierz losowo (ziarno)
  commanders = budżet < 1500 ? 1 : 2; reszta = budżet - koszt dowódców
  dla typu z udziałem: sztuki = reszta * udział / koszt; n rot = round(sztuki / rozmiar domyślny); rozmiar = sztuki / n (krok 10, 30..300)
  dopełnij: powiększaj roty głównego typu o krok, potem dołóż rotę piechoty
  gdy layoutArmy zgłosi brak miejsca: budżet *= 0.95 i od nowa (do 14 razy)

layoutArmy(strona, a):
  strefa: WK x 30..460, y wokół osi; LH od frontu (przesmyk + 90 albo W - 1040) do W - 340 (z gniazdem) lub W - 110
  odcisk roty: kolumny = max(4, round(sqrt(n * 2.5))), wiersze = ceil(n / kolumny), odstęp max(11, promień * 2.1)
  w klasie z kilkoma rotami: szerokość = (wysokość strefy + 14) / k - 14, kolumny = szerokość / odstęp
  kolumny stref od frontu do tyłu, klasy osobno, rota pod rotą, kolumna wyśrodkowana w osi
  brak miejsca: ponów z odstępem 9.5, potem błąd
```

### 4.17 Elewacja, balistyka, widoczność, kierunek ciosu
```
height[komórka] = suma wzgórz Gaussa (h * exp(-d^2 / (2 sigma^2))), sigma = promień / 2; gniazdo spłaszczone; gradient (różnice centralne)
heightAt(x, y) = interpolacja dwuliniowa

ruch mrówki, bez walki:
  s = gradient(komórka) . kierunek_ruchu
  prędkość *= s > 0 ? max(minUp, 1 / (1 + upK s)) : min(maxDown, 1 - downK s)
  roty: slopeSum += s, slopeN++  ->  zmęczenie marszu *= s_śr > 0 ? 1 + fatUp s_śr : max(0.3, 1 + fatDown s_śr)

strzał(i, j):   # kwas
  jeśli ściana na odcinku (2D): -1
  jeśli bez wzgórz: odległość <= R0 ? 0 : -1
  z0 = h(i) + 4, z1 = h(j) + 2, v2 = g R0
  tg = ballistic(R0, g, d, z1 - z0)    # [niski, stromy] albo null
  dla każdego kąta (niski, potem stromy):
     tor(x) = z0 + x tg - g x^2 (1 + tg^2) / (2 v2), próbkowany co 8 jednostek
     jeśli tor(x) > h(punkt) + 0.5 na całej drodze: zwróć wierzchołek toru
  zwróć -1

widoczność (co 5 kroków), dla strony s:
  dla obserwatora (co czwarta mrówka s), dla wroga e w promieniu 125 (28, gdy e stoi na mchu):
     jeśli linia wzroku 3D czysta (ściany SIGHT, teren powyżej linii oko-oko): widoczny do tick + 6
  widoczny(e, s) = e swoja, albo widziana, albo ujawniona atakiem (3 s)
  rota: seenAt, ostatnia widziana pozycja = środek widocznych mrówek; AI zna rotę 15 s od ostatniego zobaczenia

cios(a -> d):
  kąt = |kąt(kierunek do a) - heading[d]|; mnożnik = kąt <= 60 ? 1 : kąt <= 120 ? flank : rear; a ujawnia się na 3 s
```

### 4.18 Kopiec (etap 5)
```
function moundBuild(world):                     // czysta funkcja world.mound, z pamięcią podręczną
    pasma od środka (norma maksimum, komórki): serce [0, heartHalf), potem dla k = rings-1..0: ściana_k [d, d+wall), pierścień_k [d, d+corridor), na końcu mur zewnętrzny
    dla każdej komórki: d = max(|ox|, |oy|) (ox, oy od środka, połówkowe), strona = N/S/W/E (która oś dominuje)
        wysokość = wysokość pasma (pierścień k -> heights[k], serce -> heights[rings], ściana_k -> heights[k+1], mur -> heights[0])
        ściana_k: jeśli rampa (from = k, strona w sides, |wzdłuż - at| < rampW/2): podłoga o wysokości liniowo od heights[k] do heights[k+1] wzdłuż grubości ściany
                  inaczej ściana (komórka 3)
        mur zewnętrzny: przerwa (podłoga) na stronie W, gdzie |oy - g| < gateW/2 dla wejścia g
    zwróć siatka, wysokości, serce = środek
applyMapType(kopiec): world.mound, world.nest = serce, nestR = captureR, followAnchor = true, spawn LH w sercu
buildGrid(world) = moundBuild(world).grid, wysokości = moundBuild(world).height (zamiast genHeights)
layoutArmy(LH, kopiec) = layoutMoundDefense: dowódcy z gwardią do serca (bloki), potem klasy po pierścieniach:
    odcinki prostych korytarzy z przerwami na rampy i wejścia, twarz = w stronę mniejszej odległości po podłodze od pola startu
    rota (fcols z szerokości korytarza) kolumną wzdłuż korytarza, od końca odcinka bliższego atakującego; nie mieści się -> serce -> błąd
layoutArmy(WK, kopiec) = ten sam układ kolumn co zwykle, w prostokącie mound.staging
retreatPoint(LH) = serce; pole przepływu po prawdziwych korytarzach
```

### 4.19 Walka i morale (etap B)
```
hitNew(a, d, base, kind):                       # kind: melee | acid | burst
  jeśli kind == melee i a >= 0:
    atak = matk[typ a] - fatigueAtk * zmęczenie(a)
    szansa = clamp(hitBase + (atak - mdef[typ d]) * hitPerPoint, hitMin, hitMax) / 100
    jeśli rng >= szansa: return                  # chybiony cios nic nie zadaje
  jeśli kind == burst: przebijające = base, podstawowe = 0
  inaczej: podstawowe = base[typ a], przebijające = ap[typ a]
  k = wariancja * mnożnik kontry * (1 - effDmg * zmęczenie) * mnożnik kierunku ciosu
  redukcja = min(armourCap, pancerz[typ d] * armourScale) / 100
  dmg = (podstawowe * (1 - redukcja) + przebijające) * k
  m = 1 - odporność_rodzaju[typ d]               # wręcz, kwas albo wybuch
  m *= osłona terenu * tarcza * zamknięty szyk (jeśli dotyczy)
  dmg *= max(1 - maxReduction, m)                # dolne ograniczenie łącznej redukcji
  dmg = max(dmg, minDamage)                      # co najmniej 1 HP na trafienie
  hp[d] -= dmg; jeśli hp[d] <= 0: zabij(d)

updateControl(c) co sekundę (spec):
  zagrożenie = walka > 5% lub wróg bliżej niż threatRadius lub obrażenia w ciągu 2 s
  odporność = średnia moraleResistance żywych mrówek; mf = 1 - odporność
  d = regen + dowódca + masa + premia strony
      - mf * (straty + presja walki + brak dowódcy + odcięcie + flanka + ucieczka sąsiada + zmęczenie + brak kapitana)
  morale = clamp(morale + d, 0, 100)
  jeśli nie odwrót i morale <= retreatAt: odwrót = prawda; kolejka rozkazów czyszczona; sąsiedzi w allyRadius dostają karę ally
  jeśli odwrót i spokój >= noThreatSec i morale >= rallyMin: odwrót = fałsz, rozkaz stój
  pasmo = pierwsze q z morale >= bands[q].min; poprawa pasma dopiero o hyst pkt; odwrót => pasmo 4
  tempo ataku = bands[pasmo].cd * (1 + effCd * zmęczenie); prędkość = bands[pasmo].speed * ...
```

### 4.20 Nakładki taktyczne (etap C)
```
fireCheck(rota_strzelców c, rota_celu t):          # próbka: do maxShooters strzelców i maxTargets widocznych mrówek celu
  cele = widoczne dla strony c mrówki t              # niewidoczne nie istnieją dla nakładki
  dla każdego strzelca i: ok(i) = istnieje cel j: shotAt(i, j).apex >= 0   # te same reguły co acquire()/strzał
  frac = |ok| / |strzelcy|; canFire = |ok| > 0 i pula kwasu > 0
  przyczyna = ściana lub teren (jeśli któryś strzelec w zasięgu jest zablokowany), inaczej zasięg; punkt blokady = najbliższa para zablokowana
  poziom = zielony (frac >= 80%) | żółty (>= 50%) | pomarańczowy (> 0) | czerwony (0 lub brak amunicji)

shotAt(x0,y0,x1,y1,R0):  jak shotApex, ale zwraca {apex, why, bx, by}
  bez wzgórz: d > R0 -> range; ściana na odcinku (losBlocker) -> wall
  ze wzgórzami: brak rozwiązania balistyki -> range; ściana -> wall; oba tory (płaski i stromy) kolidują z terenem -> terrain (punkt pierwszej kolizji)

fireAreaAt(x,y,R0): 36 promieni; zasięg promienia = najdalszy punkt ciągłego odcinka, na którym shotAt jest możliwy (próbkowanie co rayStep)
approachPoint(c,t): przecięcie odcinka (kotwica c -> środek t) z obrysem t (otoczka wypukła żywych mrówek), najbliższe c
```

## 5. Uwagi do przeniesienia na C++ lub C#

- **Determinizm:** kolejność pętli jak wyżej, stały krok, jeden generator (mulberry32) z rodzinami strumieni `map`, `spawn`, `combat` (ziarno strumienia = hash tekstu `ziarno:etykieta`). W JavaScript pozycje są `float32` (`Math.fround` po każdej zmianie pozycji), reszta liczy w `double`; przy przenosinach trzeba wybrać jedną precyzję i trzymać ją wszędzie, bo wyniki z `float` i `double` rozjadą się po kilkuset krokach. Test regresji to skrót stanu (pozycje, zdrowie, tick) po N krokach.
- **Układ danych:** SoA jak wyżej, indeksy mrówek stałe. Siatki przestrzenne (`HASH` 8 do celów, 13 do kolizji) odbudowuje się co krok przez sortowanie przez zliczanie; bez alokacji w pętli.
- **Pułapki znalezione w prototypie** (każda ma test): `NaN` w puli kwasu przez zły parametr; dopływ liczony na krok zamiast na sekundę; mrówka lądująca na krawędzi muru po zaokrągleniu do `float32`; przenikanie przez szyk plugu pod naciskiem tłumu (rozwiązane rzutem na poprzednią pozycję); wskaźnik zaangażowania liczony na krok, a nie na sekundę; plug obracany za wrogiem.
- **Wydajność:** krok z ok. 2000 mrówek to kilka ms w JavaScript. Najdroższe są kolizje i wypatrywanie celów; oba są liniowe względem liczby mrówek dzięki siatkom. Wypatrywanie jest rozłożone w czasie (`(tick + i) % 4`, `% 8`, `% 16`).
- **Dane:** definicje jednostek, kontr i scenariusza są w JSON; przenosi się je bez zmian. Elita jest wyprowadzana z typu bazowego w czasie ładowania, więc zmiana statystyk bazowych (suwakiem) przelicza gwardię.
- **Prezentacja** (izometria, sprite'y, panele) jest oddzielona i tylko czyta stan; do przeniesienia zostaje rzut `(x, y) -> ekran` i kolejność rysowania.
