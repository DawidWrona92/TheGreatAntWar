# Projekt 2: graf powierzchni, ruch i walka mrówek na wielu powierzchniach

Status: **propozycja do zatwierdzenia, bez zmian w kodzie.** Zastępuje `projekt-wielopaszczyznowy.md` (model jednej powierzchni, odrzucony jako zbyt zachowawczy; plik zostaje jako zapis decyzji). Praca w V2 (`p1-bitwa-v2.html`), V1 i gałąź `p1-v1-backup` bez zmian, bezpiecznik `params.surfaces.on` domyślnie wyłączony.

Legenda: **[K]** potwierdzone w kodzie, **[P]** pomiar skryptem tylko do odczytu (poza repozytorium, ziarno 1, armie z listy), **[Z]** założenie projektowe, **[H]** hipoteza do sprawdzenia, **[W]** wartość wstępna do balansu (nie dane z gry, bez uzasadnienia w źródłach).

## 1. Cel i kryterium sukcesu
Mechanika ma być pełnoprawna: mrówki chodzą po ziemi oraz po górnych i bocznych powierzchniach skał, korzeni, pni (a później łodyg i gałęzi), przechodzą między połączonymi powierzchniami, walczą na tej samej powierzchni, na sąsiedniej i na innym poziomie, flankują i zajmują stanowiska. Kryterium sukcesu to nowe możliwości taktyczne i różnorodność bitew, nie krótsze trasy. Dotychczasowe pomiary tras (sekcja 2) zostają punktem odniesienia: pokazują, że sama wspinaczka „dla skrótu” nic nie daje, więc wartość musi pochodzić z walki, widoczności i zajmowania stanowisk.

## 2. Co potwierdza kod i pomiary
**[K] Kod (V1, rdzeń linie 434-2444):**
- Siatka 16 jedn., kody komórek: 0 podłoga, 1 kłoda/pień, 2 mech, 3 ziemia gniazda i ściany kopca, 4 kamień, 5 korzeń, 6 podszyt, 7 woda, 8 bród. Przeszkody nie mają wysokości w symulacji (rysowane: kłoda 16, kamień 14, korzeń 6, podszyt 12-14, ziemia 8); ściana blokuje ruch i promień niezależnie od wysokości.
- Wysokość terenu to osobne pole (wzgórza, tarasy kopca): prędkość, balistyka (`shotAt`, dwa tory), widoczność 3D; ściany bez z.
- Mrówka: tablice SoA (x, y, vx, vy, hp...), brak z, węzła, klasy ruchu. Zero trafień wspin/climb/layer.
- Ruch mrówki: kierowanie do celu (slot, cel ataku), całkowanie, `blocked(nx, ny)` ze ślizganiem; gdy slot za ścianą, ruch po polu przepływu do kotwicy (`afield`). Pole `buildField`: BFS po 8 sąsiadach z kosztami 10/14 i karą przy ścianach, klucz = komórka celu, pamięć 80 pól. Użycia: `blocked(` 23, `moveClear(` 7, `getField(` 10, `flowDir(` 5.
- Kolizje ciał i siatki przestrzenne 2D; `bodyAhead` (czekanie tylnego szeregu) 2D; `acquire` 2D; zasięg wręcz 2D.
- Miejsca, które czytają komórkę lub 2D pod pozycją mrówki: osłona mchu w obrażeniach (2 miejsca), zasięg widzenia mchu, nachylenie `slopeAt`, indeks pola `afield[cellAt]`, aura dowódcy i tarcze odźwiernych (odległość 2D), `bodyAhead`.
- Rysowanie: `ISO.sx/sy(x, y)` z wysokością terenu, jeden sprite terenu pod mrówkami, atlas 8 kierunków wg `heading`; `pickAt`, `selectIn`, `hullScreen`, trasy i wszystkie nakładki etapu C liczą pozycję ekranową bez z przeszkód.
- Jednostki (masa): biegacz 0,7 (tylko WK), plujka 0,9 (tylko LH), infantry 1, pękacz 1,2, ciężki 2,5, dowódca 3, taran 5, odźwierny 6. Roty są jednorodne poza rotami dowódcy (`{ "@guard": 50, "dowodca": 1 }`).
- AI (`aiStep`): `raider` (biegacze) ściga rotę z kwasem, obrońca kontratakuje rotę bliżej niż 260 w linii prostej, `reachable`/`routeOf` z pól przepływu.

**[P] Pomiary odniesienia (trasy po siatce, Dijkstra, przeszkody przechodnie z kosztem x2):** trasa do gniazda: średnio 1,00 / 0,98 / 0,91 / 0,91 długości po ziemi (mapy 2-5), skrócenie ≥25% w 0-1% startów. Dojście biegaczy WK do plujek LH: mapa 4 82%, mapa 5 84%, mapy 1-3 bez zmian. Mapa 3 przy zamkniętym przesmyku: o 17-58% krótsza. Kopiec: gdyby ziemia gniazda była przechodnia, trasa do serca 0,60 (koszt x3) i 0,72 (x6) długości po ziemi, więc ściany kopca muszą zostać niewspinalne.

**[P] Nowe: obiekty na mapach** (składowe spójne komórek przeszkód, bez krawędzi mapy). Liczba węzłów powierzchni (góra komórki plus odsłonięte ściany), gdyby wszystko było wspinalne: mapa 2: 309 (3% siatki), mapa 3: 953 (10%), mapa 4: 3780 (26% z 14344), mapa 5: 6445 (36% z 17672). Mediana mniejszego wymiaru obiektu to 3-8 komórek (48-128 jedn.). Mapa 4: 15 kłód, 15 kamieni, 6 korzeni, 31 obiektów podszytu; mapa 5: 28 kłód, 12 kamieni, 11 korzeni, 39 podszytu. Wniosek: graf jest mały względem siatki, a górne powierzchnie mieszczą szyk kilku mrówek w szeregu, nie całą rotę w linii.

## 3. Reprezentacja: graf powierzchni z komórek-kolumn
**[Z]** Z istniejącej siatki wyprowadzam graf, bez ręcznych siatek 3D.
- **Obiekt** (prop) = składowa spójna komórek tego samego materiału, z flagą `surface` (wspinalny, wysokość, materiał) nadawaną w mapie (JSON/generator), nie automatycznie wszystkim przeszkodom.
- **Kolumna:** każda komórka wspinalnego obiektu to kolumna o wysokości h.
- **Węzły:** GÓRA kolumny (1 na komórkę) i ŚCIANA kolumny (1 na odsłoniętą krawędź; dla h > 16 po jednym na pasmo 16). Węzły podłogi to istniejące komórki (id 0..N-1), węzły powierzchni mają id N..N+M-1.
- **Krawędzie:** ściana-podłoga (podstawa), ściana-góra (krawędź górna), ściana-ściana wzdłuż obwodu (narożniki wypukłe i wklęsłe), góra-góra (sąsiednie kolumny, krok wysokości), opcjonalnie skok przez szczelinę ≤ 1 komórka (późniejszy etap).
- **Węzeł** zawiera: materiał, klasę nachylenia (góra, stroma, pionowa, później nawis), pozycję 3D środka, lokalną bazę ruchu (góra: x, y; ściana: wzdłuż krawędzi i pionowo), **podstawę z0 i szczyt z1** (od S0, żeby późniejsze gałęzie, czyli dwie powierzchnie w jednym xy z ziemią pod spodem, nie wymagały przebudowy; w S0-S6 z0 jest zawsze wysokością terenu).
- **Mrówka** dostaje `node[i]` (id węzła), `az[i]` (z), `climbT[i]` (czas przejścia). Jej xy pozostaje w siatkach 2D (hash, kolizje); na ścianie xy leży tuż za krawędzią kolumny (o promień ciała), więc nie wchodzi w komórkę blokującą.
- **Pole przepływu:** klucz (węzeł celu, klasa zdolności), Dijkstra po grafie N+M ze zmiennymi kosztami krawędzi (dziś BFS), klasy deduplikowane po wektorze zdolności (ok. 3-4 różne pola, nie jedno na typ).

**Uproszczenia, o których trzeba wiedzieć:**
- Nachylenie wynika z materiału (kłoda i korzeń: ściany „strome”, bo obłe; kamień: „pionowe”), nie z geometrii: ściany komórek zawsze są pionowe.
- Kształty są blokowe (schodki z 16-jednostkowych komórek).
- Do S7 nie ma nawisów ani dwóch powierzchni w jednym xy; kolumny sięgają ziemi.
- Na powierzchniach roty poruszają się kolumną (ślad kotwicy z decyzji 70), nie w pełnym szyku.

## 4. Kategorie powierzchni i zdolności jednostek (konfiguracja w JSON)
Zamiast `climb.on`: **profil lokomocji** jednostki i **profil materiału** powierzchni. Ruch dozwolony, gdy `grip >= needGrip(klasa nachylenia)` i `masa <= supportMass(materiał)`; niski obiekt o wysokości ≤ `stepH` jednostki jest do pokonania jak stopień.

| Materiał (obiekt) | wys. h | ściana | needGrip góra / ściana | supportMass | Uwagi |
|---|---|---|---|---|---|
| Kora (kłoda, pień) | 16 | stroma | 0 / 0,4 | 3 | [W] |
| Kamień | 14 | pionowa | 0 / 0,8 | 6 | [W] |
| Korzeń | 6 | niska stroma | 0 / 0,2 lub stopień | 3 | [W] |
| Łodyga, gałąź (nowe obiekty, S7) | 10-24 | stroma / pionowa | 0 / 0,4-0,8 | 1 / 1,5 | wymaga rysunku i treści map |
| Podszyt jako obszar (komórki 6), ziemia gniazda, woda, krawędź mapy | n/d | niewspinalne | | | decyzja użytkownika |

Wysokości biorę z rysunku [K] (jedno źródło prawdy dla renderera i symulacji).

| Jednostka | grip | stepH | Co może | Uzasadnienie |
|---|---|---|---|---|
| Biegacz | 0,9 | 6 | wszystko, w tym pionowy kamień | najlżejszy, rola flankująca |
| Wojownik | 0,55 | 6 | góry i stromizny (kłody, korzenie), nie pionowy kamień | masa armii; ograniczenie szerokością powierzchni i kosztem |
| Plujka | 0,6 | 6 | jak wojownik | lekka, ale wrażliwa; patrz ryzyka |
| Pękacz | 0,45 | 6 | jak wojownik, wolniej | ładunek |
| Ciężki | 0,25 | 6 | ziemia i niskie przeszkody (korzenie jako stopień) | masa 2,5 |
| Dowódca | 0,3 | 6 | ziemia i niskie przeszkody | musi trzymać aurę (patrz rot mieszane) |
| Taran, odźwierny | 0-0,1 | 0 | tylko ziemia | masa 5-6, rola utrzymania ziemi |
Szybkość na powierzchni: mnożnik na klasę nachylenia (np. biegacz 0,85 / 0,75 / 0,6, wojownik 0,7 / 0,4 / -) [W]; punkt odniesienia: mnożnik rampy kopca w grze ok. 0,68 [K]. Zmęczenie jak szybki ruch (x2,5) [W]. Elita dziedziczy po typie bazowym [K].

**Wpływ na armie [H]:** wojownicy i plujki to większość masy obu armii; dopuszczenie ich na kłody i korzenie (zgodnie z trzema poziomami z Twojego opisu) wymaga jawnego ograniczenia liczby wspinalnych obiektów (sekcja 11, S1).

### Roty mieszane
| Opcja | Skutek |
|---|---|
| 1. Klasa = przecięcie (wszyscy muszą) | prosta, ale rota dowódcy i każda mieszana nigdy nie korzysta z mechaniki (odrzucona przez Ciebie) |
| 2. **Klasa na mrówkę, kotwica wg reguły (zalecana)** | każda mrówka idzie polem swojej klasy do slotu; mniej zdolne obchodzą po ziemi, bardziej zdolne skracają drogę. Kotwica: rota z dowódcą używa klasy dowódcy (aura!), inaczej klasa większości (≥ 75% żywych mrówek, próg w JSON, [W]), w przeciwnym razie ziemia. Skutek: szyk się rozciąga, zdolni czekają na slotach, kohezja spowalnia kotwicę |
| 3. Podział roty na oddziały | nowa mechanika (dowodzenie, interfejs), poza zakresem |
Rota dowódcy `{ gwardia, dowódca }` więc idzie klasą dowódcy (ziemia), a gwardia zdolna wspinać się może skracać drogę do slotów. **[H]** wymaga testu zachowania (rozciąganie szyku).

## 5. Ruch i sterowanie
- **Przejścia:** podłoga ↔ ściana: czas = max(minSec, wysokość / prędkość pionowa) [W]; w trakcie przejścia mrówka stoi, nie atakuje, ma obniżoną obronę wręcz (wartości [W]); ściana ↔ góra: krawędź górna (to samo). Wejście na powierzchnię wymaga trasy pola klasy przez dany węzeł.
- **Ruch po powierzchni:** w bazie lokalnej węzła, z prędkością klasy nachylenia; przejście do sąsiedniego węzła wg grafu; z z węzła (na ścianie liczone po wysokości w paśmie).
- **Odwrót:** rota w odwrocie zachowuje pole klasy (nie wymuszamy zejścia pod ogień).
- **Tryby roty (sterowanie gracza):** Ziemia (tylko podłoga), **Auto** (domyślny: koszt = czas + zmęczenie + stała ekspozycja powierzchni x1,25 [W]; wspinaczka nie wygrywa tylko dlatego, że jest krótsza) i Wspinaczka (preferuj powierzchnie: mnożnik kosztu powierzchni 0,6 [W]). Przełącznik trybu (klawisz i przycisk w pasku rozkazów, jedna kontrolka na zaznaczone roty) oraz **rozkaz ruchu na powierzchnię** (PPM na górze lub ścianie obiektu; gdy klasa nie pozwala, czerwony krzyżyk jak przy braku drogi). Nakładka „powierzchnie” (panel nakładek) podświetla węzły dostępne dla zaznaczonych rot. Dynamiczne „zagrożenie” (zasięg wrogich plujek) w trasie to późniejsza rozbudowa; w v1 tylko stała ekspozycja.
- **Orientacja:** rysowanie z z, kierunek sprite z wektora ekranowego, mrówki na ścianach odwróconych od kamery rysowane z przezroczystością (kompromis wizualny).

## 6. Walka na powierzchniach
Wszystkie reguły niżej obowiązują **tylko gdy co najmniej jedna z mrówek jest na węźle powierzchni lub w trakcie przejścia**. Gdy obie są na ziemi, działa dotychczasowy kod V1 bez zmian (wręcz, `bodyAhead`, kolizje, zasięg, osłona).
- **Wręcz:** cios możliwy, gdy węzły są te same lub sąsiednie w grafie (jedna krawędź) i odległość 3D ≤ reach + promienie [K: wzór etapu B]. Sąsiedztwo wystarcza, bo największy zasięg to ok. 15 jedn. (taran: 2,5 + 6,2 + 6,2) przy węzłach 16-jednostkowych [K]. Nie ma stałego progu wysokości: mrówka na wysokości 10 nad podstawą ściany nie sięga mrówki stojącej na ziemi, mrówka na krawędzi górnej sięga mrówki tuż pod krawędzią, na tej samej powierzchni walka jest zwykła. Węzły oddzielone kolumną nie są sąsiednie, więc nie ma ciosów przez przeszkody.
- **Modyfikatory na stromych i pionowych powierzchniach (cling):** atak i obrona obniżone, brak umiejętności [W].
- **Namierzanie:** kandydaci z siatki 2D przefiltrowani adiacencją i 3D; rota wręcz nie goni celu bez drogi (`reachable` według klasy).
- **Dystansowa (kwas):** z i tor 3D z węzłów, przeszkoda blokuje promień, gdy kolumna jest wyższa niż promień w danym punkcie; **łuk kwasu może przejść nad niską przeszkodą** (szczyt toru przy 45° i R0=120 to ok. 30 [K: wzór balistyki], a kłoda ma 16). Plama i wybuch: odległość 3D plus brak solidu na odcinku do trafionej mrówki.
- **Szew [H, decyzja świadoma]:** pociski ziemia→ziemia nadal blokuje ściana jak w V1, więc plujka z ziemi może strzelić ponad kłodą w cel na kłodzie, ale nie w cel na ziemi za tą samą kłodą. To widoczna niespójność; do ewentualnego ujednolicenia osobną decyzją.
- **Opcjonalnie (poza v1):** zrzucenie ze ściany przy dużym obrażeniu jednym ciosem (spadek na podstawę, obrażenia zależne od wysokości).

## 7. Wykrywanie i widoczność
- Ziemia-ziemia: reguły V1 bez zmian [wymaganie].
- Gdy którykolwiek koniec promienia jest na węźle powierzchni (góra, ściana, w trakcie przejścia), widoczność jest **przestrzenna**: próbkowanie promienia co 6 jedn. w 3D, komórka-kolumna blokuje, gdy jej wysokość jest powyżej promienia w tym punkcie; teren jak w `sightClear3`. Mrówka na ścianie stoi tuż za krawędzią kolumny (poza jej obrysem), więc własna kolumna nie blokuje jej od zewnątrz; mrówka na odwrotnej ścianie jest zasłonięta własną kolumną i **niewidoczna z drugiej strony** (zaskoczenie, unikanie zagrożeń).
- Mech: osłona mchu dotyczy tylko mrówek na ziemi (bramka `node < N`), nie mrówek na ścianach nad komórką mchu.
- Obserwatorzy strony próbkowani co 4 mrówki obejmują mrówki na powierzchniach (widzą dalej i ponad niskimi przeszkodami).
- Nakładki etapu C (`shotAt`, `fireCheck`, `fireArea`) używają tych samych reguł; nic nie ujawnia ukrytych celów.

## 8. AI
- Te same pola klasy i koszty co gracz w trybie Auto; AI nie dostaje osobnych rozkazów „wspinaj się”.
- Tryb roty AI według roli: `raider` Wspinaczka przy celu dystansowym, `assault` Auto, ciężkie, taran i odźwierni Ziemia (nie mają zdolności), dowódca Ziemia.
- Obrona: kontratak liczony po drodze pola klasy (nie w linii prostej) i adiacencji; `reachable` według klasy; plujki biorą wspinaczy na cel przez `acquire`.
- Odłożone osobną decyzją: AI zajmujące stanowiska na kłodach (plujki), dynamiczne zagrożenie w kosztach.

## 9. Przykłady, których nie da się zrobić w typowym RTS na płaskiej mapie
1. **Wejście od odwrotnej strony:** biegacze wspinają się po pionowej ścianie kamienia osłoniętej własną bryłą (niewidoczni dla plujek po drugiej stronie), pojawiają się na krawędzi górnej 30 jedn. za linią i schodzą na plujki.
2. **Walka na kłodzie:** wąska kłoda (2-4 komórki) staje się mostem: wojownicy wchodzą stromą ścianą i walczą kolumną, plujki obrońców strzelają łukiem w cel na kłodzie ponad kłodą; ciężcy stoją na ziemi u podstawy i nie sięgają walczących na górze.
3. **Zasadzka na ścianie:** mrówki zawieszone nisko na ścianie kamienia (z ≤ kilka jedn.) bije kolumnę marszu na ziemi w bok; kolumna nie może oddać ciosu bez drogi na ścianę.
4. **Odwrót ponad przeszkodą:** biegacze uciekają przez kamień, gdzie ciężka pogoń nie wejdzie; plujki mogą dokończyć dzieła.
5. **Obrona przez zajęcie powierzchni:** obrońcy na grzbiecie korzenia mają widok nad niskimi przeszkodami i łuk kwasu na ścianę poniżej, atakujący muszą wejść w jego kolumnę.
6. **Później (S7):** gałąź nad korytarzem: dwa poziomy jednej bitwy, ziemia pod spodem i gałąź nad nią.

## 10. Wpływ na systemy i wydajność (osobno)
| Obszar | Wpływ |
|---|---|
| Nawigacja | klasa ruchu, graf N+M, Dijkstra, dedup klas, `blocked/moveClear/nearestOpen/getField/flowDir` świadome klasy i węzła; budżet czasu budowy pola do zmierzenia w S1 |
| Ruch mrówki | osobna ścieżka dla `node >= N` w `updateAnts` (baza lokalna, przejścia, z); zmiana gorącej pętli |
| Kolizje i `bodyAhead` | odległość 3D tylko gdy któraś mrówka jest na powierzchni; w przeciwnym razie V1 |
| Walka | reguły z sekcji 6 tylko dla par z powierzchnią; ground-ground V1 |
| Widoczność | tryb przestrzenny tylko dla promieni z końcem na powierzchni |
| AI | tryb roty z roli, `reachable` według klasy |
| Interfejs i render | `ISO.sx/sy` i wszystko, co z nich korzysta (`pickAt`, `selectIn`, `hullScreen`, trasy, nakładki etapu C) dostają z; przełącznik trybu; nakładka powierzchni |
| Wydajność [H] | V1 mediana kroku 14-16 ms przy ok. 4000 mrówkach, budżet 50 ms [K]; pamięć pól do N+M ≤ ok. 24 tys. węzłów x 4 B x do 80 pól (mapa 5 w najgorszym razie); narzut wspinaczy nieznany, mierzony w S2 (cel: do +25% kroku przy ok. 30% mrówek na powierzchniach [W]) |

## 11. Plan w małych etapach (po każdym raport i zgoda)
Najpierw **pionowy wycinek S0-S2 na syntetycznej mapie testowej (jedna kłoda, jeden kamień)**, bez generatorów; tam rozstrzyga się wykonalność gorącej pętli. Po wycinku decyzja użytkownika.
- **S0 kompilacja grafu** z siatki (bez zmiany zachowania), narzędzie podglądu. Testy: krawędzie symetryczne, każda ściana ma podstawę i krawędź górną, liczba węzłów zgodna ze wzorem, deterministyczna kompilacja, skrót typu 3 na V2 identyczny z flagą wyłączoną **i z flagą włączoną bez wspinaczy**.
- **S1 zdolności i pola klasy** (mrówki jeszcze po ziemi): `routeOf` po grafie. Testy: biegacz po pionowym kamieniu, wojownik po kłodzie, nie po kamieniu, ciężki przez korzeń jako stopień, tryb Ziemia ignoruje powierzchnie, dedup klas, budżet czasu pola. **Bramka danych:** narzędzie tras (Dijkstra, jak w sekcji 2) dobiera frakcję wspinalnych obiektów tak, żeby zachować charakter map (labirynt map 3-5), zanim ruszy S2.
- **S2 ruch mrówek** po powierzchniach (węzeł, baza lokalna, przejścia, z, kolizje 3D, rysowanie, rota dowódcy). Testy: czasy wspinaczki, brak mrówek wewnątrz komórek blokujących, ciągłość z, zmęczenie, odwrót z przeszkody, determinizm, **wydajność z włączoną funkcją (4000 mrówek, część na powierzchniach) vs wyłączona**.
- **S3 widoczność i dystansowa** (przestrzenna): testy: **własność: dla losowych par, jeśli silnik pokazuje widoczność lub zadaje trafienie, istnieje wolny 3D odcinek**, krok na podstawę ściany niczego nie ujawnia przez bryłę, bramka mchu, `shotAt` zgodny z `fireCheck`/nakładkami.
- **S4 wręcz i obszarowe:** adiacencja, zasięg 3D, modyfikatory cling; testy: **własność: dozwolony cios implikuje wolny odcinek 3D (to samo dla plamy kwasu i wybuchu)**, ground-ground identyczny z V1.
- **S5 sterowanie i nakładki:** tryby roty, rozkaz na powierzchnię, picking z z, nakładka powierzchni.
- **S6 AI:** tryby z ról, `reachable` według klasy, kontratak po drodze klasy.
- **S7 treść map:** flagi `surface` w obiektach, generatory (frakcja wspinalnych, oznaczenie wizualne), nowe obiekty (łodyga, gałąź z z0 > 0, skoki przez szczeliny), obsługa dwóch poziomów w jednym xy.
- **S8 balans i wydajność:** AI-AI na mapach 2-5 z i bez funkcji, metryki: odsetek rot na powierzchniach, straty, czas do gniazda, charakter map; dopiero potem decyzja o włączeniu domyślnym.

## 12. Konsultacja z advisorem
Odbyła się dwukrotnie (advisor był dostępny). Przy pierwszym projekcie (jedna powierzchnia) advisor zalecił model jednowarstwowy, który odrzuciłeś; po rozszerzeniu uznał, że **graf z komórek-kolumn jest właściwym kierunkiem** (wykorzystuje siatkę, pola przepływu i hash 2D) i że pierwotne zalecenie nie ma już zastosowania. Uwagi do szkicu grafu i moja ocena:
- **Przyjęte:** reguły ziemia-ziemia (wręcz, kolizje, `bodyAhead`) bez zmian, nowe tylko dla par z powierzchnią (dodane w sekcjach 6, 10); lista miejsc czytających komórkę pod mrówką (mech, nachylenie, aura, tarcze) bramkowana `node < N` (sekcja 2); rota z dowódcą używa klasy dowódcy (sekcja 4); Dijkstra, dedup klas i budżet czasu pola; z0/z1 w strukturze węzła od S0 i jawna informacja, że gałęzie to S7; uproszczenia nazwane wprost (nachylenie z materiału, bloki, szew w balistyce, kolumna zamiast szyku, koszt renderowania); obowiązkowa bramka danych dla frakcji wspinalnych obiektów w S1; odroczenie AI zajmującego stanowiska i dynamicznego zagrożenia; testy własności (cios i widoczność implikują wolny odcinek), flaga włączona bez wspinaczy = skrót V1, pomiar wydajności w S2; pionowy wycinek S0-S2 przed generatorami.
- **Różnice zdań:** brak istotnych. Zaznaczam, że szew w balistyce (ziemia→ziemia blokuje ściana, cel na powierzchni jest osiągalny łukiem) zostawiam jako świadomy kompromis do Twojej decyzji, a nie ujednolicam z własnej inicjatywy.
- Advisor nie widział implementacji (jej nie ma); ocena dotyczy projektu.

## 13. Decyzje do podjęcia
1. **Piechota na kłodach i korzeniach** (wojownicy i plujki jako drugi poziom): tak (zalecam, zgodnie z opisem trzech poziomów, ale z bramką danych w S1) czy tylko biegacze na ścianach, reszta niskie przeszkody?
2. **Frakcja wspinalnych obiektów** i oznaczanie (generator z `climbChance`, flaga w mapie, wizualne oznaczenie): akceptujesz podejście per obiekt, z nakładką „powierzchnie”?
3. **Rot mieszane:** opcja 2 (zalecana) z regułą dowódcy i progiem 75%?
4. **Sterowanie:** trzy tryby (Ziemia, Auto, Wspinaczka) plus rozkaz na powierzchnię, bez dalszej rozbudowy interfejsu?
5. **Szew w balistyce** (łuk ponad niską przeszkodą tylko, gdy któryś koniec jest na powierzchni): akceptujesz w v1?
6. **Wizualny kompromis** dla ścian odwróconych od kamery (przezroczystość) oraz brak pełnego szyku na powierzchniach?
7. **Plan:** zgoda na pionowy wycinek S0-S2 na syntetycznej mapie, z raportem po nim?
