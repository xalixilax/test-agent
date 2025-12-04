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
      <div className="text-center py-16 animate-fade-in" style={{ color: 'var(--color-text-muted)' }}>
        <div className="mb-4 animate-float">
          <svg
            className="w-20 h-20 mx-auto opacity-30"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z"
            />
          </svg>
        </div>
        <p className="text-xl font-semibold mb-2" style={{ fontFamily: 'Syne, sans-serif', color: 'var(--color-text-secondary)' }}>
          Empty vault
        </p>
        <p className="text-sm" style={{ fontFamily: 'Crimson Pro, serif' }}>
          Start adding bookmarks to your collection
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-h-96 overflow-y-auto pr-2">
        {items.map((item, index) => {
          const folder = isFolder(item);
          
          return (
            <div
              key={item.id}
              draggable
              onDragStart={(e) => handleDragStart(e, item.id)}
              onDragOver={folder ? handleDragOver : undefined}
              onDrop={folder ? (e) => handleDrop(e, item.id) : undefined}
              className={`group p-4 rounded-xl transition-smooth hover-lift border-2 cursor-pointer animate-scale-in card-hover ${
                draggedItem === item.id ? 'opacity-50' : ''
              }`}
              style={{
                background: 'var(--color-bg-secondary)',
                animationDelay: `${index * 0.05}s`,
              }}
            >
              {folder ? (
                /* Folder Card */
                <div onClick={() => onFolderClick(item.id)} className="flex flex-col items-center text-center">
                  <div className="w-16 h-16 mb-3 flex items-center justify-center rounded-xl transition-smooth" style={{
                    background: 'linear-gradient(135deg, rgba(255, 140, 66, 0.2), rgba(212, 98, 47, 0.2))',
                  }}>
                    <svg
                      className="w-10 h-10"
                      style={{ color: 'var(--color-accent-primary)' }}
                      fill="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path d="M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z"/>
                    </svg>
                  </div>
                  <h3 className="font-bold truncate w-full" style={{ 
                    fontFamily: 'Syne, sans-serif',
                    color: 'var(--color-text-primary)',
                  }} title={item.title}>
                    {item.title}
                  </h3>
                  <p className="text-sm mt-1" style={{ 
                    fontFamily: 'Crimson Pro, serif',
                    color: 'var(--color-text-muted)',
                  }}>
                    {item.children?.length || 0} items
                  </p>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDelete(item.id);
                    }}
                    className="mt-3 opacity-0 group-hover:opacity-100 transition-smooth px-3 py-1 rounded-lg text-sm font-semibold"
                    style={{
                      background: 'rgba(220, 38, 38, 0.2)',
                      color: '#fca5a5',
                      fontFamily: 'Syne, sans-serif',
                    }}
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
                      className="w-full h-24 rounded-lg mb-3 overflow-hidden cursor-pointer transition-smooth hover:scale-105 border-2"
                      style={{ borderColor: 'var(--color-border)' }}
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
                    className="font-bold truncate cursor-pointer text-hover-accent mb-1"
                    onClick={() => item.url && handleOpenBookmark(item.url)}
                    title={item.title}
                    style={{
                      fontFamily: 'Syne, sans-serif',
                    }}
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
                      className="text-xs hover:underline truncate block mb-2 transition-colors"
                      title={item.url}
                      style={{
                        color: 'var(--color-accent-secondary)',
                        fontFamily: 'Crimson Pro, serif',
                      }}
                    >
                      {item.url}
                    </a>
                  )}
                  
                  <p className="text-xs mb-3" style={{ 
                    color: 'var(--color-text-muted)',
                    fontFamily: 'Crimson Pro, serif',
                  }}>
                    {formatDate(item.dateAdded)}
                  </p>
                  
                  {/* Screenshot controls */}
                  <div className="flex gap-2 mt-auto">
                    <button
                      onClick={() => item.url && onCaptureScreenshot(item.id, item.url)}
                      className="text-xs px-3 py-1.5 rounded-lg transition-smooth hover-lift font-semibold flex-1"
                      style={{
                        background: 'rgba(255, 140, 66, 0.15)',
                        color: 'var(--color-accent-secondary)',
                        border: '1px solid rgba(255, 140, 66, 0.3)',
                        fontFamily: 'Syne, sans-serif',
                      }}
                      title={item.screenshot ? "Retake screenshot" : "Capture screenshot"}
                    >
                      📷 {item.screenshot ? "Retake" : "Capture"}
                    </button>
                    {item.screenshot && (
                      <button
                        onClick={() => onDeleteScreenshot(item.id)}
                        className="text-xs px-3 py-1.5 rounded-lg transition-smooth hover-lift font-semibold"
                        style={{
                          background: 'rgba(220, 38, 38, 0.15)',
                          color: '#fca5a5',
                          border: '1px solid rgba(220, 38, 38, 0.3)',
                          fontFamily: 'Syne, sans-serif',
                        }}
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
                    className="mt-2 opacity-0 group-hover:opacity-100 transition-smooth px-2 py-1 rounded-lg text-xs font-semibold self-end"
                    style={{
                      background: 'rgba(220, 38, 38, 0.2)',
                      color: '#fca5a5',
                      fontFamily: 'Syne, sans-serif',
                    }}
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
          className="fixed inset-0 flex items-center justify-center z-50 p-4 animate-fade-in cursor-pointer"
          style={{
            background: 'rgba(0, 0, 0, 0.85)',
            backdropFilter: 'blur(10px)',
          }}
          onClick={() => setSelectedScreenshot(null)}
        >
          <div className="max-w-4xl max-h-full animate-scale-in">
            <img 
              src={selectedScreenshot} 
              alt="Screenshot preview"
              className="max-w-full max-h-full rounded-xl"
              style={{
                boxShadow: '0 0 60px rgba(255, 140, 66, 0.3)',
              }}
              onClick={(e) => e.stopPropagation()}
            />
            <button 
              className="absolute top-8 right-8 p-3 rounded-full transition-smooth hover:scale-110"
              style={{
                background: 'rgba(255, 140, 66, 0.2)',
                color: 'var(--color-accent-primary)',
                border: '2px solid var(--color-accent-primary)',
              }}
              onClick={() => setSelectedScreenshot(null)}
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}
    </>
  );
}

export default BookmarkList;
