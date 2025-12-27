# Features Guide

Complete guide to MD Preview Hub features and how they work.

## Progressive Web App (PWA)

### How It Works

The app uses `@vite-pwa/astro` with Workbox to enable offline functionality.

**Service Worker Strategy:**
- Static assets: Precached on first visit
- WASM files: CacheFirst strategy
- Shiki bundles: CacheFirst with dedicated cache

**Cached Assets (~4.5MB):**
- HTML, CSS, JS bundles
- PWA icons (192x192, 512x512)
- Shiki WASM engine
- Shiki language grammars

### Installation

On supported browsers, users can "Add to Home Screen" for app-like experience.

## Markdown Rendering

### Pipeline

```
Raw Markdown
     ↓
markdown-it (parsing)
     ↓
Token stream with heading extraction
     ↓
Shiki (code highlighting)
     ↓
HTML with injected heading IDs
     ↓
Rendered in browser
```

### Supported Elements

| Element | Support |
|---------|---------|
| Headings (h1-h6) | ✅ With auto-generated IDs |
| Code blocks | ✅ 100+ languages via Shiki |
| Inline code | ✅ Styled |
| Tables | ✅ GitHub-style |
| Lists (ul, ol) | ✅ Nested |
| Blockquotes | ✅ Styled |
| Links | ✅ External link handling |
| Images | ✅ Responsive |
| Task lists | ✅ Checkboxes |
| Horizontal rules | ✅ |

### Code Highlighting

Uses [Shiki](https://shiki.style) with GitHub themes:
- `github-dark` for dark mode
- `github-light` for light mode

**Lazy Loading:** Language grammars loaded on-demand to reduce initial bundle.

### Copy Button

Code blocks include a copy button:
- Appears on hover
- Shows checkmark on success
- 2-second feedback timeout

## Table of Contents (TOC)

### Desktop View

Fixed panel on right side (hidden on screens < 1024px):
- Shows all headings from current document
- Highlights active section on scroll
- Click to jump to section
- Collapsible with chevron button

### Mobile View

Floating Action Button (FAB) at bottom-right:
- Tap to open drawer from bottom
- Full heading list
- Tap heading to jump and close

### Active Section Tracking

Uses `IntersectionObserver`:
- Root margin: `-60px 0px -70% 0px`
- Tracks topmost visible heading
- Updates highlight in real-time

### Scroll Behavior

Headings have `scroll-margin-top: 5rem` to prevent header occlusion.

## File Tabs

### Tab Management

- Click file → Opens in new tab
- Click tab → Switches to file
- X button → Closes tab
- Modified indicator → Shows unsaved changes

### Tab Persistence

Open tabs stored in state, restored on page reload (within session).

## Editor

### Features

- Monospace font for code editing
- Unsaved changes indicator
- Keyboard shortcuts:
  - `Cmd/Ctrl + S`: Save to disk
  - `Cmd/Ctrl + E`: Toggle edit mode

### Save Flow

```
User presses Save
     ↓
writeFileContent(handle, content)
     ↓
Update diskLastModified
     ↓
Clear isDirty flag
     ↓
Update status to 'synced'
```

## Settings

### Theme

| Option | Behavior |
|--------|----------|
| Light | Force light mode |
| Dark | Force dark mode |
| System | Follow OS preference |

### Table of Contents

Toggle to show/hide TOC panel. Default: OFF (to save screen space on small screens).

### Sync Interval

How often to check active file for disk changes:
- 30 seconds (default)
- 1 minute
- 2 minutes
- 5 minutes

### Ignored Folders

Comma-separated list of folders to skip during directory scan.

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Cmd/Ctrl + K` | Open search |
| `Cmd/Ctrl + ,` | Open settings |
| `Cmd/Ctrl + S` | Save file (in edit mode) |
| `Cmd/Ctrl + E` | Toggle edit mode |
| `Escape` | Close modal/drawer |

## Theming

### CSS Variables

All colors defined as CSS custom properties in `global.css`:

```css
:root {
  --background: #ffffff;
  --foreground: #1f2328;
  --primary: #0969da;
  --accent: #cf222e;
  /* ... */
}

.dark {
  --background: #0d1117;
  --foreground: #e6edf3;
  --primary: #58a6ff;
  /* ... */
}
```

### Switching Themes

Theme class applied to `<html>` element:
- `class="light"` for light mode
- `class="dark"` for dark mode

## Responsive Design

### Breakpoints

| Width | Behavior |
|-------|----------|
| ≥ 1025px | Desktop: Sidebar + Preview + TOC panel |
| < 1024px | Mobile: Collapsible sidebar + FAB for TOC |

### Sidebar

- Desktop: Resizable with drag handle
- Mobile: Collapsible with toggle button

## Performance

### Bundle Sizes (gzipped)

| Bundle | Size |
|--------|------|
| App.js | ~24KB |
| markdown-it.js | ~46KB |
| shiki-core.js | ~755KB (lazy) |
| Total precache | ~4.5MB |

### Optimizations

1. **Code Splitting**: Shiki languages split into separate chunks
2. **Lazy Loading**: Languages loaded only when needed
3. **Signals**: Efficient reactivity without full re-renders
4. **Service Worker**: Assets served from cache after first load
