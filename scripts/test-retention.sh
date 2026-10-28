#!/usr/bin/env bash
# Runs the retention SQL from src/lib/retention.ts against a throwaway local
# Postgres database: Umami migrations, two websites, old and recent rows.
# Checks that dry run and write agree, that only old Régitex rows go,
# and that the other website is untouched.
# Usage: scripts/test-retention.sh   (needs createdb, psql, node >= 23)
set -euo pipefail
cd "$(dirname "$0")/.."

DB="umami_retention_test_$$"
R='352a3bc1-e204-45e8-b23e-ec2bc50a2b3d'
O='00000000-0000-4000-8000-000000000002'
psql_q() { psql -X -q -v ON_ERROR_STOP=1 -d "$DB" "$@"; }

createdb "$DB"
trap 'dropdb --if-exists "$DB"' EXIT

for f in prisma/migrations/*/migration.sql; do psql_q -f "$f" > /dev/null; done

# Seed: per website, sessions "old" (old rows only), "mixed" (old session, one
# recent event) and "new"; one old and one recent row in every table; one
# event_data row that is recent but hangs off an old event; one event 24
# months old (must stay).
seed() {
  local w="$1" p="$2"
  psql_q <<SQL
insert into session (session_id, website_id, created_at) values
  ('${p}0000000-0000-4000-8000-000000000001', '$w', '2020-01-01'),
  ('${p}0000000-0000-4000-8000-000000000002', '$w', '2020-01-01'),
  ('${p}0000000-0000-4000-8000-000000000003', '$w', now());
insert into website_event (event_id, website_id, session_id, visit_id, url_path, created_at) values
  ('${p}1000000-0000-4000-8000-000000000001', '$w', '${p}0000000-0000-4000-8000-000000000001', gen_random_uuid(), '/', '2020-01-01'),
  ('${p}1000000-0000-4000-8000-000000000002', '$w', '${p}0000000-0000-4000-8000-000000000002', gen_random_uuid(), '/', '2020-01-01'),
  ('${p}1000000-0000-4000-8000-000000000003', '$w', '${p}0000000-0000-4000-8000-000000000002', gen_random_uuid(), '/', now()),
  ('${p}1000000-0000-4000-8000-000000000004', '$w', '${p}0000000-0000-4000-8000-000000000003', gen_random_uuid(), '/', now() - interval '24 months');
insert into event_data (event_data_id, website_id, website_event_id, data_key, data_type, created_at) values
  (gen_random_uuid(), '$w', '${p}1000000-0000-4000-8000-000000000001', 'k', 1, '2020-01-01'),
  (gen_random_uuid(), '$w', '${p}1000000-0000-4000-8000-000000000001', 'k2', 1, now()),
  (gen_random_uuid(), '$w', '${p}1000000-0000-4000-8000-000000000003', 'k', 1, now());
insert into session_data (session_data_id, website_id, session_id, data_key, data_type, created_at) values
  (gen_random_uuid(), '$w', '${p}0000000-0000-4000-8000-000000000001', 'k', 1, '2020-01-01'),
  (gen_random_uuid(), '$w', '${p}0000000-0000-4000-8000-000000000003', 'k', 1, now());
insert into session_link (website_id, session_id, distinct_id, created_at) values
  ('$w', '${p}0000000-0000-4000-8000-000000000001', 'a', '2020-01-01'),
  ('$w', '${p}0000000-0000-4000-8000-000000000003', 'b', now());
insert into revenue (revenue_id, website_id, session_id, event_id, event_name, currency, created_at) values
  (gen_random_uuid(), '$w', '${p}0000000-0000-4000-8000-000000000001', gen_random_uuid(), 'e', 'CAD', '2020-01-01'),
  (gen_random_uuid(), '$w', '${p}0000000-0000-4000-8000-000000000003', gen_random_uuid(), 'e', 'CAD', now());
insert into heatmap_event (heatmap_event_id, website_id, session_id, visit_id, url_path, event_type, created_at) values
  (gen_random_uuid(), '$w', '${p}0000000-0000-4000-8000-000000000001', gen_random_uuid(), '/', 1, '2020-01-01'),
  (gen_random_uuid(), '$w', '${p}0000000-0000-4000-8000-000000000003', gen_random_uuid(), '/', 1, now());
insert into session_replay (replay_id, website_id, session_id, visit_id, chunk_index, events, event_count, started_at, ended_at, created_at) values
  (gen_random_uuid(), '$w', '${p}0000000-0000-4000-8000-000000000001', gen_random_uuid(), 0, '\x00', 1, '2020-01-01', '2020-01-01', '2020-01-01'),
  (gen_random_uuid(), '$w', '${p}0000000-0000-4000-8000-000000000003', gen_random_uuid(), 0, '\x00', 1, now(), now(), now());
insert into session_replay_saved (saved_replay_id, name, website_id, visit_id, created_at) values
  (gen_random_uuid(), 'a', '$w', gen_random_uuid(), '2020-01-01'),
  (gen_random_uuid(), 'b', '$w', gen_random_uuid(), now());
SQL
}
seed "$R" a
seed "$O" b

# Build a psql script from the shipped SQL: one prepared statement per table,
# executed with the same cutoff runRetention computes.
gen() {
  node --input-type=module -e "
    const m = await import('./src/lib/retention.ts');
    const write = process.argv[1] === 'write';
    let i = 0;
    for (const { table, where } of m.RETENTION_TABLES) {
      const q = 'q' + i++;
      console.log('prepare ' + q + '(uuid, timestamptz) as ' + m.getRetentionQuery(table, where, write).replace(/\s+/g, ' ') + ';');
      console.log('\\\\echo ' + table);
      console.log(\"execute \" + q + \"('$R', now() - make_interval(months => \" + m.RETENTION_MONTHS + \"));\");
    }
  " "$1"
}

run() { gen "$1" | psql_q -At | paste - - ; }

snapshot() {
  psql_q -At -c "
    select string_agg(t || '=' || n, ' ' order by t) from (
      select 'session' t, count(*) n from session where website_id = '$1' union all
      select 'session_link', count(*) from session_link where website_id = '$1' union all
      select 'website_event', count(*) from website_event where website_id = '$1' union all
      select 'event_data', count(*) from event_data where website_id = '$1' union all
      select 'session_data', count(*) from session_data where website_id = '$1' union all
      select 'revenue', count(*) from revenue where website_id = '$1' union all
      select 'heatmap_event', count(*) from heatmap_event where website_id = '$1' union all
      select 'session_replay', count(*) from session_replay where website_id = '$1' union all
      select 'session_replay_saved', count(*) from session_replay_saved where website_id = '$1') s"
}

other_before=$(snapshot "$O")
regitex_before=$(snapshot "$R")
dry=$(run dry)
regitex_after_dry=$(snapshot "$R")
write=$(run write)
regitex_after=$(snapshot "$R")
other_after=$(snapshot "$O")

expected="session_replay_saved	1
session_replay	1
heatmap_event	1
revenue	1
event_data	2
session_data	1
session_link	1
website_event	2
session	1"

fail=0
check() { if [ "$2" = "$3" ]; then echo "ok   $1"; else echo "FAIL $1"; echo "  expected: $3"; echo "  got:      $2"; fail=1; fi; }

echo "dry run counts:"; echo "$dry"
check "dry run matches expected" "$dry" "$expected"
check "dry run deletes nothing" "$regitex_after_dry" "$regitex_before"
check "write deletes what dry run counted" "$write" "$dry"
check "other website untouched" "$other_after" "$other_before"
check "Régitex keeps recent rows" "$regitex_after" "event_data=1 heatmap_event=1 revenue=1 session=2 session_data=1 session_link=1 session_replay=1 session_replay_saved=1 website_event=2"
check "second write finds nothing" "$(run write | cut -f2 | sort -u)" "0"

exit $fail
