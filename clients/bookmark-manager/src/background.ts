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
  const data: VisitedUrlsData = result.visitedUrls || { urls: [] };
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
        const screenshots: ScreenshotData = result.screenshots || {};
        
        // Get visited URLs from storage
        const visitedUrls = await getVisitedUrls();
        
        // If no screenshot exists and URL hasn't been visited
        if (!screenshots[bookmark.id] && !visitedUrls.has(url)) {
          await addVisitedUrl(url);
          
          // Capture screenshot using chrome.webNavigation or after DOM is ready
          try {
            const dataUrl = await chrome.tabs.captureVisibleTab(undefined, {
              format: 'png',
              quality: 80
            });
            
            screenshots[bookmark.id] = {
              dataUrl,
              timestamp: Date.now(),
              url
            };
            
            await chrome.storage.local.set({ screenshots });
            console.log(`Screenshot captured for bookmark: ${bookmark.title}`);
          } catch (error) {
            console.error('Failed to capture screenshot:', error);
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
            const screenshots: ScreenshotData = result.screenshots || {};
            
            sendResponse({ 
              success: true, 
              isBookmarked: true,
              bookmark: {
                id: bookmark.id,
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
  
  if (request.action === 'captureScreenshot') {
    const { bookmarkId, url } = request;
    
    // Handle screenshot capture asynchronously
    (async () => {
      try {
        // First, try to find a tab with this URL
        const tabs = await chrome.tabs.query({ url });
        
        if (tabs.length > 0 && tabs[0]?.id && tabs[0]?.windowId) {
          // Found a tab with this URL, capture it
          const dataUrl = await chrome.tabs.captureVisibleTab(tabs[0].windowId, {
            format: 'png',
            quality: 80
          });
          
          const result = await chrome.storage.local.get('screenshots');
          const screenshots: ScreenshotData = result.screenshots || {};
          
          screenshots[bookmarkId] = {
            dataUrl,
            timestamp: Date.now(),
            url
          };
          
          await chrome.storage.local.set({ screenshots });
          sendResponse({ success: true, dataUrl });
        } else {
          // No tab found with this URL, create one and capture it
          const tab = await chrome.tabs.create({ url, active: false });
          
          if (!tab.id) {
            sendResponse({ success: false, error: 'Failed to create tab' });
            return;
          }
          
          // Wait for the tab to load
          await new Promise<void>((resolve, reject) => {
            const timeoutId = setTimeout(() => {
              chrome.tabs.onUpdated.removeListener(loadListener);
              if (tab.id) {
                chrome.tabs.remove(tab.id).catch(() => {});
              }
              reject(new Error('Timeout waiting for page to load'));
            }, 30000); // 30 second timeout
            
            const loadListener = (tabId: number, changeInfo: chrome.tabs.TabChangeInfo) => {
              if (tabId === tab.id && changeInfo.status === 'complete') {
                clearTimeout(timeoutId);
                chrome.tabs.onUpdated.removeListener(loadListener);
                resolve();
              }
            };
            
            chrome.tabs.onUpdated.addListener(loadListener);
          });
          
          // Capture screenshot
          const dataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, {
            format: 'png',
            quality: 80
          });
          
          const result = await chrome.storage.local.get('screenshots');
          const screenshots: ScreenshotData = result.screenshots || {};
          
          screenshots[bookmarkId] = {
            dataUrl,
            timestamp: Date.now(),
            url
          };
          
          await chrome.storage.local.set({ screenshots });
          
          // Close the tab we created
          if (tab.id) {
            await chrome.tabs.remove(tab.id);
          }
          
          sendResponse({ success: true, dataUrl });
        }
      } catch (error) {
        console.error('Failed to capture screenshot:', error);
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
        const screenshots: ScreenshotData = result.screenshots || {};
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
