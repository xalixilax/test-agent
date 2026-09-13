export const openBookmark = (url: string): void => {
  if (typeof chrome !== "undefined" && chrome.tabs) {
    void chrome.tabs.create({ url });
  } else {
    window.open(url, "_blank");
  }
};
