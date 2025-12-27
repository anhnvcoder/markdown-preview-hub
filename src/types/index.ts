/**
 * File sync status types
 */
export type FileStatus =
  | 'synced'
  | 'modified'
  | 'conflict'
  | 'web-only'
  | 'disk-changed';

/**
 * Virtual file representation in IndexedDB
 * Overlay layer on top of real disk files
 */
export interface VirtualFile {
  id: string;
  path: string;
  realPath: string | null;
  fileHandle: FileSystemFileHandle | null;
  dirHandle: FileSystemDirectoryHandle | null;
  virtualName: string;
  contentOverride: string | null;
  isDirty: boolean;
  isHidden: boolean;
  isWebOnly: boolean;
  lastSyncedAt: number;
  diskLastModified: number | null;
  status: FileStatus;
  type: 'file' | 'folder';
  children?: VirtualFile[];
  projectId?: string;
  createdAt: number;
  updatedAt: number;
}

/**
 * Project metadata stored in IndexedDB
 */
export interface Project {
  id: string;
  name: string;
  dirHandle: FileSystemDirectoryHandle;
  createdAt: number;
  lastOpenedAt: number;
}

/**
 * App settings stored in IndexedDB
 */
export interface AppSettings {
  theme: 'dark' | 'light' | 'system';
  pollingActiveInterval: number; // ms - for active file sync (default 30000)
  directoryScanInterval: number; // ms - for new file detection (default 60000)
  ignoredFolders: string[];
  showToc: boolean; // Show Table of Contents panel (default false)
}
