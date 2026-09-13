const stripWww = (hostname: string): string =>
  hostname.startsWith("www.") ? hostname.slice(4) : hostname;

const isSlugOrId = (part: string): boolean => {
  if (/^[a-zA-Z0-9]{10,}$/u.test(part)) return true;
  if (part.includes("-") || part.includes("_")) return true;
  if (part.includes("%")) return true;
  return /^\d+$/u.test(part);
};

const meaningfulPathParts = (pathParts: string[]): string[] => {
  const meaningful: string[] = [];
  for (const part of pathParts) {
    if (meaningful.length >= 2) break;
    if (!isSlugOrId(part)) {
      meaningful.push(part);
      continue;
    }
    if (meaningful.length > 0) break;
  }
  if (meaningful.length === 0 && pathParts.length > 0) {
    return [pathParts[0]];
  }
  return meaningful;
};

export function formatDisplayUrl(url: string): string {
  try {
    const urlObj = new URL(url);
    const pathParts = urlObj.pathname.split("/").filter(Boolean);
    const meaningful = meaningfulPathParts(pathParts);
    const path = meaningful.length > 0 ? "/" + meaningful.join("/") : "";
    return stripWww(urlObj.hostname) + path;
  } catch {
    return url;
  }
}
