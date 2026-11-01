-- Prosty magazyn trumien i urn. Zakład prowadzi własną listę produktów ze stanem; przypisanie produktu do zlecenia
-- zdejmuje go ze stanu, usunięcie z zlecenia oddaje na stan. Każda zmiana stanu trafia do historii ruchów.
-- Stan nie może spaść poniżej zera (check) – „Brak na stanie” zamiast ujemnych liczb.
-- Uprawnienia: cały zespół widzi; produkty, dostawy i korekty zmienia właściciel i biuro; do zlecenia
-- przypisuje właściciel i biuro (ekipa wydaje towar fizycznie, ale nie zmienia zapisów).

create type public.stock_kind as enum ('trumna', 'urna', 'inne');
create type public.stock_reason as enum ('dostawa', 'zlecenie', 'zwrot', 'korekta');

create table public.stock_items (
  id          uuid primary key default gen_random_uuid(),
  home_id     uuid not null references public.funeral_homes (id) on delete cascade,
  kind        public.stock_kind not null,
  name        text not null check (length(trim(name)) between 2 and 120),
  material    text check (length(material) <= 120),
  supplier    text check (length(supplier) <= 120),
  sku         text check (length(sku) <= 60),
  price_pln   numeric(10,2) not null check (price_pln between 0 and 100000),
  qty         int not null default 0 check (qty >= 0),
  min_qty     int not null default 0 check (min_qty between 0 and 1000),
  active      boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index stock_items_home_idx on public.stock_items (home_id, kind, name);

create table public.order_items (
  order_id       uuid not null references public.orders (id) on delete cascade,
  stock_item_id  uuid not null references public.stock_items (id),
  home_id        uuid not null references public.funeral_homes (id) on delete cascade,
  qty            int not null check (qty between 1 and 50),
  unit_price_pln numeric(10,2) not null,
  created_at     timestamptz not null default now(),
  primary key (order_id, stock_item_id)
);

create table public.stock_movements (
  id            uuid primary key default gen_random_uuid(),
  home_id       uuid not null references public.funeral_homes (id) on delete cascade,
  stock_item_id uuid not null references public.stock_items (id) on delete cascade,
  order_id      uuid references public.orders (id) on delete set null,
  delta         int not null,
  qty_after     int not null,
  reason        public.stock_reason not null,
  note          text check (length(note) <= 200),
  created_by    uuid,
  created_at    timestamptz not null default now()
);
create index stock_movements_item_idx on public.stock_movements (stock_item_id, created_at desc);

alter table public.stock_items enable row level security;
alter table public.order_items enable row level security;
alter table public.stock_movements enable row level security;
revoke all on public.stock_items, public.order_items, public.stock_movements from anon, authenticated;
grant select, insert, update on public.stock_items to authenticated;
grant select, insert, delete on public.order_items to authenticated;
grant select on public.stock_movements to authenticated;
-- Cena przy zleceniu to kopia z chwili przypisania; zakład nie podmienia jej później.
revoke update on public.stock_items from authenticated;
grant update (name, material, supplier, sku, price_pln, qty, min_qty, active) on public.stock_items to authenticated;

create policy stock_items_read on public.stock_items for select to authenticated
  using (home_id in (select my_homes()));
create policy stock_items_insert on public.stock_items for insert to authenticated
  with check (home_id in (select my_admin_homes()));
create policy stock_items_update on public.stock_items for update to authenticated
  using (home_id in (select my_admin_homes())) with check (home_id in (select my_admin_homes()));

create policy order_items_read on public.order_items for select to authenticated
  using (home_id in (select my_homes()));
create policy order_items_insert on public.order_items for insert to authenticated
  with check (home_id in (select my_admin_homes())
              and exists (select 1 from orders o where o.id = order_id and o.home_id = order_items.home_id)
              and exists (select 1 from stock_items s where s.id = stock_item_id and s.home_id = order_items.home_id));
create policy order_items_delete on public.order_items for delete to authenticated
  using (home_id in (select my_admin_homes()));

create policy stock_movements_read on public.stock_movements for select to authenticated
  using (home_id in (select my_homes()));

-- Ruchy magazynowe ----------------------------------------------------------------

-- Zmiana stanu w produkcie: dostawa albo korekta (powód z ustawienia ostoja.stock_reason, domyślnie korekta).
create or replace function public.stock_items_log() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_reason stock_reason;
  v_setting text := current_setting('ostoja.stock_reason', true);
begin
  new.updated_at := now();
  if tg_op = 'UPDATE' and new.qty is not distinct from old.qty then
    return new;
  end if;
  if tg_op = 'INSERT' and new.qty = 0 then
    return new;
  end if;
  if v_setting in ('zlecenie', 'zwrot') then
    return new; -- ruch zapisuje trigger order_items
  end if;
  v_reason := case when v_setting = 'dostawa' then 'dostawa'::stock_reason else 'korekta'::stock_reason end;
  insert into stock_movements (home_id, stock_item_id, delta, qty_after, reason, note, created_by)
  values (new.home_id, new.id, new.qty - coalesce(old.qty, 0), new.qty, v_reason,
          nullif(current_setting('ostoja.stock_note', true), ''), auth.uid());
  return new;
end $$;
revoke all on function public.stock_items_log() from public;
create trigger stock_items_log_upd before update on public.stock_items
  for each row execute function public.stock_items_log();

create or replace function public.stock_items_log_ins() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.qty > 0 then
    insert into stock_movements (home_id, stock_item_id, delta, qty_after, reason, note, created_by)
    values (new.home_id, new.id, new.qty, new.qty, 'dostawa', 'Stan początkowy', auth.uid());
  end if;
  return null;
end $$;
revoke all on function public.stock_items_log_ins() from public;
create trigger stock_items_log_ins after insert on public.stock_items
  for each row execute function public.stock_items_log_ins();

-- Przypisanie do zlecenia zdejmuje ze stanu (cena z produktu), usunięcie oddaje na stan.
create or replace function public.order_items_stock() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_item stock_items%rowtype;
begin
  if tg_op = 'INSERT' then
    select * into v_item from stock_items where id = new.stock_item_id for update;
    if not v_item.active then
      raise exception 'Ten produkt jest wycofany z oferty.' using errcode = 'P0001';
    end if;
    if v_item.qty < new.qty then
      raise exception 'Brak na stanie. Przyjmij dostawę albo popraw stan w magazynie.' using errcode = 'P0001';
    end if;
    new.unit_price_pln := v_item.price_pln;
    perform set_config('ostoja.stock_reason', 'zlecenie', true);
    update stock_items set qty = qty - new.qty where id = new.stock_item_id;
    perform set_config('ostoja.stock_reason', '', true);
    insert into stock_movements (home_id, stock_item_id, order_id, delta, qty_after, reason, created_by)
    values (new.home_id, new.stock_item_id, new.order_id, -new.qty, v_item.qty - new.qty, 'zlecenie', auth.uid());
    return new;
  else
    perform set_config('ostoja.stock_reason', 'zwrot', true);
    update stock_items set qty = qty + old.qty where id = old.stock_item_id returning * into v_item;
    perform set_config('ostoja.stock_reason', '', true);
    if v_item.id is not null then
      insert into stock_movements (home_id, stock_item_id, order_id, delta, qty_after, reason, created_by)
      values (old.home_id, old.stock_item_id, old.order_id, old.qty, v_item.qty, 'zwrot', auth.uid());
    end if;
    return old;
  end if;
end $$;
revoke all on function public.order_items_stock() from public;
create trigger order_items_stock_ins before insert on public.order_items
  for each row execute function public.order_items_stock();
create trigger order_items_stock_del before delete on public.order_items
  for each row execute function public.order_items_stock();
