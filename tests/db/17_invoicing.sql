-- Faktury: połączenie widzi tylko właściciel (bez sekretu), umowa wrzuca fakturę do kolejki, ręczna faktura, kolejka serwera.
begin;
set local role authenticated;

-- Właścicielka Ciszy łączy Fakturownię (sekret zapisuje aplikacja już zaszyfrowany).
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
insert into invoicing_connections (home_id, provider, account, secret_enc, secret_hint)
values ('00000000-0000-4000-a000-000000000001', 'fakturownia', 'dom-cisza', 'v1.x.y.z', '…1234');
do $$ begin
  assert (select account from invoicing_connections) = 'dom-cisza', 'właścicielka nie widzi połączenia';
  begin
    perform secret_enc from invoicing_connections;
    raise exception 'FAIL: odczyt zaszyfrowanego klucza z roli authenticated';
  exception when insufficient_privilege then null;
  end;
end $$;

-- Biuro i ekipa nie widzą połączenia; inny zakład też nie.
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000002","role":"authenticated"}', true);
do $$ begin
  assert (select count(*) from invoicing_connections) = 0, 'biuro widzi połączenie z programem do faktur';
end $$;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000004","role":"authenticated"}', true);
do $$ begin
  assert (select count(*) from invoicing_connections) = 0, 'inny zakład widzi połączenie';
  begin
    insert into invoicing_connections (home_id, provider, account, secret_enc, secret_hint)
    values ('00000000-0000-4000-a000-000000000001', 'fakturownia', 'podmiana', 'v1.a.b.c', 'x');
    raise exception 'FAIL: podmiana połączenia cudzego zakładu';
  exception when insufficient_privilege or unique_violation then null;
  end;
end $$;

-- Podpisanie umowy Jana Kowalskiego wrzuca fakturę do kolejki.
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000002","role":"authenticated"}', true);
update orders set principal_street = 'ul. Lipowa 2', principal_post_code = '90-001', principal_city = 'Łódź'
  where id = '00000000-0000-4000-d000-000000000002';
update orders set contract_signed_at = now() where id = '00000000-0000-4000-d000-000000000002';
do $$ begin
  assert (select status from invoices where order_id = '00000000-0000-4000-d000-000000000002') = 'do_wystawienia', 'brak faktury w kolejce po umowie';
  assert (select provider from invoices where order_id = '00000000-0000-4000-d000-000000000002') = 'fakturownia', 'zły program w kolejce';
  begin
    perform request_invoice('00000000-0000-4000-d000-000000000002');
  exception when raise_exception then null; -- już w kolejce – nie dubluje
  end;
  assert (select count(*) from invoices where order_id = '00000000-0000-4000-d000-000000000002') = 1, 'dwie faktury do jednego zlecenia';
  begin
    perform request_invoice('00000000-0000-4000-d000-000000000005');
    raise exception 'FAIL: faktura przed umową';
  exception when raise_exception then
    if sqlerrm like 'FAIL%' then raise; end if;
  end;
end $$;

-- Ekipa nie wystawia faktur.
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000003","role":"authenticated"}', true);
do $$ begin
  begin
    perform record_manual_invoice('00000000-0000-4000-d000-000000000003', 'FV 1/2026', current_date, 4640, null);
    raise exception 'FAIL: ekipa wpisała fakturę';
  exception when insufficient_privilege then null;
  end;
end $$;

-- Biuro wpisuje fakturę ręcznie do zlecenia Teresy Lis (z numerem KSeF); zły numer KSeF – odmowa.
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000002","role":"authenticated"}', true);
do $$ begin
  perform record_manual_invoice('00000000-0000-4000-d000-000000000003', 'FV 7/10/2026', '2026-10-20', 4640, '5252445767-20261020-abc123def456');
  assert (select ksef_number from invoices where order_id = '00000000-0000-4000-d000-000000000003') = '5252445767-20261020-ABC123DEF456', 'numer KSeF';
  assert (select status from invoices where order_id = '00000000-0000-4000-d000-000000000003') = 'reczna', 'status ręcznej faktury';
  begin
    perform record_manual_invoice('00000000-0000-4000-d000-000000000004', 'FV 8/10/2026', '2026-10-21', 5240, 'zly-numer');
    raise exception 'FAIL: zły numer KSeF';
  exception when check_violation then null;
  end;
  begin
    update invoices set status = 'wystawiona';
    raise exception 'FAIL: zakład zmienia fakturę bezpośrednio';
  exception when insufficient_privilege then null;
  end;
end $$;

-- Serwer pobiera kolejkę raz (drugie wywołanie nic nie dostaje – brak podwójnej faktury).
reset role;
set local role service_role;
do $$ begin
  assert (select count(*) from claim_invoices(10)) = 1, 'serwer nie pobrał faktury z kolejki';
  assert (select count(*) from claim_invoices(10)) = 0, 'ta sama faktura pobrana drugi raz';
end $$;

-- Rodzina uzupełnia adres z linku.
reset role;
set local role anon;
do $$
declare v jsonb;
begin
  v := family_update_order('demo-rodzina-mazur-0000000000000000000000000000',
        '{"principal_street":"ul. Polna 3","principal_post_code":"91-002","principal_city":"Łódź"}');
  assert v->>'principal_city' = 'Łódź', 'rodzina nie zapisała adresu';
end $$;

rollback;
