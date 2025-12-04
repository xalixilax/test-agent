import { useState, useEffect } from 'react';
import BookmarkList from './components/BookmarkList';
import SearchBar from './components/SearchBar';
import AddBookmark from './components/AddBookmark';
import Breadcrumb from './components/Breadcrumb';
import type { Bookmark, BreadcrumbItem } from './types';

function App() {
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [screenshots, setScreenshots] = useState<Record<string, any>>({});
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [breadcrumbPath, setBreadcrumbPath] = useState<BreadcrumbItem[]>([]);

  useEffect(() => {
    loadBookmarks();
    loadScreenshots();
  }, []);

  const loadScreenshots = () => {
    if (typeof chrome !== 'undefined' && chrome.storage) {
      chrome.storage.local.get('screenshots', (result) => {
        setScreenshots(result.screenshots || {});
      });
      
      // Listen for screenshot updates
      chrome.storage.onChanged.addListener((changes, namespace) => {
        if (namespace === 'local' && changes.screenshots) {
          setScreenshots(changes.screenshots.newValue || {});
        }
      });
    }
  };

  const loadBookmarks = () => {
    if (typeof chrome !== 'undefined' && chrome.bookmarks) {
      chrome.bookmarks.getTree((bookmarkTree) => {
        setBookmarks(bookmarkTree);
        // Initialize to the root bookmark bar or first available folder
        if (bookmarkTree.length > 0 && bookmarkTree[0].children) {
          const bookmarkBar = bookmarkTree[0].children.find(node => node.id === '1') || bookmarkTree[0].children[0];
          if (bookmarkBar) {
            setCurrentFolderId(bookmarkBar.id);
            setBreadcrumbPath([{ id: bookmarkBar.id, title: bookmarkBar.title || 'Bookmarks' }]);
          }
        }
        setLoading(false);
      });
    } else {
      // Mock data for development
      const mockData = [
        {
          id: 'root',
          title: 'Bookmarks',
          children: [
            {
              id: '1',
              title: 'Bookmark Bar',
              children: [
                {
                  id: 'folder1',
                  title: 'Work',
                  children: [
                    {
                      id: 'b1',
                      title: 'Sample Bookmark',
                      url: 'https://example.com',
                      dateAdded: Date.now(),
                    },
                  ],
                },
                {
                  id: 'b2',
                  title: 'Google',
                  url: 'https://google.com',
                  dateAdded: Date.now(),
                },
              ],
            },
          ],
        },
      ];
      setBookmarks(mockData);
      setCurrentFolderId('1');
      setBreadcrumbPath([{ id: '1', title: 'Bookmark Bar' }]);
      setLoading(false);
    }
  };

  const addBookmark = (title: string, url: string) => {
    if (typeof chrome !== 'undefined' && chrome.bookmarks) {
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
    if (typeof chrome !== 'undefined' && chrome.bookmarks) {
      // Find the item in the current folder to check if it's a folder or bookmark
      const currentItems = getCurrentFolderItems();
      const item = currentItems.find(i => i.id === id);
      
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
    if (typeof chrome !== 'undefined' && chrome.bookmarks) {
      chrome.bookmarks.move(itemId, { parentId: targetFolderId }, () => {
        loadBookmarks();
      });
    }
  };

  const captureScreenshot = (bookmarkId: string, url: string) => {
    if (typeof chrome !== 'undefined' && chrome.runtime) {
      chrome.runtime.sendMessage(
        { action: 'captureScreenshot', bookmarkId, url },
        (response) => {
          if (chrome.runtime.lastError) {
            console.error('Error sending message:', chrome.runtime.lastError.message);
            return;
          }
          if (response?.success) {
            console.log('Screenshot captured successfully');
          } else {
            console.error('Failed to capture screenshot:', response?.error);
          }
        }
      );
    }
  };

  const deleteScreenshot = (bookmarkId: string) => {
    if (typeof chrome !== 'undefined' && chrome.runtime) {
      chrome.runtime.sendMessage(
        { action: 'deleteScreenshot', bookmarkId },
        (response) => {
          if (chrome.runtime.lastError) {
            console.error('Error sending message:', chrome.runtime.lastError.message);
            return;
          }
          if (response?.success) {
            console.log('Screenshot deleted successfully');
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
          screenshot: screenshots[node.id]?.dataUrl
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

  const buildPathToFolder = (nodes: Bookmark[], targetId: string, path: BreadcrumbItem[] = []): BreadcrumbItem[] | null => {
    for (const node of nodes) {
      const newPath = [...path, { id: node.id, title: node.title || 'Untitled' }];
      
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
    setSearchTerm(''); // Clear search when navigating
  };

  const getCurrentFolderItems = (): Bookmark[] => {
    if (!currentFolderId) return [];
    
    const folder = findFolderById(bookmarks, currentFolderId);
    if (!folder || !folder.children) return [];
    
    // Add screenshot data to bookmarks
    return folder.children.map(item => {
      if (item.url) {
        return {
          ...item,
          screenshot: screenshots[item.id]?.dataUrl
        };
      }
      return item;
    });
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
            <h1 className="text-3xl font-bold text-white mb-2">
              📚 Bookmark Manager
            </h1>
            <p className="text-blue-100">
              Organize and search your bookmarks with ease
            </p>
          </div>

          <div className="p-6 space-y-6">
            <AddBookmark onAdd={addBookmark} />
            <SearchBar searchTerm={searchTerm} onSearch={setSearchTerm} />
            {!searchTerm && <Breadcrumb path={breadcrumbPath} onNavigate={navigateToFolder} />}
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
