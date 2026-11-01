-- Oceny od rodzin: tylko z linku, tylko po pogrzebie, średnia liczy się sama, zakład nie wpisze oceny sam.
begin;

-- Teresa Lis: zlecenie w rozliczeniu (można oceniać). Jan Kowalski: przed umową (nie można).
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
do $$
declare v jsonb;
begin
  v := family_review('demo-rodzina-lis-000000000000000000000000000000');
  assert (v->>'eligible')::boolean, 'rozliczone zlecenie powinno pozwalać na ocenę';
  assert v->>'rating' is null, 'ocena przed wystawieniem';

  assert not (family_review('demo-rodzina-kowalski-00000000000000000000000000')->>'eligible')::boolean,
    'ocena przed pogrzebem';
  begin
    perform family_submit_review('demo-rodzina-kowalski-00000000000000000000000000', 5, null);
    raise exception 'FAIL: ocena przed pogrzebem';
  exception when raise_exception then
    if sqlerrm like 'FAIL%' then raise; end if;
  end;

  begin
    perform family_submit_review('zly-token-000000000000000000000000000000', 5, null);
    raise exception 'FAIL: ocena z nieprawidłowym linkiem';
  exception when insufficient_privilege then null;
  end;

  begin
    perform family_submit_review('demo-rodzina-lis-000000000000000000000000000000', 6, null);
    raise exception 'FAIL: ocena spoza skali';
  exception when raise_exception then
    if sqlerrm like 'FAIL%' then raise; end if;
  end;

  v := family_submit_review('demo-rodzina-lis-000000000000000000000000000000', 4, '  Spokojnie i bez pośpiechu.  ');
  assert (v->>'rating')::int = 4, 'ocena nie zapisana';
  assert v->>'comment' = 'Spokojnie i bez pośpiechu.', 'komentarz bez przycięcia';

  -- Zmiana oceny nie tworzy drugiej.
  v := family_submit_review('demo-rodzina-lis-000000000000000000000000000000', 5, '');
  assert (v->>'rating')::int = 5 and v->>'comment' is null, 'zmiana oceny nie zadziałała';
end $$;

-- Anon nie czyta tabeli ocen.
do $$ begin
  begin
    perform 1 from home_reviews;
    raise exception 'FAIL: anon czyta oceny';
  exception when insufficient_privilege then null;
  end;
end $$;

-- Średnia w profilu zakładu liczy się z ocen.
reset role;
do $$ begin
  assert (select count(*) from home_reviews where home_id = '00000000-0000-4000-a000-000000000001') = 1, 'dwie oceny dla jednego zlecenia';
  assert (select rating from funeral_homes where id = '00000000-0000-4000-a000-000000000001') = 5.0, 'średnia nie przeliczona';
  assert (select reviews_count from funeral_homes where id = '00000000-0000-4000-a000-000000000001') = 1, 'liczba ocen nie przeliczona';
end $$;

-- Zakład widzi swoje oceny, ale nie może ich dodać ani zmienić; inny zakład ich nie widzi.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
do $$ begin
  assert (select count(*) from home_reviews) = 1, 'właścicielka nie widzi oceny';
  begin
    insert into home_reviews (order_id, home_id, rating) values
      ('00000000-0000-4000-d000-000000000002', '00000000-0000-4000-a000-000000000001', 5);
    raise exception 'FAIL: zakład dodał ocenę sam';
  exception when insufficient_privilege then null;
  end;
  begin
    update home_reviews set rating = 5;
    raise exception 'FAIL: zakład zmienił ocenę';
  exception when insufficient_privilege then null;
  end;
  begin
    perform admin_set_review_hidden('00000000-0000-4000-d000-000000000003', true, 'Nie podoba mi się');
    raise exception 'FAIL: zakład ukrył ocenę';
  exception when insufficient_privilege then null;
  end;
end $$;

select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000004","role":"authenticated"}', true);
do $$ begin
  assert (select count(*) from home_reviews) = 0, 'inny zakład widzi cudze oceny';
end $$;

-- Administrator ukrywa ocenę z powodem – znika ze średniej; przywrócenie wraca ją.
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000009","role":"authenticated"}', true);
do $$ begin
  assert (select count(*) from admin_reviews()) = 1, 'administrator nie widzi ocen';
  begin
    perform admin_set_review_hidden('00000000-0000-4000-d000-000000000003', true, '');
    raise exception 'FAIL: ukrycie bez powodu';
  exception when raise_exception then
    if sqlerrm like 'FAIL%' then raise; end if;
  end;
  perform admin_set_review_hidden('00000000-0000-4000-d000-000000000003', true, 'Dane osobowe w komentarzu');
end $$;
reset role;
do $$ begin
  assert (select rating from funeral_homes where id = '00000000-0000-4000-a000-000000000001') is null, 'ukryta ocena liczy się do średniej';
  assert (select reviews_count from funeral_homes where id = '00000000-0000-4000-a000-000000000001') = 0, 'ukryta ocena w liczbie ocen';
end $$;

rollback;
