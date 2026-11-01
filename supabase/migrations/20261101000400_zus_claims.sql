-- Wniosek o zasiłek pogrzebowy (ZUS Z-12) z danych zlecenia. Treść wg § 4 ust. 2a rozporządzenia w sprawie postępowania
-- o świadczenia emerytalno-rentowe (zmiana z 29.12.2025, Dz.U. 2025 poz. 1888, od 1.01.2026):
-- dane zmarłego (imię, nazwisko, PESEL albo dokument, data i miejsce zgonu), oświadczenia (pokrewieństwo, pokrycie
-- kosztów, brak zasiłku z innego tytułu, inny organ rentowy zmarłego), przy wniosku przez zakład pogrzebowy: nazwa,
-- NIP, REGON, adres i upoważnienie do wypłaty na rachunek zakładu (w całości albo w części).
-- Uzupełnia właściciel albo biuro; ekipa widzi do druku. PESEL tylko w tej tabeli – nigdy w logach.
-- Nie ma tu pola na przyczynę zgonu i nie będzie.

create table public.zus_claims (
  order_id            uuid primary key references public.orders (id) on delete cascade,
  home_id             uuid not null references public.funeral_homes (id) on delete cascade,
  applicant_pesel     text check (applicant_pesel ~ '^[0-9]{11}$'),
  applicant_id_doc    text check (length(applicant_id_doc) <= 30),
  applicant_relation  text check (length(applicant_relation) <= 60),
  deceased_pesel      text check (deceased_pesel ~ '^[0-9]{11}$'),
  deceased_id_doc     text check (length(deceased_id_doc) <= 30),
  death_place         text check (length(death_place) <= 120),
  other_pension_body  text check (length(other_pension_body) <= 120),
  costs_covered       text not null default 'calosc' check (costs_covered in ('calosc', 'czesc')),
  no_other_benefit    boolean not null default false,
  payout_to_home      text not null default 'brak' check (payout_to_home in ('brak', 'calosc', 'czesc')),
  payout_home_pln     numeric(10,2) check (payout_home_pln between 0 and 100000),
  updated_at          timestamptz not null default now(),
  check (payout_to_home <> 'czesc' or payout_home_pln is not null)
);
alter table public.zus_claims enable row level security;
revoke all on public.zus_claims from anon, authenticated;
grant select, insert, update on public.zus_claims to authenticated;
create policy zus_claims_read on public.zus_claims for select to authenticated
  using (home_id in (select my_homes()));
create policy zus_claims_insert on public.zus_claims for insert to authenticated
  with check (home_id in (select my_admin_homes())
              and exists (select 1 from orders o where o.id = order_id and o.home_id = zus_claims.home_id));
create policy zus_claims_update on public.zus_claims for update to authenticated
  using (home_id in (select my_admin_homes()))
  with check (home_id in (select my_admin_homes())
              and exists (select 1 from orders o where o.id = order_id and o.home_id = zus_claims.home_id));

-- Wypłata na rachunek zakładu tylko za zgodą rodziny z linku (family_consents.wniosek_przez_zaklad).
create or replace function public.zus_claims_guard() returns trigger
language plpgsql set search_path = public as $$
begin
  new.updated_at := now();
  if new.payout_to_home <> 'brak' and not exists (
    select 1 from orders o where o.id = new.order_id and coalesce((o.family_consents->>'wniosek_przez_zaklad')::boolean, false)
  ) then
    raise exception 'Wypłata na rachunek zakładu wymaga zgody rodziny z linku.' using errcode = 'P0001';
  end if;
  return new;
end $$;
revoke all on function public.zus_claims_guard() from public;
create trigger zus_claims_guard before insert or update on public.zus_claims
  for each row execute function public.zus_claims_guard();

-- Wniosek RODO: dane z wniosku o zasiłek usuwa się razem ze zleceniem (on delete cascade).
