/**
 * MarkdownPreview component
 * Renders markdown content with Shiki highlighting and TOC
 */
import { useEffect, useRef, useState } from 'preact/hooks';
import {
  preloadHighlighter,
  renderMarkdown,
  type TocHeading,
} from '../lib/markdown';
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
        'a[data-internal-link]'
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
            '.mermaid-fallback'
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
          }
        }
      } catch (err) {
        console.error('[Mermaid] Import error:', err);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [html, theme]);

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
