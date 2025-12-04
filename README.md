# Bookmark Manager - Chrome Extension

A modern Chrome extension for managing bookmarks, built with React, Tailwind CSS, and Vite.

![Bookmark Manager UI](https://github.com/user-attachments/assets/5e36cef6-3995-4827-9fd7-a5e79c9637f8)

## Features

- 📚 **View All Bookmarks** - Browse all your Chrome bookmarks in a clean, organized interface
- 🔍 **Search** - Quickly find bookmarks by title or URL
- ➕ **Add Bookmarks** - Create new bookmarks directly from the extension
- 🗑️ **Delete Bookmarks** - Remove unwanted bookmarks with a single click
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
2. The popup will display all your bookmarks
3. Use the search bar to filter bookmarks
4. Click "Add New Bookmark" to create a new bookmark
5. Hover over a bookmark and click the delete icon to remove it
6. Click on any bookmark to open it in a new tab

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
- In development mode, mock data is displayed if the Chrome API is not available
- The extension popup is optimized for a 400x500px window

## License

MIT
