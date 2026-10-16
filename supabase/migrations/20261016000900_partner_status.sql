-- Wstrzymanie zakładu z uzasadnieniem i odwołanie (rozporządzenie P2B 2019/1150).
-- Art. 4: przy ograniczeniu lub zawieszeniu usług platforma podaje zakładowi uzasadnienie – konkretne fakty
-- i podstawę z zasad dla partnerów (/regulamin-partnera). Art. 11: wewnętrzny system rozpatrywania skarg.
-- Zakład widzi uzasadnienie w panelu i może złożyć odwołanie; administrator odpowiada na piśmie
-- i może przywrócić zakład. Każda zmiana statusu zostaje w historii (home_status_log).

create type public.suspension_ground as enum ('dokumenty', 'ceny', 'skargi', 'umowa', 'na_wniosek', 'inne');

create table public.home_status_log (
  id         bigint generated always as identity primary key,
  home_id    uuid not null references public.funeral_homes (id) on delete cascade,
  status     text not null check (status in ('zweryfikowany', 'wstrzymany')),
  ground     public.suspension_ground,
  reason     text check (length(reason) <= 1000),
  admin_id   uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  check (status = 'zweryfikowany' or (ground is not null and length(trim(coalesce(reason, ''))) >= 20))
);
create index home_status_log_home on public.home_status_log (home_id, created_at desc);

create table public.home_appeals (
  id            uuid primary key default gen_random_uuid(),
  home_id       uuid not null references public.funeral_homes (id) on delete cascade,
  status_log_id bigint references public.home_status_log (id) on delete set null,
  author_id     uuid references auth.users (id) on delete set null,
  author_name   text not null check (length(author_name) <= 120),
  body          text not null check (length(trim(body)) between 20 and 2000),
  created_at    timestamptz not null default now(),
  answer        text check (length(answer) <= 2000),
  outcome       text check (outcome in ('przywrocony', 'utrzymane')),
  answered_at   timestamptz,
  answered_by   uuid references auth.users (id) on delete set null,
  check ((answered_at is null) = (answer is null) and (answered_at is null) = (outcome is null))
);
create index home_appeals_home on public.home_appeals (home_id, created_at desc);
create unique index home_appeals_one_open on public.home_appeals (home_id) where answered_at is null;

alter table public.home_status_log enable row level security;
alter table public.home_appeals enable row level security;
-- Bez polityk i uprawnień: dostęp tylko przez funkcje poniżej.
revoke all on public.home_status_log, public.home_appeals from anon, authenticated;

-- Weryfikacja zostaje w admin_set_verified; wstrzymanie wymaga już uzasadnienia (admin_suspend_home).
create or replace function public.admin_set_verified(p_home uuid, p_verified boolean) returns void
language plpgsql volatile security definer set search_path = public as $$
begin
  perform assert_platform_admin();
  if not p_verified then
    raise exception 'Wstrzymanie zakładu wymaga uzasadnienia' using errcode = 'P0001';
  end if;
  update funeral_homes set verified_at = coalesce(verified_at, now()) where id = p_home;
  if not found then
    raise exception 'Nie znaleziono zakładu' using errcode = 'P0001';
  end if;
  insert into home_status_log (home_id, status, admin_id) values (p_home, 'zweryfikowany', auth.uid());
  perform admin_log('weryfikacja zakładu', p_home::text);
end $$;

create or replace function public.admin_suspend_home(p_home uuid, p_ground public.suspension_ground, p_reason text)
returns bigint
language plpgsql volatile security definer set search_path = public as $$
declare v_id bigint;
begin
  perform assert_platform_admin();
  if length(trim(coalesce(p_reason, ''))) < 20 then
    raise exception 'Opisz konkretne fakty (co najmniej 20 znaków)' using errcode = 'P0001';
  end if;
  update funeral_homes set verified_at = null where id = p_home and verified_at is not null;
  if not found then
    raise exception 'Zakład nie jest zweryfikowany albo nie istnieje' using errcode = 'P0001';
  end if;
  insert into home_status_log (home_id, status, ground, reason, admin_id)
  values (p_home, 'wstrzymany', p_ground, trim(p_reason), auth.uid())
  returning id into v_id;
  perform admin_log('wstrzymanie zakładu', p_home::text);
  return v_id;
end $$;

-- Historia statusu zakładu dla administratora.
create or replace function public.admin_home_history(p_home uuid)
returns table (status text, ground public.suspension_ground, reason text, admin_name text, created_at timestamptz)
language plpgsql stable security definer set search_path = public as $$
begin
  perform assert_platform_admin();
  return query
    select l.status, l.ground, l.reason, coalesce(p.display_name, '—'), l.created_at
    from home_status_log l left join platform_admins p on p.user_id = l.admin_id
    where l.home_id = p_home
    order by l.created_at desc, l.id desc;
end $$;

-- Status zakładu dla jego pracowników: wstrzymanie z uzasadnieniem i ostatnie odwołanie.
create or replace function public.my_home_status(p_home uuid)
returns table (status text, ground public.suspension_ground, reason text, since timestamptz,
               appeal_id uuid, appeal_body text, appeal_created_at timestamptz,
               appeal_answer text, appeal_outcome text, appeal_answered_at timestamptz)
language plpgsql stable security definer set search_path = public as $$
declare
  v_home funeral_homes%rowtype;
  v_log home_status_log%rowtype;
begin
  if p_home not in (select my_homes()) then
    raise exception 'Brak dostępu do zakładu' using errcode = '42501';
  end if;
  select * into v_home from funeral_homes where id = p_home;
  select * into v_log from home_status_log where home_id = p_home order by created_at desc, id desc limit 1;
  return query
    select case when v_home.verified_at is not null then 'zweryfikowany'
                when v_log.status = 'wstrzymany' then 'wstrzymany'
                else 'do_weryfikacji' end,
           case when v_home.verified_at is null then v_log.ground end,
           case when v_home.verified_at is null then v_log.reason end,
           coalesce(case when v_home.verified_at is null then v_log.created_at end, v_home.verified_at),
           a.id, a.body, a.created_at, a.answer, a.outcome, a.answered_at
    from (select 1) one
    -- Przy wstrzymaniu: odwołanie od bieżącej decyzji; po przywróceniu: ostatnia odpowiedź z 30 dni.
    left join lateral (
      select * from home_appeals x
      where x.home_id = p_home
        and case when v_home.verified_at is null then x.status_log_id = v_log.id
                 else x.answered_at > now() - interval '30 days' end
      order by x.created_at desc limit 1
    ) a on true;
end $$;

-- Odwołanie zakładu (właściciel lub biuro), jedno otwarte naraz, tylko gdy zakład jest wstrzymany.
create or replace function public.submit_appeal(p_home uuid, p_body text) returns uuid
language plpgsql volatile security definer set search_path = public as $$
declare
  v_member memberships%rowtype;
  v_log home_status_log%rowtype;
  v_id uuid;
begin
  select * into v_member from memberships where user_id = auth.uid() and home_id = p_home;
  if not found or v_member.role not in ('wlasciciel', 'biuro') then
    raise exception 'Odwołanie składa właściciel albo biuro zakładu' using errcode = '42501';
  end if;
  select l.* into v_log from home_status_log l join funeral_homes h on h.id = l.home_id
  where l.home_id = p_home and h.verified_at is null
  order by l.created_at desc, l.id desc limit 1;
  if not found or v_log.status <> 'wstrzymany' then
    raise exception 'Zakład nie jest wstrzymany' using errcode = 'P0001';
  end if;
  if exists (select 1 from home_appeals where home_id = p_home and answered_at is null) then
    raise exception 'Odwołanie czeka już na odpowiedź' using errcode = 'P0001';
  end if;
  if length(trim(coalesce(p_body, ''))) < 20 then
    raise exception 'Opisz sprawę (co najmniej 20 znaków)' using errcode = 'P0001';
  end if;
  insert into home_appeals (home_id, status_log_id, author_id, author_name, body)
  values (p_home, v_log.id, auth.uid(), v_member.display_name, trim(p_body))
  returning id into v_id;
  return v_id;
end $$;

-- Odwołania dla administratora: otwarte najpierw, rozpatrzone z ostatnich 30 dni.
create or replace function public.admin_appeals()
returns table (id uuid, home_id uuid, home_name text, ground public.suspension_ground, reason text,
               suspended_at timestamptz, author_name text, body text, created_at timestamptz,
               answer text, outcome text, answered_at timestamptz)
language plpgsql stable security definer set search_path = public as $$
begin
  perform assert_platform_admin();
  return query
    select a.id, a.home_id, h.name, l.ground, l.reason, l.created_at, a.author_name, a.body, a.created_at,
           a.answer, a.outcome, a.answered_at
    from home_appeals a
    join funeral_homes h on h.id = a.home_id
    left join home_status_log l on l.id = a.status_log_id
    where a.answered_at is null or a.answered_at > now() - interval '30 days'
    order by a.answered_at is not null, a.created_at;
end $$;

create or replace function public.admin_appeals_waiting() returns int
language plpgsql stable security definer set search_path = public as $$
begin
  perform assert_platform_admin();
  return (select count(*)::int from home_appeals where answered_at is null);
end $$;

-- Odpowiedź na odwołanie: zawsze z uzasadnieniem; przy przywróceniu zakład wraca na listę ofert.
create or replace function public.admin_answer_appeal(p_appeal uuid, p_restore boolean, p_answer text) returns void
language plpgsql volatile security definer set search_path = public as $$
declare v_home uuid;
begin
  perform assert_platform_admin();
  if length(trim(coalesce(p_answer, ''))) < 20 then
    raise exception 'Uzasadnij odpowiedź (co najmniej 20 znaków)' using errcode = 'P0001';
  end if;
  update home_appeals
  set answer = trim(p_answer), outcome = case when p_restore then 'przywrocony' else 'utrzymane' end,
      answered_at = now(), answered_by = auth.uid()
  where id = p_appeal and answered_at is null
  returning home_id into v_home;
  if v_home is null then
    raise exception 'Odwołanie jest już rozpatrzone' using errcode = 'P0001';
  end if;
  if p_restore then
    update funeral_homes set verified_at = now() where id = v_home and verified_at is null;
    insert into home_status_log (home_id, status, admin_id) values (v_home, 'zweryfikowany', auth.uid());
  end if;
  perform admin_log('odpowiedź na odwołanie', v_home::text);
end $$;

revoke all on function public.admin_suspend_home(uuid, public.suspension_ground, text), public.admin_home_history(uuid),
  public.my_home_status(uuid), public.submit_appeal(uuid, text), public.admin_appeals(), public.admin_appeals_waiting(),
  public.admin_answer_appeal(uuid, boolean, text) from public, anon, authenticated;
grant execute on function public.admin_suspend_home(uuid, public.suspension_ground, text), public.admin_home_history(uuid),
  public.my_home_status(uuid), public.submit_appeal(uuid, text), public.admin_appeals(), public.admin_appeals_waiting(),
  public.admin_answer_appeal(uuid, boolean, text) to authenticated;
grant execute on function public.admin_set_verified(uuid, boolean) to authenticated;
