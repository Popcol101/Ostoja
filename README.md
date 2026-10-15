# Ostoja

Platforma łącząca rodziny organizujące pogrzeb z zakładami pogrzebowymi: panel partnera i strona dla rodzin.
Stan prac: [docs/STAN.md](docs/STAN.md). Zasady dla Claude Code: [CLAUDE.md](CLAUDE.md).

## Baza danych lokalnie

Wymagany PostgreSQL 16 (z rozszerzeniami btree_gist i pgcrypto, są w standardowej instalacji).

```bash
# Ubuntu/Debian: sudo apt install postgresql-16   |   macOS: brew install postgresql@16
initdb -D .pgdata -U postgres --auth=trust -E UTF8
pg_ctl -D .pgdata -o "-p 54322" -l .pgdata/log start

./scripts/db-reset.sh     # baza "ostoja": nakładka auth + migracje + dane testowe
./tests/db/run.sh         # testy bazy na osobnej bazie "ostoja_test"
```

Z Dockerem i Supabase CLI: `npx supabase start`, a migracje i seed z `supabase/` wczytają się automatycznie
(plik `supabase/local/00_supabase_shim.sql` jest wtedy niepotrzebny).

## Na projekt Supabase

```bash
npx supabase link --project-ref <ref>
npx supabase db push        # tylko migracje, bez seeda
```

Nigdy nie wykonuj `supabase/local/00_supabase_shim.sql` na projekcie Supabase.

Wszystkie dane w `supabase/seed.sql` są fikcyjne.
