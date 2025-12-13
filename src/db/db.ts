import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import migrationsData from "./migrations.json";

interface Migration {
	version: string;
	sql: string;
}

const migrations = migrationsData as Migration[];

let db: ReturnType<typeof drizzle>;
let client: PGlite;

async function initDb() {
	console.log("[DB] Starting database initialization...");
	// Use indexedDB instead of OPFS-AHP because service workers don't support createSyncAccessHandle
	client = new PGlite("idb://my-pgdata");
	await client.waitReady;
	console.log("[DB] PGlite client ready");

	db = drizzle(client);
	console.log("[DB] Drizzle instance created");

	// Run custom migrations
	await runMigrations();

	return db;
}

async function runMigrations() {
	console.log("[DB] Checking for applied migrations...");

	// Create migrations tracking table if it doesn't exist
	await client.exec(`
		CREATE TABLE IF NOT EXISTS "_drizzle_migrations" (
			id SERIAL PRIMARY KEY,
			hash TEXT NOT NULL UNIQUE,
			created_at BIGINT NOT NULL
		);
	`);

	// Get applied migrations
	const appliedResult = await client.query(
		'SELECT hash FROM "_drizzle_migrations"',
	);
	const appliedMigrations = new Set(
		(appliedResult.rows as Array<{ hash: string }>).map((row) => row.hash),
	);

	console.log(`[DB] Found ${appliedMigrations.size} applied migrations`);

	// Run pending migrations
	for (const migration of migrations) {
		if (!appliedMigrations.has(migration.version)) {
			console.log(`[DB] Applying migration: ${migration.version}`);
			await client.exec(migration.sql);
			await client.query(
				'INSERT INTO "_drizzle_migrations" (hash, created_at) VALUES ($1, $2)',
				[migration.version, Date.now()],
			);
			console.log(`[DB] Migration ${migration.version} applied successfully`);
		} else {
			console.log(
				`[DB] Migration ${migration.version} already applied, skipping`,
			);
		}
	}

	console.log("[DB] All migrations completed");
}

export { db, initDb };
