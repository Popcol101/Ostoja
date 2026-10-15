-- Ostoja: uprawnienia i zabezpieczenia na poziomie wierszy (RLS).
-- Zasada: zakład widzi tylko swoje dane; rodzina i goście nie mają bezpośredniego
-- dostępu do tabel — korzystają wyłącznie z funkcji security definer z migracji 300.

create or replace function public.my_homes() returns setof uuid
language sql stable security definer set search_path = public as $$
  select home_id from memberships where user_id = auth.uid()
$$;
revoke all on function public.my_homes() from public;
grant execute on function public.my_homes() to authenticated;

-- Domyślnie nikt nic nie może; nadajemy tylko to, czego potrzeba.
revoke all on all tables in schema public from anon, authenticated;
grant usage on schema public to anon, authenticated, service_role;

alter table cities          enable row level security;
alter table price_catalog   enable row level security;
alter table funeral_homes   enable row level security;
alter table memberships     enable row level security;
alter table price_items     enable row level security;
alter table inquiries       enable row level security;
alter table offers          enable row level security;
alter table orders          enable row level security;
alter table order_tasks     enable row level security;
alter table resources       enable row level security;
alter table events          enable row level security;
alter table bookings        enable row level security;
alter table duty_shifts     enable row level security;

-- Słowniki: do odczytu dla wszystkich.
grant select on cities, price_catalog to anon, authenticated;
create policy cities_read on cities for select to anon, authenticated using (true);
create policy catalog_read on price_catalog for select to anon, authenticated using (true);

-- Zakład: członkowie czytają i edytują swój profil.
grant select, update on funeral_homes to authenticated;
create policy homes_member_read on funeral_homes for select to authenticated
  using (id in (select my_homes()));
create policy homes_member_update on funeral_homes for update to authenticated
  using (id in (select my_homes())) with check (id in (select my_homes()));

grant select on memberships to authenticated;
create policy memberships_read on memberships for select to authenticated
  using (home_id in (select my_homes()));

grant select, insert, update, delete on price_items to authenticated;
create policy price_items_member on price_items for all to authenticated
  using (home_id in (select my_homes())) with check (home_id in (select my_homes()));

-- Zapytania: brak polityk = brak dostępu. Kontakt do rodziny dostaje się
-- wyłącznie przez accept_offer(), a skrzynkę przez get_inbox().

-- Oferty: zakład widzi swoje, nie zmienia ich bezpośrednio.
grant select on offers to authenticated;
create policy offers_member_read on offers for select to authenticated
  using (home_id in (select my_homes()));

-- Zlecenia i wszystko, co do nich należy.
grant select, insert, update on orders to authenticated;
create policy orders_member on orders for all to authenticated
  using (home_id in (select my_homes())) with check (home_id in (select my_homes()));

grant select, insert, update, delete on order_tasks to authenticated;
create policy tasks_member on order_tasks for all to authenticated
  using (home_id in (select my_homes()))
  with check (home_id in (select my_homes())
              and order_id in (select id from orders where home_id in (select my_homes())));

grant select, insert, update, delete on resources to authenticated;
create policy resources_member on resources for all to authenticated
  using (home_id in (select my_homes())) with check (home_id in (select my_homes()));

grant select, insert, update, delete on events to authenticated;
create policy events_member on events for all to authenticated
  using (home_id in (select my_homes()))
  with check (home_id in (select my_homes())
              and (order_id is null or order_id in (select id from orders where home_id in (select my_homes()))));

grant select, insert, update, delete on bookings to authenticated;
create policy bookings_member on bookings for all to authenticated
  using (home_id in (select my_homes()))
  with check (home_id in (select my_homes())
              and resource_id in (select id from resources where home_id in (select my_homes()))
              and event_id in (select id from events where home_id in (select my_homes())));

grant select, insert, update, delete on duty_shifts to authenticated;
create policy duty_member on duty_shifts for all to authenticated
  using (home_id in (select my_homes()))
  with check (home_id in (select my_homes())
              and user_id in (select user_id from memberships where home_id in (select my_homes())));
