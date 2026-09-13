import { PGlite } from "@electric-sql/pglite";
import { MIGRATIONS } from "./migrations";

export const initDb = async (): Promise<PGlite> => {
  const client = new PGlite("idb://my-pgdata");
  await client.waitReady;

  await client.exec(`
    CREATE TABLE IF NOT EXISTS "_migrations" (
      id TEXT PRIMARY KEY,
      applied_at BIGINT NOT NULL
    );
  `);

  const applied = await client.query<{ id: string }>(
    'SELECT id FROM "_migrations"',
  );
  const appliedIds = new Set(applied.rows.map((row) => row.id));

  for (const migration of MIGRATIONS) {
    if (appliedIds.has(migration.id)) continue;
    await client.exec(migration.sql);
    await client.query(
      'INSERT INTO "_migrations" (id, applied_at) VALUES ($1, $2)',
      [migration.id, Date.now()],
    );
  }

  return client;
};

export { PGlite };
