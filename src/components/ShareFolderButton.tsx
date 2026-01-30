/**
 * ShareFolderButton component
 * Button + modal for sharing folders
 * Modal rendered at App level via signal (like ShareModal)
 */
import { signal } from '@preact/signals';
import { useEffect, useState } from 'preact/hooks';
import { getSettings } from '../lib/database';
import {
  buildFolderTree,
  calculateFolderSize,
  collectMdFiles,
  shareFolderContent,
  type FileContent,
  type TreeNode,
} from '../lib/share';
import { getContent } from '../lib/virtual-fs';
import { files } from '../stores/file-store';

const MAX_SIZE_KB = 1024; // 1MB

// Signal for folder share modal state (like isShareModalOpen in ShareButton)
export const folderShareState = signal<{
  isOpen: boolean;
  folderId: string;
  folderPath: string;
  folderName: string;
} | null>(null);

// Helper to open folder share modal
export function openFolderShareModal(folderId: string, folderPath: string, folderName: string) {
  folderShareState.value = { isOpen: true, folderId, folderPath, folderName };
}

// Helper to close folder share modal
export function closeFolderShareModal() {
  folderShareState.value = null;
}

// Modal component - rendered at App level
export function ShareFolderModal() {
  const state = folderShareState.value;
  const [status, setStatus] = useState<
    'loading' | 'ready' | 'warning' | 'oversized' | 'sharing' | 'success' | 'error'
  >('loading');
  const [tree, setTree] = useState<TreeNode[]>([]);
  const [fileContents, setFileContents] = useState<FileContent[]>([]);
  const [hasBlobs, setHasBlobs] = useState(false);
  const [sizeKB, setSizeKB] = useState(0);
  const [fileCount, setFileCount] = useState(0);
  const [shareUrl, setShareUrl] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [copied, setCopied] = useState(false);
  const [expiryDays, setExpiryDays] = useState(7);

  // Reset state when modal opens
  useEffect(() => {
    if (state?.isOpen) {
      setStatus('loading');
      setTree([]);
      setFileContents([]);
      setHasBlobs(false);
      setSizeKB(0);
      setFileCount(0);
      setShareUrl('');
      setErrorMsg('');
      setCopied(false);
    }
  }, [state?.isOpen, state?.folderPath]);

  // Build tree and collect files when modal opens
  useEffect(() => {
    if (!state?.isOpen || !state.folderPath) return;

    const prepare = async () => {
      try {
        const settings = await getSettings();
        setExpiryDays(settings.shareExpiryDays || 7);

        const builtTree = buildFolderTree(files.value, state.folderPath);
        setTree(builtTree);

        const result = await collectMdFiles(files.value, state.folderPath, getContent);
        setFileContents(result.files);
        setHasBlobs(result.hasBlobs);
        setFileCount(result.files.length);

        const size = calculateFolderSize(result.files);
        const kb = Math.round(size / 1024);
        setSizeKB(kb);

        if (kb > MAX_SIZE_KB) {
          setStatus('oversized');
        } else if (result.hasBlobs) {
          setStatus('warning');
        } else {
          setStatus('ready');
        }
      } catch (err) {
        console.error('[ShareFolderModal] Prepare error:', err);
        const errMsg = err instanceof Error ? err.message : 'Failed to prepare folder';

        // Detect file system permission errors
        if (errMsg.includes('could not be found') ||
            errMsg.includes('NotFoundError') ||
            errMsg.includes('permission') ||
            errMsg.includes('NotAllowedError')) {
          setErrorMsg('File access lost after page refresh. Click any file in the sidebar to restore permission, then try sharing again.');
        } else {
          setErrorMsg(errMsg);
        }
        setStatus('error');
      }
    };

    prepare();
  }, [state?.isOpen, state?.folderPath]);

  if (!state?.isOpen) return null;

  const handleClose = () => {
    closeFolderShareModal();
  };

  const handleShare = async () => {
    setStatus('sharing');
    const result = await shareFolderContent({
      title: state.folderName,
      tree,
      files: fileContents,
      expiryDays,
    });

    if (result.success && result.shareUrl) {
      setShareUrl(result.shareUrl);
      setStatus('success');
    } else {
      setErrorMsg(result.error || 'Unknown error');
      setStatus('error');
    }
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      const input = document.createElement('input');
      input.value = shareUrl;
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      document.body.removeChild(input);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={handleClose}
    >
      <div
        class="bg-card border border-border rounded-lg shadow-xl max-w-md w-full mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div class="flex items-center justify-between p-4 border-b border-border">
          <h2 class="font-semibold">Share Folder</h2>
          <button class="btn-icon" onClick={handleClose} aria-label="Close">
            <div class="i-lucide-x w-4 h-4" />
          </button>
        </div>

        <div class="p-4">
          {status === 'loading' && (
            <div class="flex flex-col items-center gap-3 py-6">
              <div class="i-lucide-loader-2 w-8 h-8 animate-spin text-primary" />
              <p class="text-sm text-muted-foreground">Preparing folder...</p>
            </div>
          )}

          {status === 'ready' && (
            <div class="space-y-4">
              <p class="text-sm text-muted-foreground">
                Create a public link to share "{state.folderName}" with anyone.
                The link will expire in {expiryDays}{' '}
                {expiryDays === 1 ? 'day' : 'days'}.
              </p>
              <button class="btn-primary w-full" onClick={handleShare}>
                <div class="i-lucide-link w-4 h-4" />
                Create Share Link
              </button>
            </div>
          )}

          {status === 'warning' && (
            <div class="space-y-4">
              <div class="flex gap-3 p-3 bg-warning/10 border border-warning/20 rounded-lg">
                <div class="i-lucide-alert-triangle w-5 h-5 text-warning shrink-0 mt-0.5" />
                <div class="text-sm">
                  <p class="font-medium text-warning">Local images detected</p>
                  <p class="text-muted-foreground mt-1">
                    Some files contain images stored on your device. These images
                    will not be visible to others viewing the shared link.
                  </p>
                </div>
              </div>
              <div class="flex gap-2">
                <button class="btn-ghost flex-1" onClick={handleClose}>
                  Cancel
                </button>
                <button class="btn-primary flex-1" onClick={handleShare}>
                  Share Anyway
                </button>
              </div>
            </div>
          )}

          {status === 'oversized' && (
            <div class="space-y-4">
              <div class="flex items-center gap-2 text-destructive">
                <div class="i-lucide-x-circle w-5 h-5 shrink-0" />
                <div class="text-sm">
                  <p class="font-medium">Folder too large</p>
                  <p class="text-muted-foreground mt-1">
                    This folder contains {sizeKB}KB of content. Maximum allowed is{' '}
                    {MAX_SIZE_KB}KB.
                  </p>
                </div>
              </div>
              <button class="btn-secondary w-full" onClick={handleClose}>
                Close
              </button>
            </div>
          )}

          {status === 'sharing' && (
            <div class="flex flex-col items-center gap-3 py-6">
              <div class="i-lucide-loader-2 w-8 h-8 animate-spin text-primary" />
              <p class="text-sm text-muted-foreground">Creating share link...</p>
            </div>
          )}

          {status === 'success' && (
            <div class="space-y-4">
              <div class="flex items-center gap-2 text-success">
                <div class="i-lucide-check-circle w-5 h-5 shrink-0" />
                <p class="text-sm font-medium">Share link created successfully!</p>
              </div>

              <div class="space-y-2">
                <label class="text-sm font-medium">Share URL</label>
                <div class="flex gap-2">
                  <input
                    type="text"
                    value={shareUrl}
                    readonly
                    class="input flex-1 text-sm font-mono"
                    onClick={(e) => (e.target as HTMLInputElement).select()}
                  />
                  <button
                    class={`btn-icon ${copied ? 'text-success' : ''}`}
                    onClick={handleCopy}
                    title="Copy to clipboard"
                  >
                    {copied ? (
                      <div class="i-lucide-check w-4 h-4" />
                    ) : (
                      <div class="i-lucide-copy w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>

              <div class="flex gap-2">
                <button class="btn-secondary flex-1" onClick={handleClose}>
                  Close
                </button>
                <a
                  href={shareUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  class="btn-primary flex-1 text-center"
                >
                  <div class="i-lucide-external-link w-4 h-4" />
                  Open Link
                </a>
              </div>
            </div>
          )}

          {status === 'error' && (
            <div class="space-y-4">
              <div class="flex items-center gap-2 text-destructive">
                <div class="i-lucide-x-circle w-5 h-5 shrink-0" />
                <div class="text-sm">
                  <p class="font-medium">Failed to create share</p>
                  <p class="text-muted-foreground mt-1">{errorMsg}</p>
                </div>
              </div>
              <div class="flex gap-2">
                <button class="btn-secondary flex-1" onClick={handleClose}>
                  Close
                </button>
                <button
                  class="btn-primary flex-1"
                  onClick={() => setStatus('ready')}
                >
                  Try Again
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
