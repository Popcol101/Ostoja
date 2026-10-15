-- Zespół zakładu: zaproszenia pracowników przez właściciela, lista członków, usuwanie.
-- Zaproszenie to link z jednorazowym tokenem (w bazie tylko skrót SHA-256), ważny 7 dni.
-- Członkostwo powstaje wyłącznie dla konta, którego e-mail zgadza się z zaproszeniem.

create table public.invitations (
  id              uuid primary key default gen_random_uuid(),
  home_id         uuid not null references funeral_homes on delete cascade,
  email           text not null check (email = lower(email) and email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  role            member_role not null,
  display_name    text not null check (length(display_name) between 2 and 120),
  token_hash      text not null unique,
  invited_by      uuid references auth.users on delete set null,
  created_at      timestamptz not null default now(),
  expires_at      timestamptz not null default now() + interval '7 days',
  accepted_at     timestamptz,
  accepted_user   uuid references auth.users on delete set null,
  revoked_at      timestamptz
);
create index invitations_home_idx on invitations (home_id);
-- Jedno otwarte zaproszenie na adres w zakładzie.
create unique index invitations_open_uniq on invitations (home_id, email)
  where accepted_at is null and revoked_at is null;

alter table invitations enable row level security;
-- Brak polityk i uprawnień: dostęp tylko przez funkcje poniżej.

create or replace function public.my_owner_homes() returns setof uuid
language sql stable security definer set search_path = public as $$
  select home_id from memberships where user_id = auth.uid() and role = 'wlasciciel'
$$;
revoke all on function public.my_owner_homes() from public;
grant execute on function public.my_owner_homes() to authenticated;

-- Właściciel zaprasza. Zwraca token (jedyny raz, kiedy istnieje w jawnej postaci).
create or replace function public.create_invitation(p_email text, p_role member_role, p_name text)
returns text language plpgsql volatile security definer set search_path = public, extensions as $$
declare
  v_home uuid;
  v_email text := lower(trim(p_email));
  v_token text;
begin
  select home_id into v_home from memberships where user_id = auth.uid() and role = 'wlasciciel' limit 1;
  if v_home is null then
    raise exception 'Zapraszać może tylko właściciel zakładu' using errcode = '42501';
  end if;
  if exists (select 1 from memberships m join auth.users u on u.id = m.user_id
             where m.home_id = v_home and lower(u.email) = v_email) then
    raise exception 'Ta osoba ma już dostęp do panelu' using errcode = 'P0001';
  end if;
  -- Nowe zaproszenie zastępuje poprzednie otwarte na ten sam adres.
  update invitations set revoked_at = now()
  where home_id = v_home and email = v_email and accepted_at is null and revoked_at is null;

  v_token := translate(encode(gen_random_bytes(32), 'base64'), '+/=', '-_');
  insert into invitations (home_id, email, role, display_name, token_hash, invited_by)
  values (v_home, v_email, p_role, trim(p_name), encode(digest(v_token, 'sha256'), 'hex'), auth.uid());
  return v_token;
end $$;
revoke all on function public.create_invitation(text, member_role, text) from public;
grant execute on function public.create_invitation(text, member_role, text) to authenticated;

-- Podgląd zaproszenia dla osoby z linkiem (bez logowania). Adres e-mail częściowo ukryty.
create or replace function public.invitation_preview(p_token text)
returns table (home_name text, role member_role, display_name text, email_hint text, status text)
language sql stable security definer set search_path = public, extensions as $$
  select h.name, i.role, i.display_name,
         left(i.email, 2) || '•••@' || split_part(i.email, '@', 2),
         case when i.revoked_at is not null then 'odwolane'
              when i.accepted_at is not null then 'przyjete'
              when i.expires_at <= now() then 'wygaslo'
              else 'aktywne' end
  from invitations i join funeral_homes h on h.id = i.home_id
  where i.token_hash = encode(digest(p_token, 'sha256'), 'hex')
$$;
revoke all on function public.invitation_preview(text) from public;
grant execute on function public.invitation_preview(text) to anon, authenticated;

-- E-mail z aktywnego zaproszenia: serwer potrzebuje go, żeby założyć konto i wysłać link logowania.
create or replace function public.invitation_email(p_token text) returns text
language sql stable security definer set search_path = public, extensions as $$
  select email from invitations
  where token_hash = encode(digest(p_token, 'sha256'), 'hex')
    and accepted_at is null and revoked_at is null and expires_at > now()
$$;
revoke all on function public.invitation_email(text) from public;
grant execute on function public.invitation_email(text) to anon;

-- Przyjęcie zaproszenia. p_user to konto o tym samym e-mailu co zaproszenie (sprawdzamy w auth.users).
create or replace function public.accept_invitation(p_token text, p_user uuid)
returns uuid language plpgsql volatile security definer set search_path = public, extensions as $$
declare
  v_inv invitations%rowtype;
begin
  select * into v_inv from invitations
  where token_hash = encode(digest(p_token, 'sha256'), 'hex') for update;
  if not found or v_inv.revoked_at is not null or v_inv.accepted_at is not null or v_inv.expires_at <= now() then
    raise exception 'Zaproszenie wygasło albo zostało już użyte' using errcode = 'P0001';
  end if;
  if not exists (select 1 from auth.users where id = p_user and lower(email) = v_inv.email) then
    raise exception 'Konto nie pasuje do zaproszenia' using errcode = '42501';
  end if;
  insert into memberships (user_id, home_id, role, display_name)
  values (p_user, v_inv.home_id, v_inv.role, v_inv.display_name)
  on conflict (user_id, home_id) do nothing;
  update invitations set accepted_at = now(), accepted_user = p_user where id = v_inv.id;
  return v_inv.home_id;
end $$;
revoke all on function public.accept_invitation(text, uuid) from public;
grant execute on function public.accept_invitation(text, uuid) to anon;

-- Lista zespołu i otwartych zaproszeń w zakładzie zalogowanej osoby.
create or replace function public.team_members()
returns table (user_id uuid, display_name text, email text, role member_role, is_me boolean)
language sql stable security definer set search_path = public as $$
  select m.user_id, m.display_name, u.email, m.role, m.user_id = auth.uid()
  from memberships m join auth.users u on u.id = m.user_id
  where m.home_id in (select my_homes())
  order by case m.role when 'wlasciciel' then 0 when 'biuro' then 1 else 2 end, m.display_name
$$;
revoke all on function public.team_members() from public;
grant execute on function public.team_members() to authenticated;

create or replace function public.team_invitations()
returns table (id uuid, email text, role member_role, display_name text, created_at timestamptz, expires_at timestamptz)
language sql stable security definer set search_path = public as $$
  select i.id, i.email, i.role, i.display_name, i.created_at, i.expires_at
  from invitations i
  where i.home_id in (select my_owner_homes())
    and i.accepted_at is null and i.revoked_at is null and i.expires_at > now()
  order by i.created_at desc
$$;
revoke all on function public.team_invitations() from public;
grant execute on function public.team_invitations() to authenticated;

create or replace function public.revoke_invitation(p_id uuid) returns void
language plpgsql volatile security definer set search_path = public as $$
begin
  update invitations set revoked_at = now()
  where id = p_id and home_id in (select my_owner_homes()) and accepted_at is null and revoked_at is null;
  if not found then
    raise exception 'Nie znaleziono zaproszenia' using errcode = 'P0001';
  end if;
end $$;
revoke all on function public.revoke_invitation(uuid) from public;
grant execute on function public.revoke_invitation(uuid) to authenticated;

-- Właściciel odbiera dostęp. Nie można usunąć siebie (zakład zostałby bez właściciela).
create or replace function public.remove_member(p_user uuid) returns void
language plpgsql volatile security definer set search_path = public as $$
begin
  if p_user = auth.uid() then
    raise exception 'Nie możesz usunąć własnego dostępu' using errcode = 'P0001';
  end if;
  delete from memberships where user_id = p_user and home_id in (select my_owner_homes());
  if not found then
    raise exception 'Nie znaleziono osoby w Twoim zakładzie' using errcode = 'P0001';
  end if;
end $$;
revoke all on function public.remove_member(uuid) from public;
grant execute on function public.remove_member(uuid) to authenticated;
