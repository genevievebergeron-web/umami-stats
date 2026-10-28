// Visit-data retention for a single website. No imports so the SQL can be
// exercised directly against Postgres (see scripts/test-retention.sh).
//
// Every statement takes $1 = website id (uuid) and $2 = cutoff (timestamptz).
// Rows strictly older than the cutoff are counted (dry run) or deleted (write).
// Order matters: children first, session last.

export const RETENTION_MONTHS = 25;

// Régitex (regitex.com). The only website this purge may touch.
export const RETENTION_WEBSITE_ID = '352a3bc1-e204-45e8-b23e-ec2bc50a2b3d';

const OLD = `website_id = $1::uuid and created_at < $2::timestamptz`;

export const RETENTION_TABLES: { table: string; where: string }[] = [
  { table: 'session_replay_saved', where: OLD },
  { table: 'session_replay', where: OLD },
  { table: 'heatmap_event', where: OLD },
  { table: 'revenue', where: OLD },
  {
    table: 'event_data',
    // Also rows hanging off an old Régitex event whose own website_id drifted,
    // as Umami does in deleteWebsiteDependentData.
    where: `(website_id = $1::uuid and created_at < $2::timestamptz) or website_event_id in (
      select event_id from website_event where website_id = $1::uuid and created_at < $2::timestamptz)`,
  },
  { table: 'session_data', where: OLD },
  { table: 'session_link', where: OLD },
  { table: 'website_event', where: OLD },
  {
    // Keep a session that still has recent rows anywhere, so nothing is orphaned.
    table: 'session',
    where: `${OLD}
      and not exists (select 1 from website_event x where x.session_id = session.session_id and x.created_at >= $2::timestamptz)
      and not exists (select 1 from session_data x where x.session_id = session.session_id and x.created_at >= $2::timestamptz)
      and not exists (select 1 from revenue x where x.session_id = session.session_id and x.created_at >= $2::timestamptz)
      and not exists (select 1 from heatmap_event x where x.session_id = session.session_id and x.created_at >= $2::timestamptz)
      and not exists (select 1 from session_replay x where x.session_id = session.session_id and x.created_at >= $2::timestamptz)
      and not exists (select 1 from session_link x where x.session_id = session.session_id and x.created_at >= $2::timestamptz)`,
  },
];

export function getRetentionQuery(table: string, where: string, write: boolean) {
  return write
    ? `with d as (delete from ${table} where ${where} returning 1) select count(*)::int as count from d`
    : `select count(*)::int as count from ${table} where ${where}`;
}

export interface RetentionExecutor {
  $queryRawUnsafe: (query: string, ...params: any[]) => Promise<unknown>;
  $executeRawUnsafe: (query: string, ...params: any[]) => Promise<unknown>;
}

export async function runRetention(
  tx: RetentionExecutor,
  { websiteId, write, schema }: { websiteId: string; write: boolean; schema?: string | null },
) {
  if (websiteId !== RETENTION_WEBSITE_ID) {
    throw new Error(`Retention refused for website ${websiteId}.`);
  }

  if (schema) {
    await tx.$executeRawUnsafe(`set local search_path to "${schema}"`);
  }

  // Formatted as UTC text by Postgres: the pg adapter shifts timestamptz values
  // by the database time zone on the way in and out.
  const [{ cutoff }] = (await tx.$queryRawUnsafe(
    `select to_char((now() - make_interval(months => ${RETENTION_MONTHS})) at time zone 'UTC',
      'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') as cutoff`,
  )) as { cutoff: string }[];

  const counts: Record<string, number> = {};

  for (const { table, where } of RETENTION_TABLES) {
    const [{ count }] = (await tx.$queryRawUnsafe(
      getRetentionQuery(table, where, write),
      websiteId,
      cutoff,
    )) as { count: number }[];

    counts[table] = count;
  }

  return { websiteId, months: RETENTION_MONTHS, cutoff, write, counts };
}
