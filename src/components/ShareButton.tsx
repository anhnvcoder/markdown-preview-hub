/**
 * ShareButton component
 * Button that opens share modal and handles sharing flow
 */
import { signal } from '@preact/signals';
import { useEffect, useState } from 'preact/hooks';
import { getSettings } from '../lib/database';
import { hasLocalImages, shareContent } from '../lib/share';
import { activeFile, activeFileContent } from '../stores/file-store';

// Modal state
export const isShareModalOpen = signal(false);

export function ShareButton() {
  const file = activeFile.value;
  const content = activeFileContent.value;
  const hasFile = !!file && !!content;

  const handleClick = () => {
    if (hasFile) {
      isShareModalOpen.value = true;
    }
  };

  return (
    <button
      class='btn-icon'
      onClick={handleClick}
      disabled={!hasFile}
      aria-label='Share'
      title={hasFile ? 'Share this file' : 'Open a file to share'}
    >
      <div class='i-lucide-share-2 w-4 h-4' />
    </button>
  );
}

export function ShareModal() {
  const [status, setStatus] = useState<
    'idle' | 'warning' | 'loading' | 'success' | 'error'
  >('idle');
  const [shareUrl, setShareUrl] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [copied, setCopied] = useState(false);
  const [expiryDays, setExpiryDays] = useState(7);

  const file = activeFile.value;
  const content = activeFileContent.value;

  // Load expiry setting when modal opens
  useEffect(() => {
    if (isShareModalOpen.value) {
      getSettings().then((settings) => {
        setExpiryDays(settings.shareExpiryDays || 7);
      });
    }
  }, [isShareModalOpen.value]);

  if (!isShareModalOpen.value) return null;

  const handleClose = () => {
    isShareModalOpen.value = false;
    setStatus('idle');
    setShareUrl('');
    setErrorMsg('');
    setCopied(false);
  };

  const handleShare = async () => {
    if (!file || !content) return;

    // Check for local images first
    if (status === 'idle' && hasLocalImages(content)) {
      setStatus('warning');
      return;
    }

    setStatus('loading');
    const result = await shareContent({
      title: file.virtualName,
      content,
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
      // Fallback for older browsers
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
      class='fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm'
      onClick={handleClose}
    >
      <div
        class='bg-card border border-border rounded-lg shadow-xl max-w-md w-full mx-4'
        onClick={(e) => e.stopPropagation()}
      >
        <div class='flex items-center justify-between p-4 border-b border-border'>
          <h2 class='font-semibold'>Share Document</h2>
          <button class='btn-icon' onClick={handleClose} aria-label='Close'>
            <div class='i-lucide-x w-4 h-4' />
          </button>
        </div>

        <div class='p-4'>
          {status === 'idle' && (
            <div class='space-y-4'>
              <p class='text-sm text-muted-foreground'>
                Create a public link to share "{file?.virtualName}" with anyone.
                The link will expire in {expiryDays}{' '}
                {expiryDays === 1 ? 'day' : 'days'}.
              </p>
              <button class='btn-primary w-full' onClick={handleShare}>
                <div class='i-lucide-link w-4 h-4' />
                Create Share Link
              </button>
            </div>
          )}

          {status === 'warning' && (
            <div class='space-y-4'>
              <div class='flex gap-3 p-3 bg-warning/10 border border-warning/20 rounded-lg'>
                <div class='i-lucide-alert-triangle w-5 h-5 text-warning shrink-0 mt-0.5' />
                <div class='text-sm'>
                  <p class='font-medium text-warning'>Local images detected</p>
                  <p class='text-muted-foreground mt-1'>
                    This document contains images stored on your device. These
                    images will not be visible to others viewing the shared
                    link. Consider using online image URLs instead.
                  </p>
                </div>
              </div>
              <div class='flex gap-2'>
                <button class='btn-ghost flex-1' onClick={handleClose}>
                  Cancel
                </button>
                <button class='btn-primary flex-1' onClick={handleShare}>
                  Share Anyway
                </button>
              </div>
            </div>
          )}

          {status === 'loading' && (
            <div class='flex flex-col items-center gap-3 py-6'>
              <div class='i-lucide-loader-2 w-8 h-8 animate-spin text-primary' />
              <p class='text-sm text-muted-foreground'>
                Creating share link...
              </p>
            </div>
          )}

          {status === 'success' && (
            <div class='space-y-4'>
              <div class='flex items-center gap-2 text-success'>
                <div class='i-lucide-check-circle w-5 h-5 shrink-0' />
                <p class='text-sm font-medium'>
                  Share link created successfully!
                </p>
              </div>

              <div class='space-y-2'>
                <label class='text-sm font-medium'>Share URL</label>
                <div class='flex gap-2'>
                  <input
                    type='text'
                    value={shareUrl}
                    readonly
                    class='input flex-1 text-sm font-mono'
                    onClick={(e) => (e.target as HTMLInputElement).select()}
                  />
                  <button
                    class={`btn-icon ${copied ? 'text-success' : ''}`}
                    onClick={handleCopy}
                    title='Copy to clipboard'
                  >
                    {copied ? (
                      <div class='i-lucide-check w-4 h-4' />
                    ) : (
                      <div class='i-lucide-copy w-4 h-4' />
                    )}
                  </button>
                </div>
              </div>

              <div class='flex gap-2'>
                <button class='btn-secondary flex-1' onClick={handleClose}>
                  Close
                </button>
                <a
                  href={shareUrl}
                  target='_blank'
                  rel='noopener noreferrer'
                  class='btn-primary flex-1 text-center'
                >
                  <div class='i-lucide-external-link w-4 h-4' />
                  Open Link
                </a>
              </div>
            </div>
          )}

          {status === 'error' && (
            <div class='space-y-4'>
              <div class='flex items-center gap-2 text-destructive'>
                <div class='i-lucide-x-circle w-5 h-5 shrink-0' />
                <div class='text-sm'>
                  <p class='font-medium'>Failed to create share</p>
                  <p class='text-muted-foreground mt-1'>{errorMsg}</p>
                </div>
              </div>
              <div class='flex gap-2'>
                <button class='btn-secondary flex-1' onClick={handleClose}>
                  Close
                </button>
                <button
                  class='btn-primary flex-1'
                  onClick={() => setStatus('idle')}
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
