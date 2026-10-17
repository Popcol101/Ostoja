# E-maile logowania w Supabase Auth

Ostoja wysyła przez Supabase Auth tylko jeden rodzaj wiadomości: link logowania do panelu („Magic Link”).
Konta zakładów zakłada opiekun albo właściciel zaproszeniem, więc rejestracja jest wyłączona, a szablon
„Confirm signup” nie jest używany.

## 1. Ustawienia (Authentication)

| Gdzie | Wartość |
| --- | --- |
| Sign In / Providers → Email → Allow new users to sign up | **wyłączone** |
| Sign In / Providers → Email → Confirm email | włączone (domyślnie) |
| URL Configuration → Site URL | `https://ostoja.org` |
| URL Configuration → Redirect URLs | `https://ostoja.org/**`, `https://ostoja-cyan.vercel.app/**` |
| Emails → SMTP Settings | własny serwer SMTP – patrz punkt 3 |

## 2. Szablon „Magic Link” (Authentication → Emails → Magic Link)

**Temat:** `Link do panelu Ostoi`

**Treść (HTML):**

```html
<div style="background:#ECEDEB;padding:32px 16px;font-family:Arial,Helvetica,sans-serif;color:#1E2422">
  <div style="max-width:480px;margin:0 auto;background:#FFFFFF;border:1px solid #D8DAD7;border-radius:14px;padding:28px 24px">
    <p style="margin:0 0 20px;font-family:Georgia,'Times New Roman',serif;font-size:22px;color:#1E2422">Ostoja</p>
    <p style="margin:0 0 16px;font-size:16px;line-height:1.5">Dzień dobry,</p>
    <p style="margin:0 0 24px;font-size:16px;line-height:1.5">
      oto link do panelu zakładu w Ostoi. Działa przez godzinę i tylko raz.
    </p>
    <p style="margin:0 0 24px">
      <a href="{{ .SiteURL }}/logowanie/potwierdz?token_hash={{ .TokenHash }}&type=email"
         style="display:inline-block;background:#3F5650;color:#FFFFFF;text-decoration:none;font-weight:bold;font-size:16px;padding:14px 22px;border-radius:10px">
        Zaloguj się do panelu
      </a>
    </p>
    <p style="margin:0;font-size:14px;line-height:1.5;color:#5C6461">
      Jeśli to nie Ty prosiłeś o link, zignoruj tę wiadomość – bez kliknięcia nikt się nie zaloguje.
    </p>
  </div>
</div>
```

Szablon można zmienić dopiero po zapisaniu własnego SMTP (od 3.06.2026 nowe projekty Free z wbudowaną pocztą Supabase
mają szablony zablokowane). Na telefonie treść edytuje się w zakładce „Source”, nie „Preview”. Telefon opiekuna dopiszemy,
gdy będzie znany.

Link prowadzi do strony `/logowanie/potwierdz`, która loguje dopiero po kliknięciu przycisku. Dzięki temu skanery
poczty (otwierające linki automatycznie) nie zużyją jednorazowego linku.

## 3. Własny serwer SMTP – potrzebny, zanim zalogują się zakłady

Wbudowana poczta Supabase wysyła wiadomości **tylko na adresy członków zespołu projektu** w Supabase
(Organization → Team) i najwyżej kilka na godzinę. Link do zakładu z innym adresem po prostu nie dojdzie.
Na testy z zakładami trzeba podłączyć dostawcę poczty (Emails → SMTP Settings → Enable custom SMTP):

- dostawca z serwerami w UE i umową powierzenia (np. Brevo, Mailjet; albo Resend, Postmark – wtedy przekazanie poza UE
  trzeba opisać w polityce prywatności),
- nadawca: adres w domenie Ostoi (np. `panel@twoja-domena.pl`) z rekordami SPF i DKIM ustawionymi u dostawcy domeny,
- nazwa nadawcy: `Ostoja`.

Do czasu podłączenia SMTP zakłady i opiekunowie logują się kontami testowymi na `/logowanie` (tryb demo).
Źródło: dokumentacja Supabase, „Send emails with custom SMTP” (https://supabase.com/docs/guides/auth/auth-smtp).
