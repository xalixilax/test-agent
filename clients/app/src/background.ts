import { initDb, type PGlite } from "./shared/db/pglite";
import { PgliteMetadataRepository } from "./contexts/metadata/infrastructure/pglite-metadata-repository";
import { MetadataService } from "./contexts/metadata/application/metadata-service";
import { migrateLegacyMetadata } from "./contexts/metadata/infrastructure/legacy-migration";
import { IdentityService } from "./contexts/identity/application/identity-service";
import { ChromeSessionStore } from "./contexts/identity/infrastructure/chrome-session-store";
import { HttpSyncApiClient } from "./contexts/sync/infrastructure/http-sync-api-client";
import { DataKeyCipher } from "./contexts/sync/infrastructure/data-key-cipher";
import { SystemClock } from "./contexts/sync/infrastructure/system-clock";
import { ChromeBookmarkGateway } from "./contexts/sync/infrastructure/chrome-bookmark-gateway";
import { SyncEngine } from "./contexts/sync/application/sync-engine";
import { MoveCoordinator } from "./contexts/sync/application/move-coordinator";
import { ImageArchiver } from "./contexts/sync/application/image-archiver";
import {
  capturePage,
  captureTabScreenshot,
  dataUrlToBytes,
  discoverOgImage,
  extractOgImageFromTab,
} from "./contexts/sync/infrastructure/og-image-discovery";
import { normalizeUrl } from "./contexts/metadata/domain/url";
import type { MetadataRecordView } from "./contexts/metadata/domain/metadata";
import {
  createAppRouter,
  type AppRouterContext,
  type CaptureResult,
  type DeviceInfo,
  type SyncStatus,
} from "./routers/appRouters";
import { createWorkerHandler, type WorkerRequest, type WorkerResponse } from "./shared/rpc/router";
import { SYNC_API_URL } from "./shared/config";
import { detectDeviceName } from "./shared/device-name";
import { watchForDevReload } from "./shared/dev-reload";

const LAST_SYNC_KEY = "sync.lastAt";

watchForDevReload();

const LAST_ERROR_KEY = "sync.lastError";
const VISITED_URLS_KEY = "visitedUrls";
const AUTO_CAPTURE_DELAY_MS = 2_000;

interface Services {
  db: PGlite;
  repository: PgliteMetadataRepository;
  metadata: MetadataService;
  identity: IdentityService;
  sessionStore: ChromeSessionStore;
  api: HttpSyncApiClient;
  engine: SyncEngine;
  archiver: ImageArchiver;
  coordinator: MoveCoordinator;
}

let services: Services | null = null;
let handleRequest: ((request: WorkerRequest) => Promise<WorkerResponse>) | null = null;
let syncing = false;
let backfilling = false;
let syncTimer: ReturnType<typeof setTimeout> | null = null;

const now = () => Date.now();
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const notify = (message: unknown): void => {
  chrome.runtime.sendMessage(message).catch(() => undefined);
};

const resolveBookmarkUrl = async (chromeBookmarkId: string): Promise<string | null> => {
  try {
    const [node] = await chrome.bookmarks.get(chromeBookmarkId);
    return node?.url ?? null;
  } catch {
    return null;
  }
};

const getVisitedUrls = async (): Promise<Set<string>> => {
  const result = await chrome.storage.local.get(VISITED_URLS_KEY);
  const data = result[VISITED_URLS_KEY] as { urls?: string[] } | undefined;
  return new Set(data?.urls ?? []);
};

const addVisitedUrl = async (url: string): Promise<void> => {
  const visited = await getVisitedUrls();
  visited.add(url);
  await chrome.storage.local.set({
    [VISITED_URLS_KEY]: { urls: Array.from(visited) },
  });
};

const flattenBookmarks = (
  nodes: chrome.bookmarks.BookmarkTreeNode[],
): chrome.bookmarks.BookmarkTreeNode[] => {
  const result: chrome.bookmarks.BookmarkTreeNode[] = [];
  for (const node of nodes) {
    if (node.url) result.push(node);
    if (node.children) result.push(...flattenBookmarks(node.children));
  }
  return result;
};

const isHttpUrl = (url: string): boolean => url.startsWith("http://") || url.startsWith("https://");

const initServices = async (): Promise<Services> => {
  const db = await initDb();
  const repository = new PgliteMetadataRepository(db);
  const clock = new SystemClock();
  const sessionStore = new ChromeSessionStore();
  const api = new HttpSyncApiClient({
    baseUrl: SYNC_API_URL,
    getToken: async () => (await sessionStore.get())?.token ?? null,
  });
  const metadata = new MetadataService(repository, clock, () => {
    notify({ action: "dataChanged" });
    scheduleSync();
  });
  const identity = new IdentityService(api, sessionStore);
  const cipher = new DataKeyCipher(async () => (await sessionStore.get())?.dataKey ?? null);
  const engine = new SyncEngine({
    store: repository,
    gateway: api,
    cipher,
    clock,
    isEnabled: async () => (await sessionStore.get()) !== null,
  });
  const archiver = new ImageArchiver(
    api,
    metadata,
    async () => (await sessionStore.get()) !== null,
  );
  const coordinator = new MoveCoordinator({
    repository,
    bookmarks: new ChromeBookmarkGateway(),
    clock,
    onChange: () => {
      notify({ action: "dataChanged" });
      scheduleSync();
    },
  });

  await migrateLegacyMetadata({
    db,
    repository,
    metadata,
    resolveBookmarkUrl,
  });

  return {
    db,
    repository,
    metadata,
    identity,
    sessionStore,
    api,
    engine,
    archiver,
    coordinator,
  };
};

const requireServices = (): Services => {
  if (!services) throw new Error("Services are not ready");
  return services;
};

const detectThisDeviceName = async (): Promise<string> => {
  const braveApi = (navigator as Navigator & { brave?: { isBrave?: () => Promise<boolean> } })
    .brave;
  const brave = (await braveApi?.isBrave?.().catch(() => false)) ?? false;
  return detectDeviceName({ userAgent: navigator.userAgent, brave });
};

const ensureDeviceName = async (current: Services): Promise<void> => {
  const selfId = await current.repository.getDeviceId();
  const names = await current.repository.listDeviceNames();
  if (names.some((entry) => entry.deviceId === selfId)) return;
  await current.metadata.setDeviceName(await detectThisDeviceName());
};

const listDevices = async (): Promise<DeviceInfo[]> => {
  const current = requireServices();
  const selfId = await current.repository.getDeviceId();
  const names = await current.repository.listDeviceNames();
  const byId = new Map(names.map((entry) => [entry.deviceId, entry.name]));
  if (!byId.has(selfId)) byId.set(selfId, await detectThisDeviceName());
  return [...byId.entries()]
    .map(([deviceId, name]) => ({ deviceId, name, isSelf: deviceId === selfId }))
    .sort((a, b) => a.name.localeCompare(b.name));
};

const reconcileBookmarks = async (): Promise<void> => {
  try {
    const current = await ready;
    await current.coordinator.reconcile();
  } catch (error) {
    console.error("[background] bookmark reconcile failed", error);
  } finally {
    notify({ action: "bookmarkChanged" });
  }
};

const buildStatus = async (): Promise<SyncStatus> => {
  const current = services;
  if (!current) {
    return {
      loggedIn: false,
      registered: false,
      reachable: false,
      apiUrl: SYNC_API_URL,
      lastSyncAt: null,
      lastError: null,
      pendingCount: 0,
    };
  }

  const [identityStatus, pendingCount, lastSyncAt, lastError] = await Promise.all([
    current.identity.status(),
    current.repository.countDirtyFields(),
    current.repository.getSyncState(LAST_SYNC_KEY),
    current.repository.getSyncState(LAST_ERROR_KEY),
  ]);

  return {
    loggedIn: identityStatus.loggedIn,
    registered: identityStatus.registered,
    reachable: identityStatus.reachable,
    apiUrl: SYNC_API_URL,
    lastSyncAt: lastSyncAt ? Number(lastSyncAt) : null,
    lastError: lastError && lastError !== "" ? lastError : null,
    pendingCount,
  };
};

const runSync = async (): Promise<SyncStatus> => {
  const current = services;
  if (!current) return buildStatus();
  if (syncing) return buildStatus();

  syncing = true;
  try {
    const result = await current.engine.syncNow();
    if (!result.skipped) {
      await current.coordinator.reconcile();
      await current.repository.setSyncState(LAST_SYNC_KEY, String(now()));
      await current.repository.setSyncState(
        LAST_ERROR_KEY,
        result.errors > 0 ? `${result.errors} remote change(s) could not be decrypted` : "",
      );
      notify({ action: "dataChanged" });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (/session|unauthor|401/iu.test(message)) {
      await current.identity.logout();
      await current.repository.setSyncState(
        LAST_ERROR_KEY,
        "Session expired. Log in again from the SYNC panel.",
      );
    } else {
      await current.repository.setSyncState(LAST_ERROR_KEY, message);
    }
  } finally {
    syncing = false;
  }

  return buildStatus();
};

const scheduleSync = (delayMs = AUTO_CAPTURE_DELAY_MS): void => {
  if (syncTimer) clearTimeout(syncTimer);
  syncTimer = setTimeout(() => {
    syncTimer = null;
    void runSync();
  }, delayMs);
};

const listRecordViews = async (): Promise<MetadataRecordView[]> => {
  const current = requireServices();
  const records = await current.repository.listRecords();
  const session = await current.sessionStore.get();

  let signedUrls = new Map<string, string>();
  if (session) {
    const items = records
      .filter((record) => record.imageKey)
      .map((record) => ({ uuid: record.uuid, key: record.imageKey! }));
    if (items.length > 0) {
      try {
        signedUrls = await current.api.signImageUrls(items);
      } catch {
        signedUrls = new Map();
      }
    }
  }

  return records.map((record) => ({
    ...record,
    imageUrl: record.imageKey ? signedUrls.get(`${record.uuid}/${record.imageKey}`) : undefined,
  }));
};

const captureImage = async (url: string): Promise<CaptureResult> => {
  const current = requireServices();
  const capture = await capturePage(url);
  if (!capture) return { imageKey: null };

  const decoded = capture.dataUrl ? dataUrlToBytes(capture.dataUrl) : null;
  if (decoded) {
    try {
      const imageKey = await current.archiver.archiveScreenshot(
        url,
        decoded.bytes,
        decoded.contentType,
      );
      if (imageKey) return { imageKey };
    } catch {
      // Upload failed; fall back to the site's own image below.
    }
  }

  if (capture.linkUrl) {
    await current.metadata.setScreenshotUrl(url, capture.linkUrl);
  }
  return { imageKey: null };
};

const backfillImages = async (): Promise<{ started: boolean }> => {
  if (backfilling) return { started: false };
  backfilling = true;

  void (async () => {
    try {
      const current = requireServices();
      const bookmarks = flattenBookmarks(await chrome.bookmarks.getTree()).filter(
        (bookmark) => bookmark.url && isHttpUrl(bookmark.url),
      );
      const records = await current.repository.listRecords();
      const byUrl = new Map(records.map((record) => [normalizeUrl(record.url), record]));
      const missing = bookmarks.filter((bookmark) => {
        const record = byUrl.get(normalizeUrl(bookmark.url!));
        return !record?.imageKey && !record?.screenshotUrl;
      });

      let success = 0;
      let failed = 0;
      const batchSize = 3;

      for (let i = 0; i < missing.length; i += batchSize) {
        const batch = missing.slice(i, i + batchSize);
        await Promise.all(
          batch.map(async (bookmark) => {
            const url = bookmark.url!;
            try {
              const imageUrl = await discoverOgImage(url);
              if (!imageUrl) {
                failed += 1;
                return;
              }
              await current.metadata.setScreenshotUrl(url, imageUrl);
              success += 1;
            } catch {
              failed += 1;
            }
          }),
        );

        notify({
          action: "fetchProgress",
          processed: Math.min(i + batchSize, missing.length),
          total: missing.length,
          success,
          failed,
        });

        if (i + batchSize < missing.length) await delay(1_000);
      }
    } finally {
      backfilling = false;
    }
  })();

  return { started: true };
};

const buildContext = (current: Services): AppRouterContext => ({
  listRecords: listRecordViews,
  findByUrl: (url) => current.repository.findByUrl(url),
  setNote: (url, note) => current.metadata.setNote(url, note),
  setRating: (url, rating) => current.metadata.setRating(url, rating),
  setTags: (url, tags) => current.metadata.setTags(url, tags),
  clearScreenshot: (url) => current.metadata.clearScreenshot(url),
  purgeMetadata: (url) => current.metadata.purge(url),
  captureImage,
  backfillImages,
  syncNow: runSync,
  status: buildStatus,
  listDevices,
  setDeviceName: (name) => current.metadata.setDeviceName(name),
  moveBookmark: async (url, target) => {
    await current.coordinator.requestMove(url, target);
    await runSync();
    // Reconcile even when sync is disabled so a local "move here" still lands.
    await current.coordinator.reconcile();
  },
  identityStatus: () => current.identity.status(),
  register: async (password, inviteCode) => {
    await current.identity.register(password, inviteCode);
    await ensureDeviceName(current);
    await runSync();
    void backfillImages();
  },
  login: async (password) => {
    await current.identity.login(password);
    await ensureDeviceName(current);
    await runSync();
    void backfillImages();
  },
  logout: () => current.identity.logout(),
  changePassword: (newPassword) => current.identity.changePassword(newPassword),
});

const ready = initServices()
  .then((current) => {
    services = current;
    handleRequest = createWorkerHandler(createAppRouter(buildContext(current)));
    return current;
  })
  .catch((error: unknown) => {
    console.error("[background] init failed", error instanceof Error ? error.message : error);
    throw error;
  });

chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
  if (request.type !== "worker-request") return false;

  const workerRequest = request as WorkerRequest;
  void ready
    .then(() => handleRequest?.(workerRequest))
    .then((response) => {
      sendResponse({
        ...response,
        type: "worker-response",
        requestId: workerRequest.requestId ?? workerRequest.id,
      });
    })
    .catch((error: unknown) => {
      sendResponse({
        type: "worker-response",
        id: workerRequest.id,
        requestId: workerRequest.requestId ?? workerRequest.id,
        success: false,
        error: error instanceof Error ? error.message : String(error),
      } as WorkerResponse);
    });

  return true;
});

const captureFromOpenTab = async (current: Services, tabId: number, url: string): Promise<void> => {
  const imageUrl = await extractOgImageFromTab(tabId);
  if (imageUrl) {
    await current.metadata.setScreenshotUrl(url, imageUrl);
    return;
  }

  const dataUrl = await captureTabScreenshot(tabId);
  const decoded = dataUrl ? dataUrlToBytes(dataUrl) : null;
  if (!decoded) return;
  await current.archiver.archiveScreenshot(url, decoded.bytes, decoded.contentType);
};

const captureForVisitedBookmark = async (tabId: number, url: string): Promise<void> => {
  const current = services;
  if (!current) return;

  const bookmarks = await chrome.bookmarks.search({ url });
  if (bookmarks.length === 0) return;

  const record = await current.repository.findByUrl(url);
  if (record?.screenshotUrl || record?.imageKey) return;

  const visited = await getVisitedUrls();
  if (visited.has(url)) return;
  await addVisitedUrl(url);

  await captureFromOpenTab(current, tabId, url);
};

const autoCaptureOnVisit = async (
  tabId: number,
  changeInfo: { status?: string },
  tab: chrome.tabs.Tab,
): Promise<void> => {
  if (changeInfo.status !== "complete" || !tab.url) return;
  if (!isHttpUrl(tab.url)) return;

  try {
    await captureForVisitedBookmark(tabId, tab.url);
  } catch (error) {
    console.error("[background] auto capture failed", error);
  }
};

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  void autoCaptureOnVisit(tabId, changeInfo, tab);
});

// Possession is re-derived from the bookmark tree on every event, so deleting a
// bookmark only drops this browser from the record's holders instead of purging
// metadata other browsers still rely on.
for (const event of [
  chrome.bookmarks.onCreated,
  chrome.bookmarks.onChanged,
  chrome.bookmarks.onMoved,
  chrome.bookmarks.onRemoved,
]) {
  event.addListener(() => void reconcileBookmarks());
}

const ensureAlarms = async (): Promise<void> => {
  // chrome.alarms.create replaces an existing alarm and restarts its period,
  // so only create when missing.
  if (!(await chrome.alarms.get("sync"))) {
    await chrome.alarms.create("sync", { periodInMinutes: 1 });
  }
  if (!(await chrome.alarms.get("cleanupVisitedUrls"))) {
    await chrome.alarms.create("cleanupVisitedUrls", { periodInMinutes: 30 });
  }
};

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "sync") void runSync();
  if (alarm.name === "cleanupVisitedUrls") {
    void chrome.storage.local.set({ [VISITED_URLS_KEY]: { urls: [] } });
  }
});

chrome.runtime.onStartup.addListener(() => {
  void ready.then(ensureAlarms).then(() => runSync());
});

chrome.runtime.onInstalled.addListener(() => {
  void ready.then(ensureAlarms).then(() => runSync());
});

void ready.then(ensureAlarms);
void ready
  .then(ensureDeviceName)
  .then(() => reconcileBookmarks())
  .catch((error: unknown) => console.error("[background] startup reconcile failed", error));
