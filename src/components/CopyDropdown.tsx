/**
 * CopyDropdown component
 * Dropdown with Copy (default), Download MD, Download PDF actions
 */
import { useEffect, useRef, useState } from 'preact/hooks';

interface CopyDropdownProps {
  content: string;
  filename: string;
  printTargetSelector?: string;
}

export function CopyDropdown({
  content,
  filename,
  printTargetSelector = '.markdown-body',
}: CopyDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  // Copy content to clipboard
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for older browsers
      const textarea = document.createElement('textarea');
      textarea.value = content;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
    setIsOpen(false);
  };

  // Download as .md file
  const handleDownloadMd = () => {
    const blob = new Blob([content], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    // Ensure filename has .md extension
    const name = filename.endsWith('.md') ? filename : `${filename}.md`;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setIsOpen(false);
  };

  const handleDownloadPdf = () => {
    const markdownEl = document.querySelector(printTargetSelector);
    if (!markdownEl) {
      console.warn(
        '[CopyDropdown] Print target not found:',
        printTargetSelector,
      );
      window.print();
      setIsOpen(false);
      return;
    }

    const printWindow = window.open('', '_blank', 'width=800,height=600');
    if (!printWindow) {
      window.print();
      setIsOpen(false);
      return;
    }

    const isDark = document.documentElement.classList.contains('dark');

    const printStyles = `
      @page { 
        size: auto;
        margin: 0;
      }
      * { margin: 0; padding: 0; box-sizing: border-box; }
      html, body {
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Noto Sans', Helvetica, Arial, sans-serif;
        line-height: 1.75;
        color: #1f2328;
        background: white;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
        color-adjust: exact !important;
      }
      body {
        padding: 20mm 15mm;
        max-width: 100%;
        margin: 0 auto;
      }
      
      /* Headings */
      h1 { font-size: 2.25rem; font-weight: 700; margin: 2rem 0 1.5rem; color: #1f2328; }
      h2 { font-size: 1.75rem; font-weight: 600; margin: 1.75rem 0 1rem; border-bottom: 1px solid #d0d7de; padding-bottom: 0.5rem; }
      h3 { font-size: 1.375rem; font-weight: 600; margin: 1.5rem 0 0.75rem; }
      h4, h5, h6 { font-size: 1.125rem; font-weight: 600; margin: 1.25rem 0 0.5rem; }
      
      /* Paragraphs */
      p { margin: 1rem 0; }
      
      /* Links */
      a { color: #0969da; text-decoration: underline; text-underline-offset: 2px; }
      
      /* Lists */
      ul, ol { margin: 1rem 0; padding-left: 2rem; }
      li { margin: 0.25rem 0; }
      ul { list-style-type: disc; }
      ol { list-style-type: decimal; }
      
      /* Blockquotes */
      blockquote { 
        margin: 1rem 0; 
        padding: 0.5rem 1rem; 
        border-left: 4px solid #0969da; 
        background: #f6f8fa !important; 
        border-radius: 0 0.5rem 0.5rem 0;
      }
      blockquote p { margin: 0.5rem 0; }
      
      /* Inline code - exact copy from markdown.css */
      code:not(.shiki code) { 
        padding: 0.2rem 0.4rem; 
        border-radius: 0.375rem; 
        font-size: 0.875em; 
        font-family: ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, 'Liberation Mono', monospace;
        background: #f6f8fa !important; 
        color: #1f2328; 
      }
      
      /* Code block wrapper */
      .code-block-wrapper {
        position: relative;
        display: flex;
        margin: 1rem 0;
        max-width: 100%;
        overflow: hidden;
        background: #f6f8fa !important;
        border-radius: 0.375rem;
      }
      .code-block-wrapper > pre {
        flex: 1;
        min-width: 0;
        max-width: 100%;
      }
      
      /* Shiki code blocks */
      .shiki {
        margin: 0 !important;
        padding: 0.5rem 1rem;
        overflow-x: auto;
        font-family: ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, 'Liberation Mono', monospace;
        font-size: 0.875rem;
        line-height: 1.45;
        border-radius: 0.375rem;
        background-color: #f6f8fa !important;
      }
      .shiki code {
        font-family: inherit;
        background: transparent !important;
        padding: 0;
      }
      
      /* Pre blocks */
      pre { 
        margin: 1rem 0; 
        padding: 0.5rem 1rem; 
        background: #f6f8fa !important; 
        border-radius: 0.375rem; 
        overflow-x: auto;
        font-family: ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, 'Liberation Mono', monospace;
        font-size: 0.875rem;
        line-height: 1.45;
      }
      pre code { 
        padding: 0; 
        background: transparent !important; 
        color: inherit; 
        font-size: inherit;
      }
      
      /* Tables */
      .table-wrapper {
        margin: 1rem 0;
        overflow-x: auto;
        border: 1px solid #d0d7de;
        border-radius: 0.5rem;
      }
      table { 
        width: max-content;
        min-width: 100%;
        margin: 0;
        border-collapse: collapse; 
        border: none;
        font-size: 0.875rem;
      }
      th, td { 
        padding: 0.5rem 0.75rem; 
        border: 1px solid #d0d7de; 
        text-align: left; 
        vertical-align: top;
      }
      th { 
        background: #f6f8fa !important; 
        font-weight: 600; 
        white-space: nowrap;
      }
      tr.section-header td {
        background: #f6f8fa !important;
        font-weight: 600;
      }
      
      /* Images */
      img { max-width: 100%; height: auto; border-radius: 0.5rem; margin: 1rem 0; }
      
      /* Horizontal rule */
      hr { margin: 2rem 0; border: none; border-top: 1px solid #d0d7de; }
      
      /* Strong and em */
      strong { font-weight: 600; }
      em { font-style: italic; }
      
      /* Mermaid */
      .mermaid-container { margin: 1rem 0; overflow-x: auto; }
      .mermaid-diagram { 
        display: flex; 
        justify-content: center; 
        padding: 1rem; 
        background: #f6f8fa !important; 
        border-radius: 0.5rem; 
      }
      .mermaid-diagram svg { max-width: 100%; height: auto; }
      
      /* Hide elements */
      .copy-btn, .mermaid-fallback { display: none !important; }
    `;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>${filename}</title>
        <style>${printStyles}</style>
      </head>
      <body>${markdownEl.innerHTML}</body>
      </html>
    `);

    printWindow.document.close();
    printWindow.focus();

    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 250);

    setIsOpen(false);
  };

  return (
    <div class='relative flex items-center gap-2' ref={dropdownRef}>
      {/* Copied indicator - shows beside button */}
      {copied && (
        <span class='flex items-center gap-1 text-xs text-success animate-fade-in'>
          <div class='i-lucide-check w-3.5 h-3.5' />
          Copied
        </span>
      )}

      {/* Split button group */}
      <div class='flex items-center'>
        <button
          class='flex items-center justify-center gap-1.5 px-2.5 py-1.5 text-xs rounded-l-md border border-border bg-muted/50 hover:bg-muted text-foreground transition-colors'
          onClick={handleCopy}
          title='Copy content'
        >
          <div class='i-lucide-copy w-3.5 h-3.5 flex-shrink-0' />
          <span class='leading-none'>Copy</span>
        </button>

        <button
          class={`flex items-center justify-center px-1.5 py-1.5 text-xs rounded-r-md border-t border-b border-r border-border transition-colors ${
            isOpen
              ? 'bg-muted text-foreground'
              : 'bg-muted/50 hover:bg-muted text-foreground'
          }`}
          onClick={() => setIsOpen(!isOpen)}
          aria-label='More options'
          aria-expanded={isOpen}
        >
          <div
            class={`i-lucide-chevron-down w-3.5 h-3.5 flex-shrink-0 transition-transform ${
              isOpen ? 'rotate-180' : ''
            }`}
          />
        </button>
      </div>

      {/* Dropdown menu */}
      {isOpen && (
        <div class='absolute right-0 top-full mt-1 min-w-[160px] bg-card border border-border rounded-md shadow-lg z-50 py-1'>
          <button
            class='w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-muted/50 transition-colors whitespace-nowrap'
            onClick={handleDownloadMd}
          >
            <div class='i-lucide-download w-4 h-4 shrink-0' />
            Download
          </button>
          <button
            class='w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-muted/50 transition-colors whitespace-nowrap'
            onClick={handleDownloadPdf}
          >
            <div class='i-lucide-file-text w-4 h-4 shrink-0' />
            Download as PDF
          </button>
        </div>
      )}
    </div>
  );
}
