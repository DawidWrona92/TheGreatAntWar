# Projekt: graf powierzchni, ruch i walka mrówek na wielu powierzchniach (wersja 3, po decyzjach użytkownika)

Status: **zaktualizowany projekt i plan do zatwierdzenia, bez zmian w kodzie.** Zastępuje wcześniejsze wersje (`projekt-wielopaszczyznowy.md`, model jednej powierzchni, odrzucony; poprzednia wersja tego pliku, graf powierzchni przed decyzjami, jest w historii git). Praca w V2 (`p1-bitwa-v2.html`), V1 i gałąź `p1-v1-backup` bez zmian. Mechanika za bezpiecznikiem `params.surfaces.on`, domyślnie wyłączona; obrót kamery za `ui.camera.rotate`, domyślnie wyłączony do zakończenia testów.

Legenda: **[K]** potwierdzone w kodzie lub danych, **[P]** pomiar skryptem tylko do odczytu (poza repozytorium), **[Z]** założenie projektowe, **[H]** hipoteza do sprawdzenia, **[W]** wartość wstępna do balansu (nie dane z gry).

## 0. Co się zmieniło po Twoich decyzjach
1. **Wojownicy lekki i ciężki już istnieją w danych [K]** (patrz 4.1): to `infantry` („Wojownik”) i `ciezki` („Wojownik ciężki”). Nie tworzę nowego typu; rozdzielenie polega na przypisaniu im różnych profili lokomocji. Lekki wojownik dostaje profil identyczny z biegaczem (ten sam nazwany profil w JSON).
2. **Profile lokomocji nazwane w JSON** (nie `climb.on`), tworzone od S0.
3. **Rot mieszane:** opcja 2, kotwica po klasie dowódcy lub 75% (parametr wstępny), z listą testów w S2 i zasadą: problemy zgłaszam z przyczyną i opcjami, nie zmieniam zasad sam.
4. **Obrót kamery** jest pełnoprawnym elementem: analiza w sekcji 9, wczesny spike K0 przed S0, pełna wersja K1 po S2.
5. **Rozdzielenie logiki widoczności od rysowania** jest zasadą projektową (sekcja 7).
6. **Plan:** K0, S0, S1, S2, potem stop (raport i wersja do testów manualnych).

## 1. Cel i kryterium sukcesu
Rzeczywista walka wielopłaszczyznowa: mrówki chodzą po ziemi oraz po górnych i bocznych powierzchniach skał, korzeni, pni (później łodyg i gałęzi), przechodzą między połączonymi powierzchniami, walczą na tej samej powierzchni, na sąsiedniej i na innym poziomie, flankują i zajmują stanowiska. Miarą jest nowa taktyka i różnorodność bitew, nie krótsze trasy. Pomiary tras (sekcja 2) zostają punktem odniesienia: sama wspinaczka „dla skrótu” nic nie daje (0-9% skrócenia trasy do gniazda), więc wartość pochodzi z walki, widoczności i zajmowania stanowisk.

## 2. Co potwierdza kod i pomiary
**[K] Mapa i symulacja (V1, rdzeń linie 434-2444).**
- Siatka 16 jedn.; kody: 0 podłoga, 1 kłoda/pień, 2 mech, 3 ziemia gniazda i ściany kopca, 4 kamień, 5 korzeń, 6 podszyt, 7 woda, 8 bród. Przeszkody nie mają wysokości w symulacji (rysowane: kłoda 16, kamień 14, korzeń 6, podszyt 12-14, ziemia 8); ściana blokuje ruch i promień niezależnie od wysokości.
- Wysokość terenu to osobne pole (wzgórza, tarasy kopca): prędkość, balistyka (`shotAt`, dwa tory), widoczność 3D; ściany bez z.
- Mrówka: tablice SoA (x, y, vx, vy, hp...), brak z, węzła, klasy ruchu; w kodzie zero trafień wspin/climb/layer.
- Ruch: każda mrówka kieruje się do celu (slot, cel ataku), całkuje i sprawdza `blocked(nx, ny)` ze ślizganiem; gdy slot za ścianą, idzie po polu przepływu do kotwicy (`afield`). `buildField`: BFS po 8 sąsiadach (koszty 10/14, kara przy ścianach), klucz = komórka celu, pamięć 80 pól. Użycia: `blocked(` 23, `moveClear(` 7, `getField(` 10, `flowDir(` 5.
- Kolizje ciał, siatki przestrzenne, `bodyAhead` (czekanie tylnego szeregu), `acquire`, zasięg wręcz: wszystko 2D.
- Miejsca czytające komórkę lub odległość 2D pod pozycją mrówki: osłona mchu w obrażeniach (2 miejsca), zasięg widzenia mchu, nachylenie `slopeAt`, `afield[cellAt]`, aura dowódcy i tarcze odźwiernych, `bodyAhead`.
- AI (`aiStep`): `raider` (biegacze) ściga rotę z kwasem, obrońca kontratakuje rotę bliżej niż 260 w linii prostej; `reachable`/`routeOf` z pól przepływu.
- Roty są jednorodne poza rotami dowódcy (`{ "@guard": 50, "dowodca": 1 }`).

**[K] Renderowanie (potrzebne do kamery).**
- Cała projekcja jest w jednym obiekcie `ISO` (`sx`, `sy`, `inv`, `rx`, `ry`, `size`, `hf`). W części interfejsu: 36 użyć `ISO.sx(`, 36 `ISO.sy(`, 1 `ISO.inv(`, 8+8 `ISO.rx/ry(`, 13 `toWorld/toContainer`, 54 użycia `cam.` (przesuw i zoom w przestrzeni ekranu).
- **Teren to jedna rysowana raz tekstura** (canvas rysowany od tyłu do przodu po antyprzekątnych `r+kolumna`, pocięty na kafle 2048): rozmiar 3248x1672 (21,7 MB RGBA, mapa 1) i 4548x2364 (43 MB, mapa 5). Ściany i skały to rysowane „pudełka” w tej teksturze. Orientacja jest zaszyta w kolejności rysowania i położeniu kafli.
- Mrówki to atlas 8 kierunków (`DIRS`), kierunek `((round(heading*K)) mod DIRS)`; wszystkie sprite'y rysowane nad teksturą terenu (nie ma sortowania głębi między mrówkami a bryłami).
- Wykrywanie wroga (`seenByMe`) jest osobno od rysowania: rysowanie tylko konsumuje wynik widoczności z symulacji.

**[P] Pomiary odniesienia (trasy po siatce, Dijkstra, przeszkody przechodnie z kosztem x2):** trasa do gniazda: średnio 1,00 / 0,98 / 0,91 / 0,91 długości po ziemi (mapy 2-5), skrócenie ≥25% w 0-1% startów. Dojście biegaczy WK do plujek LH: mapa 4 82%, mapa 5 84%, mapy 1-3 bez zmian. Mapa 3 przy zamkniętym przesmyku: o 17-58% krótsza. Kopiec: gdyby ziemia gniazda była przechodnia, trasa do serca 0,60 (koszt x3) i 0,72 (x6) długości po ziemi, więc ściany kopca muszą zostać niewspinalne.

**[P] Obiekty na mapach** (składowe spójne komórek przeszkód, bez krawędzi mapy). Węzły powierzchni (góra komórki plus odsłonięte ściany), gdyby wszystko było wspinalne: mapa 2: 309 (3% siatki), mapa 3: 953 (10%), mapa 4: 3780 (26% z 14344), mapa 5: 6445 (36% z 17672). Mediana mniejszego wymiaru obiektu: 3-8 komórek (48-128 jedn.). Mapa 4: 15 kłód, 15 kamieni, 6 korzeni, 31 obiektów podszytu; mapa 5: 28 kłód, 12 kamieni, 11 korzeni, 39 podszytu.

## 3. Reprezentacja: graf powierzchni z komórek-kolumn
**[Z]** Z istniejącej siatki wyprowadzam graf, bez ręcznych siatek 3D.
- **Obiekt** = składowa spójna komórek jednego materiału, z jawną flagą `surface` (wspinalny, wysokość, materiał, ograniczenia) nadawaną per obiekt w mapie (JSON/generator), nie automatycznie wszystkim przeszkodom; ściany kopca, woda, krawędź mapy i podszyt jako obszar mają `surface: none`.
- **Kolumna:** każda komórka wspinalnego obiektu to kolumna o wysokości h (tabela materiałów w JSON, ta sama dla rysowania i symulacji).
- **Węzły:** GÓRA kolumny (1 na komórkę) i ŚCIANA kolumny (1 na odsłoniętą krawędź; dla h > 16 po jednym na pasmo 16). Węzły podłogi to istniejące komórki (id 0..N-1), węzły powierzchni N..N+M-1.
- **Krawędzie:** ściana-podłoga, ściana-góra, ściana-ściana wzdłuż obwodu (narożniki), góra-góra (krok wysokości), później skok przez szczelinę ≤ 1 komórka.
- **Węzeł:** materiał, klasa nachylenia (góra, stroma, pionowa; nawis w S7), pozycja 3D, baza lokalna ruchu, **z0 i z1** (od S0; w S0-S6 z0 = wysokość terenu; gałęzie z z0 > 0 to S7).
- **Mrówka:** `node[i]`, `az[i]`, `climbT[i]`; xy zostaje w siatkach 2D (na ścianie tuż za krawędzią kolumny, o promień ciała).
- **Pole przepływu:** klucz (węzeł celu, klasa zdolności), relaksacja z kolejką (jak dziś w `buildField`, który już liczy zmienne koszty 10/14 i kary; rozszerzona o węzły powierzchni), klasy deduplikowane po wektorze zdolności (wspinacz i lekki wojownik mają ten sam wektor, więc dzielą pola).

**Uproszczenia:** nachylenie wynika z materiału (kłoda i korzeń: strome, bo obłe; kamień: pionowe), nie z geometrii; kształty blokowe (schodki); do S7 brak nawisów i drugiej powierzchni nad ziemią; na wąskich powierzchniach roty idą kolumną (ślad kotwicy, decyzja 70), nie w pełnym szyku.

## 4. Jednostki, profile lokomocji i materiały
### 4.1 Wojownicy lekki i ciężki: stan obecny
Rozdzielenie **już istnieje w danych [K]**; sprawdziłem parametry, role i występowanie:

| | Lekki (`infantry`, UI „Wojownik”, „Rota wojowników”) | Ciężki (`ciezki`, „Wojownik ciężki”) |
|---|---|---|
| HP, prędkość | 10, 30 | 24, 22 |
| Masa, promień, rozmiar | 1, 4,0, 0,55 | 2,5, 4,8, 0,7 |
| Atak/obrona wręcz, obrażenia, pancerz | 60/40, 3,1, 0 | 55/52, 3,4, pancerz 40 |
| Koszt, domyślna liczebność roty | 1, 100 | 3, 60 |
| Znacznik armii (`army.tags`) | `light` | `heavy` (razem z taranem i odźwiernym) |
| Pula frakcji | wspólna (WK i LH) | wspólna (WK i LH) |
| Gwardia dowódcy | `gwardia_infantry` (WK w liście) | `gwardia_ciezki` (LH w liście) |
| W armiach (wzorce) | lekka masa 72-75%, zrównoważona 30-50% | ciężka 50%, wytrwała 30-40%, zrównoważona 10-20% |
| Rola AI | `assault` (WK), `reserve` (LH) | `reserve` (gwardia LH) |

**Wniosek:** tożsamość frakcji i koszty zostają bez zmian; nie dodaję typu ani nie ruszam kosztów i statystyk. Zmiana to tylko przypisanie profilu lokomocji do `infantry` (profil identyczny z biegaczem) i do `ciezki` (profil ograniczony). Elita dziedziczy po typie bazowym [K], więc gwardia lekka wspina się jak lekka, ciężka jak ciężka. Kosmetyka (opcjonalnie, osobna decyzja): zmiana wyświetlanej nazwy „Wojownik” na „Lekki wojownik” zmieniłaby nazwy rot („Rota lekkich wojowników”) i kilka testów, więc nie robię jej bez zgody.

### 4.2 Profile lokomocji (JSON, nazwane, współdzielone)
Profil to zestaw: `grip` (przyczepność 0-1), `stepH` (maks. niski stopień), mnożniki prędkości na klasę nachylenia (góra, stroma, pionowa), mnożnik zmęczenia, kary walki na stromych i pionowych (`cling`), `weight` (efektywna masa profilu do porównania z nośnością materiału, żeby profile identyczne nie rozjeżdżały się przez masę jednostki). Jednostka wskazuje profil nazwą (`units.<id>.locomotion`). Dozwolony ruch: `grip >= needGrip(klasa nachylenia)` i `weight <= supportMass(materiał)`; obiekt ≤ `stepH` to stopień, **ale tylko jeśli obiekt ma jawną flagę `surface` w mapie** (korzeń bez flagi pozostaje przeszkodą dla wszystkich; inaczej korzenie przestałyby blokować na mapach 3-5: 2, 6 i 11 obiektów, a decyzja „wspinalność per obiekt” byłaby podważona).

| Profil | Jednostki | grip | stepH | Co może | Szybkość góra/stroma/pionowa [W] |
|---|---|---|---|---|---|
| **wspinacz** | biegacz, **lekki wojownik** (+ ich gwardia) | 0,9 | 6 | wszystko obsługiwane, w tym pionowy kamień | 0,85 / 0,75 / 0,6 |
| zwinny | plujka | 0,6 | 6 | góry i strome ściany (kłody, korzenie), bez pionowego kamienia | 0,7 / 0,4 / - |
| bagażowy | pękacz | 0,45 | 6 | jak zwinny, wolniej (ładunek) | 0,6 / 0,35 / - |
| **ciężki** | ciężki wojownik (+ gwardia) | 0,45 | 6 | góry i strome ściany kłód i korzeni, wolno; bez pionowego kamienia, łodyg i gałęzi (nośność) | 0,6 / 0,35 / - |
| niski | dowódca | 0,3 | 6 | ziemia i niskie przeszkody (korzenie jako stopień) | 0,6 / - / - |
| naziemny | taran, odźwierny | 0-0,1 | 0 | tylko ziemia | - |

- **Lekki wojownik ma ten sam profil co biegacz [decyzja]:** te same powierzchnie, ten sam grip, te same mnożniki; różnią się bazową prędkością (30 i 62), statystykami bojowymi i kosztem.
- Profil „ciężki” to **moja propozycja do potwierdzenia** (decyzja D-H): ciężki ma „ograniczone możliwości”, więc może uczestniczyć w walce na kłodach i korzeniach (powolne mosty), ale nie flankuje po pionowych ścianach. Alternatywa z wcześniejszego projektu: tylko ziemia i niskie przeszkody (grip 0,25).
- Wartości [W] to punkt wyjścia do balansu; punkt odniesienia: mnożnik rampy kopca w grze ok. 0,68 [K].
- **Skutki dla armii [H]:** w lekkich armiach ok. 70% mrówek ma pełny profil (tysiące w jednej bitwie). Naturalne ograniczenia: szerokość powierzchni (mediana 3-8 komórek, więc kolumna), czas i zmęczenie przejść, brak osłony (mech) na powierzchniach, widoczność z ziemi, liczba i rozmieszczenie wspinalnych obiektów. To główne ryzyko balansu i wydajności, mierzone w S2 i S8.

### 4.3 Materiały i powierzchnie (per obiekt)
| Materiał | wys. h | ściana | needGrip góra/ściana | nośność | Uwagi |
|---|---|---|---|---|---|
| Kora (kłoda, pień) | 16 | stroma | 0 / 0,4 | 3 | [W] |
| Kamień | 14 | pionowa | 0 / 0,8 | 6 | [W] |
| Korzeń | 6 | niska stroma | 0 / stopień (`stepH`) lub 0,2; tylko z flagą `surface` | 3 | [W] |
| Łodyga, gałąź (nowe obiekty, S7) | 10-24 | stroma / pionowa | 0 / 0,4-0,8 | 1 / 1,5 | wymaga treści map i rysunku |
| Podszyt jako obszar, ziemia gniazda, woda, krawędź | n/d | niewspinalne | | | Twoja decyzja |
Wspinalność nadaje się per obiekt (flaga i materiał w mapie, generator z `climbChance` dla typu), obiekt musi mieć czytelne oznaczenie na rysunku i w nakładce; nie każda przeszkoda danego rodzaju jest wspinalna.

### 4.4 Roty mieszane
Opcja 2 (przyjęta): klasa liczona na mrówkę; każda mrówka idzie polem swojej klasy do slotu, więc bardziej zdolne skracają drogę, mniej zdolne obchodzą; szyk się rozciąga. **Kotwica:** rota z dowódcą używa klasy dowódcy (żeby nie zgubić aury), inaczej klasa większości przy progu 75% żywych mrówek [W, parametr wstępny], inaczej ziemia.
**Testy w S2** (na teście: rota 30 lekkich + 30 ciężkich, rota dowódcy z gwardią, jednorodne): (a) kontrola roty (kohezja, rozciągnięcie szyku, morale/`control`), (b) walka tylko części naziemnej (rozciągnięta rota bez wrogów na powierzchniach: część naziemna walczy normalnie według V1, część na powierzchni jest wyłączona z walki zgodnie z regułą przejściową), (c) aura dowódcy (odległość kotwicy od dowódcy, utrata aury), (d) przemieszczanie po wąskich powierzchniach (kolumna, brak zakleszczeń). **Jeśli pojawią się problemy, zgłaszam przyczynę i możliwe rozwiązania; nie zmieniam ustalonych zasad sam.**

## 5. Ruch i sterowanie
- **Przejścia:** podłoga ↔ ściana ↔ góra; czas przejścia = max(minSec, wysokość / prędkość pionowa) [W]; w trakcie mrówka stoi na krawędzi, nie atakuje, ma obniżoną obronę wręcz [W]. Wejście wymaga trasy pola klasy przez węzeł.
- **Odwrót:** rota w odwrocie zachowuje pole klasy.
- **Tryby roty:** **Ziemia**, **Auto** (domyślny: koszt = czas + zmęczenie + stała ekspozycja powierzchni x1,25 [W]; wspinaczka nie wygrywa tylko dlatego, że jest krótsza; zagrożenie dynamiczne to późniejsza rozbudowa) i **Wspinaczka** (mnożnik kosztu powierzchni 0,6 [W]).
- **Rozkaz ruchu na powierzchnię:** PPM na górze lub ścianie obiektu (picking z wysokością, zależny od kamery, sekcja 9); gdy klasa nie pozwala: czerwony krzyżyk jak dziś.
- **Nakładka „powierzchnie”** w panelu nakładek: węzły dostępne dla zaznaczonych rot.
- Interfejs nie jest rozbudowywany ponad ten zakres. W S2 (manualne testy) tylko **narzędzie deweloperskie**: klawisz zmiany trybu zaznaczonych rot i podgląd grafu; docelowe sterowanie to S5.

## 6. Walka na powierzchniach
Reguły poniżej obowiązują **tylko gdy co najmniej jedna z mrówek jest na węźle powierzchni lub w trakcie przejścia**; dla par ziemia-ziemia działa kod V1 bez zmian (wręcz, `bodyAhead`, kolizje, zasięg, osłona, widoczność).
- **Wręcz:** cios możliwy, gdy węzły są te same lub sąsiednie w grafie (jedna krawędź) i odległość 3D ≤ reach + promienie [K: wzór etapu B]. Sąsiedztwo wystarcza: największy zasięg to ok. 15 jedn. (taran 2,5 + 6,2 + 6,2) przy węzłach 16-jednostkowych [K]. Brak sztywnego progu wysokości: mrówka wysoko na ścianie nie sięga mrówki na ziemi, mrówka na krawędzi górnej sięga mrówki tuż pod krawędzią, na tej samej powierzchni zwykła walka. Węzły oddzielone kolumną nie sąsiadują: brak ciosów przez przeszkody.
- **Cling:** na stromych i pionowych powierzchniach atak i obrona obniżone, brak umiejętności [W].
- **Namierzanie:** kandydaci z siatki 2D przefiltrowani adiacencją i 3D; rota wręcz nie goni celu bez drogi (`reachable` według klasy).
- **Dystansowa (kwas):** z i tor 3D z węzłów; przeszkoda blokuje promień, gdy kolumna jest wyższa niż promień w tym punkcie; łuk może przejść nad niską przeszkodą (szczyt toru przy 45° i R0=120 to ok. 30, kłoda ma 16 [K: balistyka]). Plama i wybuch: odległość 3D plus brak solidu na odcinku do trafionej mrówki.
- **Szew [zaakceptowany, do weryfikacji w testach]:** plujka na ziemi trafi łukiem cel na kłodzie, ale nie cel na ziemi osłonięty tą samą przeszkodą (ziemia→ziemia blokuje ściana jak w V1). **Jeden warunek poprawności dla trafień, widoczności i efektów obszarowych:** jeśli silnik zadaje cios, pokazuje cel albo rozchodzi efekt, istnieje wolny odcinek 3D między punktami (test własności, sekcja 11).
- Poza v1: zrzucenie ze ściany po dużym obrażeniu jednym ciosem.

## 7. Wykrywanie, widoczność i przesłanianie (logika oddzielona od rysowania)
**Zasada:** widoczność liczy wyłącznie symulacja (`seen`, `visibleTo`, `compVisible`). Rysowanie (w tym półprzezroczystość, hash kierunku, obrót kamery) tylko ją **konsumuje**; półprzezroczyste rysowanie nie zmienia wykrywalności, a kamera nie wpływa na symulację (test: skrót stanu po obrocie kamery identyczny).
- Ziemia-ziemia: reguły V1 bez zmian.
- Gdy którykolwiek koniec promienia jest na węźle powierzchni (góra, ściana, przejście), widoczność jest **przestrzenna**: próbkowanie co 6 jedn. w 3D, komórka-kolumna blokuje, gdy jej wysokość jest powyżej promienia w tym punkcie; teren jak w `sightClear3`. Mrówka na ścianie stoi za krawędzią kolumny, więc własna kolumna nie blokuje jej od zewnątrz; mrówka na odwrotnej ścianie jest zasłonięta własną bryłą i niewidoczna z drugiej strony (zaskoczenie, unikanie zagrożeń).
- Mech: osłona dotyczy tylko mrówek na ziemi (bramka `node < N`).
- Obserwatorzy strony (co 4 mrówki) obejmują mrówki na powierzchniach. Nakładki etapu C (`shotAt`, `fireCheck`, `fireArea`) używają tych samych reguł.

## 8. AI
- Te same pola klasy i koszty co gracz w trybie Auto; AI nie dostaje osobnych rozkazów „wspinaj się”.
- Tryb roty AI według roli: `raider` Wspinaczka przy celu dystansowym, `assault` Auto, ciężcy i dowódca Ziemia/Auto wg profilu, taran i odźwierni Ziemia.
- Obrona: kontratak liczony po drodze pola klasy, nie w linii prostej; `reachable` według klasy; plujki biorą wspinaczy na cel przez `acquire`. Odłożone: AI zajmujące stanowiska na kłodach, dynamiczne zagrożenie.

## 9. Obracanie kamery: analiza wykonalności i wpływu
**Wniosek wstępny [K + H]:** obrót w krokach 90° (cztery widoki) jest wykonalny **bez przebudowy całego systemu**, bo projekcja jest w jednym obiekcie `ISO`, a symulacja nie zależy od kamery; wymaga jednak ponownego rysowania terenu (tekstura jest zaszyta w jednej orientacji) i kilku poprawek w interfejsie. Obrót ciągły (dowolny kąt) nie jest wykonalny w obecnej architekturze (wstępnie narysowane tekstury i atlas), wymagałby renderera 3D; **nie proponuję go**.
Rozwiązanie: `ISO.rot` ∈ {0..3} stosuje przed zwykłym wzorem izometrycznym **odwzorowanie z zamianą osi**, np. (x, y) → (y, W − x) dla 90° (nie obrót wokół środka: na mapach nieprostokątnych 2000x1200 i 3000x1500 dawałby współrzędne ujemne, a `ISO.ox`, `ISO.top` i przesunięcia tekstury zakładają [0,W]x[0,H]); dla nieparzystych obrotów W i H są zamieniane, a `ISO.H`, `ox` i `size` liczone na nowo dla każdego obrotu; `hf` (wysokość terenu) zawsze dostaje **nieobrócone** współrzędne świata; `ISO.inv` musi cofać obrót wewnątrz iteracji wysokości; znak przesunięcia kierunku sprite'a (+2 albo −2 na 90°) to **punkt kontrolny K0**, a nie założenie, `ISO.sy(x, y, z)` dostaje opcjonalne z (jedno miejsce dla wysokości terenu i powierzchni).

| Obszar | Wpływ i rozwiązanie |
|---|---|
| Teren (tekstura) | wymaga **ponownego narysowania** po obrocie w kolejności malarskiej obróconej siatki; bryły rysują zawsze ściany zwrócone do kamery (rysowane od tyłu, bez analizy sąsiadów), oświetlenie stałe w przestrzeni ekranu. Rozmiar tekstury: 21,7 MB (mapa 1) i 43 MB (mapa 5) na widok [K], więc cztery widoki naraz to 87-172 MB: wariant zalecany to ponowne rysowanie na żądanie (czas **[H] do zmierzenia w K0** (czas rysowania canvasu i wysyłki tekstury osobno)) i pamięć najwyżej dwóch widoków |
| Mrówki | kierunek sprite'a: `dir = (dir_świata + 2*rot) mod 8` (8 kierunków = kroki 45°, obrót 90° to +2) albo z wektora ekranowego; pozycja przez `ISO` |
| Powierzchnie i mrówki po różnych stronach obiektów | z w `ISO.sy`; ściana jest „zwrócona do kamery”, gdy jej normalna ma dodatni iloczyn z kierunkiem widoku: tablica 4 wartości na węzeł (po jednej na obrót); mrówki na ścianach odwróconych rysowane półprzezroczyste (kompromis zaakceptowany); **brak sortowania głębi** mrówka-bryła pozostaje ograniczeniem (mrówki zawsze nad terenem), pełne sortowanie (pasma głębi) jako opcjonalna przyszła rozbudowa |
| Widoczność i zasłanianie | po stronie symulacji: bez zmian; po stronie rysowania: mrówka zasłonięta bryłą w widoku jest tylko półprzezroczysta, nie ukryta, żeby gracz nie tracił jednostek z oczu (to konsumpcja `visibleTo`, nie jego zmiana) |
| Zaznaczanie i wskazywanie | `pickAt`, ramka (`selectIn`) działają w przestrzeni ekranu z `ISO` (poprawne po obrocie); wskazywanie punktu terenu przez `ISO.inv` (po rozszerzeniu o obrót, test pełnego cyklu `toWorld(toScreen(p))`); **nowość:** picking węzłów powierzchni (wielokąty góra/ściana rzutowane dla bieżącego obrotu, wybór po głębi) |
| Rozkazy na powierzchnie | picking węzła (jak wyżej), reguła klasy, czerwony krzyżyk przy braku dostępu |
| Trasy, nakładki, obrysy, plamy kwasu | idą przez `ISO.sx/sy`, więc obracają się automatycznie; do sprawdzenia: miejsca z założeniem osi (podgląd szyku, strzałka frontu) i wszędzie, gdzie jest ręczne `x - y` |
| Minimapa | rysowana z góry w układzie świata; wielokąt widoku z `toWorld` obraca się poprawnie; opcjonalnie obrót minimapy zgodny z widokiem |
| Sterowanie kamerą | przesuw (WASD, krawędzie) działa w przestrzeni ekranu, bez zmian; nowe: klawisze (propozycja `[` `]`, [Z]; sprawdzić kolizje z mapą klawiszy) i dwa przyciski; zachowanie punktu pod kursorem/środka ekranu przy obrocie |
| Czytelność | wskaźnik kierunku widoku, animacja przejścia (skrócone zanikanie) lub natychmiast |
| Wydajność | koszt stały na klatkę znikomy (jedna gałąź w `ISO`); koszt jednorazowy: przerysowanie terenu przy obrocie [H]; sim bez zmian |

**Weryfikacja możliwie wcześnie, K0 (spike, przed S0):** w V2, za `ui.camera.rotate`, bez zmian w symulacji: `ISO.rot`, przerysowanie terenu z obróconą kolejnością, mapowanie kierunków, picking terenu i ramka; wyniki: czas przerysowania i pamięć dla map 1 i 5 (pomiar), cztery zrzuty tej samej sceny, test pełnego cyklu `toWorld/toScreen`, skrót stanu symulacji niezmieniony. **Kryteria przejścia:** brak zmian poza warstwą rysowania i `ISO`, brak błędów w konsoli; próg akceptowalnego czasu przerysowania ustalasz Ty po zobaczeniu pomiarów. Pomiary z piaskownicy (render programowy, wcześniej start 17 s i 33 s dla map 1 i 5) **nie są reprezentatywne**: raportuję je jako liczby z piaskownicy, osobno rysowanie canvasu i wysyłkę tekstury, i proszę o pomiar na Twoim sprzęcie. Jeśli K0 wykaże istotne problemy, raportuję je z przyczyną i opcjami (np. ograniczenie do 2 widoków, przerysowanie asynchroniczne w kaflach), nie zmieniam założeń sam. **K1 (pełna kamera)** po S2: przyciski i skróty, minimapa, półprzezroczystość ścian odwróconych dla każdego obrotu, picking węzłów, testy, wydajność.

## 10. Wpływ na systemy i wydajność (osobno)
| Obszar | Wpływ | Weryfikacja |
|---|---|---|
| Nawigacja i pola | klasa ruchu z profilu, graf N+M, relaksacja jak w `buildField`, dedup klas; `blocked/moveClear/nearestOpen/getField/flowDir` świadome klasy i węzła | S1: dostępność tras dla klas, budżet czasu pola, pamięć |
| Ruch mrówki | osobna ścieżka dla `node >= N` w `updateAnts` | S2: wejście i zejście, brak mrówek w komórkach blokujących, ciągłość z |
| Kolizje i `bodyAhead` | 3D tylko gdy któraś mrówka jest na powierzchni; inaczej V1 | S2, test skrótu V1 |
| Walka wręcz i dystansowa | sekcja 6, tylko pary z powierzchnią | S3 i S4 (nie w wycinku), testy własności |
| Widoczność | tryb przestrzenny tylko dla promieni z końcem na powierzchni | S3 |
| AI | tryb z roli, `reachable` według klasy | S6 |
| Sterowanie i rysowanie | `ISO` z z, picking węzłów, tryby roty, nakładka, kamera | S2 (z), S5, K0/K1 |
| Wydajność [H] | V1 mediana kroku 14-16 ms przy ok. 4000 mrówek, budżet 50 ms [K]; pola: N+M ≤ ok. 24 tys. węzłów x 4 B x do 80 pól; tekstury kamery 22-43 MB na widok; narzut wspinaczy nieznany | S2: krok przy 4000 mrówkach, część na powierzchniach, funkcja włączona vs wyłączona (cel: do +25% [W]); K0: przerysowanie i pamięć |

## 11. Plan w małych, niezależnie testowalnych etapach
Zasada: bezpiecznik wyłączony domyślnie; po każdym etapie raport; pierwszy wycinek to K0 i S0-S2 na syntetycznej mapie (jedna kłoda, jeden kamień); **po wycinku stop i decyzja użytkownika**, bez przechodzenia do S3.

- **K0 spike kamery** (opis w 9). Wynik wchodzi do raportu wycinka.
- **S0 dane i graf (bez zmiany zachowania):** profile lokomocji w JSON (wspinacz, zwinny, bagażowy, ciężki, niski, naziemny) i przypisanie do wszystkich jednostek, w tym **lekkiego i ciężkiego wojownika** (profile już tu), tabela materiałów i wysokości (jedno źródło także dla renderera), flagi `surface` per obiekt, `params.surfaces` (bezpiecznik), mapa testowa (ukryta: jedna kłoda, jeden kamień niewspinalny i wspinalny, korzeń), kompilacja grafu (z z0 i z1), narzędzie podglądu. Testy: krawędzie symetryczne; każda ściana ma podstawę i krawędź górną; liczba węzłów zgodna ze wzorem; deterministyczna kompilacja; wszystkie jednostki mają profil, lekki wojownik i biegacz mają identyczny wektor zdolności, ciężki inny; **skrót typu 3 na V2 identyczny z flagą wyłączoną, a przy fladze włączonej identyczny, gdy żaden obiekt nie ma flagi `surface`** (lekki wojownik ma teraz pełny profil, więc „bez wspinaczy” jest niemożliwe; niezmiennik dotyczy braku powierzchni, w tym `stepH` działającego wyłącznie na obiektach z flagą); rysowanie bez zmian z zachowaniem dotychczasowych reguł rysunku (wysokość krawędzi mapy 22, jitter podszytu 12 + k%3).
- **S1 zdolności i pola klasy (mrówki jeszcze po ziemi):** klasy z profili (dedup), pola po grafie, `routeOf`, tryby Ziemia/Auto/Wspinaczka w koszcie; **pola, których cel nie ma osiągalnych węzłów powierzchni, zachowują dotychczasowe `buildField` co do wartości** (test równości z V1; dokładne odległości nie zależą od kolejności kolejki, więc brak powierzchni daje te same liczby). Testy: biegacz i lekki wojownik wchodzą na pionowy kamień i kłodę; ciężki na kłodę i korzeń, nie na kamień; plujka/pękacz na kłodę, nie na kamień; dowódca ziemia i stopień; taran i odźwierny tylko ziemia; ściany kopca i woda niewspinalne; tryb Ziemia ignoruje powierzchnie; Auto nie wybiera wspinaczki tylko dlatego, że krótsza; budżet czasu pola. **Bramka danych:** narzędzie tras (Dijkstra) dobiera frakcję wspinalnych obiektów, żeby zachować charakter map 3-5, zanim ruszy S2.
- **S2 ruch mrówek po powierzchniach:** węzeł, baza lokalna, przejścia (czas, brak ataku), z, kolizje 3D, rysowanie z z, rota dowódcy, rot mieszane (opcja 2, próg 75%), odwrót z przeszkody. **Reguła przejściowa (S2 to ruch, nie walka na powierzchniach):** mrówki na węzłach powierzchni lub w przejściu (`node >= N` albo `climbT > 0`) są **wyłączone** z `acquire`, ciosów wręcz, kwasu (jako cel i strzelec), plam i wybuchów oraz z widoczności (nie widzą i nie są widziane przez symulację), dopóki nie wejdą S3 i S4; scena testowa S2 **nie zawiera wrogów**, a rot mieszane sprawdzają walkę tylko części naziemnej. Dzięki temu wersja manualna nie łamie zasady „brak ataków przez przeszkody”, a wynik nie jest przedstawiany jako walka wielopłaszczyznowa. Testy: czasy wspinaczki i zejścia, brak mrówek wewnątrz komórek blokujących, ciągłość z, zmęczenie, odwrót, **rot mieszane (kontrola, walka bez nowych reguł, aura dowódcy, wąska powierzchnia)**, determinizm, V1 po wyłączeniu, **wydajność z funkcją i bez**.
- **K1 pełna kamera** (po S2, przed S5): jak w 9.
- **S3** widoczność i dystansowa; **S4** wręcz i obszarowe (testy własności: dozwolony cios, widoczność i trafienie implikują wolny odcinek 3D; ground-ground identyczny z V1); **S5** sterowanie i nakładki (picking węzłów, tryby, rozkaz na powierzchnię); **S6** AI; **S7** treść map (flagi obiektów, generatory, łodygi, gałęzie z z0 > 0, skoki); **S8** balans (AI-AI na mapach 2-5, odsetek rot na powierzchniach, charakter map) i wydajność, dopiero potem decyzja o włączeniu domyślnym.

**Zależności techniczne:** graf (S0) → pola klasy (S1) → ruch (S2) → widoczność i walka (S3, S4, wymagają z i węzłów) → sterowanie (S5, wymaga picking węzłów, czyli kamery K1) → AI (S6, wymaga pól klasy i reachable). Kamera: K0 niezależnie od sim, z w `ISO` (S2) potrzebne do K1, picking węzłów (K1) potrzebny do S5. Profile lokomocji (S0) potrzebne od S1.

**Po S0-S2:** wersja do testów manualnych (V2 z parametrem włączającym funkcję i mapą testową, zestaw rot: biegacze, lekcy, ciężcy, plujki, taran, rota dowódcy, rota mieszana, wszystkie w jednej scenie; narzędzie deweloperskie trybu roty i podgląd grafu) i raport: poprawność budowy grafu; dostępność tras dla poszczególnych klas; wejście i zejście; rot mieszane i wpływ na szyk; zachowanie V1 po wyłączeniu; wstępne pomiary wydajności; wynik K0. Potem stop.

## 12. Ryzyka (jawnie)
- Gorąca pętla `updateAnts` (nowa ścieżka), wydajność przy tysiącach mrówek na powierzchniach (lekka piechota ma profil pełny) [H].
- Balans: pełny profil lekkiego wojownika zwiększa manewr masy (flankowanie plujek, obejścia); mapy 3-5 mogą stracić charakter; wymaga frakcji wspinalnych obiektów z bramki S1 i pomiarów S8.
- Rysowanie: brak sortowania głębi bryła-mrówka, blokowe schodkowe kształty, ściany odwrócone od kamery, przerysowanie terenu przy obrocie.
- Szyk na powierzchniach: kolumna zamiast szyku; rot mieszane mogą się rozciągać.
- Szew balistyczny (łuk nad kłodą w cel na kłodzie, nie w cel na ziemi za nią).
- Koszt testów i zakres: duży; dlatego wycinek i stop.

## 13. Konsultacja z advisorem
Poprzednie konsultacje: model jednowarstwowy (odrzuciłeś go), potem graf (advisor uznał go za właściwy kierunek). **Dla wersji 3 konsultacja odbyła się** na pełnym dokumencie. Uwagi i moja ocena:
- **Przyjęte (wszystkie sześć):**
  1. W S2 mrówki na powierzchniach byłyby ofiarą reguł V1 (cios 2D i `acquire` sięgałyby mrówki na kamieniu, a `losClear`/`sightClear3` robiłyby z mrówki na szczycie niewidzialną i ślepą), co łamie zasadę „brak ataków przez przeszkody”. Dodana reguła przejściowa w S2 (wyłączenie z walki i widoczności do S3 i S4), scena testowa bez wrogów, test (b) tylko dla części naziemnej, wersja manualna nie jest prezentowana jako walka na powierzchniach.
  2. Niezmiennik skrótu „flaga włączona bez wspinaczy” był niewykonalny (lekki wojownik ma pełny profil, `stepH` zmieniałby korzenie w stopnie, a rozszerzenie pola mogłoby zmienić wartości). Przeformułowane na: flaga włączona i brak obiektów z flagą `surface` daje skrót V1; pola bez osiągalnych węzłów powierzchni zachowują dotychczasowe wartości `buildField`. Sprawdziłem `buildField`: to już relaksacja z kolejką ze zmiennymi kosztami (nie BFS), więc dokładne odległości nie zależą od kolejki; poprawiłem swoje sformułowanie „zmiana na Dijkstrę”.
  3. `stepH` działa tylko na obiektach z jawną flagą `surface` (inaczej korzenie przestałyby być przeszkodami na mapach 3-5).
  4. Obrót kamery: odwzorowanie z zamianą osi zamiast obrotu wokół środka (ujemne współrzędne, założenia `ISO.ox`/`top`), `hf` z nieobróconymi współrzędnymi, `ISO.inv` cofa obrót w iteracji wysokości, znak przesunięcia kierunku sprite'a jako punkt kontrolny K0.
  5. Profil „stromy” miał dwa gripy: rozdzielony na „zwinny” (plujka 0,6) i „bagażowy” (pękacz 0,45).
  6. Czasy K0 z piaskownicy nie są reprezentatywne (render programowy): raportuję osobno rysowanie canvasu i wysyłkę tekstury jako liczby z piaskownicy, próg akceptacji ustalasz Ty; test „rysowanie bez zmian” w S0 zachowuje dotychczasowe reguły rysunku (krawędź 22, jitter podszytu 12 + k%3).
- **Różnice zdań:** brak. Advisor poprosił też, żeby pytanie o interpretację podziału wojowników stało na początku raportu, bo zmienia Twoje założenie; zrobione (sekcja 0 i decyzja 1).
- Advisor nie widział implementacji (jej nie ma).

## 14. Decyzje, o które proszę przed S0-S2
1. **Potwierdzenie interpretacji podziału wojowników:** lekki = istniejący `infantry`, ciężki = istniejący `ciezki`, bez nowego typu i bez zmian kosztów; ewentualna zmiana wyświetlanej nazwy „Wojownik” na „Lekki wojownik” osobno.
2. **Profil ciężkiego:** strome powierzchnie (kłody, korzenie) wolno (zalecam) czy tylko ziemia i niskie przeszkody?
3. **Klawisze obrotu kamery** (propozycja `[` `]` i przyciski) i czy K0 zaczyna się przed S0, jak zakładam.
4. Zgoda na plan K0, S0-S2 oraz stop po S2.
