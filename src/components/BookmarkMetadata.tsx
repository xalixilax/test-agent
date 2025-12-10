import { useState, useEffect } from 'react';

interface BookmarkMetadataProps {
  bookmarkId: string;
  rating?: number | null;
  note?: string | null;
  tags?: string | null;
  onUpdate: (id: string, data: { rating?: number; note?: string; tags?: string }) => Promise<void>;
}

function BookmarkMetadata({ bookmarkId, rating, note, tags, onUpdate }: BookmarkMetadataProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editRating, setEditRating] = useState<number>(rating || 0);
  const [editNote, setEditNote] = useState(note || '');
  const [editTags, setEditTags] = useState(tags || '');
  const [isSaving, setIsSaving] = useState(false);
  const [hoveredStar, setHoveredStar] = useState<number>(0);

  useEffect(() => {
    setEditRating(rating || 0);
    setEditNote(note || '');
    setEditTags(tags || '');
  }, [rating, note, tags]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onUpdate(bookmarkId, {
        rating: editRating > 0 ? editRating : undefined,
        note: editNote || undefined,
        tags: editTags || undefined,
      });
      setIsEditing(false);
    } catch (error) {
      console.error('Failed to update bookmark metadata:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setEditRating(rating || 0);
    setEditNote(note || '');
    setEditTags(tags || '');
    setIsEditing(false);
  };

  const hasMetadata = rating || note || tags;

  const renderStars = (interactive: boolean = false) => {
    const stars = [];
    const displayRating = interactive ? (hoveredStar || editRating) : (rating || 0);
    
    for (let i = 1; i <= 5; i++) {
      stars.push(
        <button
          key={i}
          type="button"
          onClick={() => interactive && setEditRating(i === editRating ? 0 : i)}
          onMouseEnter={() => interactive && setHoveredStar(i)}
          onMouseLeave={() => interactive && setHoveredStar(0)}
          disabled={!interactive}
          className={`star-rating-button text-2xl ${interactive ? 'cursor-pointer' : 'cursor-default'}`}
          style={{ color: i <= displayRating ? 'var(--color-rating)' : '#ccc' }}
          aria-label={`${i} star${i > 1 ? 's' : ''}`}
        >
          {i <= displayRating ? '★' : '☆'}
        </button>
      );
    }
    return stars;
  };

  const parseTags = (tagString: string | null) => {
    if (!tagString) return [];
    return tagString.split(',').map(t => t.trim()).filter(Boolean);
  };

  const tagList = parseTags(isEditing ? editTags : tags);

  return (
    <div className="border-t-3 border-black mt-2 pt-2">
      <button
        onClick={(e) => {
          e.stopPropagation();
          setIsExpanded(!isExpanded);
        }}
        className="w-full flex items-center justify-between font-black text-xs mb-2 hover:opacity-70 transition-opacity"
      >
        <span style={{ color: 'var(--color-accent)' }}>
          {hasMetadata ? '⚡ METADATA' : '➕ ADD METADATA'}
        </span>
        <span>{isExpanded ? '▲' : '▼'}</span>
      </button>

      {isExpanded && (
        <div className="metadata-expanded space-y-2">
          {/* Rating Display/Edit */}
          <div>
            <label className="block text-xs font-bold mb-1">RATING:</label>
            <div className="flex items-center gap-1">
              {isEditing ? renderStars(true) : (
                <>
                  {renderStars(false)}
                  {!rating && <span className="text-xs font-bold ml-2" style={{ opacity: 0.5 }}>NO RATING</span>}
                </>
              )}
            </div>
          </div>

          {/* Note Display/Edit */}
          <div>
            <label className="block text-xs font-bold mb-1">NOTE:</label>
            {isEditing ? (
              <textarea
                value={editNote}
                onChange={(e) => setEditNote(e.target.value)}
                placeholder="Add a note..."
                className="w-full input-brutal font-mono text-xs resize-none"
                rows={3}
                onClick={(e) => e.stopPropagation()}
              />
            ) : (
              <div 
                className="p-2 border-2 border-black font-mono text-xs min-h-[60px]"
                style={{ background: '#f5f5f5' }}
              >
                {note || <span style={{ opacity: 0.5 }}>No notes yet</span>}
              </div>
            )}
          </div>

          {/* Tags Display/Edit */}
          <div>
            <label className="block text-xs font-bold mb-1">TAGS:</label>
            {isEditing ? (
              <input
                type="text"
                value={editTags}
                onChange={(e) => setEditTags(e.target.value)}
                placeholder="tag1, tag2, tag3"
                className="w-full input-brutal font-mono text-xs"
                onClick={(e) => e.stopPropagation()}
              />
            ) : (
              <div className="flex flex-wrap gap-2 min-h-[32px]">
                {tagList.length > 0 ? (
                  tagList.map((tag, idx) => (
                    <span
                      key={idx}
                      className="tag-item px-2 py-1 border-2 border-black font-mono text-xs font-bold"
                      style={{ 
                        background: 'var(--color-secondary)',
                        animationDelay: `${idx * 0.05}s`
                      }}
                    >
                      #{tag}
                    </span>
                  ))
                ) : (
                  <span className="text-xs font-bold" style={{ opacity: 0.5 }}>No tags yet</span>
                )}
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2 pt-2">
            {isEditing ? (
              <>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleSave();
                  }}
                  disabled={isSaving}
                  className="btn-brutal px-3 py-1 text-xs font-black flex-1"
                  style={{ background: 'var(--color-success)' }}
                >
                  {isSaving ? '⏳ SAVING...' : '✓ SAVE'}
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleCancel();
                  }}
                  disabled={isSaving}
                  className="btn-brutal px-3 py-1 text-xs font-black"
                  style={{ background: 'var(--color-white)' }}
                >
                  ✕ CANCEL
                </button>
              </>
            ) : (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setIsEditing(true);
                }}
                className="btn-brutal px-3 py-1 text-xs font-black w-full"
                style={{ background: 'var(--color-accent)', color: 'white' }}
              >
                ✎ EDIT
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default BookmarkMetadata;
