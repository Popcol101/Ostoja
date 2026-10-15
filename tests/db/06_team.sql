-- Zespół: zaproszenia, przyjęcie tylko przez konto z tym samym e-mailem, usuwanie członków.
begin;
create temp table t (k text primary key, v text);
grant all on t to anon, authenticated;

insert into auth.users (id, email) values
  ('00000000-0000-4000-8000-0000000000a1', 'nowa@cisza.test'),
  ('00000000-0000-4000-8000-0000000000a2', 'obca@inna.test');

-- Ekipa i biuro nie zapraszają.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000002","role":"authenticated"}', true);
do $$ begin
  perform create_invitation('x@y.pl', 'biuro', 'Ktoś');
  raise exception 'FAIL: biuro zaprosiło';
exception when insufficient_privilege then null;
end $$;

-- Właścicielka zaprasza.
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
insert into t values ('token', create_invitation(' Nowa@Cisza.test ', 'biuro', 'Nowa Osoba'));
do $$ begin
  assert (select count(*) from team_invitations()) = 1, 'brak zaproszenia na liście';
  assert (select email from team_invitations()) = 'nowa@cisza.test', 'e-mail nie znormalizowany';
  assert (select count(*) from team_members()) = 3, 'Cisza ma 3 osoby';
  -- tabela zaproszeń niedostępna wprost
  begin
    perform * from invitations;
    raise exception 'FAIL: odczyt invitations';
  exception when insufficient_privilege then null;
  end;
  -- istniejący członek nie może być zaproszony
  begin
    perform create_invitation('ewa@cisza.test', 'biuro', 'Ewa');
    raise exception 'FAIL: zaproszono członka';
  exception when raise_exception then null;
  end;
end $$;

-- Inny zakład nie widzi zaproszeń Ciszy.
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000004","role":"authenticated"}', true);
do $$ begin
  assert (select count(*) from team_invitations()) = 0, 'Piotr widzi zaproszenia Ciszy';
  assert not exists (select 1 from team_members() where email like '%cisza%'), 'Piotr widzi zespół Ciszy';
end $$;

-- Osoba z linkiem (anon): podgląd i przyjęcie.
set local role anon;
do $$
declare tok text := (select v from t where k = 'token');
begin
  assert (select status from invitation_preview(tok)) = 'aktywne', 'podgląd: status';
  assert (select email_hint from invitation_preview(tok)) = 'no•••@cisza.test', 'podgląd: maska e-mail';
  assert (select count(*) from invitation_preview('zly-token')) = 0, 'zły token coś zwrócił';
  -- obce konto nie przyjmie zaproszenia
  begin
    perform accept_invitation(tok, '00000000-0000-4000-8000-0000000000a2');
    raise exception 'FAIL: obce konto przyjęło zaproszenie';
  exception when insufficient_privilege then null;
  end;
  perform accept_invitation(tok, '00000000-0000-4000-8000-0000000000a1');
  assert (select status from invitation_preview(tok)) = 'przyjete', 'po przyjęciu: status';
  begin
    perform accept_invitation(tok, '00000000-0000-4000-8000-0000000000a1');
    raise exception 'FAIL: drugie przyjęcie';
  exception when raise_exception then null;
  end;
end $$;

-- Nowa osoba ma rolę biuro w Ciszy.
reset role;
do $$ begin
  assert (select role from memberships where user_id = '00000000-0000-4000-8000-0000000000a1')::text = 'biuro', 'rola po przyjęciu';
end $$;

-- Usuwanie: tylko właściciel, nie siebie.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000002","role":"authenticated"}', true);
do $$ begin
  perform remove_member('00000000-0000-4000-8000-0000000000a1');
  raise exception 'FAIL: biuro usunęło osobę';
exception when raise_exception then null;
end $$;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
do $$ begin
  begin
    perform remove_member('00000000-0000-4000-8000-000000000001');
    raise exception 'FAIL: usunięto siebie';
  exception when raise_exception then
    if sqlerrm like 'FAIL%' then raise; end if;
  end;
  perform remove_member('00000000-0000-4000-8000-0000000000a1');
  assert (select count(*) from team_members()) = 3, 'po usunięciu: 3 osoby';
  -- odwołanie zaproszenia
  perform revoke_invitation(i.id) from team_invitations() i;
end $$;
-- Odwołane zaproszenie przestaje działać.
insert into t values ('t2', create_invitation('druga@cisza.test', 'ekipa', 'Druga Osoba'))
  on conflict (k) do update set v = excluded.v;
do $$ begin
  perform revoke_invitation((select id from team_invitations() limit 1));
  assert (select count(*) from team_invitations()) = 0, 'odwołane wciąż na liście';
end $$;
set local role anon;
do $$ begin
  assert (select status from invitation_preview((select v from t where k = 't2'))) = 'odwolane', 'status odwołanego';
  assert invitation_email((select v from t where k = 't2')) is null, 'odwołane zwraca e-mail';
end $$;

rollback;
