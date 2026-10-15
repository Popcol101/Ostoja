-- Role w zakładzie: profil zakładu i cennik zmieniają tylko właściciel i biuro.
-- Ekipa (kierowcy, obsługa ceremonii) widzi dane, ale ich nie zmienia.

create or replace function public.my_admin_homes() returns setof uuid
language sql stable security definer set search_path = public as $$
  select home_id from memberships where user_id = auth.uid() and role in ('wlasciciel', 'biuro')
$$;
revoke all on function public.my_admin_homes() from public;
grant execute on function public.my_admin_homes() to authenticated;

drop policy if exists homes_member_update on funeral_homes;
create policy homes_admin_update on funeral_homes for update to authenticated
  using (id in (select my_admin_homes())) with check (id in (select my_admin_homes()));

drop policy if exists price_items_member on price_items;
create policy price_items_read on price_items for select to authenticated
  using (home_id in (select my_homes()));
create policy price_items_admin_insert on price_items for insert to authenticated
  with check (home_id in (select my_admin_homes()));
create policy price_items_admin_update on price_items for update to authenticated
  using (home_id in (select my_admin_homes())) with check (home_id in (select my_admin_homes()));
create policy price_items_admin_delete on price_items for delete to authenticated
  using (home_id in (select my_admin_homes()));
