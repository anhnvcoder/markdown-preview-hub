/**
 * ShareView component
 * Read-only view for shared markdown content
 */
import { useEffect, useState } from 'preact/hooks';
import { MarkdownPreview } from './MarkdownPreview';

interface ShareViewProps {
  title: string;
  content: string;
  createdAt: number;
  expiryDays: number;
}

export function ShareView({
  title,
  content,
  createdAt,
  expiryDays,
}: ShareViewProps) {
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [isTocOpen, setIsTocOpen] = useState(false);

  // Initialize theme from localStorage or system preference
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

  const handleThemeToggle = () => {
    const newTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
    document.documentElement.className = newTheme;
    localStorage.setItem('md-preview-theme', newTheme);
  };

  // Format creation date
  const createdDate = new Date(createdAt).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });

  return (
    <div class='min-h-screen flex flex-col'>
      {/* Header */}
      <header class='sticky top-0 z-40 bg-background/95 backdrop-blur border-b border-border px-4 py-3'>
        <div class='max-w-4xl mx-auto flex items-center justify-between gap-4'>
          <div class='flex items-center gap-3 min-w-0'>
            <a
              href='/'
              class='flex items-center gap-2 shrink-0'
              title='Go to MD Preview Hub'
            >
              <div class='w-8 h-8 rounded-lg bg-gradient-to-br from-primary via-accent to-info flex items-center justify-center'>
                <span class='text-white font-bold text-sm'>MD</span>
              </div>
            </a>
            <div class='min-w-0'>
              <h1 class='font-semibold truncate'>{title}</h1>
              <p class='text-xs text-muted-foreground'>
                Shared on {createdDate}
              </p>
            </div>
          </div>

          <div class='flex items-center gap-2'>
            {/* TOC toggle */}
            <button
              class='btn-icon'
              onClick={() => setIsTocOpen(!isTocOpen)}
              aria-label='Toggle table of contents'
              title='Table of contents'
            >
              <div class='i-lucide-list w-4 h-4' />
            </button>

            {/* Theme toggle */}
            <button
              class='btn-icon'
              onClick={handleThemeToggle}
              aria-label='Toggle theme'
            >
              <div class='i-lucide-sun w-4 h-4 dark:hidden' />
              <div class='i-lucide-moon w-4 h-4 hidden dark:block' />
            </button>

            {/* Copy link */}
            <button
              class='btn-ghost text-xs gap-1'
              onClick={() => {
                navigator.clipboard.writeText(window.location.href);
              }}
              title='Copy share link'
            >
              <div class='i-lucide-link w-4 h-4' />
              <span class='hidden sm:inline'>Copy link</span>
            </button>
          </div>
        </div>
      </header>

      {/* Content */}
      <main class='flex-1 overflow-auto'>
        <div class='max-w-4xl mx-auto px-4 py-8'>
          <MarkdownPreview
            content={content}
            theme={theme}
            isTocOpen={isTocOpen}
            onTocOpenChange={setIsTocOpen}
          />
        </div>
      </main>

      {/* Footer */}
      <footer class='border-t border-border py-4 px-4'>
        <div class='max-w-4xl mx-auto flex items-center justify-between text-xs text-muted-foreground'>
          <span>
            This share expires in {expiryDays}{' '}
            {expiryDays === 1 ? 'day' : 'days'}
          </span>
          <a href='/' class='hover:text-foreground'>
            Create your own at MD Preview Hub
          </a>
        </div>
      </footer>
    </div>
  );
}
