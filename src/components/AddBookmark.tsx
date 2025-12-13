import { useState } from "react";
import { Button } from "./ui/button";

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
        <Button
          onClick={() => {
            setIsExpanded(true);
            setIsFolder(false);
          }}
          className="flex-1 font-black"
          variant="secondary"
          size="lg"
        >
          + ADD BOOKMARK
        </Button>
        <Button
          onClick={() => {
            setIsExpanded(true);
            setIsFolder(true);
          }}
          className="flex-1 font-black"
          variant="secondary"
          size="lg"
        >
          📁 ADD FOLDER
        </Button>
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
        <Button
          type="button"
          onClick={() => setIsFolder(false)}
          variant={!isFolder ? "selected" : "default"}
          size="sm"
        >
          BOOKMARK
        </Button>
        <Button
          type="button"
          onClick={() => setIsFolder(true)}
          variant={isFolder ? "selected" : "default"}
          size="sm"
        >
          FOLDER
        </Button>
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
        <Button
          type="submit"
          className="flex-1 font-black"
          variant="success"
          size="default"
        >
          {isFolder ? "📁 CREATE FOLDER" : "ADD BOOKMARK"}
        </Button>
        <Button
          type="button"
          onClick={() => {
            setIsExpanded(false);
            setTitle("");
            setUrl("");
            setIsFolder(false);
          }}
          className="flex-1 font-black"
          variant="default"
          size="default"
        >
          CANCEL
        </Button>
      </div>
    </form>
  );
}

export default AddBookmark;
