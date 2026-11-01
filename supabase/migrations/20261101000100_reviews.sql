-- Oceny od rodzin. Ocenę wystawia tylko rodzina z linku do zlecenia (bez konta), po ceremonii lub pochówku
-- albo gdy zlecenie jest w rozliczeniu. Jedna ocena na zlecenie, rodzina może ją zmienić, dopóki link działa.
-- Średnia i liczba ocen w funeral_homes liczą się triggerem z ocen widocznych (zakład nie zmieni ich sam –
-- kolumny rating i reviews_count są poza uprawnieniami authenticated od migracji 20261018000100).
-- Komentarz widzi tylko zakład i administrator Ostoi; publicznie: średnia i liczba ocen.

create table public.home_reviews (
  order_id      uuid primary key references public.orders (id) on delete cascade,
  home_id       uuid not null references public.funeral_homes (id) on delete cascade,
  rating        smallint not null check (rating between 1 and 5),
  comment       text check (length(comment) <= 1000),
  hidden_at     timestamptz,
  hidden_reason text check (length(hidden_reason) <= 300),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index home_reviews_home_idx on public.home_reviews (home_id, created_at desc);

alter table public.home_reviews enable row level security;
revoke all on public.home_reviews from anon, authenticated;
grant select on public.home_reviews to authenticated;
create policy home_reviews_read on public.home_reviews for select to authenticated
  using (home_id in (select my_homes()));

-- Średnia z ocen widocznych ---------------------------------------------------

create or replace function public.recompute_home_rating(p_home uuid) returns void
language sql security definer set search_path = public as $$
  update funeral_homes h set
    rating = s.avg_rating,
    reviews_count = s.cnt
  from (select round(avg(rating)::numeric, 1) as avg_rating, count(*)::int as cnt
        from home_reviews where home_id = p_home and hidden_at is null) s
  where h.id = p_home
$$;
revoke all on function public.recompute_home_rating(uuid) from public;

create or replace function public.home_reviews_after() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform recompute_home_rating(coalesce(new.home_id, old.home_id));
  return null;
end $$;
revoke all on function public.home_reviews_after() from public;
create trigger home_reviews_after after insert or update or delete on public.home_reviews
  for each row execute function public.home_reviews_after();

-- Kiedy rodzina może ocenić ----------------------------------------------------

create or replace function public.review_eligible(p_order uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from orders o
    where o.id = p_order
      and o.contract_signed_at is not null
      and (o.stage in ('rozliczenie', 'zamkniete')
           or exists (select 1 from events e
                      where e.order_id = o.id and e.kind in ('ceremonia', 'pochowek')
                        and e.status <> 'odwolany' and upper(e.during) < now()))
  )
$$;
revoke all on function public.review_eligible(uuid) from public;

-- Rodzina (anon, przez token) ---------------------------------------------------

create or replace function public.family_review(p_token text) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'eligible', review_eligible(o.id),
    'home_name', h.name,
    'rating', r.rating,
    'comment', r.comment,
    'submitted_at', r.updated_at
  )
  from orders o
  join funeral_homes h on h.id = o.home_id
  left join home_reviews r on r.order_id = o.id
  where o.family_token = p_token and o.family_token_until > now()
$$;
revoke all on function public.family_review(text) from public;
grant execute on function public.family_review(text) to anon, authenticated;

create or replace function public.family_submit_review(p_token text, p_rating int, p_comment text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_order orders%rowtype;
  v_comment text := nullif(trim(coalesce(p_comment, '')), '');
begin
  select * into v_order from orders
  where family_token = p_token and family_token_until > now();
  if not found then
    raise exception 'Link wygasł lub jest nieprawidłowy' using errcode = '42501';
  end if;
  if not review_eligible(v_order.id) then
    raise exception 'Ocenę można wystawić po ceremonii lub pochówku.' using errcode = 'P0001';
  end if;
  if p_rating is null or p_rating not between 1 and 5 then
    raise exception 'Wybierz ocenę od 1 do 5.' using errcode = 'P0001';
  end if;
  if length(v_comment) > 1000 then
    raise exception 'Komentarz może mieć najwyżej 1000 znaków.' using errcode = 'P0001';
  end if;

  insert into home_reviews (order_id, home_id, rating, comment)
  values (v_order.id, v_order.home_id, p_rating, v_comment)
  on conflict (order_id) do update
    set rating = excluded.rating, comment = excluded.comment, updated_at = now();

  return family_review(p_token);
end $$;
revoke all on function public.family_submit_review(text, int, text) from public;
grant execute on function public.family_submit_review(text, int, text) to anon, authenticated;

-- Administrator Ostoi: lista i ukrywanie (np. obraźliwy komentarz) ---------------------

create or replace function public.admin_reviews()
returns table (order_id uuid, home_id uuid, home_name text, rating smallint, comment text,
               hidden_at timestamptz, hidden_reason text, created_at timestamptz, updated_at timestamptz)
language plpgsql stable security definer set search_path = public as $$
begin
  perform assert_platform_admin();
  return query
    select r.order_id, r.home_id, h.name, r.rating, r.comment, r.hidden_at, r.hidden_reason, r.created_at, r.updated_at
    from home_reviews r join funeral_homes h on h.id = r.home_id
    order by r.updated_at desc
    limit 200;
end $$;
revoke all on function public.admin_reviews() from public;
grant execute on function public.admin_reviews() to authenticated;

create or replace function public.admin_set_review_hidden(p_order uuid, p_hidden boolean, p_reason text)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform assert_platform_admin();
  if p_hidden and length(trim(coalesce(p_reason, ''))) < 5 then
    raise exception 'Podaj powód ukrycia oceny.' using errcode = 'P0001';
  end if;
  update home_reviews
     set hidden_at = case when p_hidden then now() end,
         hidden_reason = case when p_hidden then trim(p_reason) end
   where order_id = p_order;
  if not found then
    raise exception 'Nie ma takiej oceny.' using errcode = 'P0001';
  end if;
  perform admin_log(case when p_hidden then 'ukrycie oceny' else 'przywrócenie oceny' end, p_order::text);
end $$;
revoke all on function public.admin_set_review_hidden(uuid, boolean, text) from public;
grant execute on function public.admin_set_review_hidden(uuid, boolean, text) to authenticated;
