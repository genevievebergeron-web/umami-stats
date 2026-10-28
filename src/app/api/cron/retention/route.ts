import { timingSafeEqual } from 'node:crypto';
import prisma, { getSchema } from '@/lib/prisma';
import { json, serverError, serviceUnavailable, unauthorized } from '@/lib/response';
import { RETENTION_WEBSITE_ID, type RetentionExecutor, runRetention } from '@/lib/retention';

// Scheduled purge of Régitex visit data older than 25 months.
// Dry run by default (counts only). Deletes only with ?mode=write.
// Secret: Authorization: Bearer <RETENTION_SECRET> (preferred) or ?secret=<RETENTION_SECRET>.

function isAuthorized(request: Request) {
  const expected = process.env.RETENTION_SECRET;

  if (!expected || expected.length < 32) {
    return null;
  }

  const url = new URL(request.url);
  const header = request.headers.get('authorization');
  const given = header?.startsWith('Bearer ') ? header.slice(7) : url.searchParams.get('secret');

  if (!given) {
    return false;
  }

  const a = Buffer.from(given);
  const b = Buffer.from(expected);

  return a.length === b.length && timingSafeEqual(a, b);
}

async function handler(request: Request) {
  const authorized = isAuthorized(request);

  if (authorized === null) {
    return serviceUnavailable({ message: 'RETENTION_SECRET is not set.' });
  }

  if (!authorized) {
    return unauthorized();
  }

  const write = new URL(request.url).searchParams.get('mode') === 'write';

  try {
    const result = await prisma.transaction(
      (tx: RetentionExecutor) =>
        runRetention(tx, { websiteId: RETENTION_WEBSITE_ID, write, schema: getSchema() }),
      { timeout: 300_000 },
    );

    return json(result);
  } catch (e) {
    return serverError(e);
  }
}

export const GET = handler;
export const POST = handler;
