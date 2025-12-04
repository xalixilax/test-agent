# Bookmark Manager - Chrome Extension

A modern Chrome extension for managing bookmarks, built with React, Tailwind CSS, and Vite.

![Bookmark Manager UI](https://github.com/user-attachments/assets/5e36cef6-3995-4827-9fd7-a5e79c9637f8)

## Features

- 📚 **View All Bookmarks** - Browse all your Chrome bookmarks in a clean, organized interface
- 🔍 **Search** - Quickly find bookmarks by title or URL
- ➕ **Add Bookmarks** - Create new bookmarks directly from the extension
- 🗑️ **Delete Bookmarks** - Remove unwanted bookmarks with a single click
- 📷 **Screenshot Capture** - Automatically capture screenshots when visiting bookmarks for the first time
- 🖼️ **Screenshot Preview** - View thumbnail previews of bookmarked pages and click to see full-size screenshots
- ♻️ **Screenshot Management** - Manually capture, retake, or delete screenshots for any bookmark
- 🎨 **Modern UI** - Beautiful interface built with React and Tailwind CSS

## Tech Stack

- **React** - UI framework
- **TypeScript** - Type safety
- **Tailwind CSS** - Styling
- **Vite** - Build tool
- **Chrome Extension API** - Browser integration

## Installation

### Prerequisites

- Node.js (v20 or higher)
- npm or your preferred package manager

### Setup

1. Install dependencies:

```bash
npm install
```

2. Generate extension icons:

```bash
npm run generate-icons
```

3. Build the extension:

```bash
npm run build
```

The built extension will be in the `dist/` folder.

## Development

Run the development server:

```bash
npm run dev
```

This will start Vite's dev server at `http://localhost:5173` (or another port if 5173 is in use). You can preview the UI in your browser.

## Loading the Extension in Chrome

1. Build the extension using `npm run build`
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode" (toggle in the top-right corner)
4. Click "Load unpacked"
5. Select the `dist/` folder from this project
6. The Bookmark Manager extension will now appear in your extensions toolbar

## Usage

1. Click the Bookmark Manager icon in your Chrome toolbar
2. The popup will display all your bookmarks with screenshot previews (if available)
3. Use the search bar to filter bookmarks
4. Click "Add New Bookmark" to create a new bookmark
5. **Screenshots are automatically captured** when you visit a bookmarked page for the first time
6. Click the **"📷 Capture"** button on any bookmark to manually take a screenshot of the current tab
7. Click on a screenshot thumbnail to view it in full size
8. Click **"🗑️ Delete Screenshot"** to remove a screenshot while keeping the bookmark
9. Click the **"📷 Retake"** button to replace an existing screenshot with a new one
10. Hover over a bookmark and click the delete icon to remove it
11. Click on any bookmark title or URL to open it in a new tab

## Project Structure

```
.
├── public/
│   ├── manifest.json      # Chrome extension manifest
│   └── icons/             # Extension icons
├── src/
│   ├── components/        # React components
│   │   ├── AddBookmark.tsx
│   │   ├── BookmarkList.tsx
│   │   └── SearchBar.tsx
│   ├── background.ts      # Service worker for automatic screenshot capture
│   ├── App.tsx            # Main app component
│   ├── main.tsx           # Entry point
│   └── index.css          # Global styles with Tailwind
├── index.html             # HTML entry point
├── vite.config.ts         # Vite configuration
├── tailwind.config.js     # Tailwind CSS configuration
└── package.json           # Dependencies and scripts
```

## Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run generate-icons` - Generate extension icons

## Notes

- The extension uses Chrome's Bookmarks API, so it requires the `bookmarks` permission
- Screenshots are stored using Chrome's Storage API with the `storage` permission
- The extension requires `tabs` and `activeTab` permissions to capture screenshots
- Screenshots are automatically captured when you visit a bookmarked page for the first time
- You can manually capture screenshots at any time using the "Capture" button
- In development mode, mock data is displayed if the Chrome API is not available
- The extension popup is optimized for a 400x500px window

## License

MIT
