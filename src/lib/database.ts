/**
 * IndexedDB database operations using idb wrapper
 * Stores: projects, files, settings
 */
import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { VirtualFile, Project, AppSettings } from '../types';

// Database schema
interface MDPreviewDB extends DBSchema {
  projects: {
    key: string;
    value: Project;
    indexes: { 'by-name': string };
  };
  files: {
    key: string;
    value: VirtualFile;
    indexes: {
      'by-path': string;
      'by-status': string;
      'by-project': string;
    };
  };
  settings: {
    key: string;
    value: AppSettings;
  };
}

const DB_NAME = 'md-preview-hub';
const DB_VERSION = 1;

let dbInstance: IDBPDatabase<MDPreviewDB> | null = null;

/**
 * Get or create database instance
 */
export async function getDB(): Promise<IDBPDatabase<MDPreviewDB>> {
  if (dbInstance) return dbInstance;

  dbInstance = await openDB<MDPreviewDB>(DB_NAME, DB_VERSION, {
    upgrade(db) {
      // Projects store
      if (!db.objectStoreNames.contains('projects')) {
        const projectStore = db.createObjectStore('projects', { keyPath: 'id' });
        projectStore.createIndex('by-name', 'name');
      }

      // Files store
      if (!db.objectStoreNames.contains('files')) {
        const fileStore = db.createObjectStore('files', { keyPath: 'id' });
        fileStore.createIndex('by-path', 'path');
        fileStore.createIndex('by-status', 'status');
        fileStore.createIndex('by-project', 'projectId');
      }

      // Settings store
      if (!db.objectStoreNames.contains('settings')) {
        db.createObjectStore('settings', { keyPath: 'key' });
      }
    },
  });

  return dbInstance;
}

// ============ Projects ============

export async function saveProject(project: Project): Promise<void> {
  const db = await getDB();
  await db.put('projects', project);
}

export async function getProject(id: string): Promise<Project | undefined> {
  const db = await getDB();
  return db.get('projects', id);
}

export async function getAllProjects(): Promise<Project[]> {
  const db = await getDB();
  return db.getAll('projects');
}

export async function deleteProject(id: string): Promise<void> {
  const db = await getDB();
  await db.delete('projects', id);
  // Also delete all files for this project
  const files = await getFilesByProject(id);
  for (const file of files) {
    await db.delete('files', file.id);
  }
}

// ============ Files ============

export async function saveFile(file: VirtualFile): Promise<void> {
  const db = await getDB();
  await db.put('files', file);
}

export async function saveFiles(files: VirtualFile[]): Promise<void> {
  const db = await getDB();
  const tx = db.transaction('files', 'readwrite');
  await Promise.all([
    ...files.map(file => tx.store.put(file)),
    tx.done,
  ]);
}

export async function getFile(id: string): Promise<VirtualFile | undefined> {
  const db = await getDB();
  return db.get('files', id);
}

export async function getFileByPath(path: string): Promise<VirtualFile | undefined> {
  const db = await getDB();
  return db.getFromIndex('files', 'by-path', path);
}

export async function getAllFiles(): Promise<VirtualFile[]> {
  const db = await getDB();
  return db.getAll('files');
}

export async function getFilesByProject(projectId: string): Promise<VirtualFile[]> {
  const db = await getDB();
  return db.getAllFromIndex('files', 'by-project', projectId);
}

export async function getFilesByStatus(status: string): Promise<VirtualFile[]> {
  const db = await getDB();
  return db.getAllFromIndex('files', 'by-status', status);
}

export async function updateFile(id: string, updates: Partial<VirtualFile>): Promise<void> {
  const db = await getDB();
  const file = await db.get('files', id);
  if (file) {
    await db.put('files', { ...file, ...updates, updatedAt: Date.now() });
  }
}

export async function deleteFile(id: string): Promise<void> {
  const db = await getDB();
  await db.delete('files', id);
}

export async function clearAllFiles(): Promise<void> {
  const db = await getDB();
  await db.clear('files');
}

// ============ Settings ============

const DEFAULT_SETTINGS: AppSettings = {
  theme: 'dark',
  pollingActiveInterval: 30000,  // 30s for active file
  directoryScanInterval: 60000,  // 60s for directory scan
  ignoredFolders: [
    'node_modules', '.git', 'dist', 'build', '.next', '.nuxt',
    '.astro', '.cache', '.temp', '__pycache__', '.idea', '.vscode'
  ],
};

export async function getSettings(): Promise<AppSettings> {
  const db = await getDB();
  const settings = await db.get('settings', 'app');
  return settings || DEFAULT_SETTINGS;
}

export async function saveSettings(settings: Partial<AppSettings>): Promise<void> {
  const db = await getDB();
  const current = await getSettings();
  await db.put('settings', { ...current, ...settings, key: 'app' } as any);
}
