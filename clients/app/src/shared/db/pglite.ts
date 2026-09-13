import { PGlite } from "@electric-sql/pglite";

const SCHEMA_SQL = `
  CREATE TABLE IF NOT EXISTS metadata_records (
    uuid TEXT PRIMARY KEY,
    url TEXT NOT NULL,
    created_at BIGINT NOT NULL,
    deleted INTEGER NOT NULL DEFAULT 0
  );
  CREATE INDEX IF NOT EXISTS metadata_records_url_idx ON metadata_records(url);
  CREATE TABLE IF NOT EXISTS metadata_fields (
    uuid TEXT NOT NULL,
    field TEXT NOT NULL,
    value TEXT,
    updated_at BIGINT NOT NULL,
    device_id TEXT NOT NULL,
    deleted INTEGER NOT NULL DEFAULT 0,
    dirty INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (uuid, field)
  );
  CREATE TABLE IF NOT EXISTS sync_state (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );
`;

export const applySchema = async (client: PGlite): Promise<void> => {
  await client.exec(SCHEMA_SQL);
};

export const initDb = async (): Promise<PGlite> => {
  const client = new PGlite("idb://my-pgdata");
  await client.waitReady;
  await applySchema(client);
  return client;
};

export { PGlite };
