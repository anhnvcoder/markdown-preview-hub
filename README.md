# MD Preview Hub

A modern, offline-first markdown preview application built with Astro, Preact, and the File System Access API.

**Live Demo:** [markdown-preview-hub.vercel.app](https://markdown-preview-hub.vercel.app)

## Features

- **Offline-First (PWA)** - Works without internet after first visit
- **File System Access** - Open local folders directly in browser
- **Live Preview** - Real-time markdown rendering with Shiki syntax highlighting
- **Table of Contents** - Floating TOC with active section tracking
- **Dark/Light Theme** - GitHub-style themes with system preference detection
- **Code Highlighting** - 100+ language support via Shiki
- **File Tabs** - Multi-file editing with tab management
- **Auto-Sync** - Automatic file change detection and sync
- **Mermaid Diagrams** - Render flowcharts, sequence diagrams, and more
- **Share Links** - Create public share links with configurable expiry (1-30 days)
- **Copy & Download** - Copy markdown to clipboard, download as .md or export as PDF
- **Quick Search** - Search files by name or content with folder filters
- **Help Guide** - Built-in user guide for new users

## Tech Stack

| Technology | Purpose |
|------------|---------|
| [Astro](https://astro.build) | Static site generation |
| [Preact](https://preactjs.com) | UI components (lightweight React alternative) |
| [Shiki](https://shiki.style) | Syntax highlighting |
| [markdown-it](https://github.com/markdown-it/markdown-it) | Markdown parsing |
| [UnoCSS](https://unocss.dev) | Atomic CSS engine |
| [idb](https://github.com/jakearchibald/idb) | IndexedDB wrapper |
| [@vite-pwa/astro](https://vite-pwa-org.netlify.app) | PWA integration |

## Getting Started

### Prerequisites

- Node.js 18+
- pnpm (recommended) or npm

### Installation

```bash
# Clone repository
git clone https://github.com/anhnvcoder/markdown-preview-hub.git

# Install dependencies
pnpm install

# Start development server
pnpm dev
```

### Commands

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start dev server at `localhost:4321` |
| `pnpm build` | Build for production to `./dist/` |
| `pnpm preview` | Preview production build locally |

## Project Structure

```
app/
├── public/              # Static assets (PWA icons)
├── src/
│   ├── components/      # Preact components
│   ├── lib/             # Core utilities
│   ├── stores/          # State management (signals)
│   ├── styles/          # CSS files
│   ├── types/           # TypeScript types
│   └── pages/           # Astro pages
├── docs/                # Technical documentation
└── astro.config.mjs     # Astro configuration
```

## Documentation

See [docs/](./docs/) for detailed technical documentation:

- [Architecture Overview](./docs/architecture.md)
- [File System & Sync](./docs/file-system.md)
- [Features Guide](./docs/features.md)
- [Share Feature](./docs/share-feature.md)

## Browser Support

Requires browsers with File System Access API support:
- Chrome/Edge 86+
- Opera 72+
- Safari 15.2+ (partial)

## License

MIT
