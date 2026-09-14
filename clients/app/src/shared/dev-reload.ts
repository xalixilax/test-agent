const PAGE_STAMP = "dev-reload-stamp";
const BG_STAMP = "dev-bg-stamp";
const PENDING_KEY = "devReloadPending";

const readStamp = async (name: string): Promise<string | null> => {
  try {
    const response = await fetch(chrome.runtime.getURL(name), { cache: "no-store" });
    return response.ok ? await response.text() : null;
  } catch {
    return null;
  }
};

const reloadExtension = async (): Promise<void> => {
  await chrome.storage.local.set({ [PENDING_KEY]: true });
  chrome.runtime.reload();
};

const reloadExtensionTabs = async (): Promise<void> => {
  const tabs = await chrome.tabs.query({ url: chrome.runtime.getURL("*") });
  await Promise.all(
    tabs.map((tab) => (tab.id === undefined ? undefined : chrome.tabs.reload(tab.id))),
  );
};

const reloadPendingTabs = async (): Promise<void> => {
  const stored = await chrome.storage.local.get(PENDING_KEY);
  if (!stored[PENDING_KEY]) return;
  await chrome.storage.local.remove(PENDING_KEY);
  await reloadExtensionTabs();
};

export const watchForDevReload = (): void => {
  if (chrome.runtime.getManifest().update_url) return;

  let pageKnown: string | null | undefined;
  let backgroundKnown: string | null | undefined;

  const check = async (): Promise<void> => {
    const [pageNext, backgroundNext] = await Promise.all([
      readStamp(PAGE_STAMP),
      readStamp(BG_STAMP),
    ]);
    const backgroundChanged = backgroundKnown !== undefined && backgroundNext !== backgroundKnown;
    const pageChanged = pageKnown !== undefined && pageNext !== pageKnown;
    pageKnown = pageNext;
    backgroundKnown = backgroundNext;

    if (backgroundChanged) {
      await reloadExtension();
      return;
    }
    if (pageChanged && typeof window !== "undefined") window.location.reload();
  };

  void reloadPendingTabs();
  void check();
  setInterval(() => void check(), 1_000);
};
