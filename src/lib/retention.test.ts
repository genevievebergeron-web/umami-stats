import { readFileSync } from 'node:fs';
import { expect, test, vi } from 'vitest';
import { RETENTION_TABLES, RETENTION_WEBSITE_ID, runRetention } from './retention';

function executor() {
  const cutoff = '2024-09-28T00:00:00.000000Z';

  return {
    $executeRawUnsafe: vi.fn().mockResolvedValue(0),
    $queryRawUnsafe: vi.fn(async (query: string, ..._params: unknown[]) =>
      query.includes('make_interval') ? [{ cutoff }] : [{ count: 3 }],
    ),
    cutoff,
  };
}

test('refuses any other website', async () => {
  const tx = executor();

  await expect(
    runRetention(tx, { websiteId: '00000000-0000-4000-8000-000000000002', write: true }),
  ).rejects.toThrow('refused');
  expect(tx.$queryRawUnsafe).not.toHaveBeenCalled();
});

test('every table is filtered on the website and the cutoff', () => {
  for (const { table, where } of RETENTION_TABLES) {
    const anchor =
      table === 'event_data'
        ? /^\(website_id = \$1::uuid and created_at < \$2::timestamptz\) or website_event_id in \(\s*select event_id from website_event where website_id = \$1::uuid and created_at < \$2::timestamptz\)$/
        : /^website_id = \$1::uuid and created_at < \$2::timestamptz/;

    expect(where).toMatch(anchor);
  }
});

// A future Umami upgrade adding a per-website table must be classified here.
test('every table with a website_id is purged or knowingly kept', () => {
  const schema = readFileSync('prisma/schema.prisma', 'utf8');
  const kept = ['website', 'report', 'segment'];
  const tables = [...schema.matchAll(/^model \w+ \{([\s\S]*?)^\}/gm)]
    .filter(([, body]) => /@map\("website_id"\)/.test(body))
    .map(([, body]) => body.match(/@@map\("(\w+)"\)/)[1]);
  const purged = RETENTION_TABLES.map(t => t.table);

  expect(tables.filter(t => !purged.includes(t) && !kept.includes(t))).toEqual([]);
  expect(purged.filter(t => !tables.includes(t))).toEqual([]);
});

test('dry run only counts, with the site id and the 25 month cutoff', async () => {
  const tx = executor();
  const result = await runRetention(tx, { websiteId: RETENTION_WEBSITE_ID, write: false });
  const queries = tx.$queryRawUnsafe.mock.calls.slice(1);

  expect(tx.$queryRawUnsafe.mock.calls[0][0]).toContain('months => 25');
  expect(queries).toHaveLength(RETENTION_TABLES.length);

  for (const [query, websiteId, cutoff] of queries) {
    expect(query).not.toMatch(/delete/i);
    expect(websiteId).toBe(RETENTION_WEBSITE_ID);
    expect(cutoff).toBe(tx.cutoff);
  }

  expect(result.write).toBe(false);
  expect(Object.keys(result.counts)).toEqual(RETENTION_TABLES.map(t => t.table));
});

test('write mode deletes, session last', async () => {
  const tx = executor();
  await runRetention(tx, { websiteId: RETENTION_WEBSITE_ID, write: true, schema: 'umami' });
  const queries = tx.$queryRawUnsafe.mock.calls.slice(1).map(([q]) => q as string);

  expect(tx.$executeRawUnsafe).toHaveBeenCalledWith('set local search_path to "umami"');
  expect(queries.every(q => q.startsWith('with d as (delete from '))).toBe(true);
  expect(queries.at(-1)).toContain('delete from session where');
});
