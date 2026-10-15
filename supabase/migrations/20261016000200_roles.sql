-- Role w zakładzie: profil zakładu i cennik zmienia tylko właściciel i biuro.
-- Ekipa (kierowcy, obsługa ceremonii) widzi dane, ale ich nie zmienia.
-- (alter policy zamiast drop/create – bez operacji usuwających)

create or replace function public.my_admin_homes() returns setof uuid
language sql stable security definer set search_path = public as $$
  select home_id from memberships where user_id = auth.uid() and role in ('wlasciciel', 'biuro')
$$;
revoke all on function public.my_admin_homes() from public;
grant execute on function public.my_admin_homes() to authenticated;

alter policy homes_member_update on funeral_homes
  using (id in (select my_admin_homes())) with check (id in (select my_admin_homes()));

-- price_items_member (FOR ALL) obejmuje teraz tylko właściciela i biuro; odczyt dla całego zespołu daje osobna polityka.
alter policy price_items_member on price_items
  using (home_id in (select my_admin_homes())) with check (home_id in (select my_admin_homes()));
create policy price_items_read on price_items for select to authenticated
  using (home_id in (select my_homes()));
