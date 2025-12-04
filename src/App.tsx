import { useState, useEffect } from "react";
import BookmarkList from "./components/BookmarkList";
import SearchBar from "./components/SearchBar";
import AddBookmark from "./components/AddBookmark";
import Breadcrumb from "./components/Breadcrumb";
import type { Bookmark, BreadcrumbItem } from "./types";

function App() {
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const [screenshots, setScreenshots] = useState<Record<string, any>>({});
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [breadcrumbPath, setBreadcrumbPath] = useState<BreadcrumbItem[]>([]);

  useEffect(() => {
    loadBookmarks();
    loadScreenshots();
  }, []);

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

  const flattenBookmarks = (nodes: Bookmark[]): Bookmark[] => {
    let result: Bookmark[] = [];
    nodes.forEach((node) => {
      if (node.url) {
        // Add screenshot data if available
        const bookmarkWithScreenshot = {
          ...node,
          screenshot: screenshots[node.id]?.dataUrl,
        };
        result.push(bookmarkWithScreenshot);
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

    // Add screenshot data to bookmarks
    return folder.children.map((item) => {
      if (item.url) {
        return {
          ...item,
          screenshot: screenshots[item.id]?.dataUrl,
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
      <div className="flex items-center justify-center h-screen" style={{
        background: 'radial-gradient(ellipse at center, #3d2d20 0%, #2d2118 50%, #1a1410 100%)',
      }}>
        <div className="text-center animate-pulse">
          <div className="text-6xl mb-4 animate-float">✦</div>
          <div className="text-2xl font-bold gradient-text" style={{ fontFamily: 'Syne, sans-serif' }}>
            Loading your vault...
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-screen relative overflow-hidden" style={{
      background: 'radial-gradient(ellipse at top right, #3d2d20 0%, #2d2118 50%, #1a1410 100%)',
    }}>
      {/* Animated background elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-10 right-10 w-96 h-96 bg-gradient-to-br from-orange-500/10 to-transparent rounded-full blur-3xl animate-pulse" style={{ animationDuration: '4s' }}></div>
        <div className="absolute bottom-20 left-20 w-80 h-80 bg-gradient-to-tr from-amber-600/10 to-transparent rounded-full blur-3xl animate-pulse" style={{ animationDuration: '6s', animationDelay: '1s' }}></div>
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-gradient-to-br from-orange-400/5 to-transparent rounded-full blur-3xl"></div>
      </div>

      <div className="container mx-auto p-6 max-w-2xl relative z-10">
        <div className="glass rounded-2xl shadow-2xl overflow-hidden animate-fade-in-up border border-orange-900/20">
          {/* Header with geometric pattern background */}
          <div className="relative p-8 overflow-hidden" style={{
            background: 'linear-gradient(135deg, #ff8c42 0%, #d4622f 100%)',
          }}>
            {/* Geometric pattern overlay */}
            <div className="absolute inset-0 opacity-10" style={{
              backgroundImage: `repeating-linear-gradient(45deg, transparent, transparent 35px, rgba(255,255,255,.1) 35px, rgba(255,255,255,.1) 70px)`,
            }}></div>
            
            <div className="flex items-center justify-between relative z-10">
              <div className="animate-slide-in-right">
                <h1 className="text-4xl font-bold text-white mb-2 drop-shadow-lg" style={{ fontFamily: 'Syne, sans-serif' }}>
                  ✦ Bookmark Vault
                </h1>
                <p className="text-orange-50/90 text-lg" style={{ fontFamily: 'Crimson Pro, serif' }}>
                  Your curated collection of the web
                </p>
              </div>
              <button
                onClick={openFullScreen}
                className="bg-white/20 hover:bg-white/30 text-white px-4 py-2 rounded-xl transition-smooth hover-lift backdrop-blur-sm border border-white/20 flex items-center gap-2 animate-fade-in stagger-2"
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
                <span className="hidden sm:inline">Expand</span>
              </button>
            </div>
          </div>

          <div className="p-6 space-y-6">
            <div className="animate-fade-in-up stagger-3">
              <AddBookmark onAdd={addBookmark} />
            </div>
            <div className="animate-fade-in-up stagger-4">
              <SearchBar searchTerm={searchTerm} onSearch={setSearchTerm} />
            </div>
            {!searchTerm && (
              <div className="animate-fade-in-up stagger-5">
                <Breadcrumb path={breadcrumbPath} onNavigate={navigateToFolder} />
              </div>
            )}
            <BookmarkList
              items={filteredBookmarks}
              onDelete={deleteBookmark}
              onCaptureScreenshot={captureScreenshot}
              onDeleteScreenshot={deleteScreenshot}
              onFolderClick={navigateToFolder}
              onMove={moveBookmark}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
