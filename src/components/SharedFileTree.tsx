/**
 * SharedFileTree component
 * Collapsible tree sidebar for folder share viewer
 * CSS copied exactly from FileItem.tsx for consistency
 */
import { useState } from 'preact/hooks';
import type { TreeNode } from '../lib/share';

interface SharedFileTreeProps {
  tree: TreeNode[];
  activePath: string;
  onFileSelect: (path: string) => void;
}

interface TreeNodeItemProps {
  node: TreeNode;
  activePath: string;
  onFileSelect: (path: string) => void;
  depth: number;
  expandedFolders: Set<string>;
  toggleFolder: (path: string) => void;
}

function TreeNodeItem({
  node,
  activePath,
  onFileSelect,
  depth,
  expandedFolders,
  toggleFolder,
}: TreeNodeItemProps) {
  const isActive = node.path === activePath;
  const isExpanded = expandedFolders.has(node.path);
  const isFolder = node.type === 'folder';
  // Exact same padding calculation as FileItem.tsx
  const paddingLeft = `${depth * 12 + 8}px`;

  const handleClick = () => {
    if (isFolder) {
      toggleFolder(node.path);
    } else {
      onFileSelect(node.path);
    }
  };

  return (
    <div>
      {/* Exact same classes as FileItem.tsx line 474-541 */}
      <div
        class={`group flex items-center gap-1.5 px-2 py-2.5 rounded-md cursor-pointer transition-colors relative ${
          isActive
            ? 'bg-[var(--sidebar-accent)] text-foreground'
            : 'hover:bg-[var(--sidebar-accent)] text-muted-foreground hover:text-foreground'
        }`}
        style={{ paddingLeft }}
        onClick={handleClick}
        title={node.name}
      >
        {/* Active indicator bar - GitHub style */}
        {isActive && (
          <div class="absolute left-0 top-1 bottom-1 w-0.5 bg-[var(--primary)] rounded-r" />
        )}

        {/* Folder chevron - same size as FileItem */}
        {isFolder ? (
          <div
            class={`i-lucide-chevron-right w-3.5 h-3.5 transition-transform flex-shrink-0 ${
              isExpanded ? 'rotate-90' : ''
            }`}
          />
        ) : (
          <div class="w-3.5 flex-shrink-0" />
        )}

        {/* Icon - same size as FileItem */}
        {isFolder ? (
          <div
            class="i-lucide-folder w-4 h-4 flex-shrink-0"
            style={{ color: 'var(--folder-icon)' }}
          />
        ) : (
          <div class="i-lucide-file-text w-4 h-4 flex-shrink-0" />
        )}

        {/* Name - same classes as FileItem */}
        <span class="flex-1 text-sm truncate">{node.name}</span>
      </div>

      {/* Children - render at next depth level */}
      {isFolder && isExpanded && node.children && (
        <div>
          {node.children.map((child) => (
            <TreeNodeItem
              key={child.path}
              node={child}
              activePath={activePath}
              onFileSelect={onFileSelect}
              depth={depth + 1}
              expandedFolders={expandedFolders}
              toggleFolder={toggleFolder}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function SharedFileTree({
  tree,
  activePath,
  onFileSelect,
}: SharedFileTreeProps) {
  // Only expand root folder initially
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(() => {
    const folders = new Set<string>();
    // Only add root level folders (depth 0)
    tree.forEach((node) => {
      if (node.type === 'folder') {
        folders.add(node.path);
      }
    });
    return folders;
  });

  const toggleFolder = (path: string) => {
    setExpandedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  };

  return (
    <nav class="space-y-0.5">
      {tree.map((node) => (
        <TreeNodeItem
          key={node.path}
          node={node}
          activePath={activePath}
          onFileSelect={onFileSelect}
          depth={0}
          expandedFolders={expandedFolders}
          toggleFolder={toggleFolder}
        />
      ))}
    </nav>
  );
}
