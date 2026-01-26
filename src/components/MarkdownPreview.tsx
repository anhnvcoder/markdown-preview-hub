/**
 * MarkdownPreview component
 * Renders markdown content with Shiki highlighting and TOC
 */
import { useEffect, useRef, useState } from 'preact/hooks';
import { processImages, reloadImages } from '../lib/image-loader';
import {
  preloadHighlighter,
  renderMarkdown,
  type TocHeading,
} from '../lib/markdown';
import { currentProject } from '../stores/file-store';
import { TableOfContents } from './TableOfContents';

interface MarkdownPreviewProps {
  content: string;
  theme?: 'dark' | 'light';
  isTocOpen?: boolean;
  onTocOpenChange?: (open: boolean) => void;
  currentFilePath?: string;
  onInternalLinkClick?: (filePath: string) => void;
}

export function MarkdownPreview({
  content,
  theme = 'dark',
  isTocOpen = false,
  onTocOpenChange,
  currentFilePath,
  onInternalLinkClick,
}: MarkdownPreviewProps) {
  const [html, setHtml] = useState<string>('');
  const [headings, setHeadings] = useState<TocHeading[]>([]);
  const [loading, setLoading] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);

  // Preload highlighter on mount
  useEffect(() => {
    preloadHighlighter();
  }, []);

  // Render markdown when content changes
  useEffect(() => {
    let cancelled = false;

    async function render() {
      setLoading(true);
      try {
        const result = await renderMarkdown(content, theme, currentFilePath);
        if (!cancelled) {
          setHtml(result.html);
          setHeadings(result.headings);
          setLoading(false);
        }
      } catch (err) {
        console.error('Markdown render error:', err);
        if (!cancelled) {
          setHtml(`<p class="text-destructive">Error rendering markdown</p>`);
          setHeadings([]);
          setLoading(false);
        }
      }
    }

    render();
    return () => {
      cancelled = true;
    };
  }, [content, theme, currentFilePath]);

  // Handle copy button clicks
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const copyIconSvg =
      '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>';
    const checkIconSvg =
      '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>';

    const handleClick = (e: Event) => {
      const target = e.target as HTMLElement;
      const copyBtn = target.closest('.copy-btn') as HTMLButtonElement | null;

      if (copyBtn) {
        const code = copyBtn.dataset.code;
        if (code) {
          navigator.clipboard.writeText(code).then(() => {
            // Replace icon with check
            copyBtn.innerHTML = checkIconSvg;
            copyBtn.classList.add('copied');
            setTimeout(() => {
              copyBtn.innerHTML = copyIconSvg;
              copyBtn.classList.remove('copied');
            }, 2000);
          });
        }
      }
    };

    container.addEventListener('click', handleClick);
    return () => container.removeEventListener('click', handleClick);
  }, [html]);

  // Handle internal .md link clicks
  useEffect(() => {
    const container = containerRef.current;
    if (!container || !onInternalLinkClick) return;

    const handleLinkClick = (e: Event) => {
      const target = e.target as HTMLElement;
      const link = target.closest(
        'a[data-internal-link]',
      ) as HTMLAnchorElement | null;

      if (link) {
        e.preventDefault();
        const href = link.getAttribute('href');
        if (href) {
          // Remove leading slash for file lookup
          const filePath = href.startsWith('/') ? href.slice(1) : href;
          onInternalLinkClick(filePath);
        }
      }
    };

    container.addEventListener('click', handleLinkClick);
    return () => container.removeEventListener('click', handleLinkClick);
  }, [html, onInternalLinkClick]);

  // Handle anchor link clicks (scroll to heading)
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleAnchorClick = (e: Event) => {
      const target = e.target as HTMLElement;
      const link = target.closest('a') as HTMLAnchorElement | null;

      if (!link) return;

      const href = link.getAttribute('href');
      // Check if it's an anchor link (starts with #)
      if (href && href.startsWith('#')) {
        e.preventDefault();
        // Decode URL-encoded characters (Vietnamese, Japanese, etc.)
        const targetId = decodeURIComponent(href.slice(1));
        const targetElement = document.getElementById(targetId);
        if (targetElement) {
          targetElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }
    };

    container.addEventListener('click', handleAnchorClick);
    return () => container.removeEventListener('click', handleAnchorClick);
  }, [html]);

  // Render mermaid diagrams after HTML is rendered
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const mermaidContainers = container.querySelectorAll('.mermaid-container');
    if (mermaidContainers.length === 0) return;

    let cancelled = false;

    // Lazy import mermaid and render diagrams
    (async () => {
      try {
        const mermaid = (await import('mermaid')).default;

        // Initialize mermaid with theme and hand-drawn style
        mermaid.initialize({
          startOnLoad: false,
          theme: theme === 'dark' ? 'dark' : 'default',
          look: 'handDrawn',
          securityLevel: 'loose',
        });

        // Render each diagram
        for (let i = 0; i < mermaidContainers.length; i++) {
          if (cancelled) break;

          const el = mermaidContainers[i] as HTMLElement;
          const code = el.dataset.mermaid;
          const diagramEl = el.querySelector('.mermaid-diagram') as HTMLElement;
          const fallbackEl = el.querySelector(
            '.mermaid-fallback',
          ) as HTMLElement;

          if (!code || !diagramEl) continue;

          try {
            const id = `mermaid-${Date.now()}-${i}`;
            const { svg } = await mermaid.render(id, code);
            diagramEl.innerHTML = svg;
            diagramEl.style.display = 'block';
            if (fallbackEl) fallbackEl.style.display = 'none';
          } catch (err) {
            // On error, show fallback raw code
            console.warn('[Mermaid] Render error:', err);
            diagramEl.style.display = 'none';
            if (fallbackEl) fallbackEl.style.display = 'block';

            // Clean up mermaid error containers that get appended to body
            document
              .querySelectorAll('[id^="dmermaid-"], [id^="d"][id*="mermaid"]')
              .forEach((el) => {
                el.remove();
              });
          }
        }

        // Final cleanup: remove any stray mermaid error containers
        document
          .querySelectorAll('[id^="dmermaid-"], [id^="d"][id*="mermaid"]')
          .forEach((el) => {
            if (
              el.querySelector('.error-icon') ||
              el.textContent?.includes('Syntax error')
            ) {
              el.remove();
            }
          });
      } catch (err) {
        console.error('[Mermaid] Import error:', err);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [html, theme]);

  // Optimize tables: wrap in scroll container, smart column sizing, section headers
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const tables = container.querySelectorAll('table');
    if (tables.length === 0) return;

    tables.forEach((table) => {
      // Skip if already wrapped
      if (table.parentElement?.classList.contains('table-wrapper')) return;

      // Wrap table in scroll container
      const wrapper = document.createElement('div');
      wrapper.className = 'table-wrapper';
      table.parentNode?.insertBefore(wrapper, table);
      wrapper.appendChild(table);

      // Analyze columns and apply smart sizing
      const rows = table.querySelectorAll('tr');
      if (rows.length === 0) return;

      const headerCells = rows[0].querySelectorAll('th');
      const numCols = headerCells.length;
      if (numCols === 0) return;

      // Calculate max content length per column
      const colMaxLengths: number[] = new Array(numCols).fill(0);
      const colHasLongText: boolean[] = new Array(numCols).fill(false);

      rows.forEach((row) => {
        const cells = row.querySelectorAll('td, th');
        cells.forEach((cell, idx) => {
          if (idx >= numCols) return;
          const text = cell.textContent || '';
          colMaxLengths[idx] = Math.max(colMaxLengths[idx], text.length);
          // Check for long text (likely description columns)
          if (text.length > 50) colHasLongText[idx] = true;
        });
      });

      // Apply column classes based on content analysis
      rows.forEach((row, rowIdx) => {
        const cells = row.querySelectorAll('td');

        // Detect section header rows: first cell is bold/strong and other cells are mostly empty
        if (cells.length > 0) {
          const firstCell = cells[0];
          const firstCellText = firstCell.textContent?.trim() || '';
          const hasStrong = firstCell.querySelector('strong') !== null;
          const startsWithBold = firstCellText.startsWith('**') || hasStrong;
          const otherCellsEmpty = Array.from(cells)
            .slice(1)
            .every(
              (c) => !c.textContent?.trim() || c.textContent?.trim() === '-',
            );

          if (
            (startsWithBold || /^\d+\.\s/.test(firstCellText)) &&
            otherCellsEmpty &&
            firstCellText.length > 3
          ) {
            row.classList.add('section-header');
          }
        }

        // Apply column sizing classes
        cells.forEach((cell, idx) => {
          if (idx >= numCols) return;

          if (colMaxLengths[idx] <= 10) {
            cell.classList.add('col-compact');
          } else if (colHasLongText[idx] || colMaxLengths[idx] > 80) {
            cell.classList.add('col-wide');
          } else if (colMaxLengths[idx] > 30) {
            cell.classList.add('col-medium');
          }
        });
      });
    });
  }, [html]);

  // Load local images from filesystem
  useEffect(() => {
    const container = containerRef.current;
    if (!container || !currentFilePath) return;

    // Process images after HTML is rendered
    processImages(container, currentFilePath).catch((err) => {
      console.warn('[MarkdownPreview] Error processing images:', err);
    });
  }, [html, currentFilePath]);

  // Reload images when folder is reconnected (dirHandle restored)
  useEffect(() => {
    const container = containerRef.current;
    const project = currentProject.value;
    if (!container || !currentFilePath || !project?.dirHandle) return;

    // Reload images that may have become stale
    reloadImages(container, currentFilePath).catch((err) => {
      console.warn('[MarkdownPreview] Error reloading images:', err);
    });
  }, [currentProject.value?.dirHandle, currentFilePath]);

  if (loading && !html) {
    return (
      <div class='flex items-center justify-center p-8'>
        <div class='i-lucide-loader-2 w-6 h-6 animate-spin text-muted-foreground' />
      </div>
    );
  }

  return (
    <div class='relative'>
      {/* TOC - always render when headings exist */}
      {headings.length > 0 && (
        <TableOfContents
          headings={headings}
          containerRef={containerRef}
          isDesktopOpen={isTocOpen}
          onClose={() => onTocOpenChange?.(false)}
        />
      )}

      {/* Markdown content */}
      <div
        ref={containerRef}
        class='markdown-body'
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </div>
  );
}
