#!/usr/bin/env tsx

/**
 * Generate a static migrations.json file from Drizzle's migration journal and SQL files.
 * There was some issues while directly trying to import using drizzle in the runtime from the worker.
 */

import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const DRIZZLE_DIR = "./drizzle";
const MIGRATIONS_FILE = "./src/db/migrations.json";
const META_JOURNAL = "./drizzle/meta/_journal.json";

interface JournalEntry {
	idx: number;
	version: string;
	when: number;
	tag: string;
	breakpoints: boolean;
}

interface Journal {
	version: string;
	dialect: string;
	entries: JournalEntry[];
}

interface Migration {
	version: string;
	sql: string;
}

async function main() {
	const journal: Journal = JSON.parse(readFileSync(META_JOURNAL, "utf-8"));

	let existingMigrations: Migration[] = [];
	try {
		existingMigrations = JSON.parse(readFileSync(MIGRATIONS_FILE, "utf-8"));
	} catch {
		// File doesn't exist yet, start with empty array
		console.log("No existing migrations file found, creating new one.");
	}

	const existingVersions = new Set(existingMigrations.map((m) => m.version));

	const newMigrations: Migration[] = [];

	for (const entry of journal.entries) {
		if (!existingVersions.has(entry.tag)) {
			const sqlFile = join(DRIZZLE_DIR, `${entry.tag}.sql`);
			try {
				const sql = readFileSync(sqlFile, "utf-8").trim();
				newMigrations.push({
					version: entry.tag,
					sql: sql,
				});
				console.log(`✓ Found new migration: ${entry.tag}`);
			} catch (err) {
				console.error(`✗ Could not read SQL file for ${entry.tag}:`, err);
			}
		}
	}

	if (newMigrations.length === 0) {
		console.log("No new migrations to add.");
		return;
	}

	const allMigrations = [...existingMigrations, ...newMigrations];

	writeFileSync(
		MIGRATIONS_FILE,
		JSON.stringify(allMigrations),
		"utf-8",
	);

	console.log(
		`\n✓ Added ${newMigrations.length} migration(s) to ${MIGRATIONS_FILE}`,
	);
	for (const m of newMigrations) {
		console.log(`  - ${m.version}`);
	}
}

main();
