import { useState, useEffect } from 'react';
import BookmarkList from './components/BookmarkList';
import SearchBar from './components/SearchBar';
import AddBookmark from './components/AddBookmark';

interface Bookmark {
  id: string;
  title: string;
  url?: string;
  dateAdded?: number;
  children?: Bookmark[];
}

function App() {
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadBookmarks();
  }, []);

  const loadBookmarks = () => {
    if (typeof chrome !== 'undefined' && chrome.bookmarks) {
      chrome.bookmarks.getTree((bookmarkTree) => {
        setBookmarks(bookmarkTree);
        setLoading(false);
      });
    } else {
      // Mock data for development
      setBookmarks([
        {
          id: '1',
          title: 'Sample Bookmark',
          url: 'https://example.com',
          dateAdded: Date.now(),
        },
      ]);
      setLoading(false);
    }
  };

  const addBookmark = (title: string, url: string) => {
    if (typeof chrome !== 'undefined' && chrome.bookmarks) {
      chrome.bookmarks.create(
        {
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
      chrome.bookmarks.remove(id, () => {
        loadBookmarks();
      });
    }
  };

  const flattenBookmarks = (nodes: Bookmark[]): Bookmark[] => {
    let result: Bookmark[] = [];
    nodes.forEach((node) => {
      if (node.url) {
        result.push(node);
      }
      if (node.children) {
        result = result.concat(flattenBookmarks(node.children));
      }
    });
    return result;
  };

  const filteredBookmarks = flattenBookmarks(bookmarks).filter(
    (bookmark) =>
      bookmark.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      bookmark.url?.toLowerCase().includes(searchTerm.toLowerCase())
  );

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
            <BookmarkList
              bookmarks={filteredBookmarks}
              onDelete={deleteBookmark}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
