/**
 * Sidebar component
 * File tree with status indicators, create file/folder, and manual refresh
 */
import { signal } from '@preact/signals';
import { useState } from 'preact/hooks';
import { fullRescanFromDisk, isSyncing } from '../lib/polling';
import {
  createFile,
  createFolder,
  currentProject,
  errorMessage,
  expandedFolders,
  files,
  fileTree,
  openFolder,
  selectedNodeId,
  selectFile,
  selectNode,
  uploadFiles,
  uploadFolder,
} from '../stores/file-store';
import { toggleSidebar } from './App';
import { FileItem } from './FileItem';
import { showUploadWarning } from './UploadWarningModal';

// Shared signals for inline creating - accessible by FileItem
export const inlineCreating = signal<{
  type: 'file' | 'folder';
  parentId: string | null;
} | null>(null);

/**
 * Root level inline create input
 */
function RootInlineCreateInput() {
  const [newName, setNewName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const inputRef = { current: null as HTMLInputElement | null };
  const creating = inlineCreating.value;

  // Can't use useEffect in this context since useState is imported
  // Use autoFocus instead

  const handleConfirm = async () => {
    if (!newName.trim() || isSubmitting || !creating) {
      if (!newName.trim()) inlineCreating.value = null;
      return;
    }

    // Validate file extension
    if (creating.type === 'file') {
      const trimmedName = newName.trim();
      const hasExtension =
        trimmedName.includes('.') && !trimmedName.startsWith('.');
      if (hasExtension && !trimmedName.toLowerCase().endsWith('.md')) {
        errorMessage.value = 'Only .md files are allowed';
        return;
      }
    }

    setIsSubmitting(true);
    try {
      const name =
        creating.type === 'file'
          ? newName.endsWith('.md')
            ? newName
            : newName + '.md'
          : newName;

      let newId: string | null = null;
      if (creating.type === 'file') {
        newId = await createFile(name, undefined);
      } else {
        newId = await createFolder(name, undefined);
      }

      if (newId) {
        selectNode(newId);
        if (creating.type === 'file') {
          await selectFile(newId);
        }
      }
    } finally {
      setIsSubmitting(false);
      inlineCreating.value = null;
    }
  };

  const handleCancel = () => {
    inlineCreating.value = null;
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleConfirm();
    } else if (e.key === 'Escape') {
      handleCancel();
    }
  };

  if (!creating || creating.parentId !== null) return null;

  return (
    <div class='flex items-center gap-1.5 px-2 py-1.5 rounded-md bg-muted/30 border border-primary/50 mb-1'>
      {creating.type === 'folder' ? (
        <div
          class='i-lucide-folder w-4 h-4 flex-shrink-0'
          style={{ color: 'var(--folder-icon)' }}
        />
      ) : (
        <div class='i-lucide-file-text w-4 h-4 flex-shrink-0' />
      )}
      <input
        ref={(el) => {
          inputRef.current = el;
          el?.focus();
        }}
        type='text'
        value={newName}
        onInput={(e) => setNewName((e.target as HTMLInputElement).value)}
        onKeyDown={handleKeyDown}
        onBlur={() => setTimeout(handleCancel, 150)}
        placeholder={
          creating.type === 'folder' ? 'Folder name...' : 'File name...'
        }
        class='flex-1 text-sm bg-transparent outline-none text-foreground placeholder:text-muted-foreground'
      />
    </div>
  );
}

export function Sidebar() {
  const tree = fileTree.value;
  const project = currentProject.value;
  const syncing = isSyncing.value;
  const [showAddMenu, setShowAddMenu] = useState(false);

  const handleNewClick = () => {
    setShowAddMenu(!showAddMenu);
  };

  const handleRefresh = async () => {
    // Always show confirmation for full rescan
    const proceed = confirm(
      'Sync from disk will replace all local changes with disk content.\n\nHidden files will be restored. Web-only files will be kept.\n\nContinue?'
    );
    if (!proceed) return;

    const result = await fullRescanFromDisk();
    if (result === 'need-reopen') {
      const rootName = project?.name || 'project';
      const reopen = confirm(
        `Folder access lost after page refresh.\n\nPlease reopen the ROOT folder "${rootName}" (not a subfolder) to restore access.`
      );
      if (reopen) {
        await openFolder();
      }
    }
  };

  const handleCollapse = () => {
    toggleSidebar();
  };

  const startCreate = (type: 'file' | 'folder') => {
    setShowAddMenu(false);

    // Determine parent folder based on selection
    let parentId: string | null = null;
    if (selectedNodeId.value) {
      const selected = files.value.find((f) => f.id === selectedNodeId.value);
      if (selected) {
        if (selected.type === 'folder') {
          parentId = selected.id;
          // Auto-expand the folder
          const current = new Set(expandedFolders.value);
          current.add(selected.id);
          expandedFolders.value = current;
        } else {
          // File selected - use its parent folder
          const parentPath = selected.path.split('/').slice(0, -1).join('/');
          if (parentPath) {
            const parentFolder = files.value.find(
              (f) => f.path === parentPath && f.type === 'folder'
            );
            parentId = parentFolder?.id ?? null;
            if (parentId) {
              const current = new Set(expandedFolders.value);
              current.add(parentId);
              expandedFolders.value = current;
            }
          }
        }
      }
    }

    // Set inline creating signal - FileItem will render the input
    inlineCreating.value = { type, parentId };
  };

  const handleUploadClick = async () => {
    setShowAddMenu(false);
    const result = await uploadFiles(showUploadWarning);
    // Focus on the first uploaded file
    if (result.firstFileId) {
      selectNode(result.firstFileId);
      await selectFile(result.firstFileId);
    }
  };

  const handleUploadFolderClick = async () => {
    setShowAddMenu(false);
    const result = await uploadFolder(showUploadWarning);
    // Focus on the uploaded root folder
    if (result.rootFolderId) {
      selectNode(result.rootFolderId);
    }
  };

  const handleOpenProjectClick = async () => {
    setShowAddMenu(false);
    await openFolder();
  };

  return (
    <aside class='app-sidebar'>
      {/* Header */}
      <div class='p-3 border-b border-border/50 flex items-center justify-between'>
        <div class='flex items-center gap-2'>
          {/* Collapse button */}
          <button
            class='btn-icon p-1'
            onClick={handleCollapse}
            aria-label='Collapse sidebar'
            title='Collapse sidebar'
          >
            <div class='i-lucide-panel-left-close w-4 h-4' />
          </button>
          <h2 class='text-sm font-semibold text-muted-foreground uppercase tracking-wide'>
            Files
          </h2>
        </div>
        <div class='flex items-center gap-1'>
          {/* Refresh button */}
          {/* <button
            class={`btn-icon p-1 ${syncing ? 'animate-spin' : ''}`}
            onClick={handleRefresh}
            aria-label="Refresh files"
            disabled={!project || syncing}
            title="Sync with local folder"
          >
            <div class="i-lucide-refresh-cw w-4 h-4" />
          </button> */}

          {/* Add menu */}
          <div class='relative'>
            <button
              class='btn-icon p-1'
              onClick={handleNewClick}
              aria-label='New file or folder'
            >
              <div class='i-lucide-plus w-4 h-4' />
            </button>

            {/* Add dropdown menu */}
            {showAddMenu && (
              <div class='absolute right-0 top-8 z-50 w-44 bg-popover border border-border/50 rounded-md shadow-lg py-1 backdrop-blur-xl'>
                <button
                  class='w-full px-3 py-1.5 text-left text-sm hover:bg-muted/50 transition-colors flex items-center gap-2'
                  onClick={handleUploadClick}
                >
                  <div class='i-lucide-upload w-4 h-4 text-info' />
                  Upload File
                </button>
                <button
                  class='w-full px-3 py-1.5 text-left text-sm hover:bg-muted/50 transition-colors flex items-center gap-2'
                  onClick={handleUploadFolderClick}
                >
                  <div class='i-lucide-folder-up w-4 h-4 text-info' />
                  Upload Folder
                </button>
                <div class='h-px bg-border/50 my-1' />
                <button
                  class='w-full px-3 py-1.5 text-left text-sm hover:bg-muted/50 transition-colors flex items-center gap-2'
                  onClick={() => startCreate('file')}
                >
                  <div class='i-lucide-file-plus w-4 h-4 text-info' />
                  New File
                </button>
                <button
                  class='w-full px-3 py-1.5 text-left text-sm hover:bg-muted/50 transition-colors flex items-center gap-2'
                  onClick={() => startCreate('folder')}
                >
                  <div class='i-lucide-folder-plus w-4 h-4 text-info' />
                  New Folder
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* File tree - click empty space to deselect */}
      <div
        class='flex-1 overflow-y-auto p-2'
        onClick={(e) => {
          // Only deselect if clicking directly on the container (empty space)
          if (e.target === e.currentTarget) {
            selectNode('');
            selectedNodeId.value = null;
          }
        }}
      >
        {!project ? (
          <div class='text-sm text-muted-foreground p-2 flex flex-col items-center justify-center h-full text-center'>
            <div class='i-lucide-folder-open w-12 h-12 mb-3 opacity-20' />
            <p class='mb-3 font-medium'>No folder opened</p>
            <p class='text-xs max-w-[180px] mb-4 opacity-70'>
              Open a local folder to start editing markdown files
            </p>
            <button
              class='btn-primary text-xs gap-1.5'
              onClick={() => openFolder()}
            >
              <div class='i-lucide-folder-open w-3.5 h-3.5' />
              Open Folder
            </button>
          </div>
        ) : tree.length === 0 && !inlineCreating.value ? (
          <div class='text-sm text-muted-foreground p-2 flex flex-col items-center justify-center h-full text-center'>
            <div class='i-lucide-file-x w-12 h-12 mb-3 opacity-20' />
            <p>No markdown files found</p>
            <button
              class='mt-4 btn-secondary text-xs gap-1.5'
              onClick={handleUploadFolderClick}
            >
              <div class='i-lucide-folder-up w-3.5 h-3.5' />
              Import Folder
            </button>
          </div>
        ) : (
          <div
            class='space-y-0.5 min-h-full'
            onClick={(e) => {
              // Deselect when clicking empty space in the tree
              if (e.target === e.currentTarget) {
                selectedNodeId.value = null;
              }
            }}
          >
            {/* Root level inline create input */}
            <RootInlineCreateInput />
            {tree.map((node) => (
              <FileItem key={node.id} node={node} />
            ))}
          </div>
        )}
      </div>
    </aside>
  );
}
