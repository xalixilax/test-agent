// Background service worker for automatic screenshot capture
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

// Listen for messages from popup to manually capture screenshots
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'captureScreenshot') {
    const { bookmarkId, url } = request;
    
    // First, try to find a tab with this URL
    chrome.tabs.query({ url }, async (tabs) => {
      if (chrome.runtime.lastError) {
        sendResponse({ success: false, error: chrome.runtime.lastError.message });
        return;
      }
      
      if (tabs.length > 0 && tabs[0]?.id) {
        // Found a tab with this URL, capture it
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
        // No tab found with this URL, create one and capture it
        chrome.tabs.create({ url, active: false }, async (tab) => {
          if (chrome.runtime.lastError) {
            sendResponse({ success: false, error: chrome.runtime.lastError.message });
            return;
          }
          
          if (!tab.id) {
            sendResponse({ success: false, error: 'Failed to create tab' });
            return;
          }
          
          let responseHandled = false;
          let timeoutId: number;
          
          // Wait for the tab to load
          const loadListener = async (tabId: number, changeInfo: chrome.tabs.TabChangeInfo) => {
            if (responseHandled || tabId !== tab.id || changeInfo.status !== 'complete') {
              return;
            }
            
            responseHandled = true;
            clearTimeout(timeoutId);
            chrome.tabs.onUpdated.removeListener(loadListener);
            
            try {
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
                chrome.tabs.remove(tab.id);
              }
              
              sendResponse({ success: true, dataUrl });
            } catch (error) {
              console.error('Failed to capture screenshot:', error);
              if (tab.id) {
                chrome.tabs.remove(tab.id);
              }
              sendResponse({ success: false, error: String(error) });
            }
          };
          
          chrome.tabs.onUpdated.addListener(loadListener);
          
          // Set a timeout to prevent hanging
          timeoutId = setTimeout(() => {
            if (responseHandled) return;
            
            responseHandled = true;
            chrome.tabs.onUpdated.removeListener(loadListener);
            if (tab.id) {
              chrome.tabs.remove(tab.id);
            }
            sendResponse({ success: false, error: 'Timeout waiting for page to load' });
          }, 30000); // 30 second timeout
        });
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

// Clean up old visited URLs periodically using chrome.alarms API
chrome.alarms.create('cleanupVisitedUrls', { periodInMinutes: 30 });

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === 'cleanupVisitedUrls') {
    // Clear visited URLs cache to allow re-capturing screenshots
    await chrome.storage.local.set({ visitedUrls: { urls: [] } });
    console.log('Cleared visited URLs cache');
  }
});
