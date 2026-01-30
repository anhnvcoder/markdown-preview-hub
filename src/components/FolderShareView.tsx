/**
 * FolderShareView component
 * Layout with sidebar tree navigation and markdown preview
 * Sidebar styling and resize copied from App.tsx
 */
import { useEffect, useRef, useState } from 'preact/hooks';
import type { FileContent, TreeNode } from '../lib/share';
import { tocWidth } from '../stores/theme-store';
import { CopyDropdown } from './CopyDropdown';
import { MarkdownPreview } from './MarkdownPreview';
import { SharedFileTree } from './SharedFileTree';

// Same constants as App.tsx
const DEFAULT_SIDEBAR_WIDTH = 256; // 16rem
const MIN_SIDEBAR_WIDTH = 180;
const MAX_SIDEBAR_WIDTH = 500;

// Read initial width from localStorage
const getInitialSidebarWidth = () => {
  if (typeof window !== 'undefined' && window.localStorage) {
    const saved = localStorage.getItem('md-preview-sidebar-width');
    if (saved) {
      const parsed = parseInt(saved, 10);
      if (!isNaN(parsed) && parsed >= MIN_SIDEBAR_WIDTH && parsed <= MAX_SIDEBAR_WIDTH) {
        return parsed;
      }
    }
  }
  return DEFAULT_SIDEBAR_WIDTH;
};

interface FolderShareViewProps {
  title: string;
  tree: TreeNode[];
  files: FileContent[];
  activePath: string;
  activeContent: string;
  createdAt: number;
  expiryDays: number;
}

export function FolderShareView({
  title,
  tree,
  files,
  activePath: initialActivePath,
  activeContent: initialActiveContent,
  createdAt,
  expiryDays,
}: FolderShareViewProps) {
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [isTocOpen, setIsTocOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(getInitialSidebarWidth);
  const [activePath, setActivePath] = useState(initialActivePath);
  const [activeContent, setActiveContent] = useState(initialActiveContent);

  // Resize state
  const isResizingRef = useRef(false);
  const resizeHandleRef = useRef<HTMLDivElement>(null);

  // Initialize theme
  useEffect(() => {
    const savedTheme = localStorage.getItem('md-preview-theme');
    if (savedTheme === 'dark' || savedTheme === 'light') {
      setTheme(savedTheme);
      document.documentElement.className = savedTheme;
    } else if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
      setTheme('dark');
      document.documentElement.className = 'dark';
    }
  }, []);

  // Sidebar resize handlers - copied from App.tsx
  const handleResizeStart = (e: Event) => {
    e.preventDefault();
    isResizingRef.current = true;
    resizeHandleRef.current?.classList.add('resizing');
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  };

  useEffect(() => {
    const handleResizeMove = (e: MouseEvent) => {
      if (!isResizingRef.current) return;
      const newWidth = Math.min(
        MAX_SIDEBAR_WIDTH,
        Math.max(MIN_SIDEBAR_WIDTH, e.clientX),
      );
      setSidebarWidth(newWidth);
    };

    const handleResizeEnd = () => {
      if (!isResizingRef.current) return;
      isResizingRef.current = false;
      resizeHandleRef.current?.classList.remove('resizing');
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      // Persist to localStorage
      localStorage.setItem('md-preview-sidebar-width', String(sidebarWidth));
    };

    document.addEventListener('mousemove', handleResizeMove);
    document.addEventListener('mouseup', handleResizeEnd);
    return () => {
      document.removeEventListener('mousemove', handleResizeMove);
      document.removeEventListener('mouseup', handleResizeEnd);
    };
  }, [sidebarWidth]);

  const handleThemeToggle = () => {
    const newTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
    document.documentElement.className = newTheme;
    localStorage.setItem('md-preview-theme', newTheme);
  };

  const handleFileSelect = (path: string) => {
    const file = files.find((f) => f.path === path);
    if (file) {
      setActivePath(path);
      setActiveContent(file.content);
      const url = new URL(window.location.href);
      url.searchParams.set('file', path);
      window.history.pushState({}, '', url.toString());
    }
  };

  // Handle internal .md link click - find and show the file
  const handleInternalLinkClick = (filePath: string) => {
    // Try exact match first
    let file = files.find((f) => f.path === filePath);

    // If not found, try matching by filename only (for relative links)
    if (!file) {
      const fileName = filePath.split('/').pop();
      file = files.find((f) => f.path.endsWith('/' + fileName) || f.path === fileName);
    }

    if (file) {
      setActivePath(file.path);
      setActiveContent(file.content);
      const url = new URL(window.location.href);
      url.searchParams.set('file', file.path);
      window.history.pushState({}, '', url.toString());
    }
  };

  const createdDate = new Date(createdAt).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });

  const activeFileName = activePath.split('/').pop() || title;

  return (
    <div class="h-screen flex flex-col overflow-hidden">
      {/* Header */}
      <header class="shrink-0 z-40 bg-background/95 backdrop-blur border-b border-border px-4 py-3">
        <div class="flex items-center justify-between gap-4">
          <div class="flex items-center gap-3 min-w-0">
            <a
              href="/"
              class="flex items-center gap-2 shrink-0"
              title="Go to MD Preview Hub"
            >
              <div class="w-8 h-8 rounded-lg bg-gradient-to-br from-primary via-accent to-info flex items-center justify-center">
                <span class="text-white font-bold text-sm">MD</span>
              </div>
            </a>
            <div class="min-w-0">
              <h1 class="font-semibold truncate">{title}</h1>
              <p class="text-xs text-muted-foreground">
                Shared on {createdDate} • {activeFileName}
              </p>
            </div>
          </div>

          <div class="flex items-center gap-2">
            {/* TOC toggle */}
            <button
              class="btn-icon toc-header-btn"
              onClick={() => setIsTocOpen(!isTocOpen)}
              aria-label="Toggle table of contents"
              title="Table of contents"
            >
              <div class="i-lucide-list w-4 h-4" />
            </button>

            {/* Theme toggle */}
            <button
              class="btn-icon"
              onClick={handleThemeToggle}
              aria-label="Toggle theme"
            >
              <div class="i-lucide-sun w-4 h-4 dark:hidden" />
              <div class="i-lucide-moon w-4 h-4 hidden dark:block" />
            </button>

            {/* Copy dropdown */}
            <CopyDropdown content={activeContent} filename={activeFileName} />

            {/* Copy link */}
            <button
              class="btn-ghost text-xs gap-1"
              onClick={() => {
                navigator.clipboard.writeText(window.location.href);
              }}
              title="Copy share link"
            >
              <div class="i-lucide-link w-4 h-4" />
              <span class="hidden sm:inline">Copy link</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main content with sidebar - same structure as App.tsx */}
      <div class="flex-1 flex overflow-hidden min-h-0">
        {/* Sidebar container */}
        <div
          class={isSidebarCollapsed ? 'sidebar-container sidebar-collapsed' : 'sidebar-container'}
          style={{ width: isSidebarCollapsed ? 0 : `${sidebarWidth}px` }}
        >
          {/* Sidebar - uses app-sidebar class for exact styling */}
          <aside class="app-sidebar">
            {/* Header */}
            <div class="p-3 border-b border-border/50 flex items-center justify-between">
              <div class="flex items-center gap-2">
                <button
                  class="btn-icon p-1"
                  onClick={() => setIsSidebarCollapsed(true)}
                  aria-label="Collapse sidebar"
                  title="Collapse sidebar"
                >
                  <div class="i-lucide-panel-left-close w-4 h-4" />
                </button>
                <h2 class="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                  Files
                </h2>
              </div>
            </div>

            {/* File tree - overflow-y-auto for independent scroll */}
            <div class="flex-1 overflow-y-auto p-2">
              <SharedFileTree
                tree={tree}
                activePath={activePath}
                onFileSelect={handleFileSelect}
              />
            </div>
          </aside>

          {/* Resize handle */}
          {!isSidebarCollapsed && (
            <div
              ref={resizeHandleRef}
              class="sidebar-resize-handle"
              onMouseDown={handleResizeStart}
            />
          )}
        </div>

        {/* Collapsed sidebar button - aligned to top */}
        {isSidebarCollapsed && (
          <button
            class="btn-icon m-2 shrink-0 self-start"
            onClick={() => setIsSidebarCollapsed(false)}
            aria-label="Expand sidebar"
            title="Expand sidebar"
          >
            <div class="i-lucide-panel-left w-4 h-4" />
          </button>
        )}

        {/* Content area - overflow-auto for independent scroll */}
        <main class="flex-1 overflow-y-auto min-w-0">
          {activePath ? (
            <div
              class="max-w-4xl mx-auto px-4 py-8 toc-content-shift"
              data-toc-open={isTocOpen}
              style={{ '--toc-width': `${tocWidth.value}px` } as any}
            >
              <MarkdownPreview
                content={activeContent}
                theme={theme}
                isTocOpen={isTocOpen}
                onTocOpenChange={setIsTocOpen}
                currentFilePath={activePath}
                onInternalLinkClick={handleInternalLinkClick}
              />
            </div>
          ) : (
            <div class="flex flex-col items-center justify-center h-full text-muted-foreground gap-4 p-8">
              <div class="i-lucide-file-text w-16 h-16 opacity-50" />
              <p class="text-lg">Select a file from the sidebar</p>
            </div>
          )}
        </main>
      </div>

      {/* Footer */}
      <footer class="border-t border-border py-4 px-4">
        <div class="max-w-4xl mx-auto flex items-center justify-between text-xs text-muted-foreground">
          <span>
            This share expires in {expiryDays}{' '}
            {expiryDays === 1 ? 'day' : 'days'}
          </span>
          <a href="/" class="hover:text-foreground">
            Create your own at MD Preview Hub
          </a>
        </div>
      </footer>
    </div>
  );
}
