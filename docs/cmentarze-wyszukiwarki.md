# Cmentarze z internetową wyszukiwarką grobów (stan: 1.11.2026)

Usługę przy grobie (znicz, kwiaty, sprzątanie) przyjmujemy tylko, gdy da się ustalić, jak dojść do grobu:
1) cmentarz ma wyszukiwarkę grobów, a klient poda kwaterę i numer (rząd, jeśli jest), albo
2) klient poda położenie grobu z telefonu („Jestem przy grobie”).

Tabela `cemeteries`: `locator` = `grobonet` (Grobonet z mapą cmentarza) albo `miejska` (wyszukiwarka zarządcy), `brak` = tylko GPS.
Cmentarze z tej listy są w migracji `20261101000600_cemeteries_reference.sql` (bez współrzędnych – do uzupełnienia).

## Ogólnopolskie wyszukiwarki

| Serwis | Zasięg (wg źródła) | Co daje | Źródło |
| --- | --- | --- | --- |
| Grobonet (grobonet.com) | ponad 2500 cmentarzy | mapa cmentarza z zaznaczonym grobem, zdjęcia nagrobków; w Grobonet PRO „Nawiguj do grobu” w obrębie cmentarza | gisplay.pl 28.10.2026; polskie-cmentarze.com |
| eCmentarze (ecmentarze.pl) | 9705 cmentarzy, także parafialne | wyszukiwanie po nazwisku i miejscowości | tvn24.pl 30.10.2025 |
| KsięgaZmarlych24 | 1220 cmentarzy | wyszukiwanie osób pochowanych | tvn24.pl 30.10.2025 |
| Mogiły (mogily.pl) | ponad milion grobów, ponad 800 cmentarzy | wyszukiwanie wg diecezji | tvn24.pl, gisplay.pl |
| WebCmentarz (webcmentarz.pl) | głównie mniejsze miejscowości | wyszukiwanie grobów | gisplay.pl |

Te serwisy pokazują miejsce pochówku, ale nie wszystkie dają mapę z drogą do grobu. Do usługi liczymy przede wszystkim
wyszukiwarki z kwaterą/rzędem/numerem i mapą (Grobonet i miejskie).

## Cmentarze zmapowane w Grobonecie

| Miasto | Cmentarze | Wyszukiwarka |
| --- | --- | --- |
| Gdańsk | Łostowicki, Oliwski, Srebrzysko, Garnizonowy, Sobieszewski (oraz wg se.pl: św. Ignacego, Salvator, św. Jadwigi, św. Franciszka) | cmentarze-gdanskie.pl |
| Gdynia | Witomino, Kosakowo, Mały Kack | gdynia.grobonet.com |
| Sopot | Cmentarz Komunalny | Grobonet (wg se.pl) |
| Bydgoszcz | cmentarze komunalne | cmentarze.bydgoszcz.pl/grobonet |
| Lublin | cmentarze Archidiecezji Lubelskiej | cmentarze.lublin.eu/grobonet |
| Rzeszów | cmentarze komunalne | grobonet.erzeszow.pl |
| Białystok | Cmentarz Miejski | bialystok.grobonet.com |

## Najlepiej zdigitalizowane cmentarze komunalne (wyszukiwarki miast)

| Miasto | Cmentarze w bazie Ostoi | Wyszukiwarka | Uwagi |
| --- | --- | --- | --- |
| Warszawa | Północny, Południowy, Wojskowe Powązki | cmentarzekomunalne.com.pl/mapa | mapa z wyszukiwaniem; aplikacja „Stare Powązki” z trasami i modelami 3D |
| Kraków | Rakowicki, Prądnik Czerwony (Batowice), Grębałów, Podgórski | zck-krakow.pl/18/locator | lokalizator na mapie |
| Wrocław | Osobowicki, Grabiszyński | groby.cui.wroclaw.pl | pole, rząd, numer grobu, mapy cmentarzy komunalnych; osobna wyszukiwarka grobów parafialnych |
| Poznań | Junikowo, Miłostowo | poznan.pl/mim/necropolis | pokazuje położenie grobu |
| Łódź | Doły, Zarzew | cmentarzekomunalne.lodz.systkom.pl | pilotaż Ostoi |
| Szczecin | Cmentarz Centralny | cmentarze.szczecin.pl | aplikacja „Szczecińskie Cmentarze” |
| Piła | cmentarz komunalny | cmentarz.pila.pl | prowadzi od dowolnej bramy cmentarza |
| Gorzów Wielkopolski | cmentarze komunalne | geoportal miasta | wyszukiwarka w geoportalu |
| Kielce, Opole, Przemyśl, Zielona Góra, Chełm | cmentarze komunalne | serwisy zarządców | do sprawdzenia, czy pokazują mapę |

## Do zrobienia przed startem w kolejnym mieście
- Współrzędne bram i kwater (OpenStreetMap, licencja ODbL – z podaniem źródła) i sprawdzenie każdej wyszukiwarki.
- Umowa z Grobonetem (Polskie Cmentarze) na dostęp do położenia grobów – wtedy klient wkleja link z Grobonetu zamiast przepisywać kwaterę.
- Parafie: brak otwartej bazy; zaczynamy od parafii wpisanych przez zakłady i list diecezji.

Źródła: [tvn24.pl, 30.10.2025](https://tvn24.pl/polska/wszystkich-swietych-2025-jak-znalezc-grob-wyszukiwarki-mogil-lokalizatory-i-aplikacje-st8727159),
[gisplay.pl, 28.10.2026](https://gisplay.pl/gis/3247-wyszukiwarki-i-lokalizatory-grobow.html),
[se.pl – Trójmiasto](https://www.se.pl/trojmiasto/szukasz-grobu-bliskiej-osoby-w-trojmiescie-mozesz-go-znalezc-przez-internet-lokalizacje-aa-BjiX-dcXE-2PGe.html),
[wroclaw.pl](https://www.wroclaw.pl/dla-mieszkanca/wyszukiwarka-grobow),
[polskie-cmentarze.com](https://polskie-cmentarze.com/nawiguj-do-grobu-i-do-cmentarza/).
