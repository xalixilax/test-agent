import { bookmarks } from "./db/schema";
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

		const allBookmarks = await db.select().from(bookmarks);
		log(`Found ${allBookmarks.length} bookmarks`);

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
