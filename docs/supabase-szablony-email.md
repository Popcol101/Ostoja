# E-maile i logowanie

Od 17.10.2026 zakłady logują się **e-mailem i hasłem**. Wszystkie e-maile wysyła aplikacja przez API Brevo
(`src/lib/mail.ts`, treść w `src/lib/emails.ts`). Supabase Auth tylko trzyma konta i sprawdza hasła –
jego szablony e-maili (Magic Link, Invite, Reset password) **nie są używane**.

## Jak to działa

| Sytuacja | Co się dzieje |
| --- | --- |
| Zaproszenie (właściciel w /panel/zespol albo administrator w /admin/zaklady/…) | Aplikacja tworzy zaproszenie (7 dni) i wysyła e-mail „Zaproszenie do panelu Ostoi – {zakład}” z linkiem `/zaproszenie?t=…`. „Wyślij ponownie” unieważnia poprzedni link. |
| Nowa osoba otwiera link | Ustawia hasło (min. 12 znaków, nie z wycieków). Aplikacja zakłada konto z hasłem (Admin API) i od razu loguje. |
| Osoba z kontem w Ostoi (np. pracuje w dwóch zakładach) | Na stronie zaproszenia wpisuje swoje hasło i dołącza do kolejnego zakładu. |
| Logowanie | `/logowanie`: e-mail i hasło. 30 prób na 15 minut z jednego adresu IP. |
| „Nie pamiętam hasła” | `/logowanie/haslo` → e-mail „Ustaw hasło do panelu Ostoi” z linkiem `/logowanie/nowe-haslo?token_hash=…` (godzina, jednorazowy, token z Admin API `generate_link`, typ recovery). Ten sam komunikat dla nieznanych adresów. |
| Konto bez hasła (założone przed 17.10.2026) | Używa „Nie pamiętam hasła”. |

Otwarcie linku nic nie zmienia – zaproszenie przyjmuje się i token zużywa dopiero po wysłaniu formularza,
więc skanery poczty, które same otwierają linki, ich nie zepsują.

## Ustawienia

**Vercel (zmienne środowiskowe, Production i Preview):**

| Zmienna | Wartość |
| --- | --- |
| `BREVO_API_KEY` | klucz z Brevo → SMTP & API → API Keys → Generate a new API key (typ **Sensitive**, wpisuje właściciel) |
| `MAIL_FROM` | `logowanie@ostoja.org` |
| `MAIL_FROM_NAME` | `Ostoja` (domyślnie) |

Bez `BREVO_API_KEY` panel pokazuje link zaproszenia do skopiowania, a „Nie pamiętam hasła” jest niedostępne.

**Supabase (Authentication):**

| Gdzie | Wartość |
| --- | --- |
| Sign In / Providers → Email → Allow new users to sign up | **wyłączone** (konta zakłada aplikacja) |
| Sign In / Providers → Email → Confirm email | włączone (konta z aplikacji są od razu potwierdzone) |
| Sign In / Providers → Email → Minimum password length | 12 |
| URL Configuration → Site URL | `https://ostoja.org` |
| Emails → SMTP Settings | Brevo (`smtp-relay.brevo.com:587`) – zostaje jako zapas, Supabase nic nie wysyła |

**Brevo:** domena `ostoja.org` uwierzytelniona (DKIM, DMARC), nadawca `logowanie@ostoja.org`.
Brevo nie pozwala wyłączyć śledzenia kliknięć dla pojedynczej wiadomości – link w e-mailu może przechodzić przez
przekierowanie Brevo. Jeśli w ustawieniach konta jest opcja wyłączenia śledzenia dla e-maili transakcyjnych, wyłącz ją.

## Hasła

- Co najmniej 12 znaków, najwyżej 72 bajty (limit bcrypt w Supabase). Bez wymogów typu „wielka litera i cyfra”.
- Odrzucamy hasła z wycieków: do Have I Been Pwned trafia tylko 5 znaków skrótu SHA-1 (k-anonimowość).
  Gdy serwis nie odpowiada, hasło przechodzi. `PWNED_CHECK=off` wyłącza sprawdzenie (testy).
- Pole „Pokaż” przy haśle – łatwiej wpisać długie hasło na telefonie.
