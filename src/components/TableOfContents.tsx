/**
 * TableOfContents component
 * Floating TOC panel with active section highlighting
 * Desktop: Fixed panel on right side (slides in/out)
 * Mobile: FAB button + drawer from bottom
 */
import type { RefObject } from 'preact';
import { useCallback, useEffect, useRef, useState } from 'preact/hooks';
import type { TocHeading } from '../lib/markdown';
import { MAX_TOC_WIDTH, MIN_TOC_WIDTH, tocWidth } from '../stores/theme-store';

interface TableOfContentsProps {
  headings: TocHeading[];
  containerRef: RefObject<HTMLDivElement>;
  isDesktopOpen?: boolean;
  onClose?: () => void;
}

export function TableOfContents({
  headings,
  containerRef,
  isDesktopOpen = false,
  onClose,
}: TableOfContentsProps) {
  const [activeId, setActiveId] = useState<string>('');
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const isResizingRef = useRef(false);
  const resizeHandleRef = useRef<HTMLDivElement>(null);
  const currentWidth = tocWidth.value;

  // Track active heading with IntersectionObserver
  useEffect(() => {
    const container = containerRef.current;
    if (!container || headings.length === 0) return;

    const headingElements = headings
      .map((h) => container.querySelector(`#${CSS.escape(h.id)}`))
      .filter(Boolean) as Element[];

    if (headingElements.length === 0) return;

    // Track visible headings to find topmost
    const visibleHeadings = new Set<string>();

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            visibleHeadings.add(entry.target.id);
          } else {
            visibleHeadings.delete(entry.target.id);
          }
        });

        // Find topmost visible heading (by DOM order)
        for (const h of headings) {
          if (visibleHeadings.has(h.id)) {
            setActiveId(h.id);
            break;
          }
        }
      },
      {
        rootMargin: '-60px 0px -70% 0px', // Trigger when heading is near top
        threshold: 0,
      }
    );

    headingElements.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [headings, containerRef]);

  // TOC resize handlers
  const handleResizeStart = useCallback((e: Event) => {
    e.preventDefault();
    isResizingRef.current = true;
    resizeHandleRef.current?.classList.add('resizing');
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }, []);

  // Add global mouse listeners for resize
  useEffect(() => {
    const handleResizeMove = (e: MouseEvent) => {
      if (!isResizingRef.current) return;
      // Calculate width from right edge of viewport
      const newWidth = Math.min(
        MAX_TOC_WIDTH,
        Math.max(MIN_TOC_WIDTH, window.innerWidth - e.clientX - 16)
      );
      tocWidth.value = newWidth;
    };

    const handleResizeEnd = () => {
      if (!isResizingRef.current) return;
      isResizingRef.current = false;
      resizeHandleRef.current?.classList.remove('resizing');
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      // Persist to localStorage
      localStorage.setItem('md-preview-toc-width', String(tocWidth.value));
    };

    document.addEventListener('mousemove', handleResizeMove);
    document.addEventListener('mouseup', handleResizeEnd);
    return () => {
      document.removeEventListener('mousemove', handleResizeMove);
      document.removeEventListener('mouseup', handleResizeEnd);
    };
  }, []);

  const handleClick = useCallback((id: string) => {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setActiveId(id);
      setIsMobileOpen(false);
    }
  }, []);

  // Calculate min level for proper indentation
  const minLevel = Math.min(...headings.map((h) => h.level));

  // Render TOC list (shared between desktop and mobile)
  const renderTocList = () => (
    <ul class='toc-list'>
      {headings.map((heading) => (
        <li
          key={heading.id}
          class={`toc-item ${activeId === heading.id ? 'toc-active' : ''}`}
          style={{ paddingLeft: `${(heading.level - minLevel) * 12 + 12}px` }}
        >
          <button
            class='toc-link'
            onClick={() => handleClick(heading.id)}
            title={heading.text}
          >
            {heading.text}
          </button>
        </li>
      ))}
    </ul>
  );

  return (
    <>
      {/* Desktop TOC */}
      {isDesktopOpen && (
        <nav
          class='toc-panel toc-desktop'
          aria-label='Table of contents'
          style={{ width: `${currentWidth}px` }}
        >
          {/* Resize handle - on left side */}
          <div
            ref={resizeHandleRef}
            class='toc-resize-handle'
            onMouseDown={handleResizeStart}
          />

          {/* Header with close button */}
          <div class='toc-header'>
            <span class='toc-title'>Outline</span>
            <button
              class='toc-toggle'
              onClick={onClose}
              aria-label='Close outline'
            >
              <div class='i-lucide-x w-4 h-4' />
            </button>
          </div>

          {/* TOC list */}
          {renderTocList()}
        </nav>
      )}

      {/* Mobile FAB - shown only on mobile */}
      <button
        class='toc-fab'
        onClick={() => setIsMobileOpen(true)}
        aria-label='Open table of contents'
      >
        <div class='i-lucide-list w-5 h-5' />
      </button>

      {/* Mobile Drawer */}
      {isMobileOpen && (
        <div class='toc-drawer-overlay' onClick={() => setIsMobileOpen(false)}>
          <nav
            class='toc-drawer'
            onClick={(e) => e.stopPropagation()}
            aria-label='Table of contents'
          >
            <div class='toc-drawer-header'>
              <span class='toc-title'>Outline</span>
              <button
                class='toc-toggle'
                onClick={() => setIsMobileOpen(false)}
                aria-label='Close'
              >
                <div class='i-lucide-x w-4 h-4' />
              </button>
            </div>
            {renderTocList()}
          </nav>
        </div>
      )}
    </>
  );
}
