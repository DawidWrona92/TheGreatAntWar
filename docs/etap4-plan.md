# Etap 4: projekt (elewacja, linia wzroku, balistyka, zasadzki, ukrywanie się, ciosy z tyłu i z boku)

Decyzje użytkownika: brak bonusu za zasadzkę (wystarczy niewidoczność); cios od tyłu zadaje największe obrażenia, z flanki mniejsze, z przodu mrówka jest przygotowana; wzgórza blokują widok; strzał zależy od wysokości i wielkości wzgórza i jest liczony balistycznie (dowolny kąt, kąt powyżej 45 stopni skraca zasięg, ale pozwala przestrzelić nad wzgórzem); AI gra zawsze uczciwie (te same ograniczenia widzenia co gracz); obsługiwane tryby to AI przeciw AI i gracz przeciw AI. Wartości liczbowe poniżej, których użytkownik nie podał, są założeniami prototypu i trafiają do JSON (`params.elevation`, `params.ballistics`, `params.visibility`, `params.facing`).

## 1. Stan kodu przed etapem
Siatka terenu 16x16 bez wysokości; ruch to `T.speed * spMod`; zmęczenie roty liczone co sekundę (`+move` w marszu); zasięg plujki stały (80); linia wzroku 2D (`losClear`, tablica `SIGHT`); osłona (mech) tylko mnoży obrażenia przez `cover`; brak widoczności (AI i rysowanie widzą wszystko); teren to płaska, wstępnie renderowana tekstura izometryczna.

## 2. Wzgórza
- Wysokości w siatce Float32 (`height`) i wstępnie policzony gradient; generowane z osobnego strumienia `terrain` jako gładkie wzgórza (funkcje Gaussa) poza strefami rozmieszczenia.
- Mapy: typ 1 zostaje płaski (z etapu 1: „otwarta i płaska”), typ 3 zostaje płaski (kotwica regresji), wzgórza mają typy 2, 4, 5 i potok (na potoku podwyższone brzegi przy brodach). Przełącznik `hills` w `mapTypes`.
- Skala wynika z balistyki (punkt 4), a nie z odczucia: szczyty 20-40 jednostek, nachylenie do 0,25, promień 200-400. Ściany (pnie, kamienie, korzenie, zarośla, mur gniazda) zostają pełnymi blokerami widoku i strzału; strzał łukiem nie przechodzi nad ścianami (to możliwa późniejsza opcja).

## 3. Ruch i zmęczenie
- Nachylenie liczone dla mrówki z gradientu wzdłuż jej prędkości. Mnożnik prędkości: pod górę `1 / (1 + 2,5 s)` (min 0,45), z góry `1 + 1,2 |s|` (max 1,35) (monotonicznie, zgodnie z wymaganiem).
- Zmęczenie: składnik marszu `move` razy `1 + 3 * średnie_nachylenie_pod_górę` i razy `1 - 0,5 * średnie_nachylenie_z_góry`; średnia po poruszających się mrówkach roty w ciągu sekundy.
- Pola przepływu bez zmian (obchodzenie stromych zboczy trafia do TODO).

## 4. Balistyka plujki (kwas)
- Prędkość wylotu z zasięgu na płaskim: `v^2 = g R0`, `R0 = 80` (g = 1 w jednostkach świata). Najwyższy punkt toru w ogóle: `v^2/(2g) = R0/2 = 40` jednostek.
- Dla odległości `d` i różnicy wysokości `Δh` (cel minus strzelec; oczy strzelca +4, cel +2): `tanθ = (v^2 ± sqrt(v^4 - g (g d^2 + 2 Δh v^2))) / (g d)`. Ujemny wyróżnik oznacza, że cel jest poza zasięgiem. Maksymalny zasięg `R = R0 sqrt(1 + 2 Δh / R0)` (strzelec 20 wyżej: 98, 20 niżej: 57, 40 niżej: 0).
- Najpierw tor płaski (mniejszy kąt), próbkowany co ok. 8 jednostek względem wysokości terenu; jeśli blokuje go wzgórze, tor stromy (powyżej 45 stopni), jeśli oba są zablokowane, strzału nie ma. Obrażenia zadawane natychmiast (jak dotąd); wyliczony wierzchołek służy tylko do narysowania łuku. Czas lotu jest pomijany (TODO).
- Bez wzgórz (`hills` wyłączone) obowiązuje dotychczasowa reguła (zasięg 80 i `losClear`), aby zachować identyczny przebieg.

## 5. Widoczność i ukrywanie się (wspólna dla gracza i AI)
- Widoczność strony jest wspólna: wrogi mrówka jest widoczna, gdy widzi ją którykolwiek z próbkowanych własnych obserwatorów (1 na 4 mrówki w rocie). Liczona co 5 kroków w stałej kolejności (stan symulacji, deterministyczna).
- Promień widzenia 125 (większy niż zasięg plujki, aby zasięg był użyteczny). Linia wzroku 3D: linia od oczu obserwatora do celu musi leżeć powyżej terenu; ściany (`SIGHT`) blokują, woda nie.
- Mech (osłona, komórka 2) ukrywa: mrówka na mchu jest widoczna tylko z bliska (28 jednostek); mech nie blokuje widoku między innymi komórkami. Trawa i ściółka to dekoracje.
- Ujawnienie: mrówka, która zaatakowała (wręcz albo kwasem), jest widoczna dla wszystkich przez 3 s. Bez bonusu obrażeń za zasadzkę.
- AI korzysta tylko z widocznych przeciwników i z ostatnio widzianej pozycji roty (ważnej ok. 15 s); dotyczy `acquire`, celu marszu, wyboru brodu, kontrataku i biegaczy. Gdy nic nie jest widoczne, cel zastępczy: Bitwa środek strefy wroga, Oblężenie gniazdo, Przeprawa lądowisko wybranego brodu.
- Interfejs: niewidoczne wrogie mrówki, etykiety, karty i panele nie są rysowane; tryb obserwatora pokazuje wszystko.

## 6. Ciosy z tyłu i z boku
Kąt między kierunkiem `heading` obrońcy a kierunkiem do atakującego: do 60 stopni przód (x1), 60-120 flanka (x1,25), powyżej 120 tył (x1,5). Dotyczy ciosów wręcz i kwasu (kierunek z miejsca strzału). Mnożniki są założeniem prototypu (`params.facing`). Obrażenia wręcz z wysokości nie są zmieniane.

## 7. Bezpiecznik regresji
`params.facing.on`, `params.visibility.on` (domyślnie włączone) i wzgórza per mapa. Test kotwicy typu 3 jest uruchamiany z wyłączonymi mechanikami etapu 4 i musi dawać identyczny skrót; nowe testy z włączonymi.

## 8. Rysowanie
Jedna funkcja przesunięcia pionowego o wysokość terenu używana w każdym miejscu, gdzie liczy się pozycję ekranową (mrówki, etykiety, aury, linie rozkazów, podglądy szyku, łuki kwasu, etykiety brodów, gniazdo); wybieranie myszą (`toWorld`) poprawiane iteracyjnie o wysokość; teren rysowany od tyłu do przodu z cieniowaniem zboczy i bokami tam, gdzie sąsiednia komórka jest niższa.

## 9. Testy
Płaska mapa z wyłączonymi mechanikami: identyczny skrót; ta sama rota pod górę i z góry (stosunek prędkości, zmęczenie); balistyka względem tabeli analitycznej (+20/-20/-40, wzgórze blokuje tor płaski, a stromy przechodzi, cel 40 wyżej poza zasięgiem); widoczność (mech: ukryta z 60, widoczna z 20; widoczna po ataku; za wzgórzem ukryta; `acquire` nie celuje w ukryte; AI idzie, gdy nic nie widzi); stosunki obrażeń przód/flanka/tył; determinizm z wzgórzami i widocznością; czas kroku przy ok. 4500 mrówek na mapie ze wzgórzami; przeglądarka: wzgórza się rysują, wybieranie na szczycie jest dokładne, ukrytych wrogów nie widać.
