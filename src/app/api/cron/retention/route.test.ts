import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { GET } from './route';

const SECRET = 's'.repeat(40);
const mocks = vi.hoisted(() => ({
  runRetention: vi.fn(),
  transaction: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  default: { transaction: mocks.transaction },
  getSchema: () => null,
}));

vi.mock('@/lib/retention', async importOriginal => ({
  ...(await importOriginal<typeof import('@/lib/retention')>()),
  runRetention: mocks.runRetention,
}));

beforeEach(() => {
  vi.stubEnv('RETENTION_SECRET', SECRET);
  mocks.transaction.mockImplementation(fn => fn('tx'));
  mocks.runRetention.mockResolvedValue({ counts: {} });
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

const call = (query: string, headers?: HeadersInit) =>
  GET(new Request(`http://localhost/api/cron/retention${query}`, { headers }));

test('disabled without a long enough secret', async () => {
  vi.stubEnv('RETENTION_SECRET', 'short');
  expect((await call(`?secret=short`)).status).toBe(503);
  expect(mocks.runRetention).not.toHaveBeenCalled();
});

test('rejects a missing or wrong secret', async () => {
  expect((await call('')).status).toBe(401);
  expect((await call(`?secret=${'x'.repeat(40)}`)).status).toBe(401);
  expect(mocks.runRetention).not.toHaveBeenCalled();
});

test('dry run by default', async () => {
  expect((await call(`?secret=${SECRET}`)).status).toBe(200);
  expect(mocks.runRetention).toHaveBeenCalledWith('tx', {
    websiteId: '352a3bc1-e204-45e8-b23e-ec2bc50a2b3d',
    write: false,
    schema: null,
  });
});

test('write only with mode=write, bearer accepted', async () => {
  await call('?mode=write', { authorization: `Bearer ${SECRET}` });
  expect(mocks.runRetention).toHaveBeenCalledWith('tx', expect.objectContaining({ write: true }));
});
