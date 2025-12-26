/**
 * UploadWarningModal component
 * Shows warning when upload will overwrite existing files
 */
import { signal } from '@preact/signals';
import type { VirtualFile } from '../types';

// Warning state signals
export const uploadWarning = signal<{
  type: 'file' | 'folder';
  targetPath: string;
  existingFiles: VirtualFile[];
  newFileCount: number;
  hasUnsaved: boolean;
  hasUnsynced: boolean;
} | null>(null);

// Promise resolver for user decision
let resolveWarning: ((proceed: boolean) => void) | null = null;

/**
 * Show upload warning and wait for user decision
 */
export function showUploadWarning(warning: {
  type: 'file' | 'folder';
  targetPath: string;
  existingFiles: VirtualFile[];
  newFileCount: number;
  hasUnsaved: boolean;
  hasUnsynced: boolean;
}): Promise<boolean> {
  return new Promise((resolve) => {
    uploadWarning.value = warning;
    resolveWarning = resolve;
  });
}

/**
 * Clear warning and resolve promise
 */
function handleDecision(proceed: boolean) {
  uploadWarning.value = null;
  resolveWarning?.(proceed);
  resolveWarning = null;
}

export function UploadWarningModal() {
  const warning = uploadWarning.value;

  if (!warning) return null;

  const handleCancel = () => {
    handleDecision(false);
  };

  const handleProceed = () => {
    handleDecision(true);
  };

  return (
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div class="bg-card border border-border rounded-lg shadow-xl max-w-md w-full mx-4">
        {/* Header */}
        <div class="flex items-center justify-between p-4 border-b border-border">
          <div class="flex items-center gap-2 text-warning">
            <div class="i-lucide-alert-triangle w-5 h-5" />
            <h2 class="font-semibold">Upload Warning</h2>
          </div>
          <button class="btn-icon" onClick={handleCancel} aria-label="Close">
            <div class="i-lucide-x w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div class="p-4 space-y-4">
          <p class="text-sm text-muted-foreground">
            Uploading {warning.type === 'folder' ? 'this folder' : 'these files'} to{' '}
            <strong class="text-foreground">{warning.targetPath || 'root'}</strong> may overwrite existing files.
          </p>

          <div class="space-y-2 text-sm">
            {warning.newFileCount > warning.existingFiles.length && (
              <div class="flex items-center gap-2">
                <div class="i-lucide-plus-circle w-4 h-4 text-info" />
                <span>{warning.newFileCount - warning.existingFiles.length} new file(s) will be added</span>
              </div>
            )}
            {warning.existingFiles.length > 0 && (
              <div class="flex items-center gap-2">
                <div class="i-lucide-replace w-4 h-4 text-warning" />
                <span>{warning.existingFiles.length} existing file(s) will be replaced</span>
              </div>
            )}
            {warning.hasUnsaved && (
              <div class="flex items-center gap-2 text-destructive">
                <div class="i-lucide-alert-circle w-4 h-4" />
                <span>Some files have unsaved changes that will be lost</span>
              </div>
            )}
            {warning.hasUnsynced && (
              <div class="flex items-center gap-2 text-warning">
                <div class="i-lucide-cloud-off w-4 h-4" />
                <span>Some files are not synced with local disk</span>
              </div>
            )}
          </div>

          {/* List affected files */}
          {warning.existingFiles.length > 0 && (
            <div class="max-h-32 overflow-y-auto bg-muted/30 rounded-md p-2">
              <div class="text-xs text-muted-foreground mb-1">Files to be replaced:</div>
              {warning.existingFiles.slice(0, 5).map((f) => (
                <div key={f.id} class="text-xs flex items-center gap-1 py-0.5">
                  <div class="i-lucide-file-text w-3 h-3" />
                  <span class="truncate">{f.virtualName}</span>
                  {f.isDirty && <span class="text-warning">(unsaved)</span>}
                </div>
              ))}
              {warning.existingFiles.length > 5 && (
                <div class="text-xs text-muted-foreground">
                  ...and {warning.existingFiles.length - 5} more
                </div>
              )}
            </div>
          )}
        </div>

        {/* Actions */}
        <div class="flex items-center justify-end gap-2 p-4 border-t border-border">
          <button class="btn-secondary" onClick={handleCancel}>
            Cancel
          </button>
          <button class="btn-primary" onClick={handleProceed}>
            <div class="i-lucide-upload w-4 h-4" />
            Proceed
          </button>
        </div>
      </div>
    </div>
  );
}
