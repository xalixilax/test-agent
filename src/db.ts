// Storage utility for managing screenshots, comments, and ratings using chrome.storage.local
// This replaces the SQLite WASM approach which doesn't work in Chrome extension service workers

export interface Comment {
  id: string;
  bookmarkId: string;
  text: string;
  timestamp: number;
}

export interface Rating {
  bookmarkId: string;
  rating: number;
  timestamp: number;
}

export interface Screenshot {
  dataUrl: string;
  timestamp: number;
  url: string;
}

// Get all screenshots from storage
export async function getAllScreenshots(): Promise<Record<string, Screenshot>> {
  if (typeof chrome === 'undefined' || !chrome.storage) {
    return {};
  }
  
  const result = await chrome.storage.local.get('screenshots');
  return result.screenshots || {};
}

// Get a single screenshot
export async function getScreenshot(bookmarkId: string): Promise<Screenshot | null> {
  const screenshots = await getAllScreenshots();
  return screenshots[bookmarkId] || null;
}

// Save a screenshot
export async function saveScreenshot(bookmarkId: string, dataUrl: string, url: string): Promise<void> {
  if (typeof chrome === 'undefined' || !chrome.storage) {
    return;
  }

  const screenshots = await getAllScreenshots();
  screenshots[bookmarkId] = {
    dataUrl,
    timestamp: Date.now(),
    url
  };
  
  await chrome.storage.local.set({ screenshots });
}

// Delete a screenshot
export async function deleteScreenshot(bookmarkId: string): Promise<void> {
  if (typeof chrome === 'undefined' || !chrome.storage) {
    return;
  }

  const screenshots = await getAllScreenshots();
  delete screenshots[bookmarkId];
  
  await chrome.storage.local.set({ screenshots });
}

// Get all comments from storage
export async function getAllComments(): Promise<Comment[]> {
  if (typeof chrome === 'undefined' || !chrome.storage) {
    return [];
  }
  
  const result = await chrome.storage.local.get('comments');
  return result.comments || [];
}

// Get comments for a specific bookmark
export async function getComments(bookmarkId: string): Promise<Comment[]> {
  const allComments = await getAllComments();
  return allComments
    .filter(c => c.bookmarkId === bookmarkId)
    .sort((a, b) => b.timestamp - a.timestamp);
}

// Add a comment
export async function addComment(bookmarkId: string, text: string): Promise<string> {
  if (typeof chrome === 'undefined' || !chrome.storage) {
    return '';
  }

  const id = `comment-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
  const comments = await getAllComments();
  
  comments.push({
    id,
    bookmarkId,
    text,
    timestamp: Date.now()
  });
  
  await chrome.storage.local.set({ comments });
  return id;
}

// Delete a comment
export async function deleteComment(commentId: string): Promise<void> {
  if (typeof chrome === 'undefined' || !chrome.storage) {
    return;
  }

  const comments = await getAllComments();
  const filtered = comments.filter(c => c.id !== commentId);
  
  await chrome.storage.local.set({ comments: filtered });
}

// Get all ratings from storage
export async function getAllRatings(): Promise<Record<string, number>> {
  if (typeof chrome === 'undefined' || !chrome.storage) {
    return {};
  }
  
  const result = await chrome.storage.local.get('ratings');
  const ratingsData = result.ratings || {};
  
  // Convert from storage format to simple number map
  const ratings: Record<string, number> = {};
  for (const [bookmarkId, data] of Object.entries(ratingsData)) {
    ratings[bookmarkId] = (data as Rating).rating;
  }
  
  return ratings;
}

// Get rating for a specific bookmark
export async function getRating(bookmarkId: string): Promise<number | null> {
  const ratings = await getAllRatings();
  return ratings[bookmarkId] || null;
}

// Set a rating
export async function setRating(bookmarkId: string, rating: number): Promise<void> {
  if (typeof chrome === 'undefined' || !chrome.storage) {
    return;
  }

  if (rating < 1 || rating > 5) {
    throw new Error('Rating must be between 1 and 5');
  }

  const result = await chrome.storage.local.get('ratings');
  const ratings = result.ratings || {};
  
  ratings[bookmarkId] = {
    rating,
    timestamp: Date.now()
  };
  
  await chrome.storage.local.set({ ratings });
}

// Delete a rating
export async function deleteRating(bookmarkId: string): Promise<void> {
  if (typeof chrome === 'undefined' || !chrome.storage) {
    return;
  }

  const result = await chrome.storage.local.get('ratings');
  const ratings = result.ratings || {};
  delete ratings[bookmarkId];
  
  await chrome.storage.local.set({ ratings });
}

// Initialize - no-op for compatibility with old code
export async function initDatabase() {
  // No initialization needed for chrome.storage.local
  return Promise.resolve();
}
