/**
 * Keyboard shortcuts handler
 * Global shortcuts for common actions
 */
import { signal } from '@preact/signals';

// Modal states
export const isSearchOpen = signal(false);
export const isContentSearchOpen = signal(false);
export const isSettingsOpen = signal(false);

/**
 * Detect if user is on macOS
 */
export const isMac =
  typeof navigator !== 'undefined' &&
  /Mac|iPhone|iPad|iPod/.test(navigator.platform);

/**
 * Get modifier key symbol based on OS (⌘ for Mac, Ctrl for others)
 */
export const modKey = isMac ? '⌘' : 'Ctrl';

// Callback references
let toggleEditMode: (() => void) | null = null;
let saveToFile: (() => void) | null = null;
let openFolderCallback: (() => void) | null = null;
let closeTabCallback: (() => void) | null = null;

/**
 * Register keyboard shortcuts
 */
export function initKeyboardShortcuts(callbacks: {
  onToggleEdit?: () => void;
  onSave?: () => void;
  onOpenFolder?: () => void;
  onCloseTab?: () => void;
}): () => void {
  toggleEditMode = callbacks.onToggleEdit || null;
  saveToFile = callbacks.onSave || null;
  openFolderCallback = callbacks.onOpenFolder || null;
  closeTabCallback = callbacks.onCloseTab || null;

  const handler = (e: KeyboardEvent) => {
    const isMeta = e.metaKey || e.ctrlKey;

    // ⌘K - Open file search
    if (isMeta && e.key === 'k' && !e.shiftKey) {
      e.preventDefault();
      isContentSearchOpen.value = false;
      isSearchOpen.value = !isSearchOpen.value;
      return;
    }

    // ⌘⇧K - Open content search
    if (isMeta && e.key === 'k' && e.shiftKey) {
      e.preventDefault();
      isSearchOpen.value = false;
      isContentSearchOpen.value = !isContentSearchOpen.value;
      return;
    }

    // ⌘O - Open folder
    if (isMeta && e.key === 'o') {
      e.preventDefault();
      openFolderCallback?.();
      return;
    }

    // ⌘S - Save to disk
    if (isMeta && e.key === 's') {
      e.preventDefault();
      saveToFile?.();
      return;
    }

    // ⌘E - Toggle edit mode
    if (isMeta && e.key === 'e') {
      e.preventDefault();
      toggleEditMode?.();
      return;
    }

    // ⌘W - Close current tab
    if (isMeta && e.key === 'w') {
      e.preventDefault();
      closeTabCallback?.();
      return;
    }

    // Escape - Close modals
    if (e.key === 'Escape') {
      if (isSearchOpen.value) {
        isSearchOpen.value = false;
        return;
      }
      if (isContentSearchOpen.value) {
        isContentSearchOpen.value = false;
        return;
      }
      if (isSettingsOpen.value) {
        isSettingsOpen.value = false;
        return;
      }
    }
  };

  document.addEventListener('keydown', handler);
  return () => document.removeEventListener('keydown', handler);
}

/**
 * Toggle settings modal
 */
export function openSettings(): void {
  isSettingsOpen.value = true;
}

export function closeSettings(): void {
  isSettingsOpen.value = false;
}
