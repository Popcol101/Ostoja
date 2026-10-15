-- Role: ekipa nie zmienia profilu ani cennika; właściciel tak.
begin;

-- Adam (ekipa, Dom Pogrzebowy Cisza)
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000003","role":"authenticated"}', true);
do $$
declare n int;
begin
  assert (select count(*) from price_items) > 0, 'ekipa powinna widzieć cennik';
  update funeral_homes set description = 'zmiana ekipy' where id = '00000000-0000-4000-a000-000000000001';
  get diagnostics n = row_count;
  assert n = 0, 'ekipa zmieniła profil zakładu';
  update price_items set price_pln = 1 where home_id = '00000000-0000-4000-a000-000000000001';
  get diagnostics n = row_count;
  assert n = 0, 'ekipa zmieniła cennik';
  delete from price_items where home_id = '00000000-0000-4000-a000-000000000001';
  get diagnostics n = row_count;
  assert n = 0, 'ekipa usunęła pozycje cennika';
end $$;

-- Anna (właścicielka) może.
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
do $$
declare n int;
begin
  update price_items set price_pln = price_pln where home_id = '00000000-0000-4000-a000-000000000001';
  get diagnostics n = row_count;
  assert n > 0, 'właścicielka nie może zmienić cennika';
  update funeral_homes set description = description where id = '00000000-0000-4000-a000-000000000001';
  get diagnostics n = row_count;
  assert n = 1, 'właścicielka nie może zmienić profilu';
end $$;

rollback;
