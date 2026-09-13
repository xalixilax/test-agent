import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDisplayUrl(url: string): string {
  try {
    const urlObj = new URL(url);
    let hostname = urlObj.hostname;

    if (hostname.startsWith("www.")) {
      hostname = hostname.substring(4);
    }

    const pathParts = urlObj.pathname.split("/").filter(Boolean);

    const isSlugOrId = (part: string): boolean => {
      if (/^[a-zA-Z0-9]{10,}$/u.test(part)) return true;
      if (part.includes("-") || part.includes("_")) return true;
      if (part.includes("%")) return true;
      if (/^\d+$/u.test(part)) return true;
      return false;
    };

    const meaningfulParts: string[] = [];
    for (const part of pathParts) {
      if (meaningfulParts.length >= 2) break;
      if (!isSlugOrId(part)) {
        meaningfulParts.push(part);
      } else if (meaningfulParts.length === 0) {
        continue;
      } else {
        break;
      }
    }

    if (meaningfulParts.length === 0 && pathParts.length > 0) {
      meaningfulParts.push(pathParts[0]);
    }

    const path =
      meaningfulParts.length > 0 ? "/" + meaningfulParts.join("/") : "";
    return hostname + path;
  } catch {
    return url;
  }
}
