/**
 * FileItem component
 * Recursive tree node for files and folders with hover actions
 */
import { useState, useRef, useEffect } from 'preact/hooks';
import {
  activeFileId,
  activeFileContent,
  selectedNodeId,
  expandedFolders,
  files,
  selectFile,
  selectNode,
  toggleFolder,
  createFile,
  createFolder,
  refreshFiles,
  closeTab,
  openFolder,
  errorMessage,
  currentProject,
} from '../stores/file-store';
import { inlineCreating } from './Sidebar';
import { StatusIcon } from './StatusIcon';
import { renameFile, hideOrDeleteFile, saveToDisk, syncFromDisk, getContent } from '../lib/virtual-fs';
import { syncFolderFromDisk } from '../lib/polling';
import { saveFile } from '../lib/database';
import type { VirtualFile } from '../types';

interface TreeNode extends VirtualFile {
  children: TreeNode[];
}

interface FileItemProps {
  node: TreeNode;
  depth?: number;
}

/**
 * Inline create input - shown inside folder when creating
 */
function InlineCreateInput({ parentPath, depth }: { parentPath: string; depth: number }) {
  const [newName, setNewName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const creating = inlineCreating.value;
  const paddingLeft = `${(depth + 1) * 12 + 8}px`;

  useEffect(() => {
    // Auto-focus input when mounted
    const timer = setTimeout(() => inputRef.current?.focus(), 0);
    return () => clearTimeout(timer);
  }, []);

  const handleConfirm = async () => {
    if (!newName.trim() || isSubmitting || !creating) {
      if (!newName.trim()) inlineCreating.value = null;
      return;
    }

    // Validate file extension
    if (creating.type === 'file') {
      const trimmedName = newName.trim();
      const hasExtension = trimmedName.includes('.') && !trimmedName.startsWith('.');
      if (hasExtension && !trimmedName.toLowerCase().endsWith('.md')) {
        errorMessage.value = 'Only .md files are allowed';
        return;
      }
    }

    setIsSubmitting(true);
    try {
      const name = creating.type === 'file'
        ? (newName.endsWith('.md') ? newName : newName + '.md')
        : newName;

      let newId: string | null = null;
      if (creating.type === 'file') {
        newId = await createFile(name, parentPath || undefined);
      } else {
        newId = await createFolder(name, parentPath || undefined);
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

  if (!creating) return null;

  return (
    <div
      class="flex items-center gap-1.5 px-2 py-1.5 rounded-md bg-muted/30 border border-primary/50 my-0.5"
      style={{ marginLeft: paddingLeft }}
    >
      {/* Spacer for chevron */}
      <div class="w-3.5 flex-shrink-0" />
      {/* Icon */}
      {creating.type === 'folder' ? (
        <div class="i-lucide-folder w-4 h-4 flex-shrink-0" style={{ color: 'var(--folder-icon)' }} />
      ) : (
        <div class="i-lucide-file-text w-4 h-4 flex-shrink-0" />
      )}
      {/* Input */}
      <input
        ref={inputRef}
        type="text"
        value={newName}
        onInput={(e) => setNewName((e.target as HTMLInputElement).value)}
        onKeyDown={handleKeyDown}
        onBlur={() => setTimeout(handleCancel, 150)}
        placeholder={creating.type === 'folder' ? 'Folder name...' : 'File name...'}
        class="flex-1 text-sm bg-transparent outline-none text-foreground placeholder:text-muted-foreground"
      />
    </div>
  );
}

export function FileItem({ node, depth = 0 }: FileItemProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);
  const [newName, setNewName] = useState(node.virtualName);
  const renameInputRef = useRef<HTMLInputElement>(null);

  const isActive = activeFileId.value === node.id;
  const isSelected = selectedNodeId.value === node.id;
  const isExpanded = expandedFolders.value.has(node.id);
  const isFolder = node.type === 'folder';
  const paddingLeft = `${depth * 12 + 8}px`;

  // Focus rename input when renaming starts
  useEffect(() => {
    if (isRenaming) {
      setTimeout(() => renameInputRef.current?.focus(), 0);
    }
  }, [isRenaming]);

  const handleClick = () => {
    if (isRenaming) return;
    // Always select the node for context
    selectNode(node.id);

    if (isFolder) {
      toggleFolder(node.id);
    } else {
      selectFile(node.id);
    }
  };

  const handleMenuClick = (e: Event) => {
    e.stopPropagation();
    setShowMenu(!showMenu);
  };

  // === Context Menu Actions ===

  const handleRename = (e: Event) => {
    e.stopPropagation();
    setShowMenu(false);
    setNewName(node.virtualName);
    setIsRenaming(true);
  };

  const handleRenameConfirm = async () => {
    const trimmed = newName.trim();
    if (!trimmed || trimmed === node.virtualName) {
      setIsRenaming(false);
      return;
    }
    try {
      await renameFile(node.id, trimmed);
      await refreshFiles();
    } catch (err) {
      console.error('[FileItem] Rename failed:', err);
    }
    setIsRenaming(false);
  };

  const handleRenameKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleRenameConfirm();
    } else if (e.key === 'Escape') {
      setIsRenaming(false);
    }
  };

  const handleDuplicate = async (e: Event) => {
    e.stopPropagation();
    setShowMenu(false);
    try {
      // Get content
      const content = await getContent(node.id);
      // Generate duplicate name
      const baseName = node.virtualName.replace(/\.md$/, '');
      const parentPath = node.path.split('/').slice(0, -1).join('/') || undefined;
      let duplicateName = `${baseName} (copy).md`;
      let counter = 1;
      // Check for existing duplicates
      while (files.value.some(f => f.path === (parentPath ? `${parentPath}/${duplicateName}` : duplicateName))) {
        counter++;
        duplicateName = `${baseName} (copy ${counter}).md`;
      }
      // Create duplicate file
      const newId = await createFile(duplicateName, parentPath);
      if (newId) {
        // Update content
        const newFile = files.value.find(f => f.id === newId);
        if (newFile) {
          newFile.contentOverride = content;
          await saveFile(newFile);
          await refreshFiles();
          selectNode(newId);
          await selectFile(newId);
        }
      }
    } catch (err) {
      console.error('[FileItem] Duplicate failed:', err);
    }
  };

  const handleSaveToDisk = async (e: Event) => {
    e.stopPropagation();
    setShowMenu(false);
    try {
      await saveToDisk(node.id);
      await refreshFiles();
    } catch (err) {
      console.error('[FileItem] Save to disk failed:', err);
    }
  };

  const handleSyncFromDisk = async (e: Event) => {
    e.stopPropagation();
    setShowMenu(false);
    try {
      await syncFromDisk(node.id);
      await refreshFiles();
      // If this is the active file, reload its content
      if (activeFileId.value === node.id) {
        const content = await getContent(node.id);
        activeFileContent.value = content;
      }
    } catch (err) {
      console.error('[FileItem] Sync from disk failed:', err);
    }
  };

  const handleDelete = async (e: Event) => {
    e.stopPropagation();
    setShowMenu(false);
    const itemType = node.type === 'folder' ? 'folder' : 'file';
    const confirmMsg = node.isWebOnly
      ? `Delete "${node.virtualName}"? This cannot be undone.`
      : `Hide "${node.virtualName}" from the list? The ${itemType} will remain on disk and can be restored by syncing.`;
    if (!confirm(confirmMsg)) return;
    try {
      // If this is the active file, close tab and clear selection
      if (activeFileId.value === node.id) {
        closeTab(node.id);
      }
      await hideOrDeleteFile(node.id);
      await refreshFiles();
    } catch (err) {
      console.error('[FileItem] Delete failed:', err);
    }
  };

  const handleSyncFolderFromDisk = async (e: Event) => {
    e.stopPropagation();
    setShowMenu(false);
    const proceed = confirm(
      `Sync "${node.virtualName}" from disk?\n\nThis will replace all local changes in this folder with disk content.`
    );
    if (!proceed) return;
    try {
      const result = await syncFolderFromDisk(node.id);
      if (result.needReopen) {
        // Need to reopen folder to get permission
        const reopen = confirm(
          `Folder access lost after page refresh.\n\nPlease reopen the folder "${result.needReopen}" to restore access.\n\n(Select the exact folder when the picker opens)`
        );
        if (reopen) {
          await openFolder();
        }
      } else if (!result.success) {
        alert('Failed to sync folder. The folder may have been moved or renamed.');
      }
    } catch (err) {
      console.error('[FileItem] Sync folder from disk failed:', err);
    }
  };

  return (
    <div>
      <div
        class={`group flex items-center gap-1.5 px-2 py-1.5 rounded-md cursor-pointer transition-colors relative ${
          isSelected || isActive ? 'bg-[var(--sidebar-accent)] text-foreground' : 'hover:bg-[var(--sidebar-accent)] text-muted-foreground hover:text-foreground'
        }`}
        style={{ paddingLeft }}
        onClick={handleClick}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => { setIsHovered(false); setShowMenu(false); }}
      >
        {/* Active indicator bar - GitHub style */}
        {isActive && (
          <div class="absolute left-0 top-1 bottom-1 w-0.5 bg-[var(--primary)] rounded-r" />
        )}

        {/* Folder chevron */}
        {isFolder ? (
          <div class={`i-lucide-chevron-right w-3.5 h-3.5 transition-transform flex-shrink-0 ${isExpanded ? 'rotate-90' : ''}`} />
        ) : (
          <div class="w-3.5 flex-shrink-0" />
        )}

        {/* Icon - folder uses theme color, file is neutral */}
        {isFolder ? (
          <div class="i-lucide-folder w-4 h-4 flex-shrink-0" style={{ color: 'var(--folder-icon)' }} />
        ) : (
          <div class="i-lucide-file-text w-4 h-4 flex-shrink-0" />
        )}

        {/* Name or Rename Input */}
        {isRenaming ? (
          <input
            ref={renameInputRef}
            type="text"
            value={newName}
            onInput={(e) => setNewName((e.target as HTMLInputElement).value)}
            onKeyDown={handleRenameKeyDown}
            onBlur={() => setTimeout(handleRenameConfirm, 100)}
            class="flex-1 text-sm bg-input border border-border rounded px-1 py-0.5 outline-none focus:ring-1 focus:ring-primary"
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <span class="flex-1 text-sm truncate">{node.virtualName}</span>
        )}

        {/* Status icon and actions */}
        <div class="flex items-center gap-1 flex-shrink-0">
          {/* Status icon - always visible for files, and for web-only folders */}
          {(!isFolder || node.status === 'web-only') && <StatusIcon status={node.status} />}

          {/* Hover action menu (for files and folders) */}
          <div class={`relative ${isHovered ? 'visible' : 'invisible'}`}>
            <button
              class="p-0.5 rounded hover:bg-muted/80 transition-opacity"
              onClick={handleMenuClick}
              aria-label={isFolder ? 'Folder options' : 'File options'}
            >
              <div class="i-lucide-more-vertical w-3.5 h-3.5" />
            </button>

            {showMenu && (
              <div class="absolute right-0 top-6 z-50 w-40 bg-popover border border-border/50 rounded-md shadow-lg py-1 backdrop-blur-xl">
                {/* Rename - for both files and folders */}
                <button
                  class="w-full px-3 py-1.5 text-left text-sm hover:bg-muted/50 transition-colors flex items-center gap-2"
                  onClick={handleRename}
                >
                  <div class="i-lucide-pencil w-3 h-3" />
                  Rename
                </button>

                {/* File-only options */}
                {!isFolder && (
                  <>
                    <button
                      class="w-full px-3 py-1.5 text-left text-sm hover:bg-muted/50 transition-colors flex items-center gap-2"
                      onClick={handleDuplicate}
                    >
                      <div class="i-lucide-copy w-3 h-3" />
                      Duplicate
                    </button>
                    <div class="h-px bg-border/50 my-1" />
                    <button
                      class="w-full px-3 py-1.5 text-left text-sm hover:bg-muted/50 transition-colors flex items-center gap-2"
                      onClick={handleSaveToDisk}
                    >
                      <div class="i-lucide-hard-drive w-3 h-3" />
                      Save to Disk
                    </button>
                    {/* Sync from Disk - only for disk files */}
                    {!node.isWebOnly && (
                      <button
                        class="w-full px-3 py-1.5 text-left text-sm hover:bg-muted/50 transition-colors flex items-center gap-2"
                        onClick={handleSyncFromDisk}
                      >
                        <div class="i-lucide-refresh-cw w-3 h-3" />
                        Sync from Disk
                      </button>
                    )}
                  </>
                )}

                {/* Folder-only options */}
                {isFolder && !node.isWebOnly && (
                  <>
                    <div class="h-px bg-border/50 my-1" />
                    <button
                      class="w-full px-3 py-1.5 text-left text-sm hover:bg-muted/50 transition-colors flex items-center gap-2"
                      onClick={handleSyncFolderFromDisk}
                    >
                      <div class="i-lucide-refresh-cw w-3 h-3" />
                      Sync from Disk
                    </button>
                  </>
                )}

                <div class="h-px bg-border/50 my-1" />

                {/* Delete/Hide option */}
                <button
                  class="w-full px-3 py-1.5 text-left text-sm text-destructive hover:bg-muted/50 transition-colors flex items-center gap-2"
                  onClick={handleDelete}
                >
                  <div class="i-lucide-trash-2 w-3 h-3" />
                  {node.isWebOnly ? 'Delete' : 'Hide'}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Children (if folder and expanded) */}
      {isFolder && isExpanded && (
        <div>
          {/* Inline create input - shows when this folder is the target */}
          {inlineCreating.value?.parentId === node.id && (
            <InlineCreateInput parentPath={node.path} depth={depth} />
          )}
          {node.children.map((child) => (
            <FileItem key={child.id} node={child} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
}
