// SQLite WASM database utility for storing screenshots, comments, and ratings
import sqlite3InitModule from '@sqlite.org/sqlite-wasm';

let db: any = null;
let sqlite3: any = null;

export async function initDatabase() {
  if (db) {
    return db;
  }

  try {
    sqlite3 = await sqlite3InitModule({
      print: console.log,
      printErr: console.error,
    });

    console.log('SQLite3 version:', sqlite3.version.libVersion);

    // Create database in memory for extension use
    // We'll persist data through chrome.storage.local as a backup
    db = new sqlite3.oo1.DB(':memory:', 'c');

    // Create tables
    db.exec(`
      CREATE TABLE IF NOT EXISTS screenshots (
        bookmark_id TEXT PRIMARY KEY,
        data_url TEXT NOT NULL,
        timestamp INTEGER NOT NULL,
        url TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS comments (
        id TEXT PRIMARY KEY,
        bookmark_id TEXT NOT NULL,
        text TEXT NOT NULL,
        timestamp INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS ratings (
        bookmark_id TEXT PRIMARY KEY,
        rating INTEGER NOT NULL CHECK(rating >= 1 AND rating <= 5),
        timestamp INTEGER NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_comments_bookmark ON comments(bookmark_id);
    `);

    console.log('Database initialized successfully');

    // Load existing data from chrome.storage.local
    await loadDataFromStorage();

    return db;
  } catch (error) {
    console.error('Failed to initialize database:', error);
    throw error;
  }
}

async function loadDataFromStorage() {
  if (!db || typeof chrome === 'undefined' || !chrome.storage) {
    return;
  }

  try {
    const result = await chrome.storage.local.get(['screenshots', 'comments', 'ratings']);

    // Load screenshots
    if (result.screenshots) {
      const screenshots = result.screenshots;
      const stmt = db.prepare('INSERT OR REPLACE INTO screenshots VALUES (?, ?, ?, ?)');
      try {
        for (const [bookmarkId, data] of Object.entries(screenshots)) {
          const screenshot = data as any;
          stmt.bind([bookmarkId, screenshot.dataUrl, screenshot.timestamp, screenshot.url]);
          stmt.step();
          stmt.reset();
        }
      } finally {
        stmt.finalize();
      }
      console.log('Loaded screenshots from storage');
    }

    // Load comments
    if (result.comments) {
      const comments = result.comments;
      const stmt = db.prepare('INSERT OR REPLACE INTO comments VALUES (?, ?, ?, ?)');
      try {
        for (const comment of comments) {
          stmt.bind([comment.id, comment.bookmarkId, comment.text, comment.timestamp]);
          stmt.step();
          stmt.reset();
        }
      } finally {
        stmt.finalize();
      }
      console.log('Loaded comments from storage');
    }

    // Load ratings
    if (result.ratings) {
      const ratings = result.ratings;
      const stmt = db.prepare('INSERT OR REPLACE INTO ratings VALUES (?, ?, ?)');
      try {
        for (const [bookmarkId, data] of Object.entries(ratings)) {
          const ratingData = data as any;
          stmt.bind([bookmarkId, ratingData.rating, ratingData.timestamp]);
          stmt.step();
          stmt.reset();
        }
      } finally {
        stmt.finalize();
      }
      console.log('Loaded ratings from storage');
    }
  } catch (error) {
    console.error('Failed to load data from storage:', error);
  }
}

export async function getScreenshot(bookmarkId: string): Promise<{ dataUrl: string; timestamp: number; url: string } | null> {
  if (!db) await initDatabase();

  const stmt = db.prepare('SELECT data_url, timestamp, url FROM screenshots WHERE bookmark_id = ?');
  try {
    stmt.bind([bookmarkId]);
    if (stmt.step()) {
      const row = stmt.get({});
      return {
        dataUrl: row[0],
        timestamp: row[1],
        url: row[2]
      };
    }
    return null;
  } finally {
    stmt.finalize();
  }
}

export async function getAllScreenshots(): Promise<Record<string, { dataUrl: string; timestamp: number; url: string }>> {
  if (!db) await initDatabase();

  const screenshots: Record<string, any> = {};
  const stmt = db.prepare('SELECT bookmark_id, data_url, timestamp, url FROM screenshots');
  try {
    while (stmt.step()) {
      const row = stmt.get({});
      screenshots[row[0]] = {
        dataUrl: row[1],
        timestamp: row[2],
        url: row[3]
      };
    }
  } finally {
    stmt.finalize();
  }
  return screenshots;
}

export async function saveScreenshot(bookmarkId: string, dataUrl: string, url: string): Promise<void> {
  if (!db) await initDatabase();

  const stmt = db.prepare('INSERT OR REPLACE INTO screenshots VALUES (?, ?, ?, ?)');
  try {
    stmt.bind([bookmarkId, dataUrl, Date.now(), url]);
    stmt.step();
  } finally {
    stmt.finalize();
  }

  // Also save to chrome.storage.local as backup
  await syncToStorage();
}

export async function deleteScreenshot(bookmarkId: string): Promise<void> {
  if (!db) await initDatabase();

  const stmt = db.prepare('DELETE FROM screenshots WHERE bookmark_id = ?');
  try {
    stmt.bind([bookmarkId]);
    stmt.step();
  } finally {
    stmt.finalize();
  }

  // Also update chrome.storage.local
  await syncToStorage();
}

export async function getComments(bookmarkId: string): Promise<Array<{ id: string; bookmarkId: string; text: string; timestamp: number }>> {
  if (!db) await initDatabase();

  const comments: Array<any> = [];
  const stmt = db.prepare('SELECT id, bookmark_id, text, timestamp FROM comments WHERE bookmark_id = ? ORDER BY timestamp DESC');
  try {
    stmt.bind([bookmarkId]);
    while (stmt.step()) {
      const row = stmt.get({});
      comments.push({
        id: row[0],
        bookmarkId: row[1],
        text: row[2],
        timestamp: row[3]
      });
    }
  } finally {
    stmt.finalize();
  }
  return comments;
}

export async function getAllComments(): Promise<Array<{ id: string; bookmarkId: string; text: string; timestamp: number }>> {
  if (!db) await initDatabase();

  const comments: Array<any> = [];
  const stmt = db.prepare('SELECT id, bookmark_id, text, timestamp FROM comments ORDER BY timestamp DESC');
  try {
    while (stmt.step()) {
      const row = stmt.get({});
      comments.push({
        id: row[0],
        bookmarkId: row[1],
        text: row[2],
        timestamp: row[3]
      });
    }
  } finally {
    stmt.finalize();
  }
  return comments;
}

export async function addComment(bookmarkId: string, text: string): Promise<string> {
  if (!db) await initDatabase();

  const id = `comment-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  const stmt = db.prepare('INSERT INTO comments VALUES (?, ?, ?, ?)');
  try {
    stmt.bind([id, bookmarkId, text, Date.now()]);
    stmt.step();
  } finally {
    stmt.finalize();
  }

  // Also save to chrome.storage.local
  await syncToStorage();
  return id;
}

export async function deleteComment(commentId: string): Promise<void> {
  if (!db) await initDatabase();

  const stmt = db.prepare('DELETE FROM comments WHERE id = ?');
  try {
    stmt.bind([commentId]);
    stmt.step();
  } finally {
    stmt.finalize();
  }

  // Also update chrome.storage.local
  await syncToStorage();
}

export async function getRating(bookmarkId: string): Promise<number | null> {
  if (!db) await initDatabase();

  const stmt = db.prepare('SELECT rating FROM ratings WHERE bookmark_id = ?');
  try {
    stmt.bind([bookmarkId]);
    if (stmt.step()) {
      const row = stmt.get({});
      return row[0];
    }
    return null;
  } finally {
    stmt.finalize();
  }
}

export async function getAllRatings(): Promise<Record<string, number>> {
  if (!db) await initDatabase();

  const ratings: Record<string, number> = {};
  const stmt = db.prepare('SELECT bookmark_id, rating FROM ratings');
  try {
    while (stmt.step()) {
      const row = stmt.get({});
      ratings[row[0]] = row[1];
    }
  } finally {
    stmt.finalize();
  }
  return ratings;
}

export async function setRating(bookmarkId: string, rating: number): Promise<void> {
  if (!db) await initDatabase();

  if (rating < 1 || rating > 5) {
    throw new Error('Rating must be between 1 and 5');
  }

  const stmt = db.prepare('INSERT OR REPLACE INTO ratings VALUES (?, ?, ?)');
  try {
    stmt.bind([bookmarkId, rating, Date.now()]);
    stmt.step();
  } finally {
    stmt.finalize();
  }

  // Also save to chrome.storage.local
  await syncToStorage();
}

export async function deleteRating(bookmarkId: string): Promise<void> {
  if (!db) await initDatabase();

  const stmt = db.prepare('DELETE FROM ratings WHERE bookmark_id = ?');
  try {
    stmt.bind([bookmarkId]);
    stmt.step();
  } finally {
    stmt.finalize();
  }

  // Also update chrome.storage.local
  await syncToStorage();
}

async function syncToStorage() {
  if (typeof chrome === 'undefined' || !chrome.storage) {
    return;
  }

  try {
    // Get all data from SQLite
    const screenshots = await getAllScreenshots();
    const comments = await getAllComments();
    const ratings = await getAllRatings();

    // Convert ratings to storage format
    const ratingsStorage: Record<string, any> = {};
    for (const [bookmarkId, rating] of Object.entries(ratings)) {
      ratingsStorage[bookmarkId] = { rating, timestamp: Date.now() };
    }

    // Save to chrome.storage.local
    await chrome.storage.local.set({
      screenshots,
      comments,
      ratings: ratingsStorage
    });
  } catch (error) {
    console.error('Failed to sync to storage:', error);
  }
}
