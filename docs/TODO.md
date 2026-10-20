# Lista TODO

Rzeczy odłożone na później (kolejność nie jest priorytetem). Źródła: rozmowy z użytkownikiem i wnioski z etapów 1-2 ([wnioski-p1.md](wnioski-p1.md)).

## AI (odłożone na wyraźną prośbę użytkownika: „AI zajmiemy się potem”)
- AI atakujących zna jeden plan (najkrótsza trasa do celu), więc nie oskrzydla na mapach z wieloma trasami i na otwartej polanie wchodzi czołowo w linię plujek (Wielka Kolonia 0/4 na mapach 1 i 2 w oblężeniu).
- AI w Przeprawie nie umie zamienić przewagi w tempie na zwycięstwo: Wielka Kolonia przegrała 25 z 25 bitew, także z szybszą armią. Brak planu „szybcy uderzają na odsłonięty bród, a reszta wiąże obrońców”, brak blefu, brak rezerwy.
- Czas dojścia w AI brodów liczony jest z odległości w linii prostej, a nie z długości trasy.
- AI obrońców w oblężeniu i Przeprawie nie przegrupowuje się poza przydziałem do brodu (stały układ, reakcja na zagrożenie co 10 s).
- Bitwa: AI obu stron idzie na najbliższą rotę, bez koncentracji i bez wykorzystania terenu.
- Do rozważenia: osobne doktryny frakcji w AI (masa i centralne dowodzenie kontra jakość i samodzielne oddziały).

## Etap 4 (elewacja, widoczność, balistyka)
- Strzał łukiem nie przechodzi nad ścianami (pnie, kamienie, zarośla, mur gniazda): tylko wzgórza można przestrzelić. Opcja: nadać ścianom wysokości i pozwolić im być przestrzelonym.
- Czas lotu pocisku jest pominięty (obrażenia natychmiast); łuk jest tylko rysowany.
- Pola przepływu nie uwzględniają nachylenia (rota nie obchodzi stromych zboczy, chyba że to konieczne): dodać koszt nachylenia do `buildField`.
- Plujka nie zmienia pozycji, żeby zdobyć strzał (np. wejść na wzgórze lub zejść z linii wzgórza); brak takiego zachowania w AI.
- AI zna prawdziwą liczebność rot, które widziało w ciągu ostatnich 15 s (uproszczenie widoczności).
- Wzgórza mają tylko typy map 2, 4, 5 i potok; typ 1 i 3 są płaskie z założenia. Strefy rozmieszczenia mogą leżeć na zboczu.
- Uzupełnienia (rozstrzygnięte): poza oblężeniem (Bitwa, Przeprawa) obie strony walczą tym, co mają, bez uzupełnień; w oblężeniu uzupełnia tylko obrońca.
- Mrówki nie ukrywają się same (brak rozkazu „ukryj się”): ukrycie wynika z miejsca, w którym stoją.

## Do pamiętania w etapie 5 (rework oblężenia)
- Strefa rozstawienia atakującego musi być adekwatnie duża (obecna strefa WK ma 470 jednostek szerokości i mieści najwyżej ok. 2000 mrówek, więc przewaga budżetowa atakującego x1,5 na budżecie Duży bywa nierealizowalna).
- Rozstawianie rot ręcznie przez gracza: na razie automatyczne (decyzja użytkownika: „dojdziemy do tego”).
- Obsługiwane tryby: tylko AI przeciw AI i gracz przeciw AI (bez dwóch graczy); AI zawsze gra uczciwie (te same ograniczenia widzenia co gracz).

## Szturm kopca (etap 5)
- AI nie wykorzystuje struktury kopca: atakujący idzie wszystkimi rotami najkrótszą drogą, obrońca stoi na stanowiskach i kontratakuje w pobliżu. Do zrobienia: podział sił na dwie trasy, odwrót na kolejne pierścienie, blokowanie ramp, ostrzał ramp z wyższego pierścienia.
- Plug odźwiernych (zamknięcie przejścia) nie działa na wejściach i rampach kopca; ściany nie są zniszczalne (tarany nie burzą).
- Poziomy są pierścieniami w jednej płaszczyźnie; prawdziwe piętra nad sobą wymagałyby osobnych warstw (ruch, kolizje, widoczność, rysowanie).
- Rozstawianie ręczne atakującego i obrońcy; strefa startu 840 x 1100 (mieści armię x1,5 budżetu Duży we wszystkich testowanych wzorcach).
- Balans (obrona vs budżet x1,5 atakującego, limit 1500 s) i wszystkie wymiary kopca do oceny w grze.

## Interfejs, walka i morale (etap B)
- Etap C (znaczniki i nakładki taktyczne na mapie) czeka na wyraźne polecenie użytkownika.
- Szał atakujących przy morale 0 (zamiast odwrotu) wynika z wcześniejszych ustaleń; do decyzji, czy atakujący ma też uciekać (`params.morale.attackerRage`).
- Balans nowego modelu walki (hit chance, pancerz, odporności, pasma morale) wymaga pomiarów na większej próbce i ocenienia w grze; wcześniejsze pomiary AI dotyczą starego modelu.
- Statystyki pojedynczej mrówki w interfejsie (obecnie tylko rota); tryb porównania dwóch rot; własne ustawienia układu paneli.
- Minimapa: wysokości wzgórz, markery i polecenia (np. ruch prawym klikiem na minimapie) są poza zakresem etapu B.

## Nakładki taktyczne (etap C)
- Broń kierunkowa i blokowanie strzału przez jednostki nie istnieją w mechanice; gdyby doszły (np. działka, tarcze), nakładka musi dostać odpowiednie zapytania (sektor, blokada przez rotę) zamiast domyślnego koła.
- Jednostki neutralne i ogień sojuszniczy: brak w grze, więc brak oznaczeń.
- Widok pojedynczych mrówek (paski zdrowia na mrówkę) na żądanie gracza.
- Podgląd zasięgu z miejsca docelowego liczony od kotwicy; dokładniejszy wymagałby symulacji rozstawienia szyku.
- Minimapa: markery rozkazów i klik prawym przyciskiem jako rozkaz ruchu.

## Armie (etap 3)
- Jednostki latające: odłożone na prośbę użytkownika. Dokument wspomina lotnika (delikatny, traci skrzydła, lotnictwo taktyczne: zrzut za linię i za bramę), ale bez statystyk i zasad; w kodzie ich nie ma. Do ustalenia: statystyki, kto może je trafić, czy ignorują teren i ciała, rola w oblężeniu.
- Tabela kosztów jednostek i trzy budżety (1200/2200/3500) to założenia prototypu; do skorygowania po testach (np. plujka 4 pkt i odźwierny 7 pkt).
- Strefa startu Wielkiej Kolonii (470 jedn. szerokości) mieści najwyżej ok. 2000 mrówek: duże armie lekkiej masy i przewaga x1,5 atakującego w oblężeniu na budżecie Duży są ograniczone miejscem. Można powiększyć strefy startu w generatorach map.
- AI armii: wzorce i tabela kontr są ręczne; brak doboru uwzględniającego mapę (np. gęstość, brody), brak uczenia się z poprzednich bitew, AI kontruje armię gracza tylko na podstawie prostego profilu (kategorie ranged/heavy/light/fast).
- Flankująca i dystansowa to wzorce tylko jednej frakcji (WK, LH), bo druga nie ma dość jednostek w puli (LH nie ma szybkich, WK nie ma dystansowych).

## Mapy i scenariusze
- Typ mapy 3 jest stałym układem (ziarno zmienia tylko mech); można dodać generowany wariant z większą liczbą tras.
- Przeprawa: wariant z celem terenowym (zajęcie przyczółka) zamiast samego zniszczenia przeciwnika.
- Powierzchnia do chodzenia map 4 i 5 jest o 40-57% większa niż na typie 3 (strefy rozmieszczenia armii są stałe): można zmniejszyć strefy lub układ obrońców.
- Mapa 5 i przeprawa: marsz całej armii trwa kilka minut; do oceny w grze.
- Interfejs przeprawy: odliczanie czasu dojścia do brodu.

## Mechanika
- Ruch za kotwicą roty (mapy 4 i 5) i ruch do celu przed kotwicą (mapy 1-3) to dwie reguły; ujednolicenie zmieni wyniki na typie 3.
- Gwardia typu Taran lub Odźwierny ma tylko statystyki elity (bez Szarży i Zamknięcia); gwardia pękaczy detonuje przy kontakcie.
- Marsz grupy przesuwa układ rot, ale go nie obraca jak w Total War (obraca się tylko przy przeciągnięciu PPM).

## Testy i narzędzia
- Pełne `npm test` trwa ok. 12 minut (rdzeń ok. 9 minut, przeglądarka ok. 3): skrócić (mniej ziaren, mniejsze roty w testach nawigacji, równoległość).
- Wydajność w Chrome na typowym PC (FPS) nie została zmierzona, tylko krok symulacji w Node.

## Dalsze etapy rozszerzenia P1
- Etap 3: konfiguracja armii i budżety (gotowy do testów ręcznych). Etap 4: elewacja, linia wzroku, zasadzki i ukrywanie się w mchu. Etap 5: pełnoprawne oblężenia kopców (gotowy do testów ręcznych: poziomy, korytarze, serce gniazda, panika obrońców).

## Sterowanie (Total War)
- Atak wielu rot na jeden cel: brak jawnego przydziału miejsc bojowych wokół celu (dziś: preferencja mrówek wskazanej roty i rozłożenie wynikające z kolizji).
- Interakcje z wrogimi budynkami, surowcami i własnym gniazdem: gra nie ma takich celów rozkazów.
- Sterowanie pojedynczymi mrówkami: nie istnieje (rota jest najmniejszą sterowalną jednostką).
- Źródła Total War z specyfikacji nie zostały sprawdzone (brak dostępu do sieci w środowisku pracy).
