export const openFullScreen = (): void => {
  if (typeof chrome !== "undefined" && chrome.tabs) {
    void chrome.tabs.create({ url: chrome.runtime.getURL("index.html") });
  }
};
