/**
 * EmptyState component
 * Welcome screen with recent projects and quick tips
 */
import { openHelp } from '../lib/keyboard';

interface RecentProject {
  name: string;
  path: string;
  lastOpened: string;
}

export function EmptyState() {
  // Mock recent projects for now
  const recentProjects: RecentProject[] = [
    {
      name: 'AI Documentation',
      path: '/Users/dev/projects/ai-docs',
      lastOpened: '2 hours ago',
    },
    {
      name: 'Meeting Notes',
      path: '/Users/dev/notes/meetings',
      lastOpened: 'Yesterday',
    },
    {
      name: 'Research Papers',
      path: '/Users/dev/research',
      lastOpened: '3 days ago',
    },
  ];

  return (
    <div class='flex-1 flex items-center justify-center p-8'>
      <div class='max-w-xl w-full space-y-8'>
        {/* Welcome Section */}
        <div class='text-center space-y-4'>
          <div class='w-20 h-20 mx-auto rounded-2xl bg-gradient-to-br from-primary via-accent to-info flex items-center justify-center'>
            <div class='i-lucide-file-text w-10 h-10 text-white' />
          </div>
          <div>
            <h2 class='text-2xl font-bold text-foreground mb-2'>
              Welcome to MD Preview Hub
            </h2>
            <p class='text-muted-foreground'>
              Your professional workspace for managing and previewing
              AI-generated Markdown files
            </p>
          </div>
        </div>

        {/* Instructions */}
        <div class='text-center text-sm text-muted-foreground pt-4'>
          <p>
            Open the sidebar menu (+) to start a new project or import files
          </p>
          <p class='mt-2'>
            <button
              class='inline-flex items-center gap-1.5 text-primary hover:underline'
              onClick={openHelp}
            >
              <div class='i-lucide-help-circle w-4 h-4' />
              New here? Click for a quick guide
            </button>
          </p>
        </div>

        {/* Quick Tips */}
        <div class='pt-4 border-t border-border/50'>
          <div class='grid grid-cols-2 gap-4 text-xs text-muted-foreground'>
            <div class='space-y-1'>
              <div class='font-semibold text-foreground'>
                Keyboard Shortcuts
              </div>
              <div class='space-y-0.5'>
                <div>
                  <kbd class='px-1.5 py-0.5 bg-muted rounded border border-border text-[10px]'>
                    ⌘K
                  </kbd>{' '}
                  Search files
                </div>
                <div>
                  <kbd class='px-1.5 py-0.5 bg-muted rounded border border-border text-[10px]'>
                    ⌘O
                  </kbd>{' '}
                  Open folder
                </div>
              </div>
            </div>
            <div class='space-y-1'>
              <div class='font-semibold text-foreground'>Features</div>
              <div class='space-y-0.5'>
                <div>Live markdown preview</div>
                <div>Auto-sync with disk</div>
                <div>Conflict resolution</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
