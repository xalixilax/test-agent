// Background service worker for automatic screenshot capture and database management
import { initDb, db } from './db/db';
import { createAppRouter } from './routers/appRouters';
import { createWorkerHandler, type WorkerRequest, type WorkerResponse } from './lib/worker/router';
import { log, error as logError } from './lib/worker/utils';

interface ScreenshotData {
  [bookmarkId: string]: {
    dataUrl: string;
    timestamp: number;
    url: string;
  };
}

interface VisitedUrlsData {
  urls: string[];
}

// Database initialization
let isDbReady = false;
let handleRequest: ReturnType<typeof createWorkerHandler> | null = null;

(async () => {
  try {
    console.log('[Background] Initializing database...');
    await initDb();
    console.log('[Background] Database initialized successfully');

    const router = createAppRouter({ db, log, error: logError });
    handleRequest = createWorkerHandler(router);

    isDbReady = true;
    console.log('[Background] Database ready');
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error('[Background] Init failed:', errorMsg);
  }
})();

// Helper function to get visited URLs from storage
async function getVisitedUrls(): Promise<Set<string>> {
  const result = await chrome.storage.local.get('visitedUrls');
  const data: VisitedUrlsData = (result.visitedUrls || { urls: [] }) as VisitedUrlsData;
  return new Set(data.urls);
}

// Helper function to save visited URLs to storage
async function addVisitedUrl(url: string): Promise<void> {
  const visitedUrls = await getVisitedUrls();
  visitedUrls.add(url);
  await chrome.storage.local.set({
    visitedUrls: { urls: Array.from(visitedUrls) }
  });
}

// Helper function to extract Open Graph image from a tab by injecting a script
async function extractOgImageFromTab(tabId: number): Promise<string | null> {
  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId },
      func: () => {
        // Helper to get meta content with different selector approaches
        const getMetaContent = (selectors: string[]): string | null => {
          for (const selector of selectors) {
            const element = document.querySelector(selector);
            if (element) {
              const content = element.getAttribute('content');
              if (content) return content;
            }
          }
          return null;
        };

        // Try multiple ways to find og:image (case-insensitive, different formats)
        let imageUrl = getMetaContent([
          'meta[property="og:image"]',
          'meta[property="og:image:secure_url"]',
          'meta[property="og:image:url"]',
          'meta[property="OG:IMAGE"]',
          'meta[name="og:image"]'
        ]);

        if (imageUrl) return imageUrl;

        // Try twitter images
        imageUrl = getMetaContent([
          'meta[name="twitter:image"]',
          'meta[name="twitter:image:src"]',
          'meta[property="twitter:image"]',
          'meta[property="twitter:image:src"]'
        ]);

        if (imageUrl) return imageUrl;

        // Last resort: search all meta tags
        const allMetas = Array.from(document.querySelectorAll('meta'));
        for (const meta of allMetas) {
          const property = meta.getAttribute('property')?.toLowerCase();
          const name = meta.getAttribute('name')?.toLowerCase();

          if (property?.includes('og:image') || name?.includes('og:image') ||
            property?.includes('twitter:image') || name?.includes('twitter:image')) {
            const content = meta.getAttribute('content');
            if (content) return content;
          }
        }

        return null;
      }
    });

    if (results && results[0] && results[0].result) {
      let imageUrl = results[0].result as string;

      // Get the tab URL to resolve relative URLs
      const tab = await chrome.tabs.get(tabId);
      if (tab.url && imageUrl) {
        // Handle relative URLs
        if (imageUrl.startsWith('/')) {
          const urlObj = new URL(tab.url);
          imageUrl = urlObj.origin + imageUrl;
        } else if (!imageUrl.startsWith('http')) {
          const urlObj = new URL(tab.url);
          imageUrl = urlObj.origin + '/' + imageUrl;
        }
      }

      return imageUrl;
    }

    console.log('No og:image found in tab');
    return null;
  } catch (error) {
    console.error('Failed to extract og:image from tab:', error);
    return null;
  }
}

// Listen for tab updates to capture screenshots on first visit
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  // Only capture when page is fully loaded
  if (changeInfo.status === 'complete' && tab.url) {
    const url = tab.url;

    // Skip chrome:// and other special URLs
    if (url.startsWith('chrome://') || url.startsWith('about:')) {
      return;
    }

    // Check if this URL is a bookmark
    try {
      const bookmarks = await chrome.bookmarks.search({ url });

      if (bookmarks.length > 0) {
        const bookmark = bookmarks[0];

        // Check if we already have a screenshot for this bookmark
        const result = await chrome.storage.local.get('screenshots');
        const screenshots: ScreenshotData = (result.screenshots || {}) as ScreenshotData;

        // Get visited URLs from storage
        const visitedUrls = await getVisitedUrls();

        // If no screenshot exists and URL hasn't been visited
        if (!screenshots[bookmark.id] && !visitedUrls.has(url)) {
          await addVisitedUrl(url);

          // Try to extract og:image from the current tab
          try {
            const ogImageUrl = await extractOgImageFromTab(tabId);

            if (ogImageUrl) {
              screenshots[bookmark.id] = {
                dataUrl: ogImageUrl,
                timestamp: Date.now(),
                url
              };

              await chrome.storage.local.set({ screenshots });
              console.log(`OG image extracted for bookmark: ${bookmark.title}`);
            } else {
              console.log(`No og:image found for bookmark: ${bookmark.title}`);
            }
          } catch (error) {
            console.error('Failed to extract og:image:', error);
          }
        }
      }
    } catch (error) {
      console.error('Error checking bookmarks:', error);
    }
  }
});

// Listen for messages from popup to manually capture screenshots and handle database operations
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  // Handle database requests
  if (request.type === 'worker-request') {
    const workerRequest = request as WorkerRequest;

    (async () => {
      if (!isDbReady || !handleRequest) {
        sendResponse({
          type: 'worker-response',
          id: workerRequest.id,
          requestId: workerRequest.requestId || workerRequest.id,
          success: false,
          error: 'Database not ready'
        } as WorkerResponse);
        return;
      }

      try {
        const response = await handleRequest(workerRequest);
        sendResponse({
          ...response,
          type: 'worker-response',
          requestId: workerRequest.requestId || workerRequest.id
        });
      } catch (err) {
        sendResponse({
          type: 'worker-response',
          id: workerRequest.id,
          requestId: workerRequest.requestId || workerRequest.id,
          success: false,
          error: err instanceof Error ? err.message : String(err)
        } as WorkerResponse);
      }
    })();

    return true; // Keep message channel open for async response
  }

  if (request.action === 'getCurrentTab') {
    // Get current active tab and check if it's bookmarked
    (async () => {
      try {
        const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tabs.length > 0 && tabs[0].url) {
          const url = tabs[0].url;
          const bookmarks = await chrome.bookmarks.search({ url });

          if (bookmarks.length > 0) {
            const bookmark = bookmarks[0];
            const result = await chrome.storage.local.get('screenshots');
            const screenshots: ScreenshotData = (result.screenshots || {}) as ScreenshotData;

            sendResponse({
              success: true,
              isBookmarked: true,
              bookmark: {
                chromeBookmarkId: bookmark.id,
                title: bookmark.title,
                url: bookmark.url,
                hasScreenshot: !!screenshots[bookmark.id]
              }
            });
          } else {
            sendResponse({ success: true, isBookmarked: false });
          }
        } else {
          sendResponse({ success: false, error: 'No active tab found' });
        }
      } catch (error) {
        console.error('Failed to get current tab:', error);
        sendResponse({ success: false, error: String(error) });
      }
    })();

    return true;
  }

  if (request.action === 'fetchAllMissingImages') {
    // Handle bulk fetching of missing images
    (async () => {
      try {
        const result = await chrome.storage.local.get('screenshots');
        const screenshots: ScreenshotData = (result.screenshots || {}) as ScreenshotData;

        // Get all bookmarks
        const allBookmarks = await chrome.bookmarks.getTree();
        const bookmarksList: chrome.bookmarks.BookmarkTreeNode[] = [];

        // Flatten bookmark tree to get all bookmarks
        const flattenBookmarks = (nodes: chrome.bookmarks.BookmarkTreeNode[]) => {
          for (const node of nodes) {
            if (node.url) {
              bookmarksList.push(node);
            }
            if (node.children) {
              flattenBookmarks(node.children);
            }
          }
        };
        flattenBookmarks(allBookmarks);

        // Filter bookmarks that don't have images and have valid URLs
        const missingImages = bookmarksList.filter(
          bookmark => bookmark.url &&
            !bookmark.url.startsWith('chrome://') &&
            !bookmark.url.startsWith('about:') &&
            !screenshots[bookmark.id]
        );

        console.log(`Found ${missingImages.length} bookmarks without images`);

        let successCount = 0;
        let failCount = 0;

        // Process bookmarks in batches to avoid overwhelming the browser
        const batchSize = 3;
        for (let i = 0; i < missingImages.length; i += batchSize) {
          const batch = missingImages.slice(i, i + batchSize);

          await Promise.all(batch.map(async (bookmark) => {
            try {
              // Create tab and extract image
              const tab = await chrome.tabs.create({ url: bookmark.url!, active: false });

              if (!tab.id) {
                failCount++;
                return;
              }

              // Wait for page to load
              await new Promise<void>((resolve, reject) => {
                const timeoutId = setTimeout(() => {
                  chrome.tabs.onUpdated.removeListener(loadListener);
                  chrome.tabs.remove(tab.id!).catch(() => { });
                  reject(new Error('Timeout'));
                }, 20000);

                const loadListener = (tabId: number, changeInfo: any) => {
                  if (tabId === tab.id && changeInfo.status === 'complete') {
                    clearTimeout(timeoutId);
                    chrome.tabs.onUpdated.removeListener(loadListener);
                    setTimeout(() => resolve(), 500);
                  }
                };

                chrome.tabs.onUpdated.addListener(loadListener);
              });

              // Extract og:image
              const ogImageUrl = await extractOgImageFromTab(tab.id);

              // Close tab
              await chrome.tabs.remove(tab.id).catch(() => { });

              if (ogImageUrl) {
                const currentResult = await chrome.storage.local.get('screenshots');
                const currentScreenshots: ScreenshotData = (currentResult.screenshots || {}) as ScreenshotData;

                currentScreenshots[bookmark.id] = {
                  dataUrl: ogImageUrl,
                  timestamp: Date.now(),
                  url: bookmark.url!
                };

                await chrome.storage.local.set({ screenshots: currentScreenshots });
                successCount++;
                console.log(`Fetched image for: ${bookmark.title}`);
              } else {
                failCount++;
              }
            } catch (error) {
              console.error(`Failed to fetch image for ${bookmark.title}:`, error);
              failCount++;
            }
          }));

          // Send progress update
          chrome.runtime.sendMessage({
            action: 'fetchProgress',
            processed: Math.min(i + batchSize, missingImages.length),
            total: missingImages.length,
            success: successCount,
            failed: failCount
          }).catch(() => { });

          // Small delay between batches
          if (i + batchSize < missingImages.length) {
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
        }

        sendResponse({
          success: true,
          total: missingImages.length,
          successCount,
          failCount
        });
      } catch (error) {
        console.error('Failed to fetch missing images:', error);
        sendResponse({ success: false, error: String(error) });
      }
    })();

    return true;
  }

  if (request.action === 'captureScreenshot') {
    const { bookmarkId, url } = request;

    // Handle og:image extraction asynchronously
    (async () => {
      try {
        // Always create a new tab to handle redirects properly
        const tab = await chrome.tabs.create({ url, active: false });
        const tabId = tab.id;

        if (!tabId) {
          sendResponse({ success: false, error: 'Failed to create tab' });
          return;
        }

        // Wait for the tab to fully load (including redirects)
        await new Promise<void>((resolve, reject) => {
          const timeoutId = setTimeout(() => {
            chrome.tabs.onUpdated.removeListener(loadListener);
            reject(new Error('Timeout waiting for page to load'));
          }, 20000); // 20 second timeout for redirects

          const loadListener = (updatedTabId: number, changeInfo: any) => {
            if (updatedTabId === tabId && changeInfo.status === 'complete') {
              clearTimeout(timeoutId);
              chrome.tabs.onUpdated.removeListener(loadListener);
              // Add a small delay to ensure meta tags are rendered
              setTimeout(() => resolve(), 500);
            }
          };

          chrome.tabs.onUpdated.addListener(loadListener);
        });

        // Extract og:image from the tab (now at the final URL after any redirects)
        const ogImageUrl = await extractOgImageFromTab(tabId);

        // Always close the tab we created
        await chrome.tabs.remove(tabId).catch(() => { });

        if (ogImageUrl) {
          const result = await chrome.storage.local.get('screenshots');
          const screenshots: ScreenshotData = (result.screenshots || {}) as ScreenshotData;

          screenshots[bookmarkId] = {
            dataUrl: ogImageUrl,
            timestamp: Date.now(),
            url
          };

          await chrome.storage.local.set({ screenshots });
          sendResponse({ success: true, dataUrl: ogImageUrl });
        } else {
          sendResponse({ success: false, error: 'No og:image found for this URL' });
        }
      } catch (error) {
        console.error('Failed to extract og:image:', error);
        sendResponse({ success: false, error: String(error) });
      }
    })();

    // Return true to indicate we'll send response asynchronously
    return true;
  }

  if (request.action === 'deleteScreenshot') {
    const { bookmarkId } = request;

    (async () => {
      try {
        const result = await chrome.storage.local.get('screenshots');
        const screenshots: ScreenshotData = (result.screenshots || {}) as ScreenshotData;
        delete screenshots[bookmarkId];

        await chrome.storage.local.set({ screenshots });
        sendResponse({ success: true });
      } catch (error) {
        console.error('Failed to delete screenshot:', error);
        sendResponse({ success: false, error: String(error) });
      }
    })();

    return true;
  }

  // Return false for unknown actions
  return false;
});

// Clean up old visited URLs periodically using chrome.alarms API
chrome.alarms.create('cleanupVisitedUrls', { periodInMinutes: 30 });

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === 'cleanupVisitedUrls') {
    // Clear visited URLs cache to allow re-capturing screenshots
    await chrome.storage.local.set({ visitedUrls: { urls: [] } });
    console.log('Cleared visited URLs cache');
  }
});

// Listen for Chrome bookmark events to trigger re-sync
chrome.bookmarks.onCreated.addListener(() => {
  console.log('Bookmark created, triggering sync...');
  chrome.runtime.sendMessage({ action: 'bookmarkChanged' }).catch(() => {
    // Ignore errors if popup isn't open
  });
});

chrome.bookmarks.onRemoved.addListener(() => {
  console.log('Bookmark removed, triggering sync...');
  chrome.runtime.sendMessage({ action: 'bookmarkChanged' }).catch(() => {
    // Ignore errors if popup isn't open
  });
});

chrome.bookmarks.onChanged.addListener(() => {
  console.log('Bookmark changed, triggering sync...');
  chrome.runtime.sendMessage({ action: 'bookmarkChanged' }).catch(() => {
    // Ignore errors if popup isn't open
  });
});

chrome.bookmarks.onMoved.addListener(() => {
  console.log('Bookmark moved, triggering sync...');
  chrome.runtime.sendMessage({ action: 'bookmarkChanged' }).catch(() => {
    // Ignore errors if popup isn't open
  });
});
