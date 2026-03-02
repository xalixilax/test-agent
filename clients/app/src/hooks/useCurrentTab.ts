import { useState, useCallback } from "react";

interface CurrentTabState {
  isBookmarked: boolean;
  bookmark?: {
    id: string;
    title: string;
    url: string;
    hasScreenshot: boolean;
  };
}

export const useCurrentTab = () => {
  const [currentTab, setCurrentTab] = useState<CurrentTabState | null>(null);

  const checkCurrentTab = useCallback(() => {
    if (typeof chrome !== "undefined" && chrome.runtime) {
      chrome.runtime.sendMessage({ action: 'getCurrentTab' }, (response) => {
        if (chrome.runtime.lastError) {
          console.error("Error checking current tab:", chrome.runtime.lastError.message);
          return;
        }
        if (response?.success) {
          setCurrentTab({
            isBookmarked: response.isBookmarked,
            bookmark: response.bookmark
          });
        }
      });
    }
  }, []);

  return {
    currentTab,
    checkCurrentTab,
  };
};
