-- Wnioski osób, których dane przetwarza Ostoja (RODO art. 15 – dostęp, art. 17 – usunięcie).
-- Ostoja jest administratorem danych z zapytań (imię, telefon) i szkiców przed kodem SMS. Dane zleceń
-- (zmarły, dokumenty, umowa) administruje zakład – tu tylko wskazujemy, do którego zakładu przekazać wniosek.
-- Szukamy po numerze telefonu (jedyny identyfikator rodziny bez konta). W dzienniku tylko końcówka numeru.

create or replace function public.phone_digits(p text) returns text
language sql immutable set search_path = public as $$
  select right(regexp_replace(coalesce(p, ''), '\D', '', 'g'), 9)
$$;

create or replace function public.subject_phone(p_phone text) returns text
language plpgsql immutable set search_path = public as $$
declare v text := phone_digits(p_phone);
begin
  if length(v) <> 9 then
    raise exception 'Podaj pełny numer telefonu (9 cyfr)' using errcode = 'P0001';
  end if;
  return v;
end $$;

create or replace function public.admin_subject_lookup(p_phone text)
returns table (kind text, id uuid, created_at timestamptz, home_name text, city_name text, status text, name text)
language plpgsql volatile security definer set search_path = public as $$
declare v text;
begin
  perform assert_platform_admin();
  v := subject_phone(p_phone);
  perform admin_log('wniosek RODO – wyszukanie', 'tel. …' || right(v, 3));
  return query
    select 'zapytanie'::text, i.id, i.created_at, h.name, c.name, i.status::text, i.contact_name
    from inquiries i join cities c on c.slug = i.city_slug
    left join offers o on o.inquiry_id = i.id and o.status = 'przyjete'
    left join funeral_homes h on h.id = o.home_id
    where phone_digits(i.contact_phone) = v and i.contact_name <> 'usunięto'
    union all
    select 'szkic', d.id, d.created_at, null, c.name, 'przed kodem SMS', null
    from inquiry_drafts d left join cities c on c.slug = d.payload->>'city_slug'
    where phone_digits(d.phone) = v
    union all
    select 'zlecenie', o.id, o.created_at, h.name, null, o.stage::text, null
    from orders o join funeral_homes h on h.id = o.home_id
    where phone_digits(o.principal_phone) = v
    order by 3 desc;
end $$;

-- Kopia danych Ostoi o osobie (art. 15 ust. 3) w JSON.
create or replace function public.admin_subject_export(p_phone text) returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare v text;
begin
  perform assert_platform_admin();
  v := subject_phone(p_phone);
  perform admin_log('wniosek RODO – eksport', 'tel. …' || right(v, 3));
  return jsonb_build_object(
    'administrator', 'Ostoja – dane z zapytań o kontakt z zakładem pogrzebowym',
    'wygenerowano', now(),
    'zapytania', coalesce((
      select jsonb_agg(jsonb_build_object(
        'data', i.created_at, 'miasto', c.name, 'forma_pochowku', i.burial, 'ceremonia', i.ceremony,
        'miejsce_zgonu', i.place_of_death, 'budzet', i.budget, 'liczba_gosci', i.guests_estimate,
        'imie_i_nazwisko', i.contact_name, 'telefon', i.contact_phone, 'telefon_potwierdzony', i.phone_verified_at,
        'status', i.status,
        'zaklady_ktore_dostaly_zapytanie', (
          select coalesce(jsonb_agg(jsonb_build_object('zaklad', h.name, 'wyslano', o.sent_at, 'odpowiedz', o.status) order by o.sent_at), '[]')
          from offers o join funeral_homes h on h.id = o.home_id where o.inquiry_id = i.id)
      ) order by i.created_at)
      from inquiries i join cities c on c.slug = i.city_slug
      where phone_digits(i.contact_phone) = v and i.contact_name <> 'usunięto'), '[]'),
    'zlecenia_u_zakladow', coalesce((
      select jsonb_agg(jsonb_build_object('zaklad', h.name, 'telefon_zakladu', h.phone, 'email_zakladu', h.email, 'od', o.created_at)
                       order by o.created_at)
      from orders o join funeral_homes h on h.id = o.home_id
      where phone_digits(o.principal_phone) = v), '[]'),
    'uwaga', 'Dane zlecenia (osoba zmarła, dokumenty, umowa) przetwarza zakład jako administrator. Wniosek o nie kieruj do zakładu.'
  );
end $$;

-- Usunięcie danych Ostoi o osobie (art. 17): imię i telefon w zapytaniach oraz szkice. Zlecenia zostają u zakładu.
create or replace function public.admin_subject_erase(p_phone text) returns int
language plpgsql volatile security definer set search_path = public as $$
declare
  v text;
  n int;
begin
  perform assert_platform_admin();
  v := subject_phone(p_phone);
  update inquiries set contact_name = 'usunięto', contact_phone = '000000000'
  where phone_digits(contact_phone) = v and contact_name <> 'usunięto';
  get diagnostics n = row_count;
  delete from inquiry_drafts where phone_digits(phone) = v;
  perform admin_log('wniosek RODO – usunięcie', 'tel. …' || right(v, 3) || ', zapytań: ' || n);
  return n;
end $$;

revoke all on function public.phone_digits(text), public.subject_phone(text), public.admin_subject_lookup(text),
  public.admin_subject_export(text), public.admin_subject_erase(text) from public, anon, authenticated;
grant execute on function public.admin_subject_lookup(text), public.admin_subject_export(text), public.admin_subject_erase(text)
  to authenticated;
