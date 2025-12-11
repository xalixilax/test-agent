import { useState } from "react";

interface AddBookmarkProps {
  onAdd: (title: string, url: string, isFolder: boolean) => void;
  currentFolderId: number | null;
}

function AddBookmark({ onAdd, currentFolderId }: AddBookmarkProps) {
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [isExpanded, setIsExpanded] = useState(false);
  const [isFolder, setIsFolder] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (title.trim() && (isFolder || url.trim())) {
      onAdd(title, url, isFolder);
      setTitle("");
      setUrl("");
      setIsFolder(false);
      setIsExpanded(false);
    }
  };

  if (!isExpanded) {
    return (
      <div className="flex gap-2">
        <button
          onClick={() => {
            setIsExpanded(true);
            setIsFolder(false);
          }}
          className="flex-1 py-3 px-4 btn-brutal font-black text-sm sm:text-base"
          style={{ background: "var(--color-secondary)" }}
        >
          + ADD BOOKMARK
        </button>
        <button
          onClick={() => {
            setIsExpanded(true);
            setIsFolder(true);
          }}
          className="flex-1 py-3 px-4 btn-brutal font-black text-sm sm:text-base"
          style={{ background: "var(--color-secondary)" }}
        >
          📁 ADD FOLDER
        </button>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-3 p-4 card-brutal"
      style={{ background: "var(--color-white)" }}
    >
      <div className="flex items-center gap-2 mb-2">
        <span className="text-sm font-bold">Creating:</span>
        <button
          type="button"
          onClick={() => setIsFolder(false)}
          className={`px-3 py-1 text-xs font-bold border-2 border-black ${
            !isFolder ? "bg-black text-white" : "bg-white"
          }`}
        >
          BOOKMARK
        </button>
        <button
          type="button"
          onClick={() => setIsFolder(true)}
          className={`px-3 py-1 text-xs font-bold border-2 border-black ${
            isFolder ? "bg-black text-white" : "bg-white"
          }`}
        >
          FOLDER
        </button>
      </div>

      <div>
        <input
          type="text"
          placeholder={isFolder ? "FOLDER NAME" : "TITLE"}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full input-brutal text-sm sm:text-base"
          required
        />
      </div>

      {!isFolder && (
        <div>
          <input
            type="url"
            placeholder="https://example.com"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            className="w-full input-brutal text-sm sm:text-base"
            required
          />
        </div>
      )}

      <div className="flex gap-2">
        <button
          type="submit"
          className="flex-1 py-2 px-4 btn-brutal font-black text-sm sm:text-base"
          style={{ background: "var(--color-success)" }}
        >
          {isFolder ? "📁 CREATE FOLDER" : "ADD BOOKMARK"}
        </button>
        <button
          type="button"
          onClick={() => {
            setIsExpanded(false);
            setTitle("");
            setUrl("");
            setIsFolder(false);
          }}
          className="flex-1 py-2 px-4 btn-brutal font-black text-sm sm:text-base"
          style={{ background: "var(--color-white)" }}
        >
          CANCEL
        </button>
      </div>
    </form>
  );
}

export default AddBookmark;
