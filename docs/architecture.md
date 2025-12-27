# Architecture Overview

This document describes the high-level architecture of MD Preview Hub.

## System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Browser                               │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │   Astro     │  │   Preact    │  │   Service Worker    │  │
│  │   (SSG)     │  │   (UI)      │  │   (PWA/Offline)     │  │
│  └─────────────┘  └─────────────┘  └─────────────────────┘  │
│                          │                                   │
│  ┌───────────────────────┴───────────────────────────────┐  │
│  │                  State Management                      │  │
│  │              (@preact/signals)                         │  │
│  └───────────────────────────────────────────────────────┘  │
│                          │                                   │
│  ┌──────────────┐  ┌─────────────┐  ┌──────────────────┐   │
│  │ File System  │  │  IndexedDB  │  │    Markdown      │   │
│  │ Access API   │  │  (idb)      │  │    Renderer      │   │
│  └──────────────┘  └─────────────┘  └──────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

## Core Layers

### 1. Presentation Layer (`src/components/`)

| Component | Purpose |
|-----------|---------|
| `App.tsx` | Root component, layout orchestration |
| `Sidebar.tsx` | File tree navigation |
| `Preview.tsx` | Markdown preview container |
| `Editor.tsx` | Text editing with save functionality |
| `MarkdownPreview.tsx` | Markdown rendering with TOC |
| `TableOfContents.tsx` | Floating TOC panel |
| `Header.tsx` | App header with search and settings |
| `SettingsModal.tsx` | User preferences |

### 2. State Management (`src/stores/`)

Uses `@preact/signals` for reactive state:

```typescript
// file-store.ts
activeFile        // Currently selected file
activeFileContent // Content of active file
currentProject    // Current open folder
openTabs          // List of open file tabs

// theme-store.ts
currentTheme      // 'dark' | 'light'
showToc           // TOC visibility toggle
```

### 3. Core Libraries (`src/lib/`)

| Module | Responsibility |
|--------|---------------|
| `markdown.ts` | Markdown parsing, Shiki highlighting, TOC extraction |
| `file-system.ts` | File System Access API operations |
| `virtual-fs.ts` | Virtual file system overlay |
| `database.ts` | IndexedDB operations (projects, files, settings) |
| `polling.ts` | File change detection and sync |
| `keyboard.ts` | Keyboard shortcuts management |

### 4. Styling (`src/styles/`)

| File | Content |
|------|---------|
| `global.css` | Theme variables, layout, scrollbars |
| `markdown.css` | Markdown body styles (headings, code, tables) |
| `toc.css` | Table of Contents styles (desktop panel, mobile drawer) |

## Data Flow

### Opening a Folder

```
User clicks "Open Folder"
         ↓
showDirectoryPicker() → FileSystemDirectoryHandle
         ↓
scanDirectory() → VirtualFile[]
         ↓
saveFiles() → IndexedDB
         ↓
updateFileTree() → UI renders tree
```

### File Selection

```
User clicks file in sidebar
         ↓
setActiveFile(fileId)
         ↓
syncFileOnDemand() → Read from disk via FileHandle
         ↓
activeFileContent.value = content
         ↓
MarkdownPreview re-renders
```

### File Sync Loop

```
┌─────────────────────────────────────┐
│         Polling System              │
├─────────────────────────────────────┤
│ • Active file: Every 30s (config)   │
│ • Directory scan: Every 60s         │
│ • Tab focus: Instant sync           │
│ • File click: On-demand sync        │
└─────────────────────────────────────┘
```

## Build Output

```
dist/
├── index.html           # SPA entry
├── _astro/
│   ├── App.*.js         # Main app bundle (~84KB)
│   ├── markdown-it.*.js # Markdown parser (~103KB)
│   ├── shiki-core.*.js  # Shiki core (~4.3MB, lazy)
│   ├── shiki-lang-*.js  # Language grammars (lazy)
│   └── shiki-themes.*.js
├── sw.js                # Service worker
└── workbox-*.js         # Workbox runtime
```

## Key Design Decisions

1. **Static Generation (SSG)**: App is fully static, deployable anywhere
2. **Preact over React**: Smaller bundle (~3KB vs ~40KB)
3. **Signals over useState**: More efficient reactivity
4. **Lazy Shiki Loading**: Languages loaded on-demand
5. **IndexedDB Overlay**: Virtual file system for offline edits
6. **Service Worker Caching**: All assets cached for offline use
