-- Monitoring błędów: zapis tylko przez serwer, grupowanie, drugie czyszczenie w bazie, odczyt tylko dla administratorów.
begin;

set local role anon;
do $$ begin
  begin
    perform log_app_error(repeat('a', 32), 'serwer', '/x', 'y', null);
    raise exception 'FAIL: anon zapisał błąd';
  exception when insufficient_privilege then null;
  end;
end $$;

set local role service_role;
select log_app_error(repeat('b', 32), 'serwer', '/panel/zlecenia/[id]', 'SMS do +48 600 100 200 dla ewa@example.com nie wyszedł', 'abc123');
select log_app_error(repeat('b', 32), 'serwer', '/panel/zlecenia/[id]', 'SMS do +48 600 100 200 dla ewa@example.com nie wyszedł', null);

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
do $$ begin
  begin
    perform * from admin_errors();
    raise exception 'FAIL: zakład widzi błędy aplikacji';
  exception when insufficient_privilege then null;
  end;
  begin
    perform * from app_errors;
    raise exception 'FAIL: bezpośredni odczyt app_errors';
  exception when insufficient_privilege then null;
  end;
end $$;

select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000009","role":"authenticated"}', true);
do $$
declare e record;
begin
  select * into e from admin_errors() where route = '/panel/zlecenia/[id]';
  assert e.count = 2, 'błędy nie zgrupowane';
  assert e.last_digest = 'abc123', 'digest zgubiony';
  assert e.message not like '%600%' and e.message not like '%ewa@%', 'dane osobowe w komunikacie: ' || e.message;
end $$;

-- Retencja.
reset role;
update app_errors set last_seen = now() - interval '31 days';
do $$ begin
  assert (purge_old_data()->>'bledy')::int = 1, 'retencja błędów';
end $$;

rollback;
