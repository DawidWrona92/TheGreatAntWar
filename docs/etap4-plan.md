# Etap 4: plan (elewacja, linia wzroku, zasadzki i ukrywanie się)

Dokument przygotowawczy. Nic z poniższego nie jest jeszcze zaimplementowane. Zawiera analizę obecnego kodu (co istnieje, czego brakuje), propozycję rozwiązania w miejscach, gdzie jest wybór projektowy, i pytania do zatwierdzenia przed pierwszym commitem etapu 4.

## 1. Wymagania (z opisu etapu 4)
1. Elewacja musi wpływać na ruch i zmęczenie: schodzenie z góry szybsze i mniej męczące, wchodzenie pod górę wolniejsze i bardziej męczące.
2. Jednostki wyżej mają przewagę nad strzelającymi z dołu: większy zasięg skuteczny niż atakujący pod górę, a różnica wysokości wpływa na możliwość ostrzału (nie tylko grafika).
3. Jednostki ukryte za linią wzroku (skały, krzaki, góry; trawa tylko dekoracyjnie, mech jako gęste krzaki) nie są widoczne dla przeciwnika: zasadzki dla gracza i dla AI. Ukrywanie się w gęstszych rzeczach (pod liściem, w mchu).
4. Zachować istniejące mechaniki; nie zmieniać niepowiązanych parametrów; typ 3 i Oblężenie bez budżetu mają nadal dawać identyczny przebieg, jeśli elewacja i widoczność są tam wyłączone.

## 2. Co jest w kodzie (stan po etapie 3)
| Obszar | Stan | Miejsce |
|---|---|---|
| Teren | siatka 16x16 jednostek, rodzaje komórek 0-8; brak wysokości | `rasterize`, `grid` |
| Ruch | prędkość = `T.speed[typ] * c.spMod`; `spMod` = morale x zmęczenie x mnożnik strony; pola przepływu liczą tylko ściany, nie koszt terenu | `updateAnts`, `updateControl`, `buildField` |
| Zmęczenie | co sekundę `+move` w marszu, `+fight` w walce, `-rest` na odpoczynku, na poziomie roty | `updateControl` |
| Zasięg | plujka `range` 80, melee `reach`; stała, niezależna od pozycji | `acquire`, `updateAnts` |
| Linia wzroku | `losClear` krokiem 6 jednostek po tablicy `SIGHT` (ściany i zarośla blokują, woda nie); wyłącznie 2D | `losClear` |
| Osłona | komórka 2 (mech) tylko mnoży otrzymane obrażenia przez `cover` (0,7) | `hit` |
| Widoczność | brak: AI (`aiStep`, `acquire`) i rysowanie widzą wszystkie mrówki obu stron | `aiStep`, `drawAnts` |
| Rysowanie | teren jest wstępnie renderowaną płaską teksturą izometryczną, mrówki sprite'ami bez sortowania głębi | `makeIsoTerrain`, `ParticleContainer` |

Wnioski: (a) elewacja wymaga nowej warstwy danych (siatka wysokości) i zmiany renderowania terenu; (b) ruch i zmęczenie mają już punkty zaczepienia (`spMod`, `fg`), więc nachylenie można tam wmnożyć bez nowego systemu; (c) zasięg i linia wzroku mają jedno miejsce (`acquire`, `losClear`), ale `losClear` musi stać się trójwymiarowe; (d) widoczność (zasadzki) to osobny, nowy mechanizm: jest dziś zupełnie nieobecny, a dotyka AI, interfejsu i rdzenia.

## 3. Propozycja rozwiązania (do zatwierdzenia)
### 3.1 Siatka wysokości
- `height[]` (Float32, jednostki świata) w tej samej siatce 16x16, generowana z ziarna (strumień `terrain`), gładkie wzgórza i grzbiety (kilka funkcji Gaussa lub szum), parametry wzgórz w `mapTypes` (`hills`: liczba, promień, wysokość).
- Skala: mrówka ma ok. 8 jednostek średnicy. Proponowana skala wysokości: wzgórze 40-120 jednostek (nachylenie do ok. 0,3-0,5), co jest „pagórkiem” rzędu kilkudziesięciu długości mrówki.
- Komórki nieprzejezdne (ściany) mają wysokość, ale nie są wchodzone; woda i brody leżą na poziomie 0.
- Typ mapy 3 (zachowanie sprzed etapu 1): bez elewacji (`hills: 0`), żeby zachować identyczny przebieg; można go odblokować osobną decyzją.

### 3.2 Ruch i zmęczenie
- Nachylenie `s = (h_cel - h_teraz) / odległość` w kierunku ruchu mrówki (z siatki wysokości, interpolacja dwuliniowa).
- Mnożnik prędkości: pod górę `1 / (1 + 2,5 * s)` (min 0,45), z góry `1 + 1,2 * (-s)` (max 1,35). Wartości do kalibracji; w JSON `params.elevation`.
- Zmęczenie roty: składnik marszu `move` mnożony przez `1 + 3 * max(0, średnie_nachylenie_pod_górę)` i `1 - 0,5 * max(0, nachylenie_z_góry)`; średnia po mrówkach roty w tym kroku.
- Pola przepływu: opcjonalnie koszt komórki rosnący z nachyleniem (żeby rota obchodziła strome zbocza); bez tego rota idzie najkrótszą trasą po płaskim terenie, wchodząc pod górę, gdy trasa tego wymaga.

### 3.3 Walka i zasięg
- Zasięg skuteczny strzelca: `range * clamp(1 + 0,006 * (h_strzelec - h_cel), 0,6, 1,6)` (każde 10 jednostek wysokości to +/- 6% zasięgu; różnica 60 daje +/- 36%). Atak wręcz: bez zmiany zasięgu, ale obrażenia z góry x1,15 i z dołu x0,9 (opcjonalnie, do zatwierdzenia).
- Strzał jest możliwy tylko, gdy `losClear` w 3D przechodzi: linia od oczu strzelca (h + 4) do celu (h + 2) musi leżeć powyżej terenu po drodze; grzbiet między stronami zasłania.
- Odpowiednio kwas z góry trafia dalej, a plujka na dole musi podejść pod ostrzał albo go przyjąć.

### 3.4 Widoczność, zasadzki i ukrywanie się
- Każda strona ma zbiór widocznych mrówek wroga, liczony co 5 kroków (4 Hz): wróg jest widoczny, gdy w promieniu widzenia (propozycja: 110 jednostek, mrówka mała) leży własna mrówka z czystą trójwymiarową linią wzroku (zasłaniają ściany, zarośla, kamienie, grzbiety; woda i trawa nie).
- Ukrywanie się: mrówka stojąca na komórce mchu (osłona) jest widoczna tylko z bliska (propozycja: 25 jednostek), czyli mech to gęste krzaki dla mrówek; mech sam nie blokuje widoku między innymi komórkami. Trawa i ściółka są dekoracją.
- Ujawnienie: mrówka, która zaatakowała (melee lub kwas), jest widoczna dla wszystkich przez 3 s (zasadzka daje pierwsze uderzenie, ale ujawnia).
- Zasadzka (opcjonalnie, do zatwierdzenia): pierwszy atak z ukrycia ma obrażenia x1,5.
- Własne jednostki są zawsze widoczne dla właściciela. Tryb obserwatora (AI przeciw AI) pokazuje wszystko, a pomocniczo można pokazać widok jednej ze stron.
- AI (obie strony, tak samo): `acquire` i `aiStep` używają tylko widocznych przeciwników oraz ostatnio widzianej pozycji roty (pamięć kilkunastu sekund). To wprowadza zasadzki także po stronie AI.
- Interfejs: ukryte wrogie mrówki nie są rysowane, nie mają kart, etykiet ani paneli po najechaniu; ostatnia znana pozycja rot może być pokazana jako znacznik „?” przez kilka sekund.
- Wydajność: obserwatorami jest próbka mrówek (np. 1 na 4 w rocie), a cele sprawdzane są przez siatkę przestrzenną w promieniu widzenia; budżet to kilka ms na aktualizację (4 razy na sekundę).

### 3.5 Rysowanie
- Wstępnie renderowany teren izometryczny przesuwa każdy kafel w pionie o `wysokość * 0,5 * S`, z cieniowaniem zboczy (jaśniej od strony światła) i pochyłymi bokami; mrówki rysowane na wysokości terenu pod nimi. Ponieważ mrówki nie są sortowane w głąb, za grzbietem nie powinny być widoczne, co zapewnia ukrywanie (wróg za wzgórzem jest ukryty), a dla własnych mrówek za wzgórzem przewidziane jest półprzezroczyste rysowanie.

## 4. Luki i pytania do użytkownika (przed implementacją)
1. **Które mapy mają elewację?** Propozycja: typy 1, 2, 4, 5 i potok mają wzgórza, typ 3 zostaje płaski (identyczny przebieg), a Oblężenie bez budżetu na typie 3 pozostaje bez zmian.
2. **Skala i siła wpływu** (liczby w punkcie 3.2 i 3.3 to propozycje, nie dane z dokumentu): czy akceptujesz wzgórza 40-120 jednostek, +/-6% zasięgu na 10 jednostek wysokości i prędkość pod górę do 0,45?
3. **Widoczność:** czy promień widzenia 110 i widoczność z bliska 25 w mchu jest dobrym punktem wyjścia, i czy AI ma grać uczciwie (te same ograniczenia widzenia co gracz)?
4. **Zasadzka:** czy pierwszy atak z ukrycia ma dawać bonus x1,5 do obrażeń (jest to nowa mechanika bojowa), czy wystarczy sama niewidoczność?
5. **Grzbiety a linia wzroku:** czy wzgórza mają blokować widok i strzał (propozycja: tak, przez trójwymiarową linię wzroku)?

## 5. Plan implementacji i testów (po zatwierdzeniu)
1. Siatka wysokości: generator z ziarna dla typów map, renderowanie terenu z wysokością, test: typ 3 bez zmian (hash), generatory dają gładkie wzgórza i trasy nadal istnieją.
2. Ruch i zmęczenie: test, że ta sama rota idzie szybciej z góry niż pod górę i zbiera więcej zmęczenia pod górę, na płaskim terenie bez zmian.
3. Zasięg i trójwymiarowa linia wzroku: test, że plujka na wzgórzu trafia dalej niż ta pod nim, a grzbiet blokuje strzał.
4. Widoczność i zasadzki: test, że ukryta w mchu rota jest niewidoczna z daleka, widoczna z bliska i po ataku; AI nie celuje w ukryte jednostki; interfejs ich nie rysuje; test zasadzki (AI przeciw AI).
5. Pełny `npm test` w tle na kopii pliku, eksperymenty wpływu elewacji na wynik i dokumentacja (decyzje, pseudokod, wnioski), zrzuty ekranu.
