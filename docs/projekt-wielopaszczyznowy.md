# Projekt: ruch i walka mrówek po powierzchniach przeszkód (wspinaczka)

Status: **propozycja do zatwierdzenia**. Nie zmieniono kodu, mechaniki walki, nawigacji ani AI. Wersja bazowa: V1 (`prototypy/p1-bitwa.html`, tag `p1-v1-stan-2026-10-21`, gałąź `p1-v1-backup`); praca poszłaby na V2 (`p1-bitwa-v2.html`).

Legenda: **[K]** potwierdzone analizą kodu, **[P]** pomiar wykonany skryptem tylko do odczytu (poza repozytorium), **[Z]** założenie projektowe, **[H]** hipoteza do sprawdzenia, **[W]** wartość wstępna do balansu.

## 1. Co jest w kodzie (Etap 1)

- **[K] Mapa.** Siatka komórek 16 jedn. Kody: 0 podłoga, 1 kłoda/pień (także krawędź mapy), 2 mech (osłona), 3 ziemia gniazda i ściany kopca, 4 kamień, 5 korzeń, 6 podszyt, 7 woda, 8 bród. `BLK` blokuje ruch (1, 3, 4, 5, 6, 7), `SIGHT` blokuje widok i strzał (1, 3, 4, 5, 6; woda nie).
- **[K] Przeszkody nie mają wysokości w symulacji.** Rysowane mają (kłoda 16, krawędź mapy 22, kamień 14, korzeń 6, podszyt 12-14, ziemia 8), ale rdzeń zna tylko „blokuje albo nie” niezależnie od wysokości promienia.
- **[K] Elewacja** to osobne pole terenu (wzgórza map 2, 4, 5, tarasy kopca): prędkość (nachylenie), balistyka (`shotAt`/`shotApex`, dwa tory), widoczność 3D (`sightClear3`; teren liczy z, ściany nie).
- **[K] Mrówka** to tablice SoA (x, y, vx, vy, hp, heading...). Brak współrzędnej z, warstwy i stanu wspinania (wyszukanie w kodzie: zero trafień wspin/climb/layer).
- **[K] Ruch.** Kotwica roty idzie po polu przepływu (klucz pola: komórka celu, pamięć `fields`, 80 pól), mrówki idą do slotów szyku. W rdzeniu: 23 użycia `blocked(`, 7 `moveClear(`, 10 `getField(`, 5 `flowDir(`. Kolizje ciał w jednej płaszczyźnie. Tryb korytarzowy (ślad kotwicy) na mapach 4, 5 i kopcu.
- **[K] Walka.** Zasięg wręcz 2D (reach + promienie), namierzanie przez siatkę 2D (`acquire`), kwas: zasięg i tor z wysokością terenu, ściany blokują 2D, jednostki nie blokują pocisków, brak ognia sojuszniczego. Widoczność wspólna dla strony.
- **[K] Jednostki** (masa): infantry 1 (ok. 600 mrówek w armii listy), biegacz 0,7 (prędkość 62, tylko WK, rola `raider`), plujka 0,9 (zasięg 120, tylko LH), pękacz 1,2, ciężki 2,5, dowódca 3, taran 5, odźwierny 6. Elita (`gwardia_*`) dziedziczy zachowanie po typie bazowym.
- **[K] Roty są jednorodne**, poza rotami dowódcy: `{ "@guard": 50, "dowodca": 1 }` (gwardia plus dowódca).
- **[K] AI** (`aiStep`, co 20 kroków): atakujący idą do celu po polach przepływu, `raider` (biegacze) ściga rotę z kwasem, obrońca trzyma `home` i kontratakuje rotę bliżej niż 260 w linii prostej.

**Co można rozbudować, a co jest nowe.** Rozbudować: tablice cech jednostek (`T.*`, JSON), pole przepływu (dodać klasę ruchu), `blocked`/`moveClear`/`nearestOpen`, widoczność i balistykę (dodać z przeszkód), AI `raider`, nakładki etapu C. Nowe: wysokości przeszkód w rdzeniu, stan przejścia (wspinaczka), klasa ruchu roty.

## 2. Mechanika (Etap 2)

### 2.1 Model
**[Z] Jedna powierzchnia na punkt, bez osobnych warstw.** Komórka przeszkody wspinalnej jest dla wspinaczy przechodnia, dla reszty nadal blokuje. Mrówka na komórce przeszkody stoi na jej górnej powierzchni, z = teren + wysokość przeszkody z tabeli w JSON (jedno źródło prawdy dla rysowania, balistyki i widoczności; dziś liczby są zaszyte w rendererze). Ściana pionowa to **przejście w czasie**, nie miejsce, w którym się walczy: wejście z podłogi na przeszkodę (i zejście) trwa `max(minSec, wysokość / prędkość pionowa)`, w tym czasie mrówka stoi na krawędzi, nie atakuje i ma obniżoną obronę wręcz.

**Kompromis do świadomej akceptacji:** „wielopłaszczyznowość” to dwie wysokości (podłoga i górne powierzchnie przeszkód) z odsłoniętym przejściem, a nie dowolne poruszanie się po ścianach. Ściany kopca i krawędź mapy są poza zakresem (patrz niżej, [P]).

### 2.2 Klasy jednostek
| Jednostka | Wspinaczka | Uzasadnienie |
|---|---|---|
| Biegacz (i gwardia biegaczy) | tak, kamień, korzeń i kłoda | najlżejszy (0,7), rola zwiadowcza i flankująca, tylko WK |
| Plujka | **etap 2 projektu** (opcja B), tylko niskie powierzchnie | lekka (0,9), ale daje wysokie stanowiska ogniowe, patrz ryzyka |
| Wojownik | nie | masa armii (ok. 600 mrówek); dałoby wszystkim rotom dodatkowe kierunki ataku i obciążyło wydajność |
| Pękacz | nie | niesie ładunek (1,2), wolny (26) |
| Ciężki, taran, odźwierny, dowódca | nie | masa 2,5-6, pancerz; ich siła to utrzymanie ziemi |
Reguła rota: **wspina się tylko rota, której wszystkie żywe mrówki mają zdolność** (rota dowódcy z dowódcą nigdy). Rodzaj uprawnień jest w JSON przy jednostce (`climb`), a nie wyliczany z masy, żeby kontrolować balans.

Powierzchnie: kamień, korzeń, kłoda wspinalne; ziemia gniazda i woda nie; krawędź mapy nie; podszyt do decyzji (D2); przeszkody oznaczone w mapie `climb:false` (np. pień blokujący przesmyk) nie.

### 2.3 Ruch
- Warunki wejścia: jednostka ma `climb`, komórka wspinalna, wysokość przeszkody ≤ `maxH` jednostki, rota nie jest w odwrocie (rota w odwrocie nadal może uciekać polem swojej klasy, więc nie utknie na przeszkodzie).
- Trasa: pole przepływu zależy od klasy (klucz: komórka celu i klasa); klasa wspinaczy widzi komórki wspinalne z mnożnikiem kosztu. Wspinacze zawsze idą polem swojej klasy; to pole samo rozstrzyga, kiedy wspinaczka się opłaca (bez progów w AI).
- Prędkość na powierzchni x0,7 **[W]** (uzasadnienie: mnożnik rampy kopca w grze wynosi ok. 0,68, więc wspinaczka nie jest wolniejsza niż wejście pod górę). Przejście pionowe: prędkość pionowa 0,5 prędkości jednostki, minimum 1,0 s **[W]**. Zmęczenie jak szybki ruch (x2,5, wartość `run.fatigue` z gry) **[W]**. Obrona wręcz podczas przejścia -20 punktów **[W]** (szansa trafienia rośnie o 20 pp, wzór z etapu B).
- Odwrót: rota w odwrocie zachowuje pole klasy (nie ma wymuszonego zejścia, które wystawiałoby ją na ogień).

### 2.4 Walka między wysokościami
- **Wręcz:** nowa reguła różnicy wysokości: cios wymaga `|z_atakującego - z_celu| <= meleeZ` (**[W]** 8: korzeń 6 mieści się, kamień 14 i kłoda 16 nie). Skutek: mrówka na kamieniu jest nieosiągalna dla wręcz z ziemi, i odwrotnie; walczą ze sobą mrówki na tej samej powierzchni (biegacz kontra biegacz) i przy przejściu (mrówka w trakcie wspinania jest trafialna z podłoża). Jeśli ta reguła zostanie odrzucona (D5), wszystko jest 2D jak dziś, a wspinacze walczą z ziemi na krawędzi.
- **Kwas:** `shotAt` dostaje z strzelca z powierzchni (z0 = teren + wysokość przeszkody + oczy); plama działa na mrówki w promieniu 2D.
- **Widoczność i tor:** komórka przeszkody blokuje promień tylko wtedy, gdy jej wysokość jest powyżej promienia w tym punkcie, **i tylko gdy któryś koniec jest na przeszkodzie**; komórki, na których stoją końce, są wyłączone z testu (inaczej wspinacz byłby niewidoczny i nietrafialny, a strzelec na kamieniu zasłaniałby się sam). Dla odcinków podłoga-podłoga zachowanie V1 bez zmian.
- Nikt nie atakuje przez przeszkody: namierzanie (`acquire`) pomija cele, do których nie ma ani tory strzału, ani dopuszczalnego ciosu wręcz (różnica wysokości); rota wręcz nie dostaje rozkazu ataku celu bez drogi (`reachable` według klasy).

### 2.5 Co to daje w bitwie (Etap 3 i pomiary)
**Uczciwie: korzyść strategiczna jest mała [P].** Trasa z zachodu do gniazda (wspinaczka, koszt x2): średnia długość 1,00 (mapa 2), 0,98 (mapa 3), 0,91 (mapa 4), 0,91 (mapa 5) trasy po ziemi; w 0-1% punktów startowych skrócenie o ≥25%. Mapy 1 i 2 praktycznie nic nie zyskują. Wartość mechaniki jest lokalna:
1. **Obejście przesmyku zamkniętego plugiem** [P]: na mapie 3 przy zamkniętym przesmyku trasa wspinacza z zachodu jest o 17-58% krótsza niż po ziemi (np. start y=600: 1026 -> 439 jedn.; start y=180: 734 -> 607). Dotyczy ukrytego scenariusza Oblężenie; w menu (Bitwa, Przeprawa, Szturm kopca) nie występuje.
2. **Dojście do plujek za ścianą** [P]: biegacze WK do rot plujek LH: mapa 4 trasa 82% (podszyt wspinalny: 81%), mapa 5 84% (81%); mapy 1-3 bez zmian (plujki stoją na otwartym terenie).
3. **Zaskoczenie** [Z]: kamień i kłoda zasłaniają widok z ziemi, więc biegacz pojawia się na górze przeszkody dopiero, gdy promień wyjdzie nad nią (po zmianie widoczności); z ziemi nie widać go wcześniej.
4. **Obrona pozycji** [Z]: ciężcy i odźwierni nadal trzymają ziemię i wejścia; wspinacze nie przejmują ich roli (nie walczą z ziemi, gdy są na górze, i nie wchodzą na ziemię kopca).
5. **Wysokie stanowiska ogniowe** [Z, opcja B]: plujka z kamienia (14 w górę) ma zasięg R = R0 sqrt(1 + 2·14/R0) z R0 = 120, czyli 133 (ok. +11%), ale promień widzenia to 125, więc przewaga zasięgu wymaga zwiadu.

Przykład: rota 80 biegaczy WK widzi linię plujek LH za pasem kamieni (mapa 4). Po ziemi to 2250 jedn. krętym podszytem, po kamieniach 1850: biegacze wspinają się w 3 s, są widoczni i bez osłony (mech nie działa na powierzchni), plujki strzelają do nich z pełną liczbą strzelców, a obrona wręcz (ciężcy) nie może ich dosięgnąć, dopóki nie zejdą. Biegacze wygrywają, jeśli zejdą za plecami linii; przegrywają, jeśli plujki mają osłonę wręcz i kwas.

## 3. Zachowanie AI (Etap 2.5)
- **[Z]** Wspinacze zawsze używają pola przepływu swojej klasy, bez dodatkowej warstwy decyzyjnej (pole z mnożnikiem kosztu już rozstrzyga, kiedy się opłaca; próg „≥25% krótsza” w AI prawie nigdy by nie zadziałał, według pomiaru z 2.5).
- Rola `raider` (biegacze) już ściga rotę z kwasem: nowa mechanika przyspiesza ten sam rozkaz, nie wymaga nowej roli.
- Obrona: `reachable` według klasy, więc AI nie wysyła rot wręcz po cel na powierzchni, do którego nie ma drogi ciosu; plujki biorą wspinaczy na cel przez istniejące `acquire`; kontratak „< 260” jest filtrowany różnicą wysokości.
- AI nie dostaje poleceń „wspinaj się”: wspinaczka jest własnością trasy, nie rozkazem.

## 4. Projekt techniczny (Etap 4.4)
1. **Dane (JSON):** `world.surfaces` (kod komórki -> wysokość, wspinalność, jedno źródło także dla renderera), `units.*.climb` (`speedMul`, `upMul`, `minSec`, `fatigue`, `maxH`, `defPenalty`), `params.climb` (`on`, `meleeZ`, `costMul`). Mapa: dodatkowa tablica `noClimb` (krawędź, ściany gniazda, przeszkody z `climb:false`).
2. **Rdzeń:** klasa ruchu roty `c.cls` (wszystkie żywe mrówki wspinają się; liczona raz na sekundę); `blocked(x,y,cls)`, `moveClear(...,cls)`, `nearestOpen(...,cls)` (inaczej rozkaz celowany w kamień przesunie się na podłogę), `getField(x,y,cls)` (klucz komórka*2+klasa), przejścia w ruchu mrówki (`climbT`, brak ataku, obniżona obrona), z mrówki z tablicy (`zOff`) lub liczony z komórki.
3. **Kolizje:** bez zmian poza testem ściany w `resolveCollisions` (klasa mrówki), żeby odpychanie na krawędzi nie wpychało mrówki z ziemi w przeszkodę.
4. **Tryb korytarzowy** (`updateBent`, ślad kotwicy): klasa musi tam dotrzeć; [H] szyk rozsypuje się podczas wspinaczki (kohezja spowolni kotwicę).
5. **Widoczność, tor, nakładki etapu C** (`shotAt`, `fireCheck`, `fireArea`): ten sam z; inaczej nakładki przestaną odpowiadać symulacji.
6. **Walka:** reguła różnicy wysokości w ciosie i w `acquire` (jedna drobna zmiana w `acquire`, której nie da się uniknąć: bez niej mrówki z ziemi dążą do celu na kamieniu, którego nie sięgną).
7. **Interfejs:** przesunięcie sprite o wysokość powierzchni, znacznik stanu „wspina się”, trasa z odcinkami przez przeszkody (inny styl linii), w nakładkach liczenie z z0.
8. **Bezpiecznik:** `params.climb.on` domyślnie `false` w V2, aż do balansu; przy wyłączeniu skrót stanu typu 3 identyczny (test na V2); skrót stanu zawiera `climbT` tylko przy włączonej funkcji.

## 5. Balans i ryzyka (Etap 2.6)
- **[P] Ściany kopca muszą zostać niewspinalne:** gdyby ziemia gniazda była przechodnia, trasa do serca skraca się średnio do 0,60 (koszt x3) lub 0,72 (x6) długości po ziemi. Kopiec jest zbudowany na labiryncie.
- **Asymetria frakcji [K]:** wspinają się tylko biegacze, a tylko WK je ma; mur chroni dziś plujki LH. Zyskują więc atakujący (pomiar 2 pokazuje skrócenie dojścia do plujek o 16-19% na mapach 4 i 5), a obrona nie dostaje odpowiednika. Opcja B (plujki na niskich powierzchniach) daje LH użycie obronne; uwaga na ryzyko niżej.
- **Plujki na kamieniach [H]:** mrówki na kamieniu są nieosiągalne dla wręcz z ziemi (reguła różnicy wysokości), więc plujki na dużym kamieniu mogłyby być nietykalne, a WK nie ma kontr dystansowych; jedyna kontra to biegacze na tej samej powierzchni. Ograniczenia: tylko niskie powierzchnie (`maxH`), brak kwasu dla plujek w trakcie przejścia, test AI-AI przed włączeniem.
- **Biegacze [H]:** prędkość 62 plus skróty: ograniczają koszt przejścia, zmęczenie, bezbronność w trakcie wspinania, brak osłony (mech) na powierzchni i widoczność z ziemi po wyjściu nad przeszkodę.
- **Rzeczy, których nie wiem:** jak zachowa się szyk rot (tryb korytarzowy), czy wspinaczka zmieni wyniki AI-AI na mapach 4 i 5 (dotychczasowe pomiary balansu dotyczą gry bez niej), jak wygląda przejście na ekranie izometrycznym, wpływ na wydajność (drugie pole przepływu per klasa, ok. 15 tys. komórek).
- Wszystkie wartości liczbowe z oznaczeniem [W] to wstępne wartości do balansu, nie dane z gry.

## 6. Decyzje do podjęcia
- **D1 Zakres klas:** A) tylko biegacze (zalecam na start) albo B) biegacze i plujki (niskie powierzchnie).
- **D2 Podszyt wspinalny?** Zalecam nie (miękka roślinność; chroni labirynt mapy 4: pomiary 81% vs 82% dojścia do plujek, więc różnica jest mała).
- **D3 Sterowanie:** wspinaczka zawsze włączona w trasie klasy (prosto, jak AI) albo przełącznik „tylko ziemia” na rotę (zalecam przełącznik, bo rota gracza nie powinna wchodzić w nieoczekiwane miejsca).
- **D4 Zakres z-świadomej widoczności:** tylko gdy któryś koniec jest na przeszkodzie (zalecam; V1 bez zmian dla odcinków podłoga-podłoga) albo wszędzie (zmieniłoby zachowanie V1: wzgórze pozwalałoby widzieć ponad kłodą).
- **D5 Reguła różnicy wysokości w walce wręcz:** zalecam tak (daje „wysokie stanowisko”, wymaga kontr), albo wszystko 2D.
- **D6 Wersja:** praca w V2 z bezpiecznikiem wyłączonym do czasu balansu.

## 7. Plan implementacji
1. **F0** dane i bezpiecznik: tabela powierzchni w JSON, `noClimb`, `params.climb`, wspólne wysokości dla renderera; test: funkcja wyłączona, skrót typu 3 identyczny, rysowanie bez zmian.
2. **F1** nawigacja: klasa roty, `blocked/moveClear/nearestOpen/getField` z klasą, przejście w ruchu mrówki, kolizje przy ścianie, render z; testy: wspinacz przechodzi kamień w oczekiwanym czasie, ciężki nie, rota mieszana nie, odwrót z przeszkody, brak mrówek w ścianach kopca, determinizm, wydajność.
3. **F2** widoczność, tor, walka: z przeszkód w LOS i `shotAt` (tylko przy podniesionym końcu), reguła różnicy wysokości w ciosie i `acquire`, nakładki etapu C; testy: wspinacz widoczny i trafialny, strzelec nie zasłania się sam, brak ataku przez przeszkody, `fireCheck` zgodny ze strzałem.
4. **F3** AI i interfejs: `reachable` według klasy, `raider`, przełącznik roty (D3), stan i trasy w interfejsie.
5. **F4** balans: AI-AI na mapach 2-5 z i bez funkcji (kilkanaście ziaren), metryki: odsetek rot wspinaczy na przeszkodach, straty, czas do gniazda; dopiero potem włączenie domyślne.
6. **F5 (opcjonalnie)** plujki (D1-B), zdolność wspinaczki dla piechoty jako umiejętność roty z odnowieniem.
Każdy etap kończy się raportem i czeka na zgodę.

## 8. Konsultacja z advisorem
Advisor był dostępny i konsultacja się odbyła na szkicu z danymi (analiza i pomiary). Główne uwagi:
- **Przyjęte:** zrezygnować z dwóch warstw (`lay`, kolizje na warstwę, pojemność powierzchni): jedna powierzchnia na punkt wystarcza, a przejście to czas, nie miejsce; wspólna tabela wysokości przeszkód; wyjątki dla komórek końców promienia i z-świadomość tylko przy podniesionym końcu; nakładki etapu C z tym samym z; `nearestOpen` i kolizje ze ścianą według klasy; reguła „rota wspina się, gdy wszystkie żywe mrówki mogą” (zweryfikowane: rota dowódcy jest mieszana); przedstawienie wartości mechaniki bez przesady (korzyść strategiczna mała) z dodatkowymi pomiarami lokalnymi; usunięcie progu „≥25%” z AI; pytania o asymetrię, podszyt, sterowanie, zakres z-widoczności i bezpiecznik.
- **Moja różnica zdań:** advisor sugerował, że kolizje, siatka przestrzenna i `acquire` zostają bez zmian. Po analizie `acquire` potrzebuje drobnego filtra różnicy wysokości (bez niego mrówki z ziemi próbują dojść do celu na kamieniu); dodałem też regułę różnicy wysokości w walce wręcz (D5), której advisor nie proponował, bo daje „wysokie stanowisko”; jest do odrzucenia.
- Advisor nie widział implementacji, bo jej nie ma.

## 9. Co nie jest zweryfikowane
Wydajność, zachowanie szyku podczas wspinaczki, wygląd na ekranie, wpływ na balans AI-AI, dobór wszystkich liczb [W]. Pomiary [P] dotyczą tras po siatce (Dijkstra, ruch 8-kierunkowy), nie rzeczywistego ruchu rot; użyto ziarna 1 i armii z listy.
