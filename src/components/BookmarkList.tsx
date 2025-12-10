import { useState, useEffect } from 'react';
import type { Bookmark } from '../types';
import BookmarkMetadata from './BookmarkMetadata';

interface BookmarkListProps {
  items: Bookmark[];
  onDelete: (id: string) => void;
  onCaptureScreenshot: (id: string, url: string) => void;
  onDeleteScreenshot: (id: string) => void;
  onFolderClick: (id: string) => void;
  onMove?: (itemId: string, targetFolderId: string) => void;
  onUpdateMetadata: (id: string, data: { rating?: number; note?: string; tags?: string }) => Promise<void>;
}

function BookmarkList({ items, onDelete, onCaptureScreenshot, onDeleteScreenshot, onFolderClick, onMove, onUpdateMetadata }: BookmarkListProps) {
  const [selectedScreenshot, setSelectedScreenshot] = useState<string | null>(null);
  const [draggedItem, setDraggedItem] = useState<string | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = () => setOpenMenuId(null);
    if (openMenuId) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [openMenuId]);

  const handleOpenBookmark = (url: string) => {
    if (typeof chrome !== 'undefined' && chrome.tabs) {
      chrome.tabs.create({ url });
    } else {
      window.open(url, '_blank');
    }
  };

  const formatDate = (timestamp?: number) => {
    if (!timestamp) return 'Unknown';
    return new Date(timestamp).toLocaleDateString();
  };

  const handleDragStart = (e: React.DragEvent, itemId: string) => {
    setDraggedItem(itemId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e: React.DragEvent, targetFolderId: string) => {
    e.preventDefault();
    if (draggedItem && onMove) {
      onMove(draggedItem, targetFolderId);
    }
    setDraggedItem(null);
  };

  const isFolder = (item: Bookmark) => {
    return !item.url && Array.isArray(item.children);
  };

  if (items.length === 0) {
    return (
      <div className="text-center py-16">
        <div className="text-6xl mb-4">📭</div>
        <p className="text-xl font-black">NO BOOKMARKS</p>
        <p className="text-sm font-bold mt-2">ADD SOME LINKS!</p>
      </div>
    );
  }

  return (
    <>
      {/* Responsive grid: 1 col on mobile, 2 on tablet, 3-4 on desktop */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
        {items.map((item) => {
          const folder = isFolder(item);
          
          return (
            <div
              key={item.id}
              draggable
              onDragStart={(e) => handleDragStart(e, item.id)}
              onDragOver={folder ? handleDragOver : undefined}
              onDrop={folder ? (e) => handleDrop(e, item.id) : undefined}
              className={`relative card-brutal p-3 sm:p-4 cursor-pointer ${
                draggedItem === item.id ? 'opacity-50' : ''
              }`}
              style={{ background: 'var(--color-white)' }}
            >
              {folder ? (
                /* Folder Card */
                <div onClick={() => onFolderClick(item.id)} className="flex flex-col items-center text-center">
                  <div className="w-12 h-12 sm:w-16 sm:h-16 mb-2 sm:mb-3 flex items-center justify-center border-3 border-black" style={{ background: 'var(--color-tertiary)' }}>
                    <span className="text-2xl sm:text-3xl">📁</span>
                  </div>
                  <h3 className="font-black text-sm sm:text-base truncate w-full" title={item.title}>
                    {item.title?.toUpperCase()}
                  </h3>
                  <p className="text-xs font-bold mt-1">
                    {item.children?.length || 0} ITEMS
                  </p>
                </div>
              ) : (
                /* Bookmark Card */
                <div className="flex flex-col h-full">
                  {/* Kebab menu */}
                  <div className="absolute top-2 right-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setOpenMenuId(openMenuId === item.id ? null : item.id);
                      }}
                      className="w-8 h-8 flex flex-col items-center justify-center gap-1 hover:bg-gray-100 border-2 border-black"
                      style={{ background: 'var(--color-white)' }}
                      aria-label="Bookmark actions menu"
                      aria-expanded={openMenuId === item.id}
                      aria-haspopup="true"
                    >
                      <div className="w-1 h-1 bg-black rounded-full"></div>
                      <div className="w-1 h-1 bg-black rounded-full"></div>
                      <div className="w-1 h-1 bg-black rounded-full"></div>
                    </button>
                    
                    {openMenuId === item.id && (
                      <div 
                        className="absolute right-0 mt-1 w-40 border-3 border-black z-10 shadow-brutal" 
                        style={{ background: 'var(--color-white)' }}
                        role="menu"
                        aria-label="Bookmark actions"
                      >
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            item.url && onCaptureScreenshot(item.id, item.url);
                            setOpenMenuId(null);
                          }}
                          className="w-full px-3 py-2 text-left text-xs font-bold hover:bg-gray-100 border-b-2 border-black flex items-center gap-2"
                          role="menuitem"
                        >
                          📷 SCREENSHOT
                        </button>
                        {item.screenshot && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onDeleteScreenshot(item.id);
                              setOpenMenuId(null);
                            }}
                            className="w-full px-3 py-2 text-left text-xs font-bold hover:bg-gray-100 border-b-2 border-black flex items-center gap-2"
                            role="menuitem"
                          >
                            🗑️ DEL SCREENSHOT
                          </button>
                        )}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onDelete(item.id);
                            setOpenMenuId(null);
                          }}
                          className="w-full px-3 py-2 text-left text-xs font-bold hover:bg-red-100 flex items-center gap-2"
                          style={{ color: 'var(--color-danger)' }}
                          role="menuitem"
                        >
                          ❌ DELETE
                        </button>
                      </div>
                    )}
                  </div>

                  {item.screenshot && (
                    <div 
                      className="w-full h-20 sm:h-24 border-3 border-black mb-2 sm:mb-3 overflow-hidden cursor-pointer hover:opacity-80 transition-opacity"
                      onClick={() => setSelectedScreenshot(item.screenshot!)}
                      title="Click to view full screenshot"
                    >
                      <img 
                        src={item.screenshot} 
                        alt={`Screenshot of ${item.title}`}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  )}
                  
                  <h3
                    className="font-black text-sm sm:text-base mb-1 cursor-pointer hover:underline pr-8"
                    onClick={() => item.url && handleOpenBookmark(item.url)}
                    title={item.title}
                  >
                    {item.title?.toUpperCase()}
                  </h3>
                  
                  {item.url && (
                    <a
                      href={item.url}
                      onClick={(e) => {
                        e.preventDefault();
                        handleOpenBookmark(item.url!);
                      }}
                      className="text-xs font-bold hover:underline block mb-2 break-words"
                      title={item.url}
                      style={{ color: 'var(--color-primary)' }}
                    >
                      {item.url}
                    </a>
                  )}
                  
                  <p className="text-xs font-bold mt-auto" style={{ opacity: 0.6 }}>
                    {formatDate(item.dateAdded)}
                  </p>

                  {/* Bookmark Metadata Section */}
                  <BookmarkMetadata
                    bookmarkId={item.id}
                    rating={item.rating}
                    note={item.note}
                    tags={item.tags}
                    onUpdate={onUpdateMetadata}
                  />
                </div>
              )}
              
              {/* Delete button for folders - only visible on hover */}
              {folder && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(item.id);
                  }}
                  className="absolute top-2 right-2 opacity-0 hover:opacity-100 transition-opacity w-8 h-8 border-2 border-black font-black text-sm"
                  style={{ background: 'var(--color-danger)', color: 'white' }}
                  title="Delete folder"
                >
                  ×
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Screenshot preview modal */}
      {selectedScreenshot && (
        <div 
          className="fixed inset-0 flex items-center justify-center z-50 p-4"
          style={{ background: 'rgba(0, 0, 0, 0.9)' }}
          onClick={() => setSelectedScreenshot(null)}
        >
          <div className="max-w-6xl max-h-full relative">
            <img 
              src={selectedScreenshot} 
              alt="Screenshot preview"
              className="max-w-full max-h-full border-4 border-white"
              onClick={(e) => e.stopPropagation()}
            />
            <button 
              className="absolute -top-12 right-0 btn-brutal px-4 py-2 font-black"
              style={{ background: 'var(--color-white)' }}
              onClick={() => setSelectedScreenshot(null)}
            >
              CLOSE
            </button>
          </div>
        </div>
      )}
    </>
  );
}

export default BookmarkList;
