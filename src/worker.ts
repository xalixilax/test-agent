import { users } from "./db/schema";
import { createWorkerHandler, type WorkerRequest } from "./lib/worker/router";
import { createAppRouter } from "./routers/appRouters";
import { error, log } from "./lib/worker/utils";
import { db, initDb } from "./db/db";

let isDbReady = false;
let handleRequest: ReturnType<typeof createWorkerHandler> | null = null;
const requestQueue: WorkerRequest[] = [];

(async () => {
	try {
		log("Initializing database...");
		await initDb();
		log("Database initialized successfully");

		const router = createAppRouter({ db, log, error });
		handleRequest = createWorkerHandler(router);

		// await db.execute(`
		// 	drop table if exists users;
		// `);

		const allUsers = await db.select().from(users);
		log(`Found ${allUsers.length} users`);

		if (allUsers.length === 0) {
			log("Inserting default user...");
			await db.insert(users).values({
				name: "John Doe",
				email: "john@example.com",
				age: 30,
			});
			log("Default user inserted");
		}

		isDbReady = true;
		log("Database ready");

		// Process queued requests
		while (requestQueue.length > 0) {
			const queuedRequest = requestQueue.shift();
			if (queuedRequest) {
				const response = await handleRequest(queuedRequest);
				postMessage(response);
			}
		}
	} catch (err) {
		const errorMsg = err instanceof Error ? err.message : String(err);
		error("Init failed:", errorMsg);
		throw err;
	}
})();

self.addEventListener("message", async (event: MessageEvent) => {
	if (!event.data.route) return;

	const request = event.data as WorkerRequest;

	if (!isDbReady || !handleRequest) {
		requestQueue.push(request);
		log(`Request queued: ${request.route}`);
		return;
	}

	const response = await handleRequest(request);
	postMessage(response);
});
