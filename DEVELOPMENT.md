# Chrome Extension Development Guide

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Build the Extension

```bash
npm run build
```

### 3. Load in Chrome

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable **Developer mode** (toggle switch in top-right)
3. Click **Load unpacked**
4. Navigate to and select the `dist/` folder in this project
5. The extension icon should appear in your toolbar

### 4. Test the Extension

Click the extension icon in your Chrome toolbar to open the bookmark manager popup.

## Development Workflow

### Live Development

```bash
npm run dev
```

This starts a development server at `http://localhost:5173` where you can preview the UI in your browser. Note that Chrome extension APIs won't work in this mode - you'll see mock data instead.

### Building for Production

```bash
npm run build
```

This creates an optimized build in the `dist/` folder that can be loaded as a Chrome extension.

### Updating the Extension

After making code changes:

1. Run `npm run build`
2. Go to `chrome://extensions/`
3. Click the refresh icon on your extension card

The extension will reload with your changes.

## Troubleshooting

### Extension Won't Load

- Make sure you've run `npm run build` first
- Check that you're selecting the `dist/` folder, not the project root
- Look for errors in the Chrome extensions page

### Changes Not Showing

- After rebuilding, click the refresh button on the extension in `chrome://extensions/`
- If the popup is open, close it and reopen it

### API Errors

The extension requires these permissions (already configured in manifest.json):
- `bookmarks` - Read and modify Chrome bookmarks
- `storage` - Store extension settings

These are automatically granted when you load the extension.

## File Structure

```
dist/                    # Built extension (load this in Chrome)
├── index.html          # Popup HTML
├── manifest.json       # Extension configuration
├── icons/              # Extension icons
│   ├── icon-16.png
│   ├── icon-48.png
│   └── icon-128.png
└── assets/             # Compiled JS and CSS
    ├── index.js
    └── index.css
```

## Chrome APIs Used

- `chrome.bookmarks.getTree()` - Fetch all bookmarks
- `chrome.bookmarks.create()` - Add new bookmarks
- `chrome.bookmarks.remove()` - Delete bookmarks
- `chrome.tabs.create()` - Open bookmarks in new tabs

## Next Steps

Consider adding:
- Bookmark folders organization
- Export/import bookmarks
- Bookmark tags or categories
- Keyboard shortcuts
- Dark mode toggle
- Bookmark editing functionality
