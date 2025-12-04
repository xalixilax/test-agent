import { useState, useEffect } from "react";
import BookmarkList from "./components/BookmarkList";
import SearchBar from "./components/SearchBar";
import AddBookmark from "./components/AddBookmark";
import Breadcrumb from "./components/Breadcrumb";
import type { Bookmark, BreadcrumbItem, Comment } from "./types";
import { getAllScreenshots, getAllComments, getAllRatings, addComment, deleteComment, setRating } from "./db";

function App() {
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const [screenshots, setScreenshots] = useState<Record<string, any>>({});
  const [comments, setComments] = useState<Comment[]>([]);
  const [ratings, setRatings] = useState<Record<string, number>>({});
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [breadcrumbPath, setBreadcrumbPath] = useState<BreadcrumbItem[]>([]);

  useEffect(() => {
    loadBookmarks();
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const screenshotsData = await getAllScreenshots();
      const commentsData = await getAllComments();
      const ratingsData = await getAllRatings();
      
      setScreenshots(screenshotsData);
      setComments(commentsData);
      setRatings(ratingsData);
    } catch (error) {
      console.error('Failed to load data from storage:', error);
    }

    // Listen for storage changes
    if (typeof chrome !== "undefined" && chrome.storage) {
      chrome.storage.onChanged.addListener(async (changes, namespace) => {
        if (namespace === "local") {
          if (changes.screenshots) {
            setScreenshots(changes.screenshots.newValue || {});
          }
          if (changes.comments) {
            setComments(changes.comments.newValue || []);
          }
          if (changes.ratings) {
            const ratingsData = changes.ratings.newValue || {};
            const ratingsMap: Record<string, number> = {};
            for (const [bookmarkId, data] of Object.entries(ratingsData)) {
              ratingsMap[bookmarkId] = (data as any).rating;
            }
            setRatings(ratingsMap);
          }
        }
      });
    }
  };

  const loadScreenshots = () => {
    if (typeof chrome !== "undefined" && chrome.storage) {
      chrome.storage.local.get("screenshots", (result) => {
        setScreenshots(result.screenshots || {});
      });

      // Listen for screenshot updates
      chrome.storage.onChanged.addListener((changes, namespace) => {
        if (namespace === "local" && changes.screenshots) {
          setScreenshots(changes.screenshots.newValue || {});
        }
      });
    }
  };

  const loadBookmarks = () => {
    if (typeof chrome !== "undefined" && chrome.bookmarks) {
      chrome.bookmarks.getTree((bookmarkTree) => {
        setBookmarks(bookmarkTree);
        // Initialize to the root bookmark bar or first available folder
        if (bookmarkTree.length > 0 && bookmarkTree[0].children) {
          const bookmarkBar =
            bookmarkTree[0].children.find((node) => node.id === "1") ||
            bookmarkTree[0].children[0];
          if (bookmarkBar) {
            setCurrentFolderId(bookmarkBar.id);
            setBreadcrumbPath([
              { id: bookmarkBar.id, title: bookmarkBar.title || "Bookmarks" },
            ]);
          }
        }
        setLoading(false);
      });
    } else {
      // Mock data for development
      const mockData = [
        {
          id: "root",
          title: "Bookmarks",
          children: [
            {
              id: "1",
              title: "Bookmark Bar",
              children: [
                {
                  id: "folder1",
                  title: "Work",
                  children: [
                    {
                      id: "b1",
                      title: "Sample Bookmark",
                      url: "https://example.com",
                      dateAdded: Date.now(),
                    },
                  ],
                },
                {
                  id: "b2",
                  title: "Google",
                  url: "https://google.com",
                  dateAdded: Date.now(),
                },
              ],
            },
          ],
        },
      ];
      setBookmarks(mockData);
      setCurrentFolderId("1");
      setBreadcrumbPath([{ id: "1", title: "Bookmark Bar" }]);
      setLoading(false);
    }
  };

  const addBookmark = (title: string, url: string) => {
    if (typeof chrome !== "undefined" && chrome.bookmarks) {
      chrome.bookmarks.create(
        {
          parentId: currentFolderId || undefined,
          title,
          url,
        },
        () => {
          loadBookmarks();
        }
      );
    }
  };

  const deleteBookmark = (id: string) => {
    if (typeof chrome !== "undefined" && chrome.bookmarks) {
      // Find the item in the current folder to check if it's a folder or bookmark
      const currentItems = getCurrentFolderItems();
      const item = currentItems.find((i) => i.id === id);

      if (item && !item.url && Array.isArray(item.children)) {
        // It's a folder, remove it recursively
        chrome.bookmarks.removeTree(id, () => {
          loadBookmarks();
        });
      } else {
        // It's a bookmark, just remove it
        chrome.bookmarks.remove(id, () => {
          loadBookmarks();
        });
      }
    }
  };

  const moveBookmark = (itemId: string, targetFolderId: string) => {
    if (typeof chrome !== "undefined" && chrome.bookmarks) {
      chrome.bookmarks.move(itemId, { parentId: targetFolderId }, () => {
        loadBookmarks();
      });
    }
  };

  const captureScreenshot = (bookmarkId: string, url: string) => {
    if (typeof chrome !== "undefined" && chrome.runtime) {
      chrome.runtime.sendMessage(
        { action: "captureScreenshot", bookmarkId, url },
        (response) => {
          if (chrome.runtime.lastError) {
            console.error(
              "Error sending message:",
              chrome.runtime.lastError.message
            );
            return;
          }
          if (response?.success) {
            console.log("Screenshot captured successfully");
          } else {
            console.error("Failed to capture screenshot:", response?.error);
          }
        }
      );
    }
  };

  const deleteScreenshot = (bookmarkId: string) => {
    if (typeof chrome !== "undefined" && chrome.runtime) {
      chrome.runtime.sendMessage(
        { action: "deleteScreenshot", bookmarkId },
        (response) => {
          if (chrome.runtime.lastError) {
            console.error(
              "Error sending message:",
              chrome.runtime.lastError.message
            );
            return;
          }
          if (response?.success) {
            console.log("Screenshot deleted successfully");
          }
        }
      );
    }
  };

  const handleAddComment = async (bookmarkId: string, text: string) => {
    try {
      await addComment(bookmarkId, text);
      const commentsData = await getAllComments();
      setComments(commentsData);
    } catch (error) {
      console.error('Failed to add comment:', error);
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    try {
      await deleteComment(commentId);
      const commentsData = await getAllComments();
      setComments(commentsData);
    } catch (error) {
      console.error('Failed to delete comment:', error);
    }
  };

  const handleSetRating = async (bookmarkId: string, rating: number) => {
    try {
      await setRating(bookmarkId, rating);
      const ratingsData = await getAllRatings();
      setRatings(ratingsData);
    } catch (error) {
      console.error('Failed to set rating:', error);
    }
  };

  const flattenBookmarks = (nodes: Bookmark[]): Bookmark[] => {
    let result: Bookmark[] = [];
    nodes.forEach((node) => {
      if (node.url) {
        // Add screenshot data, comments, and rating if available
        const bookmarkWithData = {
          ...node,
          screenshot: screenshots[node.id]?.dataUrl,
          comments: comments.filter(c => c.bookmarkId === node.id),
          rating: ratings[node.id]
        };
        result.push(bookmarkWithData);
      }
      if (node.children) {
        result = result.concat(flattenBookmarks(node.children));
      }
    });
    return result;
  };

  const findFolderById = (nodes: Bookmark[], id: string): Bookmark | null => {
    for (const node of nodes) {
      if (node.id === id) {
        return node;
      }
      if (node.children) {
        const found = findFolderById(node.children, id);
        if (found) return found;
      }
    }
    return null;
  };

  const buildPathToFolder = (
    nodes: Bookmark[],
    targetId: string,
    path: BreadcrumbItem[] = []
  ): BreadcrumbItem[] | null => {
    for (const node of nodes) {
      const newPath = [
        ...path,
        { id: node.id, title: node.title || "Untitled" },
      ];

      if (node.id === targetId) {
        return newPath;
      }

      if (node.children) {
        const found = buildPathToFolder(node.children, targetId, newPath);
        if (found) return found;
      }
    }
    return null;
  };

  const navigateToFolder = (folderId: string) => {
    setCurrentFolderId(folderId);
    const path = buildPathToFolder(bookmarks, folderId);
    if (path) {
      setBreadcrumbPath(path);
    }
    setSearchTerm(""); // Clear search when navigating
  };

  const getCurrentFolderItems = (): Bookmark[] => {
    if (!currentFolderId) return [];

    const folder = findFolderById(bookmarks, currentFolderId);
    if (!folder || !folder.children) return [];

    // Add screenshot data, comments, and rating to bookmarks
    return folder.children.map((item) => {
      if (item.url) {
        return {
          ...item,
          screenshot: screenshots[item.id]?.dataUrl,
          comments: comments.filter(c => c.bookmarkId === item.id),
          rating: ratings[item.id]
        };
      }
      return item;
    });
  };

  const openFullScreen = () => {
    if (typeof chrome !== "undefined" && chrome.tabs) {
      chrome.tabs.create({ url: chrome.runtime.getURL("index.html") });
    }
  };

  const filteredBookmarks = searchTerm
    ? flattenBookmarks(bookmarks).filter(
        (bookmark) =>
          bookmark.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          bookmark.url?.toLowerCase().includes(searchTerm.toLowerCase())
      )
    : getCurrentFolderItems();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <div className="text-xl text-gray-600">Loading bookmarks...</div>
      </div>
    );
  }

  return (
    <div className="w-full h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="container mx-auto p-6 max-w-2xl">
        <div className="bg-white rounded-lg shadow-xl overflow-hidden">
          <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold text-white mb-2">
                  📚 Bookmark Manager
                </h1>
                <p className="text-blue-100">
                  Organize and search your bookmarks with ease
                </p>
              </div>
              <button
                onClick={openFullScreen}
                className="bg-white/20 hover:bg-white/30 text-white px-4 py-2 rounded-lg transition-colors flex items-center gap-2"
                title="Open in full screen"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-5 w-5"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path
                    fillRule="evenodd"
                    d="M3 4a1 1 0 011-1h4a1 1 0 010 2H6.414l2.293 2.293a1 1 0 11-1.414 1.414L5 6.414V8a1 1 0 01-2 0V4zm9 1a1 1 0 010-2h4a1 1 0 011 1v4a1 1 0 01-2 0V6.414l-2.293 2.293a1 1 0 11-1.414-1.414L13.586 5H12zm-9 7a1 1 0 012 0v1.586l2.293-2.293a1 1 0 111.414 1.414L6.414 15H8a1 1 0 010 2H4a1 1 0 01-1-1v-4zm13-1a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 010-2h1.586l-2.293-2.293a1 1 0 111.414-1.414L15 13.586V12a1 1 0 011-1z"
                    clipRule="evenodd"
                  />
                </svg>
                <span className="hidden sm:inline">Full Screen</span>
              </button>
            </div>
          </div>

          <div className="p-6 space-y-6">
            <AddBookmark onAdd={addBookmark} />
            <SearchBar searchTerm={searchTerm} onSearch={setSearchTerm} />
            {!searchTerm && (
              <Breadcrumb path={breadcrumbPath} onNavigate={navigateToFolder} />
            )}
            <BookmarkList
              items={filteredBookmarks}
              onDelete={deleteBookmark}
              onCaptureScreenshot={captureScreenshot}
              onDeleteScreenshot={deleteScreenshot}
              onFolderClick={navigateToFolder}
              onMove={moveBookmark}
              onAddComment={handleAddComment}
              onDeleteComment={handleDeleteComment}
              onSetRating={handleSetRating}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
