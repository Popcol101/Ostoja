-- Magazyn: zakład widzi tylko swój stan, przypisanie do zlecenia zdejmuje ze stanu, nie da się zejść poniżej zera.
begin;
set local role authenticated;

-- Biuro Ciszy (Ewa): dostawa, przypisanie do zlecenia, zwrot.
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000002","role":"authenticated"}', true);
do $$
declare v_qty int;
begin
  assert (select count(*) from stock_items) = 6, 'biuro nie widzi magazynu';

  perform set_config('ostoja.stock_reason', 'dostawa', true);
  update stock_items set qty = qty + 2 where id = '00000000-0000-4000-c100-000000000005';
  perform set_config('ostoja.stock_reason', '', true);
  assert (select qty from stock_items where id = '00000000-0000-4000-c100-000000000005') = 2, 'dostawa nie zwiększyła stanu';
  assert (select reason from stock_movements where stock_item_id = '00000000-0000-4000-c100-000000000005' order by created_at desc limit 1) = 'dostawa',
    'brak ruchu dostawy';

  -- Urna do zlecenia Haliny Nowak (kremacja): stan 5 → 4, cena skopiowana z produktu.
  insert into order_items (order_id, stock_item_id, home_id, qty, unit_price_pln)
  values ('00000000-0000-4000-d000-000000000001', '00000000-0000-4000-c100-000000000004', '00000000-0000-4000-a000-000000000001', 1, 1);
  assert (select qty from stock_items where id = '00000000-0000-4000-c100-000000000004') = 4, 'przypisanie nie zdjęło ze stanu';
  assert (select unit_price_pln from order_items where order_id = '00000000-0000-4000-d000-000000000001') = 450, 'cena nie z produktu';

  -- Więcej niż na stanie – odmowa.
  begin
    insert into order_items (order_id, stock_item_id, home_id, qty, unit_price_pln)
    values ('00000000-0000-4000-d000-000000000001', '00000000-0000-4000-c100-000000000002', '00000000-0000-4000-a000-000000000001', 2, 0);
    raise exception 'FAIL: zejście poniżej zera';
  exception when raise_exception then
    if sqlerrm like 'FAIL%' then raise; end if;
  end;

  -- Bezpośrednia korekta poniżej zera – odmowa.
  begin
    update stock_items set qty = -1 where id = '00000000-0000-4000-c100-000000000002';
    raise exception 'FAIL: ujemny stan';
  exception when check_violation then null;
  end;

  -- Usunięcie z zlecenia oddaje na stan.
  delete from order_items where order_id = '00000000-0000-4000-d000-000000000001';
  assert (select qty from stock_items where id = '00000000-0000-4000-c100-000000000004') = 5, 'zwrot nie oddał na stan';
  assert (select array_agg(reason::text order by created_at) from stock_movements
          where stock_item_id = '00000000-0000-4000-c100-000000000004' and order_id is not null) = array['zlecenie', 'zwrot'],
    'historia ruchów niepełna';
end $$;

-- Ekipa widzi, ale nie zmienia stanu ani nie przypisuje.
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000003","role":"authenticated"}', true);
do $$ begin
  assert (select count(*) from stock_items) = 6, 'ekipa nie widzi magazynu';
  update stock_items set qty = 99 where id = '00000000-0000-4000-c100-000000000001';
  assert (select qty from stock_items where id = '00000000-0000-4000-c100-000000000001') = 4, 'ekipa zmieniła stan';
  begin
    insert into order_items (order_id, stock_item_id, home_id, qty, unit_price_pln)
    values ('00000000-0000-4000-d000-000000000002', '00000000-0000-4000-c100-000000000001', '00000000-0000-4000-a000-000000000001', 1, 0);
    raise exception 'FAIL: ekipa przypisała produkt';
  exception when insufficient_privilege then null;
  end;
end $$;

-- Inny zakład nie widzi magazynu Ciszy i nie przypnie jego produktu do swojego zlecenia.
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000004","role":"authenticated"}', true);
do $$ begin
  assert (select count(*) from stock_items) = 0, 'Pod Lipami widzi magazyn Ciszy';
  assert (select count(*) from stock_movements) = 0, 'Pod Lipami widzi ruchy Ciszy';
  begin
    insert into stock_items (home_id, kind, name, price_pln) values ('00000000-0000-4000-a000-000000000001', 'urna', 'Podrzucona', 1);
    raise exception 'FAIL: produkt w cudzym magazynie';
  exception when insufficient_privilege then null;
  end;
end $$;

-- Właściciel nie zmieni ceny już przypisanej do zlecenia (kolumna poza uprawnieniami).
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
do $$ begin
  begin
    update order_items set unit_price_pln = 1;
    raise exception 'FAIL: zmiana ceny w zleceniu';
  exception when insufficient_privilege then null;
  end;
end $$;

rollback;
