import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Formats a URL to display only meaningful parts (domain + first path segments)
 * Removes protocol, slugs, IDs, and encoded titles
 * Example: https://subsite.website.com/community/article/this-is-a-title-93h2348
 * Returns: subsite.website.com/community/article
 */
export function formatDisplayUrl(url: string): string {
  try {
    const urlObj = new URL(url);
    let hostname = urlObj.hostname;

    // Remove www. prefix
    if (hostname.startsWith('www.')) {
      hostname = hostname.substring(4);
    }

    const pathParts = urlObj.pathname.split('/').filter(Boolean);

    // Patterns that indicate a slug, ID, or title
    const isSlugOrId = (part: string): boolean => {
      // Check if it's a long alphanumeric ID (more than 10 chars with mixed case/numbers)
      if (/^[a-zA-Z0-9]{10,}$/.test(part)) return true;

      // Check if it contains hyphens or underscores (likely a slug)
      if (part.includes('-') || part.includes('_')) return true;

      // Check if it's URL encoded (contains %)
      if (part.includes('%')) return true;

      // Check if it's purely numeric (likely an ID)
      if (/^\d+$/.test(part)) return true;

      return false;
    };

    // Keep only meaningful path segments (first 1-2 segments that aren't slugs/IDs)
    const meaningfulParts: string[] = [];
    for (const part of pathParts) {
      if (meaningfulParts.length >= 2) break; // Max 2 path segments
      if (!isSlugOrId(part)) {
        meaningfulParts.push(part);
      } else if (meaningfulParts.length === 0) {
        // If first part is a slug/ID, still include it but look for better parts
        continue;
      } else {
        // We already have meaningful parts, stop here
        break;
      }
    }

    // If we only got slugs/IDs, take the first segment anyway
    if (meaningfulParts.length === 0 && pathParts.length > 0) {
      meaningfulParts.push(pathParts[0]);
    }

    const path = meaningfulParts.length > 0 ? '/' + meaningfulParts.join('/') : '';
    return hostname + path;
  } catch (e) {
    // If URL parsing fails, return the original
    return url;
  }
}
