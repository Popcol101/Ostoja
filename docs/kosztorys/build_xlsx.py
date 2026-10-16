from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.comments import Comment
from openpyxl.utils import get_column_letter

# Kosztorys Ostoi bez kosztów programistów (Excel). Uruchom: python3 docs/kosztorys/build_xlsx.py
import os
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "Ostoja-kosztorys.xlsx")
F = "Arial"
BLUE = Font(name=F, color="0000FF")
GREEN = Font(name=F, color="008000")
BOLD = Font(name=F, bold=True)
NORM = Font(name=F)
TITLE = Font(name=F, bold=True, size=14)
HEAD_FILL = PatternFill("solid", start_color="E6EAE8")
KEY_FILL = PatternFill("solid", start_color="FFFF00")
TOTAL_FILL = PatternFill("solid", start_color="F1ECE2")
thin = Side(style="thin", color="D8DAD7")
BOX = Border(bottom=thin)
PLN = '#,##0 "zł";(#,##0 "zł");"-"'
PLN2 = '#,##0.00 "zł";(#,##0.00 "zł");"-"'
NUM = '#,##0.##;(#,##0.##);"-"'

wb = Workbook()

# ---------------- Założenia ----------------
z = wb.active
z.title = "Założenia"
z["A1"] = "Ostoja – założenia kosztorysu"; z["A1"].font = TITLE
z["A2"] = "Niebieskie liczby to dane wejściowe – zmień je, a reszta przeliczy się sama. Żółte tło: kluczowe założenia. Kwoty netto (bez VAT)."
z["A2"].font = Font(name=F, italic=True)
hdr = ["Parametr", "Pilot", "Start", "Jednostka", "Źródło / uwagi"]
for i, h in enumerate(hdr, 1):
    c = z.cell(row=4, column=i, value=h); c.font = BOLD; c.fill = HEAD_FILL
params = [
    ("Kurs USD/PLN", 3.8827, 3.8827, "zł za 1 USD", "Kurs średni NBP z 16.10.2026 (comparic.pl). Usługi Supabase, Vercel, Claude są w USD."),
    ("Długość scenariusza", 3, 12, "miesiące", "Pilot: 3 miesiące w Łodzi z 5 zakładami. Start: pierwszy rok sprzedaży."),
    ("Zakłady partnerskie", 5, 25, "zakłady", "Założenie. Start: 2–3 miasta."),
    ("Zlecenia z umową na zakład", 2, 2.4, "na miesiąc", "Założenie do sprawdzenia w pilocie."),
    ("Zlecenia z umową razem", "=B7*B8", "=C7*C8", "na miesiąc", "Wyliczone."),
    ("Zapytania na jedno zlecenie", 2, 2, "zapytania", "Założenie: połowa zapytań kończy się umową."),
    ("SMS-y z linkiem na zlecenie", 2, 2, "SMS-y", "Pierwszy link i jedno przypomnienie (limit w bazie: 3 na dobę)."),
    ("Części jednego SMS-a", 3, 3, "części", "Wzór SMS-a z polskimi literami ma ok. 170 znaków = 3 części po 67 znaków. Bez polskich liter: 2."),
    ("Cena części SMS netto", 0.17, "=B13", "zł", "SMSAPI: 0,17 zł przy doładowaniu 49–499 zł; 0,16 zł przy 500–1 999 zł (smsapi.pl/cennik). Jedna cena dla obu scenariuszy."),
    ("Osoby z firmowym e-mailem", 2, 3, "osoby", "Założenie."),
    ("Jedyny wspólnik płaci ZUS (1 = tak, 0 = nie)", 0, 0, "", "Przy jednym wspólniku obowiązkowy ZUS i składka zdrowotna (ok. 2 619 zł/mies.). Przy dwóch i więcej wspólnikach bez wynagrodzenia – 0 (norman.finance)."),
    ("Opłata Ostoi za zlecenie z umową", 250, 250, "zł netto", "Model z panelu partnera: opłata tylko za podpisaną umowę. Jeśli w pilocie zakłady testują za darmo, wpisz 0 w kolumnie Pilot."),
]
for r, (name, p, s, unit, src) in enumerate(params, start=5):
    z.cell(row=r, column=1, value=name).font = NORM
    for col, v in ((2, p), (3, s)):
        c = z.cell(row=r, column=col, value=v)
        c.font = NORM if isinstance(v, str) and v.startswith("=") else BLUE
        c.number_format = NUM if r != 5 else "0.0000"
    z.cell(row=r, column=4, value=unit).font = NORM
    z.cell(row=r, column=5, value=src).font = NORM
for r in (7, 8, 15, 16):
    z.cell(row=r, column=2).fill = KEY_FILL; z.cell(row=r, column=3).fill = KEY_FILL
z.column_dimensions["A"].width = 44; z.column_dimensions["B"].width = 12; z.column_dimensions["C"].width = 12
z.column_dimensions["D"].width = 14; z.column_dimensions["E"].width = 110

ZA = "'Założenia'"
KURS = f"{ZA}!$B$5"

# ---------------- Jednorazowe ----------------
j = wb.create_sheet("Jednorazowe")
j["A1"] = "Koszty jednorazowe (przed pilotem)"; j["A1"].font = TITLE
j["A2"] = "Programiści: 0 zł (aplikację budujesz z Claude). Kwoty netto; „szacunek” = brak publicznego cennika, kwota do potwierdzenia ofertą."
j["A2"].font = Font(name=F, italic=True)
for i, h in enumerate(["Pozycja", "Kategoria", "Kwota netto", "Rodzaj", "Źródło / uwagi", "Kiedy"], 1):
    c = j.cell(row=4, column=i, value=h); c.font = BOLD; c.fill = HEAD_FILL
one = [
    ("Rejestracja sp. z o.o. przez S24 (opłata sądowa 250 zł + PCC)", "Spółka", 274, "cennik", "norman.finance, stan na 9.10.2026. Ogłoszenie w MSiG bezpłatne od 29.11.2025."),
    ("Znak towarowy w UPRP – zgłoszenie elektroniczne, klasa 1", "Marka", 400, "cennik", "Klasa 35 (pośrednictwo, platforma). poradnikprzedsiebiorcy.pl – stawki z rozporządzenia z 2016 r.; sprawdź w UPRP przed zgłoszeniem."),
    ("Znak towarowy – 2 kolejne klasy (42, 45) × 120 zł", "Marka", "=2*120", "cennik", "Klasy 42 (oprogramowanie jako usługa) i 45 (usługi związane z pogrzebem)."),
    ("Znak towarowy – opłata za 10 lat ochrony, 3 klasy × 400 zł", "Marka", "=3*400", "cennik", "Płatna po decyzji o udzieleniu prawa."),
    ("Znak towarowy – publikacja o udzieleniu prawa", "Marka", 90, "cennik", "Jak wyżej."),
    ("Regulaminy, polityka prywatności, umowa partnerska, umowa powierzenia danych", "Prawo i RODO", 6000, "szacunek", "Kancelaria; 2 regulaminy (rodziny, zakłady), DPA z zakładami, klauzule. Wyceny kancelarii zwykle 4–10 tys. zł."),
    ("Przegląd bezpieczeństwa i RODO przed prawdziwymi danymi", "Prawo i RODO", 5000, "szacunek", "Warunek z CLAUDE.md. Test aplikacji + rejestr czynności przetwarzania."),
    ("Domena .pl – pierwszy rok", "Infrastruktura", 16.69, "cennik", "OVHcloud: 16,69 zł netto pierwszy rok, odnowienie 58,99 zł netto."),
    ("Wizytówki 2 × 100 szt.", "Materiały", 150, "szacunek", "Druk cyfrowy, papier niepowlekany 350 g."),
    ("Naklejki „Partner Ostoi” 120 × 120 mm, 10 szt.", "Materiały", 200, "szacunek", "Folia matowa."),
    ("Test penetracyjny aplikacji (zewnętrzna firma)", "Prawo i RODO", 8000, "szacunek", "Przed startem z prawdziwymi danymi (dokument RODO, rozdz. 8). Mała aplikacja webowa: zwykle kilka–kilkanaście tys. zł, zależnie od zakresu – do potwierdzenia ofertą."),
]
WHEN = {"Test penetracyjny aplikacji (zewnętrzna firma)": "Start"}
start = 5
for i, (name, cat, amt, kind, src) in enumerate(one):
    r = start + i
    j.cell(row=r, column=1, value=name).font = NORM
    j.cell(row=r, column=2, value=cat).font = NORM
    c = j.cell(row=r, column=3, value=amt); c.number_format = PLN2
    c.font = NORM if isinstance(amt, str) else BLUE
    j.cell(row=r, column=4, value=kind).font = NORM
    j.cell(row=r, column=5, value=src).font = NORM
    j.cell(row=r, column=6, value=WHEN.get(name, "Pilot")).font = BLUE
end = start + len(one) - 1
tr = end + 1
j.cell(row=tr, column=1, value="Razem koszty jednorazowe").font = BOLD
c = j.cell(row=tr, column=3, value=f"=SUM(C{start}:C{end})"); c.font = BOLD; c.number_format = PLN2
for col in range(1, 7): j.cell(row=tr, column=col).fill = TOTAL_FILL
j.cell(row=tr + 1, column=1, value="w tym przed pilotem").font = NORM
c = j.cell(row=tr + 1, column=3, value=f'=SUMIFS(C{start}:C{end},F{start}:F{end},"Pilot")'); c.number_format = PLN2; c.font = NORM
j.cell(row=tr + 2, column=1, value="w tym przed startem z prawdziwymi danymi").font = NORM
c = j.cell(row=tr + 2, column=3, value=f'=SUMIFS(C{start}:C{end},F{start}:F{end},"Start")'); c.number_format = PLN2; c.font = NORM
j.cell(row=tr + 2, column=5, value="Kolumna Kiedy: wpisz Pilot albo Start – od tego zależy, do którego scenariusza trafia koszt.").font = NORM
j.cell(row=tr + 4, column=1, value="Kapitał zakładowy (minimum)").font = NORM
c = j.cell(row=tr + 4, column=3, value=5000); c.font = BLUE; c.number_format = PLN
j.cell(row=tr + 4, column=5, value="To nie jest koszt – pieniądze zostają w spółce i można je wydać na jej potrzeby. Liczymy je do gotówki potrzebnej na start.").font = NORM
J_TOTAL = f"Jednorazowe!$C${tr}"
J_PILOT = f"Jednorazowe!$C${tr + 1}"
J_START = f"Jednorazowe!$C${tr + 2}"
J_CAPITAL = f"Jednorazowe!$C${tr + 4}"
for col, w in zip("ABCDEF", (70, 16, 14, 11, 110, 9)):
    j.column_dimensions[col].width = w

# ---------------- Miesięczne ----------------
m = wb.create_sheet("Miesięczne")
m["A1"] = "Koszty miesięczne"; m["A1"].font = TITLE
m["A2"] = "Kwota = cena jednostkowa (w USD przeliczona po kursie z Założeń) × ilość. Ilości i ceny na niebiesko można zmieniać."
m["A2"].font = Font(name=F, italic=True)
heads = ["Pozycja", "Kategoria", "Cena jedn.", "Waluta", "Ilość – pilot", "Ilość – start", "Pilot / mies.", "Start / mies.", "Rodzaj", "Źródło / uwagi"]
for i, h in enumerate(heads, 1):
    c = m.cell(row=4, column=i, value=h); c.font = BOLD; c.fill = HEAD_FILL
monthly = [
    ("Supabase Pro – baza produkcyjna (Frankfurt), compute Micro w cenie", "Infrastruktura", 25, "USD", 1, 1, "cennik", "25 USD/mies. z kredytem 10 USD, który pokrywa instancję Micro (makerkit.dev, 2026)."),
    ("Supabase – drugi projekt (wersja testowa), compute Micro", "Infrastruktura", 10, "USD", 0, 1, "cennik", "W pilocie wersja testowa na planie Free (usypia po tygodniu bez ruchu)."),
    ("Vercel Pro – 1 miejsce", "Infrastruktura", 20, "USD", 1, 1, "cennik", "20 USD za miejsce, zawiera 20 USD kredytu na ruch. Plan Hobby nie pozwala na użytek komercyjny."),
    ("Domena .pl – odnowienie (1/12 roku)", "Infrastruktura", "=58.99/12", "PLN", 0, 1, "cennik", "OVHcloud: 58,99 zł netto rocznie od drugiego roku."),
    ("E-maile z linkami logowania – własny SMTP (Brevo, plan Free)", "Infrastruktura", 0, "USD", 1, 1, "cennik", "Wymagany: wbudowana poczta Supabase wysyła tylko do członków zespołu projektu. Brevo (firma z UE): 300 e-maili dziennie za darmo, plan Starter od 9 USD/mies."),
    ("Monitoring błędów (wbudowany – panel administratora → Błędy)", "Infrastruktura", 0, "PLN", 1, 1, "cennik", "Zbudowany w aplikacji 16.10.2026, bez danych osobowych; bez zewnętrznej usługi."),
    ("Klepsydry online i obrazy podglądu linków", "Infrastruktura", 0, "PLN", 1, 1, "cennik", "W ramach Vercel Pro (funkcje i ruch mieszczą się w kredycie 20 USD przy skali pilotu)."),
    ("SMS z linkiem dla rodziny (części SMS)", "Powiadomienia", f"={ZA}!B13", "PLN",
     f"={ZA}!B9*{ZA}!B11*{ZA}!B12", f"={ZA}!C9*{ZA}!C11*{ZA}!C12", "cennik", "Ilość = zlecenia × SMS-y na zlecenie × części. Cena z Założeń (SMSAPI)."),
    ("SMS z kodem weryfikacji numeru rodziny", "Powiadomienia", f"={ZA}!B13", "PLN",
     f"={ZA}!B9*{ZA}!B10", f"={ZA}!C9*{ZA}!C10", "cennik", "Wdrożone: kod przed wysłaniem zapytania, bez polskich liter = 1 część. Ilość = zapytania (zlecenia × zapytania na zlecenie); ponowne wysyłki kodu zwiększą ją nieznacznie."),
    ("Powiadomienia push (web push)", "Powiadomienia", 0, "PLN", 1, 1, "cennik", "Bezpłatne – przez przeglądarkę, bez aplikacji w sklepie."),
    ("Claude Max 5x – narzędzie, w którym powstaje aplikacja", "Narzędzia", 100, "USD", 1, 1, "cennik", "100 USD/mies. (support.claude.com). Po zbudowaniu wersji 1 wystarczy Pro – 20 USD."),
    ("Google Workspace Business Starter (plan roczny)", "Narzędzia", 31.5, "PLN", f"={ZA}!B14", f"={ZA}!C14", "cennik", "31,50 zł za osobę/mies. przy umowie rocznej, 37,80 zł elastycznie (antyweb.pl, cennik od 2025)."),
    ("Pełna księgowość sp. z o.o.", "Spółka", 800, "PLN", 1, 1, "szacunek", "Biura rachunkowe: 600–1 500 zł netto/mies. (norman.finance, 2026)."),
    ("Konto firmowe", "Spółka", 30, "PLN", 1, 1, "szacunek", "0–100 zł/mies."),
    ("Adres siedziby (wirtualne biuro)", "Spółka", 100, "PLN", 1, 1, "szacunek", "40–250 zł/mies.; 0 zł, jeśli siedziba w lokalu wspólnika."),
    ("ZUS i składka zdrowotna jedynego wspólnika", "Spółka", "=1788.29+830.58", "PLN", f"={ZA}!B15", f"={ZA}!C15", "cennik", "1 788,29 zł ZUS + 830,58 zł zdrowotna w 2026 (norman.finance). Tylko przy jednym wspólniku."),
    ("Ubezpieczenie cyber (1/12 składki rocznej)", "Spółka", "=2000/12", "PLN", 0, 1, "szacunek", "Mikrofirmy: 1 000–3 000 zł rocznie (freenance.io). W pilocie tylko dane testowe – bez polisy."),
    ("Telefon opiekuna 24/7 (abonament)", "Operacje", 40, "PLN", 1, 1, "szacunek", "Osobny numer, który można przekierować na dyżurnego."),
    ("Opiekun nocny – ryczałt za dyżur pod telefonem", "Operacje", 3000, "PLN", 0, 1, "szacunek", "W pilocie dyżurują wspólnicy. Kwota do ustalenia z osobą na umowie zlecenia."),
    ("Dojazdy do zakładów (wdrożenie, szkolenia)", "Sprzedaż", 1, "PLN", 400, 800, "szacunek", "Pilot: Łódź; start: 2–3 miasta."),
    ("Reklama dla rodzin (Google Ads)", "Marketing", 1, "PLN", 1500, 4000, "szacunek", "Budżet do ustalenia. Google nie publikuje cennika – koszt kliknięcia zależy od aukcji i miasta."),
    ("Dodruk materiałów dla zakładów", "Materiały", 100, "PLN", 0, 1, "szacunek", ""),
]
ms = 5
for i, (name, cat, price, cur, qp, qs, kind, src) in enumerate(monthly):
    r = ms + i
    m.cell(row=r, column=1, value=name).font = NORM
    m.cell(row=r, column=2, value=cat).font = NORM
    c = m.cell(row=r, column=3, value=price); c.number_format = PLN2 if cur == "PLN" else '#,##0.00 "USD"'
    c.font = (GREEN if "Założenia" in str(price) else NORM) if isinstance(price, str) else BLUE
    m.cell(row=r, column=4, value=cur).font = NORM
    for col, q in ((5, qp), (6, qs)):
        c = m.cell(row=r, column=col, value=q); c.number_format = NUM
        c.font = (GREEN if "Założenia" in str(q) else NORM) if isinstance(q, str) else BLUE
    for col, qcol in ((7, "E"), (8, "F")):
        c = m.cell(row=r, column=col, value=f'=IF($D{r}="USD",$C{r}*{KURS},$C{r})*{qcol}{r}')
        c.number_format = PLN2; c.font = NORM
    m.cell(row=r, column=9, value=kind).font = NORM
    m.cell(row=r, column=10, value=src).font = NORM
me = ms + len(monthly) - 1
mt = me + 1
m.cell(row=mt, column=1, value="Razem miesięcznie").font = BOLD
for col in (7, 8):
    L = get_column_letter(col)
    c = m.cell(row=mt, column=col, value=f"=SUM({L}{ms}:{L}{me})"); c.font = BOLD; c.number_format = PLN2
for col in range(1, 11): m.cell(row=mt, column=col).fill = TOTAL_FILL
M_PILOT = f"'Miesięczne'!$G${mt}"
M_START = f"'Miesięczne'!$H${mt}"
for col, w in zip("ABCDEFGHIJ", (62, 15, 13, 8, 13, 13, 15, 15, 10, 100)):
    m.column_dimensions[col].width = w

# Podsumowanie kosztów wg kategorii (pod tabelą)
cats = ["Infrastruktura", "Powiadomienia", "Narzędzia", "Spółka", "Operacje", "Sprzedaż", "Marketing", "Materiały"]
cr = mt + 3
m.cell(row=cr - 1, column=1, value="Według kategorii").font = BOLD
for i, h in enumerate(["Kategoria", "", "", "", "", "", "Pilot / mies.", "Start / mies."], 1):
    if h: c = m.cell(row=cr, column=i, value=h); c.font = BOLD; c.fill = HEAD_FILL
for i, cat in enumerate(cats, start=1):
    r = cr + i
    m.cell(row=r, column=1, value=cat).font = NORM
    for col in (7, 8):
        L = get_column_letter(col)
        c = m.cell(row=r, column=col, value=f'=SUMIFS({L}${ms}:{L}${me},$B${ms}:$B${me},$A{r})'); c.number_format = PLN2; c.font = NORM
ce = cr + len(cats)
m.cell(row=ce + 1, column=1, value="Kontrola: suma kategorii = razem").font = Font(name=F, italic=True)
for col in (7, 8):
    L = get_column_letter(col)
    c = m.cell(row=ce + 1, column=col, value=f'=IF(ROUND(SUM({L}{cr+1}:{L}{ce})-{L}{mt},2)=0,"OK","SPRAWDŹ")'); c.font = Font(name=F, italic=True)

# ---------------- Podsumowanie ----------------
p = wb.create_sheet("Podsumowanie", 0)
p["A1"] = "Ostoja – kosztorys bez kosztów programistów"; p["A1"].font = TITLE
p["A2"] = "Kwoty netto w złotych. Wszystko wylicza się z zakładek Założenia, Jednorazowe i Miesięczne."
p["A2"].font = Font(name=F, italic=True)
for i, h in enumerate(["", "Pilot", "Start"], 1):
    c = p.cell(row=4, column=i, value=h); c.font = BOLD; c.fill = HEAD_FILL
p.cell(row=4, column=4, value="Jak liczone").font = BOLD; p.cell(row=4, column=4).fill = HEAD_FILL
rows = [
    ("Długość scenariusza (miesiące)", f"={ZA}!B6", f"={ZA}!C6", "Z Założeń.", NUM),
    ("Koszty jednorazowe", f"={J_PILOT}", f"={J_START}", "Pilot: przed pilotem. Start: przed prawdziwymi danymi (np. test penetracyjny).", PLN),
    ("Koszty miesięczne", f"={M_PILOT}", f"={M_START}", "Suma z zakładki Miesięczne.", PLN),
    ("Koszt całego scenariusza", "=B6+B7*B5", "=C6+C7*C5", "Jednorazowe + miesięczne × liczba miesięcy.", PLN),
    ("Zlecenia z umową miesięcznie", f"={ZA}!B9", f"={ZA}!C9", "Zakłady × zlecenia na zakład.", NUM),
    ("Przychód miesięczny (opłata Ostoi)", f"=B9*{ZA}!B16", f"=C9*{ZA}!C16", "Zlecenia × 250 zł.", PLN),
    ("Wynik miesięczny", "=B10-B7", "=C10-C7", "Przychód − koszty miesięczne (przed podatkiem).", PLN),
    ("Próg rentowności – zlecenia miesięcznie", f"=ROUNDUP(B7/{ZA}!B16,0)", f"=ROUNDUP(C7/{ZA}!C16,0)", "Ile podpisanych umów pokrywa koszty miesięczne.", NUM),
    ("Próg rentowności – zlecenia na zakład", f"=IF({ZA}!B7=0,0,B12/{ZA}!B7)", f"=IF({ZA}!C7=0,0,C12/{ZA}!C7)", "Próg ÷ liczba zakładów.", '0.0'),
    ("Gotówka potrzebna na start", f"=B6+{J_CAPITAL}+B7*B5-B10*B5", "", "Jednorazowe + kapitał + koszty pilotu − przychód z pilotu.", PLN),
]
for i, (name, a, b, how, fmt) in enumerate(rows, start=5):
    p.cell(row=i, column=1, value=name).font = BOLD if name.startswith(("Koszt całego", "Wynik", "Gotówka")) else NORM
    for col, v in ((2, a), (3, b)):
        c = p.cell(row=i, column=col, value=v); c.number_format = fmt
        c.font = GREEN if isinstance(v, str) and "!" in v else NORM
    p.cell(row=i, column=4, value=how).font = NORM
for r in (8, 11, 14):
    for col in range(1, 5): p.cell(row=r, column=col).fill = TOTAL_FILL
p["A16"] = "Uwagi"; p["A16"].font = BOLD
notes = [
    "Nie liczymy wynagrodzeń programistów – aplikację rozwijasz z Claude (koszt narzędzia jest w zakładce Miesięczne).",
    "Usługi z USA (Supabase, Vercel, Claude) rozlicza się bez polskiego VAT (import usług); polskie faktury – netto, VAT do odliczenia po rejestracji do VAT.",
    "Przy jednym wspólniku dochodzi ok. 2 619 zł ZUS i składki zdrowotnej miesięcznie – przełącznik w zakładce Założenia.",
    "Pozycje „szacunek” trzeba potwierdzić ofertami (kancelaria, test penetracyjny, księgowość, ubezpieczenie, druk). Ceny z cenników sprawdzono 15–16.10.2026.",
    "Zmiany 16.10.2026: kurs NBP z 16.10, wdrożony kod SMS dla rodziny, własny serwer poczty dla linków logowania, monitoring błędów i klepsydry online w aplikacji (bez dodatkowych opłat), test penetracyjny przed startem.",
]
for i, t in enumerate(notes, start=17):
    p.cell(row=i, column=1, value=f"• {t}").font = NORM
p.column_dimensions["A"].width = 44; p.column_dimensions["B"].width = 16; p.column_dimensions["C"].width = 16; p.column_dimensions["D"].width = 70

# ---------------- Źródła ----------------
s = wb.create_sheet("Źródła")
s["A1"] = "Źródła cen (sprawdzone 15–16.10.2026)"; s["A1"].font = TITLE
srcs = [
    ("Kurs NBP USD/PLN 16.10.2026", "https://comparic.pl/dolar-kolejny-dzien-mocno-traci-co-dzieje-sie-z-kursami-dolara-euro-franka-i-funta-16-10-2026/"),
    ("Supabase – cennik planów 2026", "https://makerkit.dev/blog/md/saas/supabase-pricing"),
    ("Vercel – cennik 2026", "https://makerkit.dev/blog/saas/vercel-cost"),
    ("SMSAPI – cennik", "https://www.smsapi.pl/cennik"),
    ("Założenie sp. z o.o. – S24 i notariusz (2026)", "https://norman.finance/pl/blog/jak-zalozyc-spolke-z-o-o"),
    ("Koszty prowadzenia sp. z o.o. miesięcznie (2026)", "https://norman.finance/pl/blog/ile-kosztuje-prowadzenie-spolki-z-o-o"),
    ("Opłaty za znak towarowy w UPRP", "https://poradnikprzedsiebiorcy.pl/-oplaty-za-rejestracje-znaku-towarowego-ile-wynosza"),
    ("Domena .pl – OVHcloud", "https://www.ovhcloud.com/pl/domains/tld/pl/"),
    ("Google Workspace – ceny w złotych", "https://antyweb.pl/google-miesza-z-cenami-tlumaczymy-nowy-cennik"),
    ("Brevo – plany i limity (2026)", "https://toolquestor.com/pl/tool/brevo"),
    ("Supabase – wbudowana poczta tylko dla członków zespołu (własny SMTP)", "https://supabase.com/docs/guides/auth/auth-smtp"),
    ("Claude Max – cena", "https://support.claude.com/en/articles/11049744-how-much-does-the-max-plan-cost"),
    ("Claude Pro – cena", "https://support.claude.com/en/articles/8325606"),
    ("Ubezpieczenie cyber 2026 – widełki", "https://freenance.io/ubezpieczenia/ubezpieczenie-cyber-2026-poland-koszt-firma-hacking-ransomware-rodo-procedura/"),
    ("Google Ads – jak naliczany jest koszt", "https://business.google.com/pl/resources/articles/google-ads-cost/"),
]
for i, (n, u) in enumerate(srcs, start=3):
    s.cell(row=i, column=1, value=n).font = NORM
    c = s.cell(row=i, column=2, value=u); c.hyperlink = u; c.font = Font(name=F, color="3F5650", underline="single")
s.column_dimensions["A"].width = 48; s.column_dimensions["B"].width = 120

for ws in wb.worksheets:
    ws.sheet_view.showGridLines = False
    for row in ws.iter_rows():
        for c in row:
            if c.font is None or c.font.name != F:
                c.font = Font(name=F, bold=c.font.bold if c.font else False, color=c.font.color if c.font else None)
    ws.freeze_panes = "A5" if ws.title not in ("Źródła",) else None
wb.save(OUT)
print(OUT)
