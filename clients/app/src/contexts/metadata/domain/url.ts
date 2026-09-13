export const normalizeUrl = (raw: string): string => {
  const trimmed = raw.trim();
  try {
    const url = new URL(trimmed);
    url.hash = "";
    url.hostname = url.hostname.toLowerCase();
    if (url.pathname.length > 1) {
      url.pathname = url.pathname.replace(/\/+$/u, "");
    }
    return url.toString();
  } catch {
    return trimmed;
  }
};
