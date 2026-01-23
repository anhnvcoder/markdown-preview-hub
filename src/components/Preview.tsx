/**
 * Preview component
 * Markdown preview with breadcrumb navigation and edit mode
 */
import { useEffect, useState } from 'preact/hooks';
import { getDiskContent } from '../lib/virtual-fs';
import {
  activeFile,
  activeFileContent,
  activeFileId,
  currentProject,
  files,
  openFolder,
  openTab,
  permissionLost,
  updateFileInState,
} from '../stores/file-store';
import { currentTheme, tocWidth } from '../stores/theme-store';
import { sidebarCollapsed, viewMode } from './App';
import { CopyDropdown } from './CopyDropdown';
import { Editor } from './Editor';
import { EmptyState } from './EmptyState';
import { MarkdownPreview } from './MarkdownPreview';
import { ShareButton } from './ShareButton';

export function Preview() {
  const file = activeFile.value;
  const content = activeFileContent.value;
  const project = currentProject.value;
  const fileId = activeFileId.value;
  const mode = viewMode.value;
  const isCollapsed = sidebarCollapsed.value;
  const hasPermissionLost = permissionLost.value;
  const [isTocOpen, setIsTocOpen] = useState(false);
  const currentTocWidth = tocWidth.value;

  // Parse breadcrumb from file path
  const breadcrumbs = file ? file.path.split('/') : [];

  // Check if content differs from disk when switching from edit to preview
  useEffect(() => {
    if (mode === 'preview' && file && fileId && !file.isWebOnly) {
      // When switching to preview mode, check if content is different from disk
      (async () => {
        try {
          const diskContent = await getDiskContent(fileId);

          // If null, permission is lost - skip status update (user needs to reconnect)
          if (diskContent === null) {
            console.warn(
              '[Preview] Permission lost - cannot compare with disk',
            );
            return;
          }

          const currentContent = activeFileContent.value;

          if (diskContent !== currentContent) {
            // Content is different from disk - mark as modified
            updateFileInState(fileId, { status: 'modified' });
          } else {
            // Content matches disk - mark as synced
            updateFileInState(fileId, { status: 'synced' });
          }
        } catch (err) {
          console.error('[Preview] Error checking disk content:', err);
        }
      })();
    }
  }, [mode, fileId]);

  // Close TOC when switching to edit mode
  useEffect(() => {
    if (mode === 'edit') {
      setIsTocOpen(false);
    }
  }, [mode]);

  const handleExpandSidebar = () => {
    sidebarCollapsed.value = false;
  };

  // Handle internal .md link click - open file in new tab
  const handleInternalLinkClick = (filePath: string) => {
    const targetFile = files.value.find(
      (f) => f.path === filePath && f.type === 'file',
    );
    if (targetFile) {
      openTab(targetFile.id);
    } else {
      console.warn('[Preview] Internal link target not found:', filePath);
    }
  };

  // Show welcome screen when no project OR when all files are deleted
  if (!project || files.value.length === 0) {
    return (
      <main class='app-main bg-background'>
        <EmptyState />
      </main>
    );
  }

  if (!file || !fileId) {
    return (
      <main class='app-main bg-background'>
        <div class='flex-1 flex flex-col items-center justify-center text-muted-foreground gap-4'>
          <div class='i-lucide-file-text w-16 h-16 opacity-30' />
          <div class='text-center'>
            <p class='text-lg font-medium mb-2'>No file selected</p>
            <p class='text-sm'>Select a file from the sidebar to preview</p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main class='app-main bg-background'>
      <div class='flex-1 flex flex-col overflow-hidden'>
        {/* Breadcrumb bar */}
        <div class='h-12 border-b border-border/50 bg-card/50 flex items-center justify-between px-4 flex-shrink-0'>
          <div class='flex items-center gap-2 text-sm'>
            {/* Expand sidebar button when collapsed */}
            {isCollapsed && (
              <button
                class='btn-icon p-1 mr-2'
                onClick={handleExpandSidebar}
                aria-label='Expand sidebar'
                title='Expand sidebar'
              >
                <div class='i-lucide-panel-left-open w-4 h-4' />
              </button>
            )}
            {breadcrumbs.map((part, i) => (
              <span key={i} class='flex items-center gap-2'>
                {i > 0 && <span class='text-muted-foreground'>/</span>}
                <span
                  class={
                    i === breadcrumbs.length - 1
                      ? 'text-foreground font-medium'
                      : 'text-muted-foreground'
                  }
                >
                  {part}
                </span>
                {/* Show pencil icon next to filename when in edit mode */}
                {i === breadcrumbs.length - 1 && mode === 'edit' && (
                  <div
                    class='i-lucide-pencil w-3 h-3 text-warning'
                    title='Editing'
                  />
                )}
              </span>
            ))}
          </div>

          <div class='flex items-center gap-1'>
            <button
              class={
                mode === 'preview'
                  ? 'bg-[var(--sidebar-accent)] text-foreground px-3 py-1.5 rounded-md text-xs flex items-center gap-1.5 transition-colors'
                  : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground px-3 py-1.5 rounded-md text-xs flex items-center gap-1.5 transition-colors'
              }
              onClick={() => {
                viewMode.value = 'preview';
              }}
            >
              <div class='i-lucide-eye w-3.5 h-3.5' />
              Preview
            </button>
            <button
              class={
                mode === 'edit'
                  ? 'bg-[var(--sidebar-accent)] text-foreground px-3 py-1.5 rounded-md text-xs flex items-center gap-1.5 transition-colors'
                  : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground px-3 py-1.5 rounded-md text-xs flex items-center gap-1.5 transition-colors'
              }
              onClick={() => {
                viewMode.value = 'edit';
              }}
            >
              <div class='i-lucide-pencil w-3.5 h-3.5' />
              Edit
            </button>

            {/* Separator */}
            {mode === 'preview' && (
              <div class='w-px h-4 bg-border mx-1 hidden lg:block' />
            )}

            {/* TOC toggle button */}
            {mode === 'preview' && (
              <button
                class={`btn-icon p-1.5 hidden lg:flex ${
                  isTocOpen ? 'bg-[var(--sidebar-accent)] text-foreground' : ''
                }`}
                onClick={() => setIsTocOpen(!isTocOpen)}
                aria-label={isTocOpen ? 'Hide outline' : 'Show outline'}
                title={isTocOpen ? 'Hide outline' : 'Show outline'}
              >
                <div class='i-lucide-list w-4 h-4' />
              </button>
            )}
            {mode === 'preview' && (
              <CopyDropdown content={content} filename={file.virtualName} />
            )}
            <ShareButton />
          </div>
        </div>

        {/* Permission lost banner */}
        {hasPermissionLost && (
          <div class='px-4 py-2 bg-warning/10 border-b border-warning/30 flex items-center gap-3'>
            <div class='i-lucide-alert-triangle w-4 h-4 text-warning shrink-0' />
            <p class='text-sm text-foreground flex-1'>
              Permission lost. File content may be outdated.
            </p>
            <button
              class='px-3 py-1 text-xs font-medium bg-warning/20 hover:bg-warning/30 text-foreground rounded-md transition-colors'
              onClick={() => openFolder()}
            >
              Reconnect Folder
            </button>
          </div>
        )}

        {/* Content */}
        {mode === 'preview' ? (
          <div
            class='flex-1 overflow-y-auto px-4 py-4 transition-all duration-200'
            style={{
              paddingRight: isTocOpen ? `${currentTocWidth + 32}px` : undefined,
            }}
          >
            <div class='border border-border rounded-lg p-6'>
              <MarkdownPreview
                content={content}
                theme={currentTheme.value}
                isTocOpen={isTocOpen}
                onTocOpenChange={setIsTocOpen}
                currentFilePath={file.path}
                onInternalLinkClick={handleInternalLinkClick}
              />
            </div>
          </div>
        ) : (
          <Editor fileId={fileId} initialContent={content} />
        )}
      </div>
    </main>
  );
}
