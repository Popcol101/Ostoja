-- Przegląd bezpieczeństwa: uprawnienia do funkcji i limit prób.
begin;

-- Żadna funkcja security definer w schemacie public nie jest wykonywalna dla PUBLIC (domyślne uprawnienie).
do $$
declare bad text;
begin
  select string_agg(p.proname, ', ') into bad
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.prosecdef and p.prokind = 'f'
    and (p.proacl is null or exists (select 1 from aclexplode(p.proacl) a where a.grantee = 0));
  assert bad is null, 'funkcje security definer dostępne dla PUBLIC: ' || coalesce(bad, '');
end $$;

-- Rola anon (publiczne API Supabase) może tylko to, czego potrzebuje strona dla rodzin.
do $$
declare extra text;
begin
  select string_agg(p.proname, ', ' order by p.proname) into extra
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.prosecdef and has_function_privilege('anon', p.oid, 'execute')
    and p.proname not in ('search_homes', 'home_price_list', 'family_get_order', 'family_update_order',
                          'public_memorial', 'invitation_preview');
  assert extra is null, 'anon ma dostęp do: ' || coalesce(extra, '');
end $$;

set local role anon;
do $$ begin
  assert (select count(*) from search_homes('lodz', 'kremacja', 'bez')) > 0, 'rodzina nie widzi ofert';
  begin
    perform quote_for('00000000-0000-4000-a000-000000000006', 'kremacja', 'bez');
    raise exception 'FAIL: anon wycenił niezweryfikowany zakład';
  exception when insufficient_privilege then null;
  end;
  begin
    perform hit_rate_limit('x', 1, 60);
    raise exception 'FAIL: anon zmienia limity';
  exception when insufficient_privilege then null;
  end;
end $$;

set local role service_role;
do $$ begin
  assert hit_rate_limit('test:abc', 2, 3600), 'pierwsza próba';
  assert hit_rate_limit('test:abc', 2, 3600), 'druga próba';
  assert not hit_rate_limit('test:abc', 2, 3600), 'trzecia próba przeszła';
  assert hit_rate_limit('test:inny', 2, 3600), 'limit wspólny dla różnych kluczy';
end $$;

-- Retencja: dane kontaktowe ze starych zapytań znikają.
reset role;
update inquiries set created_at = now() - interval '91 days' where contact_name = 'Tomasz Lis';
set local role service_role;
do $$ begin
  assert (purge_old_data()->>'zapytania')::int >= 1, 'retencja nic nie usunęła';
end $$;
reset role;
do $$ begin
  assert not exists (select 1 from inquiries where contact_name = 'Tomasz Lis'), 'dane kontaktowe zostały';
  assert exists (select 1 from orders where principal_name is not null), 'retencja usunęła dane zleceń';
end $$;

rollback;
