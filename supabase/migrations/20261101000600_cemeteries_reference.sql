-- Cmentarze z internetową wyszukiwarką grobów (stan: 1.11.2026). Źródła: tvn24.pl (30.10.2025),
-- gisplay.pl (28.10.2026), se.pl (Trójmiasto), wroclaw.pl. Tylko cmentarze, których nazwę i wyszukiwarkę potwierdzają
-- źródła; współrzędne i kolejne cmentarze dopisujemy po sprawdzeniu. Pełna lista: docs/cmentarze-wyszukiwarki.md.
-- locator = 'grobonet' (wyszukiwarka Grobonet z mapą cmentarza) albo 'miejska' (wyszukiwarka zarządcy z kwaterą/rzędem/numerem).

insert into public.cemeteries (name, city, kind, locator, locator_url, phrase, source) values
  -- Gdańsk (Grobonet, Gdańskie Cmentarze Komunalne)
  ('Cmentarz Łostowicki', 'Gdańsk', 'komunalny', 'grobonet', 'https://www.cmentarze-gdanskie.pl/chapter_77139.asp', 'na Cmentarzu Łostowickim w Gdańsku', 'grobonet'),
  ('Cmentarz Oliwski', 'Gdańsk', 'komunalny', 'grobonet', 'https://www.cmentarze-gdanskie.pl/chapter_77139.asp', 'na Cmentarzu Oliwskim w Gdańsku', 'grobonet'),
  ('Cmentarz Srebrzysko', 'Gdańsk', 'komunalny', 'grobonet', 'https://www.cmentarze-gdanskie.pl/chapter_77139.asp', 'na Cmentarzu Srebrzysko w Gdańsku', 'grobonet'),
  ('Cmentarz Garnizonowy', 'Gdańsk', 'komunalny', 'grobonet', 'https://www.cmentarze-gdanskie.pl/chapter_77139.asp', 'na Cmentarzu Garnizonowym w Gdańsku', 'grobonet'),
  ('Cmentarz Sobieszewski', 'Gdańsk', 'komunalny', 'grobonet', 'https://www.cmentarze-gdanskie.pl/chapter_77139.asp', 'na Cmentarzu Sobieszewskim w Gdańsku', 'grobonet'),
  -- Gdynia (Grobonet)
  ('Cmentarz Komunalny Witomino', 'Gdynia', 'komunalny', 'grobonet', 'https://gdynia.grobonet.com/grobonet/start.php', 'na Cmentarzu Komunalnym Witomino w Gdyni', 'grobonet'),
  ('Cmentarz Komunalny Kosakowo', 'Gdynia', 'komunalny', 'grobonet', 'https://gdynia.grobonet.com/grobonet/start.php', 'na Cmentarzu Komunalnym w Kosakowie', 'grobonet'),
  ('Cmentarz Komunalny Mały Kack', 'Gdynia', 'komunalny', 'grobonet', 'https://gdynia.grobonet.com/grobonet/start.php', 'na Cmentarzu Komunalnym Mały Kack w Gdyni', 'grobonet'),
  -- Białystok (Grobonet)
  ('Cmentarz Miejski w Białymstoku', 'Białystok', 'komunalny', 'grobonet', 'https://bialystok.grobonet.com/grobonet/start.php', 'na Cmentarzu Miejskim w Białymstoku', 'grobonet'),
  -- Warszawa (Zarząd Cmentarzy Komunalnych – wyszukiwarka z mapą)
  ('Cmentarz Komunalny Północny', 'Warszawa', 'komunalny', 'miejska', 'https://www.cmentarzekomunalne.com.pl/mapa/', 'na Cmentarzu Komunalnym Północnym w Warszawie', 'reczny'),
  ('Cmentarz Komunalny Południowy', 'Warszawa', 'komunalny', 'miejska', 'https://www.cmentarzekomunalne.com.pl/mapa/', 'na Cmentarzu Komunalnym Południowym w Antoninowie', 'reczny'),
  ('Cmentarz Wojskowy na Powązkach', 'Warszawa', 'wojskowy', 'miejska', 'https://www.cmentarzekomunalne.com.pl/mapa/', 'na Cmentarzu Wojskowym na Powązkach w Warszawie', 'reczny'),
  -- Kraków (Zarząd Cmentarzy Komunalnych – lokalizator)
  ('Cmentarz Rakowicki', 'Kraków', 'komunalny', 'miejska', 'https://zck-krakow.pl/18/locator', 'na Cmentarzu Rakowickim w Krakowie', 'reczny'),
  ('Cmentarz Prądnik Czerwony (Batowice)', 'Kraków', 'komunalny', 'miejska', 'https://zck-krakow.pl/18/locator', 'na Cmentarzu Prądnik Czerwony w Krakowie', 'reczny'),
  ('Cmentarz Grębałów', 'Kraków', 'komunalny', 'miejska', 'https://zck-krakow.pl/18/locator', 'na Cmentarzu Grębałów w Krakowie', 'reczny'),
  ('Cmentarz Podgórski', 'Kraków', 'komunalny', 'miejska', 'https://zck-krakow.pl/18/locator', 'na Cmentarzu Podgórskim w Krakowie', 'reczny'),
  -- Wrocław (Zarząd Cmentarzy Komunalnych – katalog z mapą)
  ('Cmentarz Osobowicki', 'Wrocław', 'komunalny', 'miejska', 'https://groby.cui.wroclaw.pl', 'na Cmentarzu Osobowickim we Wrocławiu', 'reczny'),
  ('Cmentarz Grabiszyński', 'Wrocław', 'komunalny', 'miejska', 'https://groby.cui.wroclaw.pl', 'na Cmentarzu Grabiszyńskim we Wrocławiu', 'reczny'),
  -- Poznań (wyszukiwarka grobów miasta)
  ('Cmentarz Junikowo', 'Poznań', 'komunalny', 'miejska', 'https://www.poznan.pl/mim/necropolis/', 'na Cmentarzu Junikowo w Poznaniu', 'reczny'),
  ('Cmentarz Miłostowo', 'Poznań', 'komunalny', 'miejska', 'https://www.poznan.pl/mim/necropolis/', 'na Cmentarzu Miłostowo w Poznaniu', 'reczny'),
  -- Łódź (Cmentarze Komunalne w Łodzi – wyszukiwarka)
  ('Cmentarz Komunalny Doły', 'Łódź', 'komunalny', 'miejska', 'http://cmentarzekomunalne.lodz.systkom.pl/szukaj.html', 'na Cmentarzu Komunalnym Doły w Łodzi', 'reczny'),
  ('Cmentarz Komunalny Zarzew', 'Łódź', 'komunalny', 'miejska', 'http://cmentarzekomunalne.lodz.systkom.pl/szukaj.html', 'na Cmentarzu Komunalnym Zarzew w Łodzi', 'reczny'),
  -- Szczecin (Zakład Usług Komunalnych)
  ('Cmentarz Centralny w Szczecinie', 'Szczecin', 'komunalny', 'miejska', 'https://www.cmentarze.szczecin.pl/chapter_11975.asp', 'na Cmentarzu Centralnym w Szczecinie', 'reczny');
