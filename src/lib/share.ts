/**
 * Share service for markdown content
 * Handles sharing content via Upstash Redis with blob image detection
 */

import type { VirtualFile } from '../types';

const SHARE_API_ENDPOINT = '/api/share';
const SHARE_FOLDER_API_ENDPOINT = '/api/share-folder';
const MAX_FOLDER_FILES = 200; // Max files in a folder share to prevent DoS

export interface ShareResult {
  success: boolean;
  shareId?: string;
  shareUrl?: string;
  error?: string;
}

export interface ShareData {
  title: string;
  content: string;
  expiryDays?: number;
}

// Folder share types
export interface TreeNode {
  name: string;
  type: 'folder' | 'file';
  path: string;
  children?: TreeNode[];
}

export interface FileContent {
  path: string;
  content: string;
}

export interface FolderShareData {
  title: string;
  tree: TreeNode[];
  files: FileContent[];
  expiryDays?: number;
}

/**
 * Detect if content contains local blob URLs that won't work when shared
 * Returns list of detected blob URLs
 */
export function detectBlobUrls(content: string): string[] {
  // Match blob: URLs and data: URLs for images
  const blobPattern = /!\[.*?\]\((blob:[^)]+)\)/g;
  const dataPattern = /!\[.*?\]\((data:image[^)]+)\)/g;

  const blobs: string[] = [];
  let match;

  while ((match = blobPattern.exec(content)) !== null) {
    blobs.push(match[1]);
  }

  while ((match = dataPattern.exec(content)) !== null) {
    // Only warn about large data URLs (small icons are ok)
    if (match[1].length > 1000) {
      blobs.push('data:image (embedded)');
    }
  }

  return blobs;
}

/**
 * Check if content has local images that won't be visible when shared
 */
export function hasLocalImages(content: string): boolean {
  return detectBlobUrls(content).length > 0;
}

/**
 * Share markdown content and get a shareable URL
 */
export async function shareContent(data: ShareData): Promise<ShareResult> {
  try {
    const response = await fetch(SHARE_API_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      // Parse JSON error response
      let errorMsg = `HTTP ${response.status}`;
      try {
        const errorJson = await response.json();
        errorMsg = errorJson.error || errorMsg;
      } catch {
        // If not JSON, use status text
        errorMsg = response.statusText || errorMsg;
      }
      return {
        success: false,
        error: errorMsg,
      };
    }

    const result = await response.json();
    const shareUrl = `${window.location.origin}/share/${result.id}`;

    return {
      success: true,
      shareId: result.id,
      shareUrl,
    };
  } catch (err) {
    console.error('[share] Error sharing content:', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Network error',
    };
  }
}

/**
 * Build folder tree from VirtualFile[] for sharing
 * Filters to only include .md files and folders containing them
 */
export function buildFolderTree(
  files: VirtualFile[],
  rootPath: string,
): TreeNode[] {
  // Get all files under rootPath
  const filesUnderRoot = files.filter(
    (f) => f.path === rootPath || f.path.startsWith(rootPath + '/'),
  );

  // Build map of path -> VirtualFile for quick lookup
  const fileMap = new Map<string, VirtualFile>();
  filesUnderRoot.forEach((f) => fileMap.set(f.path, f));

  // Helper to check if a folder contains any .md files (recursively)
  function hasMdFiles(folderPath: string): boolean {
    return filesUnderRoot.some(
      (f) =>
        f.type === 'file' &&
        f.path.startsWith(folderPath + '/') &&
        f.path.endsWith('.md'),
    );
  }

  // Helper to get DIRECT children of a folder path
  function getDirectChildren(parentPath: string): VirtualFile[] {
    return filesUnderRoot.filter((f) => {
      if (f.path === parentPath) return false;
      // Must start with parent path + /
      if (!f.path.startsWith(parentPath + '/')) return false;
      // Get the part after parent path
      const remainder = f.path.slice(parentPath.length + 1);
      // Direct child has no more slashes
      return !remainder.includes('/');
    });
  }

  // Recursive function to build node
  function buildNode(file: VirtualFile): TreeNode | null {
    if (file.type === 'file') {
      if (!file.path.endsWith('.md')) return null;
      return {
        name: file.virtualName,
        type: 'file',
        path: file.path,
      };
    }

    // Folder: check if it has any .md descendants
    if (!hasMdFiles(file.path)) return null;

    // Get direct children and build their nodes
    const directChildren = getDirectChildren(file.path);
    const children = directChildren
      .map((child) => buildNode(child))
      .filter((node): node is TreeNode => node !== null)
      .sort((a, b) => {
        if (a.type !== b.type) return a.type === 'folder' ? -1 : 1;
        return a.name.localeCompare(b.name);
      });

    return {
      name: file.virtualName,
      type: 'folder',
      path: file.path,
      children,
    };
  }

  // Find root folder
  const rootFile = fileMap.get(rootPath);
  if (!rootFile || rootFile.type !== 'folder') {
    return [];
  }

  // Build root node
  const rootNode = buildNode(rootFile);
  return rootNode ? [rootNode] : [];
}

/**
 * Collect all .md file contents under a folder path
 * Checks each file for blob URLs
 */
export async function collectMdFiles(
  files: VirtualFile[],
  rootPath: string,
  getContentFn: (fileId: string) => Promise<string>,
): Promise<{ files: FileContent[]; hasBlobs: boolean }> {
  const mdFiles = files.filter(
    (f) =>
      f.type === 'file' &&
      f.path.endsWith('.md') &&
      (f.path === rootPath || f.path.startsWith(rootPath + '/')),
  );

  // Guard against too many files (DoS prevention)
  if (mdFiles.length > MAX_FOLDER_FILES) {
    throw new Error(`Too many files (max ${MAX_FOLDER_FILES})`);
  }

  let hasBlobs = false;
  const fileContents: FileContent[] = [];

  for (const file of mdFiles) {
    const content = await getContentFn(file.id);
    if (hasLocalImages(content)) {
      hasBlobs = true;
    }
    fileContents.push({
      path: file.path,
      content,
    });
  }

  return { files: fileContents, hasBlobs };
}

/**
 * Find first .md file alphabetically in tree (recursive)
 */
export function findFirstFile(tree: TreeNode[]): string | null {
  // Sort tree: folders first, then files, all alphabetically
  const sorted = [...tree].sort((a, b) => {
    if (a.type !== b.type) return a.type === 'folder' ? -1 : 1;
    return a.name.localeCompare(b.name);
  });

  for (const node of sorted) {
    if (node.type === 'file') {
      return node.path;
    }
    if (node.type === 'folder' && node.children?.length) {
      const found = findFirstFile(node.children);
      if (found) return found;
    }
  }

  return null;
}

/**
 * Calculate total size of folder files in bytes
 */
export function calculateFolderSize(files: FileContent[]): number {
  const encoder = new TextEncoder();
  return files.reduce((sum, f) => sum + encoder.encode(f.content).length, 0);
}

/**
 * Share folder content and get a shareable URL
 */
export async function shareFolderContent(
  data: FolderShareData,
): Promise<ShareResult> {
  try {
    const response = await fetch(SHARE_FOLDER_API_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      let errorMsg = `HTTP ${response.status}`;
      try {
        const errorJson = (await response.json()) as { error?: string };
        // Sanitize error message to prevent XSS
        errorMsg =
          typeof errorJson.error === 'string'
            ? errorJson.error.slice(0, 200)
            : errorMsg;
      } catch {
        errorMsg = response.statusText || errorMsg;
      }
      return {
        success: false,
        error: errorMsg,
      };
    }

    const result = await response.json();
    const shareUrl = `${window.location.origin}/share/folder/${result.id}`;

    return {
      success: true,
      shareId: result.id,
      shareUrl,
    };
  } catch (err) {
    console.error('[share] Error sharing folder:', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Network error',
    };
  }
}
