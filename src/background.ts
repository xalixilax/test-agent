// Background service worker for automatic screenshot capture
interface ScreenshotData {
  [bookmarkId: string]: {
    dataUrl: string;
    timestamp: number;
    url: string;
  };
}

// Track visited URLs to detect first-time visits
const visitedUrls = new Set<string>();

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
        
        // If no screenshot exists and URL hasn't been visited in this session
        if (!screenshots[bookmark.id] && !visitedUrls.has(url)) {
          visitedUrls.add(url);
          
          // Capture screenshot after a short delay to ensure page is rendered
          setTimeout(async () => {
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
          }, 1000);
        }
      }
    } catch (error) {
      console.error('Error checking bookmarks:', error);
    }
  }
});

// Listen for messages from popup to manually capture screenshots
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'captureScreenshot') {
    const { bookmarkId, url } = request;
    
    // Query for the active tab
    chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
      if (tabs[0]?.id) {
        try {
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
        } catch (error) {
          console.error('Failed to capture screenshot:', error);
          sendResponse({ success: false, error: String(error) });
        }
      } else {
        sendResponse({ success: false, error: 'No active tab found' });
      }
    });
    
    // Return true to indicate we'll send response asynchronously
    return true;
  }
  
  if (request.action === 'deleteScreenshot') {
    const { bookmarkId } = request;
    
    chrome.storage.local.get('screenshots', async (result) => {
      const screenshots: ScreenshotData = result.screenshots || {};
      delete screenshots[bookmarkId];
      
      await chrome.storage.local.set({ screenshots });
      sendResponse({ success: true });
    });
    
    return true;
  }
});

// Clear visited URLs cache periodically (every 30 minutes)
setInterval(() => {
  visitedUrls.clear();
}, 30 * 60 * 1000);
