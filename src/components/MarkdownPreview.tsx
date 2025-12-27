/**
 * MarkdownPreview component
 * Renders markdown content with Shiki highlighting and TOC
 */
import { useState, useEffect, useRef } from 'preact/hooks';
import { renderMarkdown, preloadHighlighter, type TocHeading } from '../lib/markdown';
import { TableOfContents } from './TableOfContents';

interface MarkdownPreviewProps {
  content: string;
  theme?: 'dark' | 'light';
  showToc?: boolean;
}

export function MarkdownPreview({ content, theme = 'dark', showToc = false }: MarkdownPreviewProps) {
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
        const result = await renderMarkdown(content, theme);
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
    return () => { cancelled = true; };
  }, [content, theme]);

  // Handle copy button clicks
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const copyIconSvg = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>';
    const checkIconSvg = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>';

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

  if (loading && !html) {
    return (
      <div class="flex items-center justify-center p-8">
        <div class="i-lucide-loader-2 w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div class="relative">
      {/* TOC floating panel */}
      {showToc && headings.length > 0 && (
        <TableOfContents headings={headings} containerRef={containerRef} />
      )}

      {/* Markdown content */}
      <div
        ref={containerRef}
        class="markdown-body"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </div>
  );
}
