/**
 * File store using @preact/signals
 * Reactive state management for files and UI
 */
import { computed, signal } from '@preact/signals';
import {
  clearAllFiles,
  getAllFiles,
  getAllProjects,
  saveFile,
  saveFiles,
  saveProject,
} from '../lib/database';
import {
  openDirectory,
  openFilePicker,
  processDroppedFiles,
  scanDirectory,
  verifyPermission,
} from '../lib/file-system';
import { getContent } from '../lib/virtual-fs';
import type { Project, VirtualFile } from '../types';

// ============ State ============

/** Current project */
export const currentProject = signal<Project | null>(null);

/** All files in current project */
export const files = signal<VirtualFile[]>([]);

/** Currently selected file ID */
export const activeFileId = signal<string | null>(null);

/** Currently selected node ID (file or folder, for context) */
export const selectedNodeId = signal<string | null>(null);

/** Expanded folder IDs */
export const expandedFolders = signal<Set<string>>(new Set());

/** Current file content */
export const activeFileContent = signal<string>('');

/** Loading state */
export const isLoading = signal<boolean>(false);

/** Error message */
export const errorMessage = signal<string | null>(null);

/** Open tabs (file IDs) */
export const openTabs = signal<string[]>([]);

/** Permission lost flag - true when file handles need reconnection */
export const permissionLost = signal<boolean>(false);

/** Custom order for root folders (array of folder IDs) */
export const rootFolderOrder = signal<string[]>([]);

// ============ Computed ============

/** Get active file object */
export const activeFile = computed(() => {
  if (!activeFileId.value) return null;
  return files.value.find((f) => f.id === activeFileId.value) || null;
});

/** Get visible files (not hidden) */
export const visibleFiles = computed(() => {
  return files.value.filter((f) => !f.isHidden);
});

/** Build file tree structure */
export const fileTree = computed(() => {
  const visible = visibleFiles.value;
  const order = rootFolderOrder.value;
  return buildTree(visible, order);
});

/** Get file counts by status */
export const statusCounts = computed(() => {
  const visible = visibleFiles.value.filter((f) => f.type === 'file');
  return {
    synced: visible.filter((f) => f.status === 'synced').length,
    modified: visible.filter((f) => f.status === 'modified').length,
    conflict: visible.filter((f) => f.status === 'conflict').length,
    webOnly: visible.filter((f) => f.status === 'web-only').length,
    total: visible.length,
  };
});

/** Get open tab files with their data */
export const openTabFiles = computed(() => {
  return openTabs.value
    .map((id) => files.value.find((f) => f.id === id))
    .filter((f): f is VirtualFile => f !== undefined);
});

// ============ Actions ============

/**
 * Open a folder and scan for files
 */
export async function openFolder(): Promise<boolean> {
  isLoading.value = true;
  errorMessage.value = null;

  try {
    const dirHandle = await openDirectory();
    if (!dirHandle) {
      isLoading.value = false;
      return false;
    }

    // Verify permission
    const hasPermission = await verifyPermission(dirHandle);
    if (!hasPermission) {
      errorMessage.value = 'Permission denied to access folder';
      isLoading.value = false;
      return false;
    }

    // Create project
    const project: Project = {
      id: crypto.randomUUID(),
      name: dirHandle.name,
      dirHandle,
      createdAt: Date.now(),
      lastOpenedAt: Date.now(),
    };

    // Scan directory
    const scannedFiles = await scanDirectory(dirHandle, project.id);

    // Create root folder entry for the project folder itself
    const rootFolder: VirtualFile = {
      id: crypto.randomUUID(),
      path: dirHandle.name,
      realPath: dirHandle.name,
      fileHandle: null,
      dirHandle: dirHandle,
      virtualName: dirHandle.name,
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
    };

    // Prepend root folder path to all scanned files
    const filesWithRoot = scannedFiles.map((f) => {
      const prependedPath = `${dirHandle.name}/${f.path}`.replace(/\/+$/, '');
      return {
        ...f,
        path: prependedPath,
        realPath: prependedPath,
      };
    });

    // Add root folder to files list
    const allFiles = [rootFolder, ...filesWithRoot];

    // Clear old files and save new ones
    await clearAllFiles();
    await saveFiles(allFiles);
    await saveProject(project);

    // Update state
    currentProject.value = project;
    files.value = allFiles;
    activeFileId.value = null;
    activeFileContent.value = '';

    // Reset permission lost flag on successful folder open
    permissionLost.value = false;

    // Auto-expand root folder
    expandedFolders.value = new Set([rootFolder.id]);

    isLoading.value = false;
    return true;
  } catch (err) {
    console.error('Error opening folder:', err);
    errorMessage.value = 'Failed to open folder';
    isLoading.value = false;
    return false;
  }
}

/**
 * Expand all parent folders of a file path
 */
function expandParentFolders(filePath: string): void {
  const pathParts = filePath.split('/');
  // Remove the file name, keep only folder parts
  pathParts.pop();

  const foldersToExpand = new Set(expandedFolders.value);
  let currentPath = '';

  for (const part of pathParts) {
    currentPath = currentPath ? `${currentPath}/${part}` : part;
    // Find folder by path and add its ID to expanded set
    const folder = files.value.find(
      (f) => f.path === currentPath && f.type === 'folder'
    );
    if (folder) {
      foldersToExpand.add(folder.id);
    }
  }

  expandedFolders.value = foldersToExpand;
}

/**
 * Select a file and load its content
 * Automatically adds to open tabs and focuses in sidebar
 */
export async function selectFile(fileId: string): Promise<void> {
  const file = files.value.find((f) => f.id === fileId);
  if (!file || file.type === 'folder') return;

  // Auto-add to tabs if not already open
  if (!openTabs.value.includes(fileId)) {
    openTabs.value = [...openTabs.value, fileId];
  }

  activeFileId.value = fileId;

  // Focus file in sidebar: expand parent folders and select node
  expandParentFolders(file.path);
  selectedNodeId.value = fileId;

  try {
    const content = await getContent(fileId);
    activeFileContent.value = content;
  } catch (err) {
    console.error('Error loading file:', err);
    activeFileContent.value = '';
  }

  // Persist tabs state
  persistTabs();
}

/**
 * Select a node (file or folder) for context actions
 */
export function selectNode(id: string): void {
  selectedNodeId.value = id;
}

/**
 * Toggle folder expansion
 */
export function toggleFolder(folderId: string): void {
  const current = new Set(expandedFolders.value);
  if (current.has(folderId)) {
    current.delete(folderId);
  } else {
    current.add(folderId);
  }
  expandedFolders.value = current;
}

/**
 * Open a file in a new tab (or switch to existing tab)
 */
export async function openTab(fileId: string): Promise<void> {
  const file = files.value.find((f) => f.id === fileId);
  if (!file || file.type === 'folder') return;

  // Add to tabs if not already open
  if (!openTabs.value.includes(fileId)) {
    openTabs.value = [...openTabs.value, fileId];
  }

  // Switch to the tab
  await selectFile(fileId);
}

/**
 * Close a tab by file ID
 */
export function closeTab(fileId: string): void {
  const tabs = openTabs.value;
  const index = tabs.indexOf(fileId);
  if (index === -1) return;

  // Remove from tabs
  const newTabs = tabs.filter((id) => id !== fileId);
  openTabs.value = newTabs;

  // If closing active tab, switch to adjacent tab
  if (activeFileId.value === fileId) {
    if (newTabs.length === 0) {
      activeFileId.value = null;
      activeFileContent.value = '';
      persistTabs();
    } else {
      // Switch to previous tab or first tab (this will also persist)
      const newIndex = Math.min(index, newTabs.length - 1);
      selectFile(newTabs[newIndex]);
    }
  } else {
    // Just persist the tab removal
    persistTabs();
  }
}

/**
 * Close the currently active tab
 */
export function closeActiveTab(): void {
  if (activeFileId.value) {
    closeTab(activeFileId.value);
  }
}

/**
 * Refresh files from database
 */
export async function refreshFiles(): Promise<void> {
  const allFiles = await getAllFiles();
  files.value = allFiles;
}

/**
 * Update a file in state
 */
export function updateFileInState(
  fileId: string,
  updates: Partial<VirtualFile>
): void {
  files.value = files.value.map((f) =>
    f.id === fileId ? { ...f, ...updates } : f
  );
}

/**
 * Load persisted project and files on app init
 * Note: File System handles can't be persisted, so we just load the file list
 */
export async function loadPersistedProject(): Promise<void> {
  try {
    const allFiles = await getAllFiles();
    if (allFiles.length > 0) {
      files.value = allFiles;
      // Auto-expand root folders
      const rootFolders = allFiles.filter(
        (f) => f.type === 'folder' && !f.path.includes('/')
      );
      expandedFolders.value = new Set(rootFolders.map((f) => f.id));

      // Restore open tabs from localStorage
      const savedTabs = localStorage.getItem('md-preview-open-tabs');
      const savedActiveId = localStorage.getItem('md-preview-active-file');

      if (savedTabs) {
        try {
          const tabIds = JSON.parse(savedTabs) as string[];
          // Filter to only include tabs that still exist in files
          const validTabs = tabIds.filter((id) =>
            allFiles.some((f) => f.id === id && f.type === 'file')
          );
          openTabs.value = validTabs;

          // Restore active file if it's in the valid tabs
          if (savedActiveId && validTabs.includes(savedActiveId)) {
            activeFileId.value = savedActiveId;
            // Load content for active file
            const file = allFiles.find((f) => f.id === savedActiveId);
            if (file) {
              // Use contentOverride if available, otherwise will load from disk via selectFile
              if (file.contentOverride !== null) {
                activeFileContent.value = file.contentOverride;
              } else {
                // Need to load from disk - call getContent
                try {
                  const content = await getContent(savedActiveId);
                  activeFileContent.value = content;
                } catch {
                  activeFileContent.value = '';
                }
              }
            }
          } else if (validTabs.length > 0) {
            // Select first tab if saved active is not valid
            activeFileId.value = validTabs[0];
          }
        } catch {
          console.warn('[file-store] Error parsing saved tabs');
        }
      }
    }

    // Load project info (but dirHandle won't work after refresh)
    const projects = await getAllProjects();
    if (projects.length > 0) {
      // Just restore the project info for display
      const latest = projects[0];
      currentProject.value = {
        ...latest,
        dirHandle: null as any, // Handle is lost after refresh
      };
    }

    // Load root folder order from localStorage
    const savedOrder = localStorage.getItem('md-preview-root-folder-order');
    if (savedOrder) {
      try {
        rootFolderOrder.value = JSON.parse(savedOrder);
      } catch {
        console.warn('[file-store] Error parsing root folder order');
      }
    }
  } catch (err) {
    console.error('[file-store] Error loading persisted data:', err);
  }
}

/**
 * Save open tabs state to localStorage
 */
export function persistTabs(): void {
  localStorage.setItem('md-preview-open-tabs', JSON.stringify(openTabs.value));
  if (activeFileId.value) {
    localStorage.setItem('md-preview-active-file', activeFileId.value);
  } else {
    localStorage.removeItem('md-preview-active-file');
  }
}

/**
 * Reorder root folders by moving a folder to a new position
 * @param draggedId - ID of the folder being dragged
 * @param targetId - ID of the folder to drop before (or null for end)
 */
export function reorderRootFolders(
  draggedId: string,
  targetId: string | null
): void {
  // Get all root folders
  const rootFolders = files.value.filter(
    (f) => f.type === 'folder' && !f.path.includes('/')
  );

  // Build current order (use existing order or create from current folders)
  let currentOrder = rootFolderOrder.value.length > 0
    ? [...rootFolderOrder.value]
    : rootFolders.map((f) => f.id);

  // Ensure all current root folders are in the order
  for (const folder of rootFolders) {
    if (!currentOrder.includes(folder.id)) {
      currentOrder.push(folder.id);
    }
  }
  // Remove any IDs that no longer exist
  currentOrder = currentOrder.filter((id) =>
    rootFolders.some((f) => f.id === id)
  );

  // Remove dragged item from current position
  const draggedIndex = currentOrder.indexOf(draggedId);
  if (draggedIndex === -1) return;
  currentOrder.splice(draggedIndex, 1);

  // Insert at new position
  if (targetId === null) {
    // Drop at end
    currentOrder.push(draggedId);
  } else {
    const targetIndex = currentOrder.indexOf(targetId);
    if (targetIndex === -1) {
      currentOrder.push(draggedId);
    } else {
      currentOrder.splice(targetIndex, 0, draggedId);
    }
  }

  // Update signal and persist
  rootFolderOrder.value = currentOrder;
  localStorage.setItem('md-preview-root-folder-order', JSON.stringify(currentOrder));
}

/**
 * Create a new file (web-only until saved to disk)
 */
export async function createFile(
  name: string,
  parentPath?: string
): Promise<string | null> {
  // Create temporary project if none exists
  if (!currentProject.value) {
    const project: Project = {
      id: crypto.randomUUID(),
      name: 'My Files',
      dirHandle: null as any,
      createdAt: Date.now(),
      lastOpenedAt: Date.now(),
    };
    await saveProject(project);
    currentProject.value = project;
  }

  const path = parentPath ? `${parentPath}/${name}` : name;

  // Check for duplicates
  const existing = files.value.find((f) => f.path === path);
  if (existing) {
    console.warn('[file-store] File already exists:', path);
    return null;
  }

  const newFile: VirtualFile = {
    id: crypto.randomUUID(),
    path,
    realPath: path,
    fileHandle: null,
    dirHandle: null,
    virtualName: name,
    contentOverride: '# ' + name.replace('.md', '') + '\n\nStart writing...',
    isDirty: true,
    isHidden: false,
    isWebOnly: true,
    lastSyncedAt: Date.now(),
    diskLastModified: null,
    status: 'web-only',
    type: 'file',
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  // Save to DB and update state
  await saveFile(newFile);
  files.value = [...files.value, newFile];

  return newFile.id;
}

/**
 * Create a new folder (web-only)
 */
export async function createFolder(
  name: string,
  parentPath?: string
): Promise<string | null> {
  // Create temporary project if none exists
  if (!currentProject.value) {
    const project: Project = {
      id: crypto.randomUUID(),
      name: 'My Files',
      dirHandle: null as any,
      createdAt: Date.now(),
      lastOpenedAt: Date.now(),
    };
    await saveProject(project);
    currentProject.value = project;
  }

  const path = parentPath ? `${parentPath}/${name}` : name;

  // Check for duplicates
  const existing = files.value.find((f) => f.path === path);
  if (existing) {
    console.warn('[file-store] Folder already exists:', path);
    return null;
  }

  const newFolder: VirtualFile = {
    id: crypto.randomUUID(),
    path,
    realPath: path,
    fileHandle: null,
    dirHandle: null,
    virtualName: name,
    contentOverride: null,
    isDirty: false,
    isHidden: false,
    isWebOnly: true,
    lastSyncedAt: Date.now(),
    diskLastModified: null,
    status: 'web-only', // Web-only folders show cloud-off icon
    type: 'folder',
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  // Save to DB and update state
  await saveFile(newFolder);
  files.value = [...files.value, newFolder];

  // Auto-expand new folder
  expandedFolders.value = new Set([...expandedFolders.value, newFolder.id]);

  return newFolder.id;
}

/**
 * Upload files (from file picker)
 * Returns object with count and first file ID for focusing
 */
export async function uploadFiles(
  showWarning?: (warning: {
    type: 'file' | 'folder';
    targetPath: string;
    existingFiles: VirtualFile[];
    newFileCount: number;
    hasUnsaved: boolean;
    hasUnsynced: boolean;
  }) => Promise<boolean>
): Promise<{ count: number; firstFileId: string | null }> {
  // Create temporary project if none exists
  if (!currentProject.value) {
    const project: Project = {
      id: crypto.randomUUID(),
      name: 'Uploaded Files',
      dirHandle: null as any,
      createdAt: Date.now(),
      lastOpenedAt: Date.now(),
    };
    await saveProject(project);
    currentProject.value = project;
  }

  const selectedFiles = await openFilePicker();

  if (selectedFiles.length === 0) return { count: 0, firstFileId: null };

  // Determine target path based on selection
  let targetPath = '';
  if (selectedNodeId.value) {
    const selected = files.value.find((f) => f.id === selectedNodeId.value);
    if (selected) {
      targetPath =
        selected.type === 'folder'
          ? selected.path
          : selected.path.split('/').slice(0, -1).join('/');
    }
  }

  // Check for existing files that would be overwritten
  const existingFiles: VirtualFile[] = [];
  for (const file of selectedFiles) {
    const filePath = targetPath ? `${targetPath}/${file.name}` : file.name;
    const existing = files.value.find((f) => f.path === filePath);
    if (existing) {
      existingFiles.push(existing);
    }
  }

  // Check if any existing files have unsaved changes or are not synced
  const hasUnsaved = existingFiles.some((f) => f.isDirty);
  const hasUnsynced = existingFiles.some((f) => f.status !== 'synced');

  // Show warning if there are existing files to overwrite
  if (existingFiles.length > 0 && showWarning) {
    const proceed = await showWarning({
      type: 'file',
      targetPath,
      existingFiles,
      newFileCount: selectedFiles.length,
      hasUnsaved,
      hasUnsynced,
    });
    if (!proceed) {
      return { count: 0, firstFileId: null };
    }
  }

  const newFiles: VirtualFile[] = [];

  for (const file of selectedFiles) {
    const filePath = targetPath ? `${targetPath}/${file.name}` : file.name;
    const content = await file.text();

    // Check if file exists - if so, update it instead of skip
    const existingIndex = files.value.findIndex((f) => f.path === filePath);

    const newFile: VirtualFile = {
      id:
        existingIndex >= 0
          ? files.value[existingIndex].id
          : crypto.randomUUID(),
      path: filePath,
      realPath: filePath,
      fileHandle:
        existingIndex >= 0 ? files.value[existingIndex].fileHandle : null,
      dirHandle: null,
      virtualName: file.name,
      contentOverride: content,
      isDirty: false,
      isHidden: false,
      isWebOnly:
        existingIndex >= 0 ? files.value[existingIndex].isWebOnly : true,
      lastSyncedAt: Date.now(),
      diskLastModified: file.lastModified,
      status:
        existingIndex >= 0 && !files.value[existingIndex].isWebOnly
          ? 'synced'
          : 'web-only',
      type: 'file',
      createdAt:
        existingIndex >= 0 ? files.value[existingIndex].createdAt : Date.now(),
      updatedAt: Date.now(),
    };

    newFiles.push(newFile);
  }

  // Save to DB and update state
  if (newFiles.length > 0) {
    await saveFiles(newFiles);
    // Update existing files or add new ones
    const updatedFiles = files.value.filter(
      (f) => !newFiles.some((nf) => nf.id === f.id)
    );
    files.value = [...updatedFiles, ...newFiles];
  }

  return { count: newFiles.length, firstFileId: newFiles[0]?.id ?? null };
}

/**
 * Upload a folder (import directory)
 * Returns object with count and root folder ID for focusing
 */
export async function uploadFolder(
  showWarning?: (warning: {
    type: 'file' | 'folder';
    targetPath: string;
    existingFiles: VirtualFile[];
    newFileCount: number;
    hasUnsaved: boolean;
    hasUnsynced: boolean;
  }) => Promise<boolean>
): Promise<{ count: number; rootFolderId: string | null }> {
  // Create temporary project if none exists
  if (!currentProject.value) {
    const success = await openFolder();
    return { count: success ? 1 : 0, rootFolderId: null };
  }

  const projectId = currentProject.value.id;
  const dirHandle = await openDirectory();
  if (!dirHandle) return { count: 0, rootFolderId: null };

  // Determine target path based on selection
  let targetPath = '';
  if (selectedNodeId.value) {
    const selected = files.value.find((f) => f.id === selectedNodeId.value);
    if (selected) {
      targetPath =
        selected.type === 'folder'
          ? selected.path
          : selected.path.split('/').slice(0, -1).join('/');
    }
  }

  // Scan the imported directory
  // We scan it as if it were a project to get the structure
  const scannedFiles = await scanDirectory(dirHandle, projectId);

  if (scannedFiles.length === 0) return { count: 0, rootFolderId: null };

  // The scanned files have paths relative to the imported folder root, NOT including the import folder name itself?
  // scanDirectory uses '' as initial path.
  // actually scanDirectory's first recursion uses entries.
  // If I scan folder "images" which contains "logo.png", scanDirectory returns "logo.png" (if I strictly look at how scan works)
  // Wait, scanDirectory:
  // await scan(dirHandle, '', 0);
  // for entry in dirHandle:
  //   path = "" ? "" + entry.name : entry.name -> "logo.png"

  // But we want to preserve the folder name of the imported folder, right?
  // "When upload folder, check into folder which will upload whole folder into checked folder"
  // If I import "assets", I want "assets/..." to appear in the target.
  // But `scanDirectory` iterates *contents* of the handle. It doesn't know the handle's name as a parent of the contents in the path context.

  // validation: dirHandle.name is the folder name.
  // So we should prepend `${dirHandle.name}/` to all scanned paths.

  const folderName = dirHandle.name;
  const importRoot = targetPath ? `${targetPath}/${folderName}` : folderName;

  const newFiles: VirtualFile[] = scannedFiles.map((f) => {
    const newPath = `${importRoot}/${f.path}`;
    return {
      ...f,
      id: crypto.randomUUID(), // Regenerate IDs just in case, though scanDirectory makes new ones
      path: newPath,
      realPath: newPath,
      // We need to keep the handles valid.
      // Scan directory returns handles relative to the scanned root, which is fine.
    };
  });

  // Create the root folder entry for the imported folder itself?
  // scanDirectory does NOT create an entry for the root handle itself.
  // We need to create it manually.

  const rootFolder: VirtualFile = {
    id: crypto.randomUUID(),
    path: importRoot,
    realPath: importRoot,
    fileHandle: null,
    dirHandle: dirHandle,
    virtualName: folderName,
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
    // @ts-ignore
    projectId,
  };

  // Check for existing files that would be overwritten
  const existingFiles = files.value.filter((ex) =>
    newFiles.some((nf) => nf.path === ex.path)
  );

  // Check if any existing files have unsaved changes or are not synced
  const hasUnsaved = existingFiles.some((f) => f.isDirty);
  const hasUnsynced = existingFiles.some((f) => f.status !== 'synced');

  // Show warning if there are existing files to overwrite
  if (existingFiles.length > 0 && showWarning) {
    const proceed = await showWarning({
      type: 'folder',
      targetPath: importRoot,
      existingFiles,
      newFileCount: newFiles.length,
      hasUnsaved,
      hasUnsynced,
    });
    if (!proceed) {
      return { count: 0, rootFolderId: null };
    }
  }

  // For files that exist, update them; otherwise add new
  const filesToSave: VirtualFile[] = [];
  for (const nf of newFiles) {
    const existingIndex = files.value.findIndex((ex) => ex.path === nf.path);
    if (existingIndex >= 0) {
      // Update existing file
      filesToSave.push({
        ...nf,
        id: files.value[existingIndex].id,
        createdAt: files.value[existingIndex].createdAt,
        status: files.value[existingIndex].isWebOnly ? 'web-only' : 'modified',
      });
    } else {
      filesToSave.push(nf);
    }
  }

  // Add root folder if it doesn't exist
  if (!files.value.some((ex) => ex.path === rootFolder.path)) {
    filesToSave.unshift(rootFolder);
  }

  if (filesToSave.length > 0) {
    await saveFiles(filesToSave);

    // Deduplicate existing files by path to prevent duplicates appearing at different levels
    // (e.g. if a file existed at root and is now being uploaded inside a folder)
    const updatedFiles = files.value.filter(
      (f) => !filesToSave.some((sf) => sf.path === f.path)
    );
    files.value = [...updatedFiles, ...filesToSave];

    // Auto expand the parent of the imported folder and the root folder itself
    if (selectedNodeId.value) {
      expandedFolders.value = new Set([
        ...expandedFolders.value,
        selectedNodeId.value,
        rootFolder.id,
      ]);
    } else {
      expandedFolders.value = new Set([
        ...expandedFolders.value,
        rootFolder.id,
      ]);
    }
  }

  return { count: filesToSave.length, rootFolderId: rootFolder.id };
}

/**
 * Handle dropped files/folders from drag-drop
 * @param dataTransfer - DataTransfer from drop event
 * @param targetFolderId - Optional folder ID to drop into (null = root)
 */
export async function handleDroppedFiles(
  dataTransfer: DataTransfer,
  targetFolderId: string | null = null
): Promise<{ count: number; firstFileId: string | null }> {
  // Create temporary project if none exists
  if (!currentProject.value) {
    const project: Project = {
      id: crypto.randomUUID(),
      name: 'Dropped Files',
      dirHandle: null as any,
      createdAt: Date.now(),
      lastOpenedAt: Date.now(),
    };
    await saveProject(project);
    currentProject.value = project;
  }

  // Process dropped items
  const droppedItems = await processDroppedFiles(dataTransfer);
  if (droppedItems.length === 0) {
    return { count: 0, firstFileId: null };
  }

  // Determine target path
  let targetPath = '';
  if (targetFolderId) {
    const targetFolder = files.value.find((f) => f.id === targetFolderId);
    if (targetFolder && targetFolder.type === 'folder') {
      targetPath = targetFolder.path;
    }
  }

  const newFiles: VirtualFile[] = [];
  const foldersToExpand: string[] = [];

  // Process each dropped item
  for (const item of droppedItems) {
    const itemPath = targetPath ? `${targetPath}/${item.name}` : item.name;
    const itemName = item.name.split('/').pop() || item.name;

    // Check if already exists
    const existingIndex = files.value.findIndex((f) => f.path === itemPath);

    if (item.isFolder) {
      // Create folder entry
      const folderId = existingIndex >= 0
        ? files.value[existingIndex].id
        : crypto.randomUUID();

      if (existingIndex < 0) {
        newFiles.push({
          id: folderId,
          path: itemPath,
          realPath: itemPath,
          fileHandle: null,
          dirHandle: null,
          virtualName: itemName,
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
        });
      }
      foldersToExpand.push(folderId);
    } else {
      // Create file entry
      const newFile: VirtualFile = {
        id: existingIndex >= 0
          ? files.value[existingIndex].id
          : crypto.randomUUID(),
        path: itemPath,
        realPath: itemPath,
        fileHandle: existingIndex >= 0 ? files.value[existingIndex].fileHandle : null,
        dirHandle: null,
        virtualName: itemName,
        contentOverride: item.content,
        isDirty: false,
        isHidden: false,
        isWebOnly: existingIndex >= 0 ? files.value[existingIndex].isWebOnly : true,
        lastSyncedAt: Date.now(),
        diskLastModified: Date.now(),
        status: existingIndex >= 0 && !files.value[existingIndex].isWebOnly
          ? 'modified'
          : 'web-only',
        type: 'file',
        createdAt: existingIndex >= 0
          ? files.value[existingIndex].createdAt
          : Date.now(),
        updatedAt: Date.now(),
      };
      newFiles.push(newFile);
    }
  }

  // Save to DB and update state
  if (newFiles.length > 0) {
    await saveFiles(newFiles);
    // Update existing files or add new ones
    const updatedFiles = files.value.filter(
      (f) => !newFiles.some((nf) => nf.id === f.id)
    );
    files.value = [...updatedFiles, ...newFiles];

    // Expand target folder and any new folders
    if (targetFolderId) {
      foldersToExpand.push(targetFolderId);
    }
    if (foldersToExpand.length > 0) {
      expandedFolders.value = new Set([
        ...expandedFolders.value,
        ...foldersToExpand,
      ]);
    }
  }

  // Return first file for selection
  const firstFile = newFiles.find((f) => f.type === 'file');
  return { count: newFiles.length, firstFileId: firstFile?.id ?? null };
}

// ============ Helpers ============

interface TreeNode extends VirtualFile {
  children: TreeNode[];
}

function buildTree(flatFiles: VirtualFile[], customRootOrder: string[] = []): TreeNode[] {
  const map = new Map<string, TreeNode>();
  const roots: TreeNode[] = [];

  // Sort by path to ensure parents come before children
  const sorted = [...flatFiles].sort((a, b) => a.path.localeCompare(b.path));

  for (const file of sorted) {
    const node: TreeNode = { ...file, children: [] };
    map.set(file.path, node);

    const parentPath = file.path.split('/').slice(0, -1).join('/');

    if (parentPath && map.has(parentPath)) {
      map.get(parentPath)!.children.push(node);
    } else {
      roots.push(node);
    }
  }

  // Sort children: folders first, then alphabetically
  const sortNodes = (nodes: TreeNode[]): TreeNode[] => {
    return nodes
      .sort((a, b) => {
        if (a.type !== b.type) {
          return a.type === 'folder' ? -1 : 1;
        }
        return a.virtualName.localeCompare(b.virtualName);
      })
      .map((node) => ({
        ...node,
        children: sortNodes(node.children),
      }));
  };

  // Sort root nodes with custom order if provided
  const sortedRoots = sortNodes(roots);

  // Apply custom order to root folders if available
  if (customRootOrder.length > 0) {
    // Separate folders and files at root level
    const rootFolders = sortedRoots.filter((n) => n.type === 'folder');
    const rootFiles = sortedRoots.filter((n) => n.type === 'file');

    // Sort root folders by custom order
    rootFolders.sort((a, b) => {
      const indexA = customRootOrder.indexOf(a.id);
      const indexB = customRootOrder.indexOf(b.id);
      // If not in custom order, put at end (alphabetically)
      if (indexA === -1 && indexB === -1) {
        return a.virtualName.localeCompare(b.virtualName);
      }
      if (indexA === -1) return 1;
      if (indexB === -1) return -1;
      return indexA - indexB;
    });

    // Return folders first, then files
    return [...rootFolders, ...rootFiles];
  }

  return sortedRoots;
}
