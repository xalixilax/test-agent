export const MIGRATIONS: Array<{ id: string; sql: string }> = [
  {
    id: "0001_metadata_sync",
    sql: `
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
    `,
  },
];
