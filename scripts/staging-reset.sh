#!/usr/bin/env bash
# Przywraca dane testowe na WERSJI TESTOWEJ (Supabase): czyści tabele aplikacji i wczytuje supabase/seed.sql.
# Konta w auth.users zostają. Odmawia działania na bazie, w której nie ma zakładu testowego „Dom Pogrzebowy Cisza”
# – dzięki temu nie da się przypadkiem wyczyścić produkcji.
#   STAGING_DATABASE_URL=postgresql://... CONFIRM=ostoja-test ./scripts/staging-reset.sh
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
URL="${STAGING_DATABASE_URL:?Ustaw STAGING_DATABASE_URL (Supabase → Connect → Session pooler)}"

if [[ "${CONFIRM:-}" != "ostoja-test" ]]; then
  echo "Dla bezpieczeństwa ustaw CONFIRM=ostoja-test" >&2
  exit 1
fi

demo=$(psql "$URL" -tA -c "select count(*) from public.funeral_homes where id = '00000000-0000-4000-a000-000000000001'" 2>/dev/null || echo 0)
empty=$(psql "$URL" -tA -c "select count(*) = 0 from public.funeral_homes" 2>/dev/null || echo f)
if [[ "$demo" != "1" && "$empty" != "t" ]]; then
  echo "To nie wygląda na bazę testową (brak zakładu testowego Cisza, a są inne dane). Przerywam." >&2
  exit 1
fi

psql "$URL" -v ON_ERROR_STOP=1 -q <<'SQL'
begin;
truncate table public.notifications, public.push_subscriptions, public.inquiry_drafts, public.invitations, public.admin_audit, public.bookings, public.events, public.duty_shifts,
  public.order_tasks, public.orders, public.offers, public.inquiries, public.resources, public.price_items,
  public.memberships, public.funeral_homes, public.price_catalog, public.cities restart identity cascade;
commit;
SQL
psql "$URL" -v ON_ERROR_STOP=1 -q -f "$ROOT/supabase/seed.sql"
echo "Dane testowe przywrócone."
