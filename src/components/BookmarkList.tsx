import { useState } from 'react';
import type { Bookmark } from '../types';

interface BookmarkListProps {
  items: Bookmark[];
  onDelete: (id: string) => void;
  onCaptureScreenshot: (id: string, url: string) => void;
  onDeleteScreenshot: (id: string) => void;
  onFolderClick: (id: string) => void;
  onMove?: (itemId: string, targetFolderId: string) => void;
}

function BookmarkList({ items, onDelete, onCaptureScreenshot, onDeleteScreenshot, onFolderClick, onMove }: BookmarkListProps) {
  const [selectedScreenshot, setSelectedScreenshot] = useState<string | null>(null);
  const [draggedItem, setDraggedItem] = useState<string | null>(null);

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
      <div className="text-center py-12 text-gray-500">
        <svg
          className="w-16 h-16 mx-auto mb-4 text-gray-300"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z"
          />
        </svg>
        <p className="text-lg font-medium">No items found</p>
        <p className="text-sm mt-1">This folder is empty</p>
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-96 overflow-y-auto">
        {items.map((item) => {
          const folder = isFolder(item);
          
          return (
            <div
              key={item.id}
              draggable
              onDragStart={(e) => handleDragStart(e, item.id)}
              onDragOver={folder ? handleDragOver : undefined}
              onDrop={folder ? (e) => handleDrop(e, item.id) : undefined}
              className={`group p-4 border border-gray-200 rounded-lg hover:border-blue-300 hover:shadow-md transition-all bg-white cursor-pointer ${
                draggedItem === item.id ? 'opacity-50' : ''
              }`}
            >
              {folder ? (
                /* Folder Card */
                <div onClick={() => onFolderClick(item.id)} className="flex flex-col items-center text-center">
                  <div className="w-16 h-16 mb-3 flex items-center justify-center bg-blue-100 rounded-lg">
                    <svg
                      className="w-10 h-10 text-blue-600"
                      fill="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path d="M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z"/>
                    </svg>
                  </div>
                  <h3 className="font-semibold text-gray-900 truncate w-full" title={item.title}>
                    {item.title}
                  </h3>
                  <p className="text-xs text-gray-500 mt-1">
                    {item.children?.length || 0} items
                  </p>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDelete(item.id);
                    }}
                    className="mt-2 opacity-0 group-hover:opacity-100 transition-opacity p-1 text-red-600 hover:bg-red-50 rounded text-xs"
                    title="Delete folder"
                  >
                    🗑️ Delete
                  </button>
                </div>
              ) : (
                /* Bookmark Card */
                <div className="flex flex-col h-full">
                  {item.screenshot && (
                    <div 
                      className="w-full h-24 bg-gray-100 rounded mb-2 overflow-hidden cursor-pointer hover:opacity-80 transition-opacity"
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
                    className="font-semibold text-gray-900 truncate cursor-pointer hover:text-blue-600"
                    onClick={() => item.url && handleOpenBookmark(item.url)}
                    title={item.title}
                  >
                    {item.title}
                  </h3>
                  
                  {item.url && (
                    <a
                      href={item.url}
                      onClick={(e) => {
                        e.preventDefault();
                        handleOpenBookmark(item.url!);
                      }}
                      className="text-xs text-blue-600 hover:underline truncate block"
                      title={item.url}
                    >
                      {item.url}
                    </a>
                  )}
                  
                  <p className="text-xs text-gray-500 mt-1">
                    {formatDate(item.dateAdded)}
                  </p>
                  
                  {/* Screenshot controls */}
                  <div className="flex gap-1 mt-2">
                    <button
                      onClick={() => item.url && onCaptureScreenshot(item.id, item.url)}
                      className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition-colors"
                      title={item.screenshot ? "Retake screenshot" : "Capture screenshot"}
                    >
                      📷 {item.screenshot ? "Retake" : "Capture"}
                    </button>
                    {item.screenshot && (
                      <button
                        onClick={() => onDeleteScreenshot(item.id)}
                        className="text-xs px-2 py-1 bg-red-100 text-red-700 rounded hover:bg-red-200 transition-colors"
                        title="Delete screenshot"
                      >
                        🗑️
                      </button>
                    )}
                  </div>
                  
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDelete(item.id);
                    }}
                    className="mt-2 opacity-0 group-hover:opacity-100 transition-opacity p-1 text-red-600 hover:bg-red-50 rounded text-xs self-end"
                    title="Delete bookmark"
                  >
                    🗑️ Delete
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Screenshot preview modal */}
      {selectedScreenshot && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4"
          onClick={() => setSelectedScreenshot(null)}
        >
          <div className="max-w-4xl max-h-full">
            <img 
              src={selectedScreenshot} 
              alt="Screenshot preview"
              className="max-w-full max-h-full rounded-lg shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        </div>
      )}
    </>
  );
}

export default BookmarkList;
