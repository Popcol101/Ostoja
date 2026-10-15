-- Uwagi doradcy bezpieczeństwa Supabase (get_advisors, 15.10.2026):
--  * distance_km bez ustalonej ścieżki wyszukiwania,
--  * rozszerzenie btree_gist w schemacie public (wystawionym przez API).
-- Pozostałe uwagi są zamierzone: funkcje security definer dla anon to strona dla rodzin,
-- a dla authenticated – panel; każda sama sprawdza auth.uid() i członkostwo.
alter function public.distance_km(double precision, double precision, double precision, double precision)
  set search_path = public;

do $$ begin
  if exists (select 1 from pg_extension e join pg_namespace n on n.oid = e.extnamespace
             where e.extname = 'btree_gist' and n.nspname = 'public') then
    create schema if not exists extensions;
    alter extension btree_gist set schema extensions;
  end if;
end $$;
