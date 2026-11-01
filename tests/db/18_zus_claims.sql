-- Wniosek o zasiłek: dane w zakładzie (RLS), wypłata na rachunek zakładu tylko za zgodą rodziny.
begin;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000002","role":"authenticated"}', true);

insert into zus_claims (order_id, home_id, applicant_pesel, applicant_relation, deceased_pesel, death_place, no_other_benefit)
values ('00000000-0000-4000-d000-000000000003', '00000000-0000-4000-a000-000000000001', '44051401458', 'syn', '50112012345', 'Łódź', true);

do $$ begin
  -- Rodzina nie zgodziła się na wniosek przez zakład – wypłata na rachunek zakładu odrzucona.
  begin
    update zus_claims set payout_to_home = 'calosc' where order_id = '00000000-0000-4000-d000-000000000003';
    raise exception 'FAIL: wypłata dla zakładu bez zgody rodziny';
  exception when raise_exception then
    if sqlerrm like 'FAIL%' then raise; end if;
  end;
  begin
    update zus_claims set applicant_pesel = '123' where order_id = '00000000-0000-4000-d000-000000000003';
    raise exception 'FAIL: zły PESEL';
  exception when check_violation then null;
  end;
end $$;

-- Zgoda rodziny z linku → można upoważnić zakład do odbioru części zasiłku (z kwotą).
reset role;
update orders set family_consents = family_consents || '{"wniosek_przez_zaklad": true}' where id = '00000000-0000-4000-d000-000000000003';
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000002","role":"authenticated"}', true);
do $$ begin
  begin
    update zus_claims set payout_to_home = 'czesc' where order_id = '00000000-0000-4000-d000-000000000003';
    raise exception 'FAIL: część bez kwoty';
  exception when check_violation then null;
  end;
  update zus_claims set payout_to_home = 'czesc', payout_home_pln = 4640 where order_id = '00000000-0000-4000-d000-000000000003';
  assert (select payout_home_pln from zus_claims) = 4640, 'upoważnienie nie zapisane';
end $$;

-- Ekipa widzi (druk), nie zmienia; inny zakład nie widzi.
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000003","role":"authenticated"}', true);
do $$ begin
  assert (select count(*) from zus_claims) = 1, 'ekipa nie widzi wniosku';
  update zus_claims set death_place = 'Ekipa' where order_id = '00000000-0000-4000-d000-000000000003';
  assert (select death_place from zus_claims) = 'Łódź', 'ekipa zmieniła wniosek';
end $$;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000004","role":"authenticated"}', true);
do $$ begin
  assert (select count(*) from zus_claims) = 0, 'inny zakład widzi PESEL z wniosku';
end $$;

-- Anon nic nie widzi.
set local role anon;
do $$ begin
  begin
    perform 1 from zus_claims;
    raise exception 'FAIL: anon czyta wnioski';
  exception when insufficient_privilege then null;
  end;
end $$;
rollback;
