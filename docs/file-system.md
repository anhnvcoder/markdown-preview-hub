# File System & Sync

This document explains how MD Preview Hub handles file system operations and synchronization.

## File System Access API

The app uses the [File System Access API](https://developer.mozilla.org/en-US/docs/Web/API/File_System_Access_API) to access local files directly in the browser.

### Key Handles

```typescript
FileSystemDirectoryHandle  // Reference to a folder
FileSystemFileHandle       // Reference to a file
```

These handles persist across page reloads (stored in IndexedDB) but require permission re-grant after browser restart.

## Virtual File System

Files are stored in IndexedDB as `VirtualFile` objects:

```typescript
interface VirtualFile {
  id: string;                    // UUID
  path: string;                  // Display path (e.g., "project/docs/readme.md")
  realPath: string | null;       // Actual disk path
  fileHandle: FileSystemFileHandle | null;
  dirHandle: FileSystemDirectoryHandle | null;
  virtualName: string;           // File/folder name
  contentOverride: string | null; // Unsaved local edits
  isDirty: boolean;              // Has unsaved changes
  isHidden: boolean;             // User hidden
  isWebOnly: boolean;            // Created in browser, not on disk
  lastSyncedAt: number;          // Last sync timestamp
  diskLastModified: number | null;
  status: FileStatus;
  type: 'file' | 'folder';
}

type FileStatus = 'synced' | 'modified' | 'conflict' | 'web-only' | 'disk-changed';
```

## Sync Mechanism

### Three Sync Triggers

| Trigger | Interval | Action |
|---------|----------|--------|
| **File Click** | Instant | `syncFileOnDemand()` - Read disk, compare, update |
| **Tab Focus** | Instant | Sync active file + scan for new files |
| **Polling (Active)** | 30s (configurable) | Check disk timestamp, auto-reload if no local edits |
| **Directory Scan** | 60s (fixed) | Detect new/deleted files in folder |

### Sync Flow

```
Check file handle permission
         ↓
Read file metadata (lastModified)
         ↓
Compare with stored diskLastModified
         ↓
If changed AND no local edits:
  → Auto-reload from disk
  → Update UI
         ↓
If changed AND has local edits:
  → Show conflict dialog
  → User chooses: Keep Local / Use Disk
```

### Conflict Resolution

When both local and disk versions change:

```
┌─────────────────────────────────────┐
│         Conflict Detected           │
├─────────────────────────────────────┤
│ File was modified externally while  │
│ you have unsaved changes.           │
├─────────────────────────────────────┤
│  [Keep Local]     [Use Disk]        │
└─────────────────────────────────────┘
```

## Permission Handling

### Permission States

```typescript
'granted'   // Full access
'denied'    // No access
'prompt'    // Need to ask user
```

### Permission Lost

After browser restart, file handles lose permission. The app:

1. Shows "Permission lost" banner
2. Offers "Reconnect Folder" button
3. User re-selects folder → permissions restored

## Ignored Folders

Default ignored patterns (configurable in Settings):

```
node_modules, .git, dist, build, .next, .nuxt, .astro,
__pycache__, .venv, venv, .idea, .vscode, .cache, .temp
```

These folders are skipped during directory scanning.

## File Operations

### Read File

```typescript
async function readFileContent(handle: FileSystemFileHandle): Promise<string> {
  const file = await handle.getFile();
  return file.text();
}
```

### Write File

```typescript
async function writeFileContent(handle: FileSystemFileHandle, content: string): Promise<void> {
  const writable = await handle.createWritable();
  await writable.write(content);
  await writable.close();
}
```

### Create New File (Web-Only)

```typescript
// Creates file in IndexedDB only (not on disk)
const newFile: VirtualFile = {
  id: crypto.randomUUID(),
  isWebOnly: true,
  status: 'web-only',
  // ...
};
```

## IndexedDB Schema

```typescript
interface MDPreviewDB {
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
```

## Performance Optimizations

1. **Lazy Content Loading**: File content only loaded when selected
2. **Metadata-Only Scans**: Directory scans only read timestamps, not content
3. **Debounced Updates**: State updates batched to reduce re-renders
4. **Handle Caching**: File handles reused, not re-queried
