export const openBookmark = (url: string): void => {
  void chrome.tabs.create({ url });
};

export const openFullScreen = (): void => {
  void chrome.tabs.create({ url: chrome.runtime.getURL("index.html") });
};
