/**
 * TableOfContents component
 * Floating TOC panel with active section highlighting
 * Desktop: Fixed panel on right side
 * Mobile: FAB button + drawer from bottom
 */
import { useState, useEffect, useCallback } from 'preact/hooks';
import type { RefObject } from 'preact';
import type { TocHeading } from '../lib/markdown';

interface TableOfContentsProps {
  headings: TocHeading[];
  containerRef: RefObject<HTMLDivElement>;
}

export function TableOfContents({ headings, containerRef }: TableOfContentsProps) {
  const [activeId, setActiveId] = useState<string>('');
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);

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
    <ul class="toc-list">
      {headings.map((heading) => (
        <li
          key={heading.id}
          class={`toc-item ${activeId === heading.id ? 'toc-active' : ''}`}
          style={{ paddingLeft: `${(heading.level - minLevel) * 12 + 12}px` }}
        >
          <button
            class="toc-link"
            onClick={() => handleClick(heading.id)}
          >
            {heading.text}
          </button>
        </li>
      ))}
    </ul>
  );

  return (
    <>
      {/* Desktop TOC - hidden on mobile */}
      <nav
        class={`toc-panel toc-desktop ${isCollapsed ? 'toc-collapsed' : ''}`}
        aria-label="Table of contents"
      >
        {/* Header - title left, icon right */}
        <div class="toc-header">
          <span class="toc-title">Contents</span>
          <button
            class="toc-toggle"
            onClick={() => setIsCollapsed(!isCollapsed)}
            aria-label={isCollapsed ? 'Expand TOC' : 'Collapse TOC'}
          >
            <div class={`i-lucide-chevron-${isCollapsed ? 'right' : 'down'} w-4 h-4`} />
          </button>
        </div>

        {/* TOC list */}
        {!isCollapsed && renderTocList()}
      </nav>

      {/* Mobile FAB - shown only on mobile */}
      <button
        class="toc-fab"
        onClick={() => setIsMobileOpen(true)}
        aria-label="Open table of contents"
      >
        <div class="i-lucide-list w-5 h-5" />
      </button>

      {/* Mobile Drawer */}
      {isMobileOpen && (
        <div class="toc-drawer-overlay" onClick={() => setIsMobileOpen(false)}>
          <nav
            class="toc-drawer"
            onClick={(e) => e.stopPropagation()}
            aria-label="Table of contents"
          >
            <div class="toc-drawer-header">
              <span class="toc-title">Contents</span>
              <button
                class="toc-toggle"
                onClick={() => setIsMobileOpen(false)}
                aria-label="Close"
              >
                <div class="i-lucide-x w-4 h-4" />
              </button>
            </div>
            {renderTocList()}
          </nav>
        </div>
      )}
    </>
  );
}
