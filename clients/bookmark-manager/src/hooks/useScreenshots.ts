import { useState, useCallback } from "react";

export const useScreenshots = () => {
  const [screenshots, setScreenshots] = useState<Record<string, any>>({});

  const loadScreenshots = useCallback(() => {
    if (typeof chrome !== "undefined" && chrome.storage) {
      chrome.storage.local.get("screenshots", (result) => {
        setScreenshots(result.screenshots || {});
      });

      // Listen for screenshot updates
      chrome.storage.onChanged.addListener((changes, namespace) => {
        if (namespace === "local" && changes.screenshots) {
          setScreenshots(changes.screenshots.newValue || {});
        }
      });
    }
  }, []);

  const captureScreenshot = useCallback((bookmarkId: string, url: string) => {
    if (typeof chrome !== "undefined" && chrome.runtime) {
      chrome.runtime.sendMessage(
        { action: "captureScreenshot", bookmarkId, url },
        (response) => {
          if (chrome.runtime.lastError) {
            console.error(
              "Error sending message:",
              chrome.runtime.lastError.message
            );
            return;
          }
          if (response?.success) {
            console.log("Screenshot captured successfully");
          } else {
            console.error("Failed to capture screenshot:", response?.error);
          }
        }
      );
    }
  }, []);

  const deleteScreenshot = useCallback((bookmarkId: string) => {
    if (typeof chrome !== "undefined" && chrome.runtime) {
      chrome.runtime.sendMessage(
        { action: "deleteScreenshot", bookmarkId },
        (response) => {
          if (chrome.runtime.lastError) {
            console.error(
              "Error sending message:",
              chrome.runtime.lastError.message
            );
            return;
          }
          if (response?.success) {
            console.log("Screenshot deleted successfully");
          }
        }
      );
    }
  }, []);

  return {
    screenshots,
    loadScreenshots,
    captureScreenshot,
    deleteScreenshot,
  };
};
