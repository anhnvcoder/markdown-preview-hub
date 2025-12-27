/**
 * ConflictModal component
 * Shows conflict resolution options when file changed on both web and disk
 */
import {
  clearConflict,
  conflictDiskContent,
  conflictFile,
} from '../lib/polling';
import { resolveConflict } from '../lib/virtual-fs';
import { refreshFiles, selectFile } from '../stores/file-store';

export function ConflictModal() {
  const file = conflictFile.value;
  const diskContent = conflictDiskContent.value;

  if (!file) return null;

  const handleKeepWeb = async () => {
    await resolveConflict(file.id, 'keep-web');
    await refreshFiles();
    clearConflict();
  };

  const handleUseDisk = async () => {
    await resolveConflict(file.id, 'use-disk');
    await refreshFiles();
    await selectFile(file.id);
    clearConflict();
  };

  const handleClose = () => {
    clearConflict();
  };

  // Format relative time
  const formatTime = (timestamp: number) => {
    const diff = Date.now() - timestamp;
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins === 1) return '1 minute ago';
    return `${mins} minutes ago`;
  };

  return (
    <div class='fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm'>
      <div class='bg-card border border-border rounded-lg shadow-xl max-w-md w-full mx-4'>
        {/* Header */}
        <div class='flex items-center justify-between p-4 border-b border-border'>
          <div class='flex items-center gap-2 text-warning'>
            <div class='i-lucide-alert-triangle w-5 h-5' />
            <h2 class='font-semibold'>Conflict Detected</h2>
          </div>
          <button class='btn-icon' onClick={handleClose} aria-label='Close'>
            <div class='i-lucide-x w-4 h-4' />
          </button>
        </div>

        {/* Content */}
        <div class='p-4 space-y-4'>
          <p class='text-sm text-muted-foreground'>
            <strong class='text-foreground'>{file.virtualName}</strong> was
            modified both on web and on disk.
          </p>

          <div class='space-y-2 text-sm'>
            <div class='flex items-center gap-2'>
              <div class='i-lucide-cloud w-4 h-4 text-info' />
              <span class='text-muted-foreground'>Web version:</span>
              <span>Edited {formatTime(file.updatedAt)}</span>
            </div>
            <div class='flex items-center gap-2'>
              <div class='i-lucide-hard-drive w-4 h-4 text-accent' />
              <span class='text-muted-foreground'>Disk version:</span>
              <span>
                Modified{' '}
                {file.diskLastModified
                  ? formatTime(file.diskLastModified)
                  : 'unknown'}
              </span>
            </div>
          </div>

          {/* Preview snippets */}
          <div class='grid grid-cols-2 gap-2'>
            <div class='p-2 bg-muted rounded text-xs'>
              <div class='text-muted-foreground mb-1'>Web</div>
              <pre class='truncate' title={file.contentOverride?.slice(0, 200)}>
                {file.contentOverride?.slice(0, 100)}...
              </pre>
            </div>
            <div class='p-2 bg-muted rounded text-xs'>
              <div class='text-muted-foreground mb-1'>Disk</div>
              <pre class='truncate' title={diskContent.slice(0, 200)}>
                {diskContent.slice(0, 100)}...
              </pre>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div class='flex items-center justify-end gap-2 p-4 border-t border-border'>
          <button class='btn-secondary' onClick={handleUseDisk}>
            <div class='i-lucide-hard-drive w-4 h-4' />
            Use Disk
          </button>
          <button class='btn-primary' onClick={handleKeepWeb}>
            <div class='i-lucide-cloud w-4 h-4' />
            Keep Web
          </button>
        </div>
      </div>
    </div>
  );
}
