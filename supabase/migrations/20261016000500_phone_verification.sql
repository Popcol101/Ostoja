-- Weryfikacja numeru rodziny kodem SMS przed wysłaniem zapytania.
-- Zapytanie (z telefonem rodziny) trafia do zakładów dopiero po wpisaniu kodu. Do tego czasu dane
-- czekają w inquiry_drafts najwyżej 10 minut (kod) i są kasowane po dobie.
-- Kod: 6 cyfr, w bazie tylko skrót SHA-256 z identyfikatorem szkicu, 5 prób, 3 wysyłki, ponowna wysyłka po 60 s.

create table public.inquiry_drafts (
  id           uuid primary key default gen_random_uuid(),
  payload      jsonb not null,
  phone        text not null check (phone ~ '^\+48 [0-9]{3} [0-9]{3} [0-9]{3}$'),
  code_hash    text not null,
  attempts     int not null default 0,
  sends        int not null default 1,
  last_sent_at timestamptz not null default now(),
  expires_at   timestamptz not null default now() + interval '10 minutes',
  created_at   timestamptz not null default now()
);
create index inquiry_drafts_phone_idx on inquiry_drafts (phone, created_at);
alter table inquiry_drafts enable row level security;
-- Brak polityk i uprawnień: tylko funkcje poniżej.

-- Zapytanie bez weryfikacji nie może już powstać z zewnątrz (Supabase udostępnia funkcje roli anon przez API).
revoke execute on function public.create_inquiry(jsonb) from anon, authenticated;
grant execute on function public.create_inquiry(jsonb) to service_role;

create or replace function public.new_sms_code() returns text
language sql volatile set search_path = public, extensions as $$
  select lpad((('x' || encode(gen_random_bytes(4), 'hex'))::bit(32)::bigint % 1000000)::text, 6, '0')
$$;
revoke all on function public.new_sms_code() from public;

create or replace function public.sms_code_hash(p_draft uuid, p_code text) returns text
language sql immutable set search_path = public, extensions as $$
  select encode(digest(p_draft::text || ':' || p_code, 'sha256'), 'hex')
$$;
revoke all on function public.sms_code_hash(uuid, text) from public;

-- Krok 1: dane z formularza + numer. Zwraca identyfikator szkicu i kod do wysłania SMS-em (tylko serwerowi).
create or replace function public.start_inquiry(p jsonb)
returns table (draft_id uuid, code text)
language plpgsql volatile security definer set search_path = public, extensions as $$
declare
  v_id uuid := gen_random_uuid();
  v_code text := new_sms_code();
  v_phone text := p->>'contact_phone';
begin
  delete from inquiry_drafts where created_at < now() - interval '1 day';
  if not exists (select 1 from cities where slug = p->>'city_slug') then
    raise exception 'Nieznane miasto' using errcode = '22023';
  end if;
  -- Sprawdzenie typów teraz, nie dopiero po kodzie.
  perform (p->>'burial')::burial_type, (p->>'ceremony')::ceremony_type, (p->>'place_of_death')::place_of_death;
  if (select count(*) from inquiry_drafts where phone = v_phone and created_at > now() - interval '1 hour') >= 3 then
    raise exception 'Wysłaliśmy już kilka kodów na ten numer. Zadzwoń do opiekuna – pomożemy od razu.' using errcode = 'P0001';
  end if;
  insert into inquiry_drafts (id, payload, phone, code_hash)
  values (v_id, p - 'contact_phone', v_phone, sms_code_hash(v_id, v_code));
  return query select v_id, v_code;
end $$;
revoke all on function public.start_inquiry(jsonb) from public;
grant execute on function public.start_inquiry(jsonb) to anon;

-- Dane do ekranu z kodem: zamaskowany numer, kiedy można wysłać ponownie, parametry do powrotu.
create or replace function public.draft_info(p_draft uuid)
returns table (phone_hint text, expired boolean, blocked boolean, resend_in int, sends_left int,
               city_slug text, burial text, ceremony text, place_of_death text, budget text, preferred_home_id text)
language sql stable security definer set search_path = public as $$
  select left(d.phone, 8) || '••• ' || right(d.phone, 3),
         d.expires_at <= now(), d.attempts >= 5,
         greatest(0, 60 - extract(epoch from now() - d.last_sent_at))::int, 3 - d.sends,
         d.payload->>'city_slug', d.payload->>'burial', d.payload->>'ceremony', d.payload->>'place_of_death',
         d.payload->>'budget', d.payload->>'preferred_home_id'
  from inquiry_drafts d where d.id = p_draft
$$;
revoke all on function public.draft_info(uuid) from public;
grant execute on function public.draft_info(uuid) to anon;

-- Nowy kod (poprzedni przestaje działać). Zwraca kod i numer – serwer wysyła SMS.
create or replace function public.resend_inquiry_code(p_draft uuid)
returns table (code text, phone text)
language plpgsql volatile security definer set search_path = public, extensions as $$
declare
  v inquiry_drafts%rowtype;
  v_code text := new_sms_code();
begin
  select * into v from inquiry_drafts where id = p_draft for update;
  if not found or v.created_at < now() - interval '1 hour' then
    raise exception 'Ten formularz wygasł. Wypełnij go jeszcze raz.' using errcode = 'P0001';
  end if;
  if v.sends >= 3 then
    raise exception 'Wysłaliśmy już kilka kodów na ten numer. Zadzwoń do opiekuna – pomożemy od razu.' using errcode = 'P0001';
  end if;
  if v.last_sent_at > now() - interval '60 seconds' then
    raise exception 'Nowy kod możesz wysłać po minucie od poprzedniego.' using errcode = 'P0001';
  end if;
  update inquiry_drafts
  set code_hash = sms_code_hash(v.id, v_code), attempts = 0, sends = sends + 1, last_sent_at = now(),
      expires_at = now() + interval '10 minutes'
  where id = v.id;
  return query select v_code, v.phone;
end $$;
revoke all on function public.resend_inquiry_code(uuid) from public;
grant execute on function public.resend_inquiry_code(uuid) to anon;

-- Krok 2: kod. Zła próba nie przerywa transakcji (licznik prób musi się zapisać), dlatego zwracamy status.
create or replace function public.confirm_inquiry(p_draft uuid, p_code text)
returns table (status text, inquiry_id uuid, attempts_left int)
language plpgsql volatile security definer set search_path = public, extensions as $$
declare
  v inquiry_drafts%rowtype;
  v_inquiry uuid;
begin
  select * into v from inquiry_drafts where id = p_draft for update;
  if not found or v.expires_at <= now() then
    return query select 'wygasl'::text, null::uuid, 0;
    return;
  end if;
  if v.attempts >= 5 then
    return query select 'zablokowany'::text, null::uuid, 0;
    return;
  end if;
  if p_code !~ '^[0-9]{6}$' or sms_code_hash(v.id, p_code) <> v.code_hash then
    update inquiry_drafts set attempts = attempts + 1 where id = v.id;
    return query select 'zly'::text, null::uuid, 4 - v.attempts;
    return;
  end if;
  v_inquiry := create_inquiry(v.payload || jsonb_build_object('contact_phone', v.phone));
  update inquiries set phone_verified_at = now() where id = v_inquiry;
  delete from inquiry_drafts where id = v.id;
  return query select 'ok'::text, v_inquiry, 0;
end $$;
revoke all on function public.confirm_inquiry(uuid, text) from public;
grant execute on function public.confirm_inquiry(uuid, text) to anon;
