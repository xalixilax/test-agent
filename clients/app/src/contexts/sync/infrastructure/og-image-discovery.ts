export const waitForTabComplete = (
  tabId: number,
  timeoutMs = 20_000,
): Promise<void> =>
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

export const extractOgImageFromTab = async (
  tabId: number,
): Promise<string | null> => {
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

export const discoverOgImage = async (
  url: string,
): Promise<string | null> => {
  const tab = await chrome.tabs.create({ url, active: false });
  if (!tab.id) return null;
  try {
    await waitForTabComplete(tab.id);
    return await extractOgImageFromTab(tab.id);
  } catch {
    return null;
  } finally {
    await chrome.tabs.remove(tab.id).catch(() => undefined);
  }
};
