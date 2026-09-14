const waitForTabComplete = (tabId: number, timeoutMs = 20_000): Promise<void> =>
  new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      chrome.tabs.onUpdated.removeListener(listener);
      reject(new Error("Timed out waiting for the page to load"));
    }, timeoutMs);

    const listener = (updatedTabId: number, changeInfo: { status?: string }) => {
      if (updatedTabId === tabId && changeInfo.status === "complete") {
        clearTimeout(timeoutId);
        chrome.tabs.onUpdated.removeListener(listener);
        setTimeout(resolve, 500);
      }
    };

    chrome.tabs.onUpdated.addListener(listener);
  });

export const extractOgImageFromTab = async (tabId: number): Promise<string | null> => {
  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId },
      func: () => {
        const getMetaContent = (selectors: string[]): string | null => {
          for (const selector of selectors) {
            const element = document.querySelector(selector);
            const content = element?.getAttribute("content");
            if (content) return content;
          }
          return null;
        };

        let imageUrl = getMetaContent([
          'meta[property="og:image"]',
          'meta[property="og:image:secure_url"]',
          'meta[property="og:image:url"]',
          'meta[property="OG:IMAGE"]',
          'meta[name="og:image"]',
        ]);
        if (imageUrl) return imageUrl;

        imageUrl = getMetaContent([
          'meta[name="twitter:image"]',
          'meta[name="twitter:image:src"]',
          'meta[property="twitter:image"]',
          'meta[property="twitter:image:src"]',
        ]);
        if (imageUrl) return imageUrl;

        for (const meta of Array.from(document.querySelectorAll("meta"))) {
          const property = meta.getAttribute("property")?.toLowerCase();
          const name = meta.getAttribute("name")?.toLowerCase();
          if (
            property?.includes("og:image") ||
            name?.includes("og:image") ||
            property?.includes("twitter:image") ||
            name?.includes("twitter:image")
          ) {
            const content = meta.getAttribute("content");
            if (content) return content;
          }
        }

        return null;
      },
    });

    const raw = results?.[0]?.result as string | null | undefined;
    if (!raw) return null;

    const tab = await chrome.tabs.get(tabId);
    if (!tab.url) return raw;

    if (raw.startsWith("/")) {
      return new URL(tab.url).origin + raw;
    }
    if (!raw.startsWith("http")) {
      return new URL(tab.url).origin + "/" + raw;
    }
    return raw;
  } catch {
    return null;
  }
};

const withPageTab = async <T>(
  url: string,
  run: (tabId: number) => Promise<T>,
): Promise<T | null> => {
  const tab = await chrome.tabs.create({ url, active: false });
  if (!tab.id) return null;
  try {
    await waitForTabComplete(tab.id);
    return await run(tab.id);
  } catch {
    return null;
  } finally {
    await chrome.tabs.remove(tab.id).catch(() => undefined);
  }
};

export const discoverOgImage = (url: string): Promise<string | null> =>
  withPageTab(url, extractOgImageFromTab);

export interface PageCapture {
  linkUrl: string | null;
  dataUrl: string | null;
}

export const capturePage = (url: string): Promise<PageCapture | null> =>
  withPageTab(url, async (tabId) => ({
    linkUrl: await extractOgImageFromTab(tabId),
    dataUrl: await captureTabScreenshot(tabId),
  }));

// captureVisibleTab only captures the active tab of a window, so bring the tab
// to the front for the shot and hand focus back to whatever was active before.
export const captureTabScreenshot = async (tabId: number): Promise<string | null> => {
  try {
    const tab = await chrome.tabs.get(tabId);
    const [previouslyActive] = await chrome.tabs.query({ active: true, windowId: tab.windowId });
    await chrome.tabs.update(tabId, { active: true });
    await new Promise((resolve) => setTimeout(resolve, 500));
    const dataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, {
      format: "jpeg",
      quality: 70,
    });
    if (previouslyActive?.id && previouslyActive.id !== tabId) {
      await chrome.tabs.update(previouslyActive.id, { active: true }).catch(() => undefined);
    }
    return dataUrl;
  } catch {
    return null;
  }
};

export const dataUrlToBytes = (
  dataUrl: string,
): { bytes: ArrayBuffer; contentType: string } | null => {
  const match = /^data:(image\/[a-z0-9.+-]+);base64,([\s\S]+)$/iu.exec(dataUrl);
  if (!match) return null;
  const binary = atob(match[2]);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return { bytes: bytes.buffer, contentType: match[1] };
};
