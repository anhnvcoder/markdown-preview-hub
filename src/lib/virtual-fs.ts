/**
 * Virtual File System operations
 * Overlay layer for web-only CRUD without touching disk
 */
import { permissionLost } from '../stores/file-store';
import type { FileStatus, VirtualFile } from '../types';
import {
  deleteFile as dbDeleteFile,
  getAllFiles,
  getFile,
  saveFile,
  updateFile,
} from './database';
import {
  hasFilePermission,
  readFileContent,
  writeFileContent,
} from './file-system';

/**
 * Create a new web-only file
 */
export async function createFile(
  parentPath: string,
  name: string,
  projectId: string
): Promise<VirtualFile> {
  const path = parentPath ? `${parentPath}/${name}` : name;

  const file: VirtualFile = {
    id: crypto.randomUUID(),
    path,
    realPath: null,
    fileHandle: null,
    dirHandle: null,
    virtualName: name,
    contentOverride: `# ${name.replace('.md', '')}\n\nStart writing here...`,
    isDirty: true,
    isHidden: false,
    isWebOnly: true,
    lastSyncedAt: Date.now(),
    diskLastModified: null,
    status: 'web-only',
    type: 'file',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    // @ts-ignore
    projectId,
  };

  await saveFile(file);
  return file;
}

/**
 * Create a new web-only folder
 */
export async function createFolder(
  parentPath: string,
  name: string,
  projectId: string
): Promise<VirtualFile> {
  const path = parentPath ? `${parentPath}/${name}` : name;

  const folder: VirtualFile = {
    id: crypto.randomUUID(),
    path,
    realPath: null,
    fileHandle: null,
    dirHandle: null,
    virtualName: name,
    contentOverride: null,
    isDirty: false,
    isHidden: false,
    isWebOnly: true,
    lastSyncedAt: Date.now(),
    diskLastModified: null,
    status: 'web-only',
    type: 'folder',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    // @ts-ignore
    projectId,
  };

  await saveFile(folder);
  return folder;
}

/**
 * Rename a file (virtual name only, doesn't touch disk)
 */
export async function renameFile(
  fileId: string,
  newName: string
): Promise<void> {
  const file = await getFile(fileId);
  if (!file) throw new Error('File not found');

  const oldPath = file.path;
  const newPath = oldPath.replace(/[^/]+$/, newName);

  await updateFile(fileId, {
    virtualName: newName,
    path: newPath,
  });

  // Update children paths if folder
  if (file.type === 'folder') {
    const allFiles = await getAllFiles();
    for (const child of allFiles) {
      if (child.path.startsWith(oldPath + '/')) {
        await updateFile(child.id, {
          path: child.path.replace(oldPath, newPath),
        });
      }
    }
  }
}

/**
 * Update file content (stores in contentOverride)
 */
export async function updateContent(
  fileId: string,
  content: string
): Promise<void> {
  await updateFile(fileId, {
    contentOverride: content,
    isDirty: true,
    status: 'modified',
  });
}

/**
 * Delete/hide a file
 * - Web-only files: actually delete from DB
 * - Disk files: just hide (set isHidden=true)
 */
export async function hideOrDeleteFile(fileId: string): Promise<void> {
  const file = await getFile(fileId);
  if (!file) return;

  if (file.isWebOnly) {
    // Actually delete web-only files
    await dbDeleteFile(fileId);
  } else {
    // Hide disk files (don't delete from disk)
    await updateFile(fileId, { isHidden: true });
  }

  // Handle children for folders
  if (file.type === 'folder') {
    const allFiles = await getAllFiles();
    for (const child of allFiles) {
      if (child.path.startsWith(file.path + '/')) {
        await hideOrDeleteFile(child.id);
      }
    }
  }
}

/**
 * Save file content to disk
 * For existing files: writes directly to disk
 * For web-only files: shows save dialog (starts in parent folder if available)
 */
export async function saveToDisk(fileId: string): Promise<void> {
  const file = await getFile(fileId);
  if (!file) return;

  // Get content to save (from contentOverride or return early if nothing to save)
  const contentToSave = file.contentOverride;
  if (contentToSave === null && file.isWebOnly) return;

  if (file.fileHandle) {
    // Existing file: write to disk
    const content = contentToSave ?? '';
    const lastModified = await writeFileContent(file.fileHandle, content);

    await updateFile(fileId, {
      contentOverride: null,
      isDirty: false,
      diskLastModified: lastModified,
      lastSyncedAt: Date.now(),
      status: 'synced',
    });
  } else {
    // Web-only file: show save dialog
    try {
      // Try to find parent folder's dirHandle for better starting location
      const allFiles = await getAllFiles();
      const parentPath = file.path.split('/').slice(0, -1).join('/');
      const parentFolder = allFiles.find(
        (f) => f.path === parentPath && f.type === 'folder'
      );

      // Build save picker options
      const saveOptions: any = {
        suggestedName: file.virtualName,
        types: [
          {
            description: 'Markdown',
            accept: { 'text/markdown': ['.md'] },
          },
        ],
      };

      // Set starting directory if parent folder has a handle
      if (parentFolder?.dirHandle) {
        saveOptions.startIn = parentFolder.dirHandle;
      }

      // @ts-ignore
      const handle = await window.showSaveFilePicker(saveOptions);

      const lastModified = await writeFileContent(handle, contentToSave ?? '');

      await updateFile(fileId, {
        fileHandle: handle,
        realPath: file.path,
        contentOverride: null,
        isDirty: false,
        isWebOnly: false,
        diskLastModified: lastModified,
        lastSyncedAt: Date.now(),
        status: 'synced',
      });
    } catch {
      // User cancelled save dialog
    }
  }
}

/**
 * Sync file from disk (reload disk content, discard local changes)
 */
export async function syncFromDisk(fileId: string): Promise<void> {
  const file = await getFile(fileId);
  if (!file || !file.fileHandle) return;

  const hasPermission = await hasFilePermission(file.fileHandle);
  if (!hasPermission) {
    permissionLost.value = true;
    console.warn(
      `[virtual-fs] Permission lost for ${file.virtualName}. Reconnect folder to sync.`
    );
    return;
  }

  const diskFile = await file.fileHandle.getFile();

  await updateFile(fileId, {
    contentOverride: null,
    isDirty: false,
    diskLastModified: diskFile.lastModified,
    lastSyncedAt: Date.now(),
    status: 'synced',
  });
}

/**
 * Get file content (priority: contentOverride > disk)
 * Falls back gracefully if disk permission is lost
 */
export async function getContent(fileId: string): Promise<string> {
  const file = await getFile(fileId);
  if (!file) throw new Error('File not found');

  // Return override if exists
  if (file.contentOverride !== null) {
    return file.contentOverride;
  }

  // Read from disk (check permission first)
  if (file.fileHandle) {
    const hasPermission = await hasFilePermission(file.fileHandle);
    if (!hasPermission) {
      // Permission lost - set signal and return empty (user needs to reconnect folder)
      permissionLost.value = true;
      console.warn(
        `[virtual-fs] Permission lost for ${file.virtualName}. Reconnect folder to sync.`
      );
      return '';
    }
    return readFileContent(file.fileHandle);
  }

  return '';
}

/**
 * Get disk content only (ignores contentOverride)
 * Returns null if permission is lost (caller should handle gracefully)
 */
export async function getDiskContent(fileId: string): Promise<string | null> {
  const file = await getFile(fileId);
  if (!file) throw new Error('File not found');

  // Read from disk (check permission first)
  if (file.fileHandle) {
    const hasPermission = await hasFilePermission(file.fileHandle);
    if (!hasPermission) {
      // Permission lost - set signal and return null to indicate can't read disk
      permissionLost.value = true;
      console.warn(
        `[virtual-fs] Permission lost for ${file.virtualName}. Reconnect folder to sync.`
      );
      return null;
    }
    return readFileContent(file.fileHandle);
  }

  return '';
}

/**
 * Resolve conflict between web and disk versions
 */
export async function resolveConflict(
  fileId: string,
  resolution: 'keep-web' | 'use-disk'
): Promise<void> {
  const file = await getFile(fileId);
  if (!file || !file.fileHandle) return;

  if (resolution === 'keep-web') {
    // Keep contentOverride, just update status
    await updateFile(fileId, { status: 'modified' });
  } else {
    // Discard web changes, use disk version
    const diskFile = await file.fileHandle.getFile();

    await updateFile(fileId, {
      contentOverride: null,
      isDirty: false,
      diskLastModified: diskFile.lastModified,
      lastSyncedAt: Date.now(),
      status: 'synced',
    });
  }
}

/**
 * Update file status
 */
export async function setFileStatus(
  fileId: string,
  status: FileStatus
): Promise<void> {
  await updateFile(fileId, { status });
}
