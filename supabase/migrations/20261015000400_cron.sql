-- Ostoja: wygasanie ofert co minutę przez pg_cron (dostępny w Supabase).
-- Gdy pg_cron nie jest dostępny (np. lokalny PostgreSQL), wygasanie i tak działa:
-- get_inbox() i decline_offer() wywołują expire_offers() przy każdym odczycie skrzynki.
do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron;
    perform cron.schedule('ostoja-expire-offers', '* * * * *', 'select public.expire_offers()');
  else
    raise notice 'pg_cron niedostępny – pomijam harmonogram wygasania ofert';
  end if;
end $$;
