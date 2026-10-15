-- Harmonogram wysyłki powiadomień na projekcie Supabase (uruchom RAZ w SQL Editor, po wdrożeniu aplikacji).
-- Co minutę baza wywołuje /api/powiadomienia aplikacji. Wymaga rozszerzeń pg_cron i pg_net
-- (Database → Extensions). Podmień ADRES_APLIKACJI i SEKRET (ten sam co CRON_SECRET w Vercel).
-- Sekret trafia do Vault, nie do treści zadania.

create extension if not exists pg_cron;
create extension if not exists pg_net;

select vault.create_secret('SEKRET', 'ostoja_cron_secret');

select cron.schedule(
  'ostoja-powiadomienia',
  '* * * * *',
  $$
  select net.http_post(
    url := 'https://ADRES_APLIKACJI/api/powiadomienia',
    headers := jsonb_build_object(
      'authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'ostoja_cron_secret')
    )
  );
  $$
);

-- Sprawdzenie: select * from cron.job_run_details order by start_time desc limit 5;
-- Wyłączenie:  select cron.unschedule('ostoja-powiadomienia');
