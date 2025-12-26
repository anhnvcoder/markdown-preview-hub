/**
 * File polling system for sync
 * - Active file polling: 30s default (configurable)
 * - No inactive file polling (sync on-demand when clicked)
 * - Directory scan: 60s to detect new files
 * - Focus sync: sync when tab regains focus
 */
import { signal } from '@preact/signals';
import type { VirtualFile, Project } from '../types';
import {
  getFile,
  updateFile,
  getAllFiles,
  saveFiles,
  getSettings,
} from './database';
import { readFileContent, getFileMetadata, scanDirectory, hasFilePermission, verifyPermission } from './file-system';

// Default polling interval (30s for active file)
const DEFAULT_ACTIVE_INTERVAL = 30000;
// Directory scan interval (60s)
const DIR_SCAN_INTERVAL = 60000;

// Conflict state for modal
export const conflictFile = signal<VirtualFile | null>(null);
export const conflictDiskContent = signal<string>('');

// Sync state signals
export const isSyncing = signal<boolean>(false);
export const lastSyncTime = signal<number>(0);

// Poller state
let activeFileId: string | null = null;
let activeTimer: number | null = null;
let dirScanTimer: number | null = null;
let isPolling = false;
let currentInterval = DEFAULT_ACTIVE_INTERVAL;

// Project reference (set from outside to avoid circular import)
let currentProjectRef: Project | null = null;

// Callbacks
let onFileChanged: ((fileId: string) => void) | null = null;
let onConflictDetected:
  | ((file: VirtualFile, diskContent: string) => void)
  | null = null;
let onFolderUpdated: (() => void) | null = null;
let onRefreshFiles: (() => Promise<void>) | null = null;

/**
 * Set project reference (call from App.tsx to avoid circular import)
 */
export function setProjectRef(project: Project | null): void {
  currentProjectRef = project;
}

/**
 * Start polling for file changes
 */
export async function startPolling(callbacks: {
  onFileChanged?: (fileId: string) => void;
  onConflictDetected?: (file: VirtualFile, diskContent: string) => void;
  onFolderUpdated?: () => void;
  onRefreshFiles?: () => Promise<void>;
}): Promise<void> {
  if (isPolling) return;

  onFileChanged = callbacks.onFileChanged || null;
  onConflictDetected = callbacks.onConflictDetected || null;
  onFolderUpdated = callbacks.onFolderUpdated || null;
  onRefreshFiles = callbacks.onRefreshFiles || null;
  isPolling = true;

  // Load interval from settings
  const settings = await getSettings();
  currentInterval = settings.pollingActiveInterval || DEFAULT_ACTIVE_INTERVAL;

  // Poll active file at configured interval
  activeTimer = window.setInterval(pollActiveFile, currentInterval);

  // Directory scan every 60s to detect new files
  dirScanTimer = window.setInterval(pollForNewFiles, DIR_SCAN_INTERVAL);

  // Add focus listener for sync on tab focus
  window.addEventListener('focus', handleWindowFocus);

  console.log(
    `[Poller] Started - active file: ${currentInterval}ms, dir scan: ${DIR_SCAN_INTERVAL}ms`
  );
}

/**
 * Stop polling
 */
export function stopPolling(): void {
  if (activeTimer) {
    clearInterval(activeTimer);
    activeTimer = null;
  }
  if (dirScanTimer) {
    clearInterval(dirScanTimer);
    dirScanTimer = null;
  }
  window.removeEventListener('focus', handleWindowFocus);
  isPolling = false;
  console.log('[Poller] Stopped');
}

/**
 * Set the currently active file (polled at interval)
 */
export function setActiveFile(fileId: string | null): void {
  activeFileId = fileId;
}

/**
 * Update polling interval (called when settings change)
 */
export async function updatePollingInterval(intervalMs: number): Promise<void> {
  currentInterval = intervalMs;
  if (activeTimer) {
    clearInterval(activeTimer);
    activeTimer = window.setInterval(pollActiveFile, currentInterval);
    console.log(`[Poller] Updated interval to ${currentInterval}ms`);
  }
}

/**
 * Handle window focus - sync active file and scan for new files
 */
async function handleWindowFocus(): Promise<void> {
  console.log('[Poller] Window focused - syncing...');
  await pollForNewFiles();
  if (activeFileId) {
    await syncFileOnDemand(activeFileId);
  }
}

/**
 * Poll the active file for changes
 */
async function pollActiveFile(): Promise<void> {
  if (!activeFileId || !isPolling) return;

  const file = await getFile(activeFileId);
  if (!file) return;

  await checkFileChange(file);
}

/**
 * Sync a specific file on-demand (called when file is clicked/opened)
 */
export async function syncFileOnDemand(fileId: string): Promise<void> {
  isSyncing.value = true;
  try {
    const file = await getFile(fileId);
    if (!file) return;

    await checkFileChange(file);
    lastSyncTime.value = Date.now();
  } finally {
    isSyncing.value = false;
  }
}

/**
 * Manual refresh - sync active file and scan directory
 * @param force - if true, skip unsaved changes warning
 */
export async function manualRefresh(force: boolean = false): Promise<void> {
  isSyncing.value = true;
  try {
    console.log('[Poller] Manual refresh triggered');
    await pollForNewFiles();
    if (activeFileId) {
      await syncFileOnDemand(activeFileId);
    }
    lastSyncTime.value = Date.now();
  } finally {
    isSyncing.value = false;
  }
}

/**
 * Poll for new files in directory (lightweight - only scans metadata)
 */
async function pollForNewFiles(): Promise<void> {
  if (!currentProjectRef?.dirHandle) return;

  // Check directory permission first (query only, no prompt)
  try {
    // @ts-ignore
    const permission = await currentProjectRef.dirHandle.queryPermission({ mode: 'read' });
    if (permission !== 'granted') {
      // Permission lost - skip scanning silently
      return;
    }
  } catch {
    return;
  }

  console.log('[Poller] Scanning for new files...');
  isSyncing.value = true;

  try {
    // Scan directory for current files on disk
    const scanned = await scanDirectory(
      currentProjectRef.dirHandle,
      currentProjectRef.id
    );
    const rootName = currentProjectRef.dirHandle.name;

    // Prepend root name just like openFolder does
    const currentFilesOnDisk = scanned.map((f) => {
      const prependedPath = `${rootName}/${f.path}`.replace(/\/+$/, '');
      return {
        ...f,
        path: prependedPath,
        realPath: prependedPath,
      };
    });

    // Get existing files from DB
    const existingFiles = await getAllFiles();
    const existingPaths = new Set(existingFiles.map((f) => f.path));
    const diskPaths = new Set(currentFilesOnDisk.map((f) => f.path));

    // Find new files (on disk but not in DB)
    const newFiles = currentFilesOnDisk.filter(
      (f) => !existingPaths.has(f.path)
    );

    // Find deleted files (in DB but not on disk, excluding web-only files)
    const deletedPaths = existingFiles
      .filter((f) => !f.isWebOnly && !diskPaths.has(f.path))
      .map((f) => f.path);

    if (newFiles.length > 0) {
      console.log(`[Poller] Found ${newFiles.length} new files`);
      await saveFiles(newFiles);
      await onRefreshFiles?.();
      onFolderUpdated?.();
    }

    if (deletedPaths.length > 0) {
      console.log(`[Poller] Detected ${deletedPaths.length} deleted files`);
      await onRefreshFiles?.();
      onFolderUpdated?.();
    }
  } catch (err) {
    console.warn('[Poller] Error scanning directory:', err);
  } finally {
    isSyncing.value = false;
  }
}

/**
 * Check if a file has changed on disk
 */
async function checkFileChange(file: VirtualFile): Promise<void> {
  if (!file.fileHandle || file.isWebOnly) return;

  // Check permission before accessing file
  const hasPermission = await hasFilePermission(file.fileHandle);
  if (!hasPermission) {
    // Permission lost - skip check silently (user needs to reconnect folder)
    return;
  }

  try {
    const metadata = await getFileMetadata(file.fileHandle);
    const diskModified = metadata.lastModified;

    // Skip if no change
    if (file.diskLastModified && diskModified <= file.diskLastModified) {
      return;
    }

    console.log(`[Poller] Disk change detected: ${file.virtualName}`);

    if (file.isDirty) {
      // CONFLICT: Both web and disk changed
      const diskContent = await readFileContent(file.fileHandle);

      await updateFile(file.id, {
        status: 'conflict',
        diskLastModified: diskModified,
      });

      // Trigger conflict modal
      conflictFile.value = { ...file, status: 'conflict' };
      conflictDiskContent.value = diskContent;

      onConflictDetected?.(file, diskContent);
    } else {
      // Safe to auto-reload (no local changes)
      await updateFile(file.id, {
        diskLastModified: diskModified,
        lastSyncedAt: Date.now(),
        status: 'synced',
      });

      onFileChanged?.(file.id);
    }
  } catch (err) {
    // File might be deleted or permission lost
    console.warn(`[Poller] Error checking ${file.virtualName}:`, err);
  }
}

/**
 * Clear conflict state after resolution
 */
export function clearConflict(): void {
  conflictFile.value = null;
  conflictDiskContent.value = '';
}

/**
 * Full rescan from disk - replaces all DB content with disk content
 * Keeps web-only files, restores hidden files from disk
 * Returns: true = success, false = failed, 'need-reopen' = need to reopen folder first
 */
export async function fullRescanFromDisk(): Promise<boolean | 'need-reopen'> {
  if (!currentProjectRef?.dirHandle) {
    console.warn('[Poller] No project handle - need to reopen folder');
    return 'need-reopen';
  }

  // Verify permission with prompt if needed
  const hasPermission = await verifyPermission(currentProjectRef.dirHandle);
  if (!hasPermission) {
    console.warn('[Poller] Permission denied for full rescan');
    return 'need-reopen';
  }

  console.log('[Poller] Full rescan from disk triggered');
  isSyncing.value = true;

  try {
    const rootName = currentProjectRef.dirHandle.name;

    // Scan directory
    const scanned = await scanDirectory(
      currentProjectRef.dirHandle,
      currentProjectRef.id
    );

    // Prepend root name
    const diskFiles = scanned.map((f) => {
      const prependedPath = `${rootName}/${f.path}`.replace(/\/+$/, '');
      return {
        ...f,
        path: prependedPath,
        realPath: prependedPath,
      };
    });

    // Create root folder entry
    const rootFolder = {
      id: crypto.randomUUID(),
      path: rootName,
      realPath: rootName,
      fileHandle: null,
      dirHandle: currentProjectRef.dirHandle,
      virtualName: rootName,
      contentOverride: null,
      isDirty: false,
      isHidden: false,
      isWebOnly: false,
      lastSyncedAt: Date.now(),
      diskLastModified: null,
      status: 'synced' as const,
      type: 'folder' as const,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    // Get existing web-only files that belong to THIS project only
    // (filter by path starting with current root name)
    const existingFiles = await getAllFiles();
    const webOnlyFiles = existingFiles.filter(
      (f) => f.isWebOnly && f.path.startsWith(rootName + '/')
    );

    // Merge: disk files + web-only files from this project only
    const allFiles = [rootFolder, ...diskFiles, ...webOnlyFiles];

    // Clear and save
    const { clearAllFiles } = await import('./database');
    await clearAllFiles();
    await saveFiles(allFiles);

    await onRefreshFiles?.();
    lastSyncTime.value = Date.now();

    console.log(`[Poller] Full rescan complete: ${diskFiles.length} disk files, ${webOnlyFiles.length} web-only files`);
    return true;
  } catch (err) {
    console.error('[Poller] Full rescan error:', err);
    return false;
  } finally {
    isSyncing.value = false;
  }
}

/**
 * Resolve a folder handle by walking from root
 * Path format: "rootName/sub1/sub2" - we skip rootName and walk sub1/sub2
 */
async function resolveFolderHandle(
  rootHandle: FileSystemDirectoryHandle,
  folderPath: string
): Promise<FileSystemDirectoryHandle | null> {
  // Path includes root name, e.g., "markdown-preview/plans/subfolder"
  // We need to skip the root name and walk the rest
  const parts = folderPath.split('/');
  if (parts.length < 2) {
    // This is the root folder itself
    return rootHandle;
  }

  // Skip root name, walk the rest
  let currentHandle = rootHandle;
  for (let i = 1; i < parts.length; i++) {
    try {
      currentHandle = await currentHandle.getDirectoryHandle(parts[i]);
    } catch {
      console.warn(`[Poller] Could not resolve folder: ${parts[i]}`);
      return null;
    }
  }
  return currentHandle;
}

/**
 * Sync a specific folder from disk (rescan folder contents)
 * Supports multiple root folders - only affects the synced folder, leaves others untouched
 * Returns: { success: true } | { success: false, needReopen?: string }
 */
export async function syncFolderFromDisk(folderId: string): Promise<{ success: boolean; needReopen?: string }> {
  const file = await getFile(folderId);
  if (!file || file.type !== 'folder') return { success: false };

  // Find root folder name (first path segment)
  const rootName = file.path.split('/')[0];
  const isRootFolder = file.path === rootName;

  // Get all existing files to find root folder's dirHandle
  const existingFiles = await getAllFiles();
  const rootFolder = existingFiles.find((f) => f.path === rootName && f.type === 'folder');

  // Check if we have a valid dirHandle for this root folder
  let rootDirHandle = rootFolder?.dirHandle;

  // Fallback to currentProjectRef if it matches this root
  if (!rootDirHandle && currentProjectRef?.dirHandle?.name === rootName) {
    rootDirHandle = currentProjectRef.dirHandle;
  }

  if (!rootDirHandle) {
    console.warn(`[Poller] No dirHandle for root folder "${rootName}" - need to reopen`);
    return { success: false, needReopen: rootName };
  }

  // Verify permission
  const hasPermission = await verifyPermission(rootDirHandle);
  if (!hasPermission) {
    console.warn('[Poller] Permission denied for folder sync');
    return { success: false, needReopen: rootName };
  }

  // Resolve folder handle (for root folder, use rootDirHandle directly)
  let folderHandle: FileSystemDirectoryHandle;
  if (isRootFolder) {
    folderHandle = rootDirHandle;
  } else {
    const resolved = await resolveFolderHandle(rootDirHandle, file.path);
    if (!resolved) {
      console.warn('[Poller] Could not resolve folder handle');
      return { success: false };
    }
    folderHandle = resolved;
  }

  console.log(`[Poller] Syncing folder: ${file.virtualName}`);
  isSyncing.value = true;

  try {
    // Scan the folder
    const scanned = await scanDirectory(folderHandle, 'sync');

    // Prepend folder path (for root folder, just use rootName)
    const diskFiles = scanned.map((f) => {
      const prependedPath = isRootFolder
        ? `${rootName}/${f.path}`.replace(/\/+$/, '')
        : `${file.path}/${f.path}`.replace(/\/+$/, '');
      return {
        ...f,
        path: prependedPath,
        realPath: prependedPath,
      };
    });

    // Files inside this folder (to be replaced)
    // For subfolder sync: file.path is already full path like "root/subfolder"
    const folderPrefix = file.path + '/';
    const filesInFolder = existingFiles.filter((f) =>
      f.path.startsWith(folderPrefix) || (isRootFolder && f.path === rootName)
    );

    // Keep web-only files in this folder
    const webOnlyInFolder = filesInFolder.filter((f) => f.isWebOnly && f.id !== folderId);

    // Files OUTSIDE this root folder (other root folders - keep as-is!)
    const filesFromOtherRoots = existingFiles.filter(
      (f) => f.path !== rootName && !f.path.startsWith(rootName + '/')
    );

    // Files in same root but outside synced folder (only for subfolder sync)
    const filesInSameRootButOutside = isRootFolder
      ? []
      : existingFiles.filter(
          (f) => (f.path === rootName || f.path.startsWith(rootName + '/')) &&
                 !f.path.startsWith(folderPrefix) &&
                 f.id !== folderId
        );

    // Update folder entry itself with resolved handle
    const updatedFolder = {
      ...file,
      dirHandle: folderHandle,
      isHidden: false,
      lastSyncedAt: Date.now(),
      status: 'synced' as const,
    };

    // For root folder sync, also create/update the root folder entry
    const rootFolderEntry = isRootFolder ? {
      ...updatedFolder,
      dirHandle: rootDirHandle,
    } : null;

    // Merge all - keep other roots untouched!
    const allFiles = [
      ...filesFromOtherRoots,
      ...filesInSameRootButOutside,
      ...(isRootFolder ? [rootFolderEntry!] : [updatedFolder]),
      ...diskFiles,
      ...webOnlyInFolder,
    ];

    console.log(`[Poller] Sync folder stats:`, {
      rootName,
      isRootFolder,
      folderPrefix,
      existingFilesCount: existingFiles.length,
      filesFromOtherRootsCount: filesFromOtherRoots.length,
      filesInSameRootButOutsideCount: filesInSameRootButOutside.length,
      diskFilesCount: diskFiles.length,
      webOnlyInFolderCount: webOnlyInFolder.length,
      allFilesCount: allFiles.length,
      filesFromOtherRootsPaths: filesFromOtherRoots.map(f => f.path).slice(0, 10),
    });

    // Clear and save
    const { clearAllFiles } = await import('./database');
    await clearAllFiles();
    await saveFiles(allFiles);

    await onRefreshFiles?.();
    lastSyncTime.value = Date.now();

    console.log(`[Poller] Folder sync complete: ${diskFiles.length} files`);
    return { success: true };
  } catch (err) {
    console.error('[Poller] Folder sync error:', err);
    return { success: false };
  } finally {
    isSyncing.value = false;
  }
}
