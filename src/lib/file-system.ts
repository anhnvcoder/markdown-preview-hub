/**
 * File System Access API operations
 * Directory scanning with filters
 */
import type { VirtualFile } from '../types';
import { getSettings } from './database';

// Scan configuration
interface ScanConfig {
  ignoredFolders: string[];
  allowedExtensions: string[];
  maxFiles: number;
  maxDepth: number;
}

const DEFAULT_SCAN_CONFIG: ScanConfig = {
  ignoredFolders: [
    'node_modules',
    '.git',
    'dist',
    'build',
    '.next',
    '.nuxt',
    '.astro',
    '.cache',
    '.temp',
    '__pycache__',
    '.idea',
    '.vscode',
    '.svn',
    '.hg',
    'vendor',
    'bower_components',
    'out',
    '.DS_Store',
  ],
  allowedExtensions: ['.md', '.mdx', '.markdown'],
  maxFiles: 1000,
  maxDepth: 10,
};

/**
 * Open directory picker and return handle
 */
export async function openDirectory(): Promise<FileSystemDirectoryHandle | null> {
  try {
    // @ts-ignore - File System Access API
    const handle = await window.showDirectoryPicker({
      mode: 'readwrite',
    });
    return handle;
  } catch (err) {
    // User cancelled
    return null;
  }
}

/**
 * Check if File System Access API is supported
 */
export function isFileSystemSupported(): boolean {
  return 'showDirectoryPicker' in window;
}

/**
 * Request permission for a directory handle
 */
export async function verifyPermission(
  handle: FileSystemDirectoryHandle,
  mode: 'read' | 'readwrite' = 'readwrite',
): Promise<boolean> {
  try {
    // @ts-ignore
    const permission = await handle.queryPermission({ mode });
    if (permission === 'granted') return true;

    // @ts-ignore
    const request = await handle.requestPermission({ mode });
    return request === 'granted';
  } catch {
    return false;
  }
}

/**
 * Check if a file handle has permission (query only, no prompt)
 */
export async function hasFilePermission(
  handle: FileSystemFileHandle,
  mode: 'read' | 'readwrite' = 'read',
): Promise<boolean> {
  try {
    // @ts-ignore
    const permission = await handle.queryPermission({ mode });
    return permission === 'granted';
  } catch {
    return false;
  }
}

/**
 * Request permission for a file handle (requires user gesture)
 */
export async function requestFilePermission(
  handle: FileSystemFileHandle,
  mode: 'read' | 'readwrite' = 'read',
): Promise<boolean> {
  try {
    // @ts-ignore
    const permission = await handle.queryPermission({ mode });
    if (permission === 'granted') return true;

    // @ts-ignore
    const request = await handle.requestPermission({ mode });
    return request === 'granted';
  } catch {
    return false;
  }
}

/**
 * Scan directory recursively for markdown files
 */
export async function scanDirectory(
  dirHandle: FileSystemDirectoryHandle,
  projectId: string,
  config?: Partial<ScanConfig>,
): Promise<VirtualFile[]> {
  const settings = await getSettings();
  const scanConfig: ScanConfig = {
    ...DEFAULT_SCAN_CONFIG,
    ignoredFolders:
      settings.ignoredFolders || DEFAULT_SCAN_CONFIG.ignoredFolders,
    ...config,
  };

  const files: VirtualFile[] = [];
  let scannedCount = 0;

  async function scan(
    handle: FileSystemDirectoryHandle,
    path: string,
    depth: number,
  ): Promise<void> {
    // Safety checks
    if (depth > scanConfig.maxDepth) {
      console.warn(`Max depth reached at: ${path}`);
      return;
    }
    if (scannedCount >= scanConfig.maxFiles) {
      console.warn(`Max files limit reached: ${scanConfig.maxFiles}`);
      return;
    }

    try {
      for await (const entry of handle.values()) {
        if (scannedCount >= scanConfig.maxFiles) break;

        if (entry.kind === 'directory') {
          // Check if folder should be ignored
          if (isIgnoredFolder(entry.name, scanConfig.ignoredFolders)) {
            continue;
          }

          // Add folder to tree
          const folderPath = path ? `${path}/${entry.name}` : entry.name;
          const subHandle = await handle.getDirectoryHandle(entry.name);

          files.push({
            id: crypto.randomUUID(),
            path: folderPath,
            realPath: folderPath,
            fileHandle: null,
            dirHandle: subHandle,
            virtualName: entry.name,
            contentOverride: null,
            isDirty: false,
            isHidden: false,
            isWebOnly: false,
            lastSyncedAt: Date.now(),
            diskLastModified: null,
            status: 'synced',
            type: 'folder',
            createdAt: Date.now(),
            updatedAt: Date.now(),
            // @ts-ignore - we add projectId for indexing
            projectId,
          });

          // Recursively scan subfolder
          await scan(subHandle, folderPath, depth + 1);
        } else if (entry.kind === 'file') {
          // Check file extension
          if (!isAllowedFile(entry.name, scanConfig.allowedExtensions)) {
            continue;
          }

          scannedCount++;
          const filePath = path ? `${path}/${entry.name}` : entry.name;
          const fileHandle = await handle.getFileHandle(entry.name);
          const file = await fileHandle.getFile();

          files.push({
            id: crypto.randomUUID(),
            path: filePath,
            realPath: filePath,
            fileHandle,
            dirHandle: handle,
            virtualName: entry.name,
            contentOverride: null,
            isDirty: false,
            isHidden: false,
            isWebOnly: false,
            lastSyncedAt: Date.now(),
            diskLastModified: file.lastModified,
            status: 'synced',
            type: 'file',
            createdAt: Date.now(),
            updatedAt: Date.now(),
            // @ts-ignore
            projectId,
          });
        }
      }
    } catch (err) {
      console.error(`Error scanning ${path}:`, err);
    }
  }

  await scan(dirHandle, '', 0);

  // Filter out folders that don't contain any allowed files
  const allowedIds = new Set<string>();

  // First pass: identify all allowed files
  files.forEach((f) => {
    if (f.type === 'file') {
      allowedIds.add(f.id);
      // Add all parent paths
      const parts = f.path.split('/');
      let currentPath = '';
      for (let i = 0; i < parts.length - 1; i++) {
        currentPath = currentPath ? `${currentPath}/${parts[i]}` : parts[i];
        // Find folder with this path
        const folder = files.find(
          (dir) => dir.path === currentPath && dir.type === 'folder',
        );
        if (folder) allowedIds.add(folder.id);
      }
    }
  });

  // Second pass: only return allowed items
  return files.filter((f) => allowedIds.has(f.id));
}

/**
 * Read file content from handle
 */
export async function readFileContent(
  handle: FileSystemFileHandle,
): Promise<string> {
  const file = await handle.getFile();
  return file.text();
}

/**
 * Write content to file
 */
export async function writeFileContent(
  handle: FileSystemFileHandle,
  content: string,
): Promise<number> {
  // @ts-ignore
  const writable = await handle.createWritable();
  await writable.write(content);
  await writable.close();

  // Return new lastModified
  const file = await handle.getFile();
  return file.lastModified;
}

/**
 * Get file metadata
 */
export async function getFileMetadata(handle: FileSystemFileHandle): Promise<{
  name: string;
  size: number;
  lastModified: number;
}> {
  const file = await handle.getFile();
  return {
    name: file.name,
    size: file.size,
    lastModified: file.lastModified,
  };
}

/**
 * Open file picker and return selected files
 */
export async function openFilePicker(): Promise<File[]> {
  try {
    // @ts-ignore - File System Access API
    const handles = await window.showOpenFilePicker({
      multiple: true,
      types: [
        {
          description: 'Markdown files',
          accept: { 'text/markdown': ['.md', '.mdx', '.markdown'] },
        },
      ],
    });

    const files: File[] = [];
    for (const handle of handles) {
      const file = await handle.getFile();
      files.push(file);
    }
    return files;
  } catch {
    // User cancelled
    return [];
  }
}

/**
 * Process dropped files from DataTransfer
 * Returns array of markdown files with their content
 * Filters out folders that don't contain any md files
 */
export async function processDroppedFiles(
  dataTransfer: DataTransfer,
): Promise<{ name: string; content: string; isFolder: boolean }[]> {
  const results: { name: string; content: string; isFolder: boolean }[] = [];
  const items = dataTransfer.items;

  for (let i = 0; i < items.length; i++) {
    const item = items[i];

    // Try to get FileSystemHandle (modern browsers)
    // @ts-ignore - webkitGetAsEntry is non-standard
    const entry = item.webkitGetAsEntry?.();

    if (entry) {
      await processEntry(entry, '', results);
    } else if (item.kind === 'file') {
      // Fallback: use File API directly
      const file = item.getAsFile();
      if (
        file &&
        isAllowedFile(file.name, DEFAULT_SCAN_CONFIG.allowedExtensions)
      ) {
        const content = await file.text();
        results.push({ name: file.name, content, isFolder: false });
      }
    }
  }

  // Filter out folders that don't contain any md files
  return filterEmptyFolders(results);
}

/**
 * Filter out folders that don't have any md file descendants
 */
function filterEmptyFolders(
  items: { name: string; content: string; isFolder: boolean }[],
): { name: string; content: string; isFolder: boolean }[] {
  // Get all file paths
  const filePaths = new Set(
    items.filter((item) => !item.isFolder).map((item) => item.name),
  );

  // Find folders that have md file descendants
  const foldersWithFiles = new Set<string>();
  for (const filePath of filePaths) {
    const parts = filePath.split('/');
    let currentPath = '';
    for (let i = 0; i < parts.length - 1; i++) {
      currentPath = currentPath ? `${currentPath}/${parts[i]}` : parts[i];
      foldersWithFiles.add(currentPath);
    }
  }

  // Filter: keep all files and only folders that have md descendants
  return items.filter(
    (item) => !item.isFolder || foldersWithFiles.has(item.name),
  );
}

/**
 * Recursively process a FileSystemEntry from drag-drop
 */
async function processEntry(
  entry: FileSystemEntry,
  parentPath: string,
  results: { name: string; content: string; isFolder: boolean }[],
): Promise<void> {
  const fullPath = parentPath ? `${parentPath}/${entry.name}` : entry.name;

  if (entry.isDirectory) {
    // Skip ignored folders
    if (isIgnoredFolder(entry.name, DEFAULT_SCAN_CONFIG.ignoredFolders)) {
      return;
    }

    // Add folder marker
    results.push({ name: fullPath, content: '', isFolder: true });

    // Read directory contents
    const dirEntry = entry as FileSystemDirectoryEntry;
    const reader = dirEntry.createReader();

    const entries = await new Promise<FileSystemEntry[]>((resolve) => {
      const allEntries: FileSystemEntry[] = [];
      const readBatch = () => {
        reader.readEntries((batch) => {
          if (batch.length === 0) {
            resolve(allEntries);
          } else {
            allEntries.push(...batch);
            readBatch();
          }
        });
      };
      readBatch();
    });

    // Process each entry recursively
    for (const childEntry of entries) {
      await processEntry(childEntry, fullPath, results);
    }
  } else if (entry.isFile) {
    const fileEntry = entry as FileSystemFileEntry;

    // Only process markdown files
    if (!isAllowedFile(entry.name, DEFAULT_SCAN_CONFIG.allowedExtensions)) {
      return;
    }

    // Read file content
    const file = await new Promise<File>((resolve, reject) => {
      fileEntry.file(resolve, reject);
    });

    const content = await file.text();
    results.push({ name: fullPath, content, isFolder: false });
  }
}

// ============ Helpers ============

function isIgnoredFolder(name: string, ignoredFolders: string[]): boolean {
  return ignoredFolders.includes(name) || name.startsWith('.');
}

function isAllowedFile(name: string, allowedExtensions: string[]): boolean {
  const ext = '.' + name.split('.').pop()?.toLowerCase();
  return allowedExtensions.includes(ext);
}
