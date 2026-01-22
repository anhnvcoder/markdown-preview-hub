/**
 * Image loader for local filesystem images
 * Uses File System Access API to load images referenced in markdown
 * Handles blob URL invalidation after page reload
 */
import { currentProject, files } from '../stores/file-store';

// Cache blob URLs to avoid reloading same images
const blobUrlCache = new Map<string, string>();

// Track which blob URLs have been verified as valid
const verifiedUrls = new Set<string>();

/**
 * Check if a blob URL is still valid
 * Blob URLs become invalid after page reload
 */
async function isBlobUrlValid(blobUrl: string): Promise<boolean> {
  // If already verified in this session, it's valid
  if (verifiedUrls.has(blobUrl)) {
    return true;
  }

  try {
    const response = await fetch(blobUrl, { method: 'HEAD' });
    if (response.ok) {
      verifiedUrls.add(blobUrl);
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

/**
 * Resolve relative image path to absolute path based on markdown file location
 * @param markdownPath - Path of the markdown file (e.g., "credit/docs/SRS/M12.md")
 * @param imageSrc - Relative image path from markdown (e.g., "../Figma/img.png")
 * @returns Resolved absolute path (e.g., "credit/docs/Figma/img.png")
 */
export function resolveImagePath(
  markdownPath: string,
  imageSrc: string
): string {
  // Skip absolute URLs and data URIs
  if (
    imageSrc.startsWith('http://') ||
    imageSrc.startsWith('https://') ||
    imageSrc.startsWith('data:') ||
    imageSrc.startsWith('blob:')
  ) {
    return imageSrc;
  }

  // Get directory of markdown file
  const parts = markdownPath.split('/');
  parts.pop(); // Remove filename
  const currentDir = [...parts];

  // Split image path into segments
  const imageParts = imageSrc.split('/');

  for (const segment of imageParts) {
    if (segment === '.' || segment === '') {
      continue;
    } else if (segment === '..') {
      if (currentDir.length > 0) {
        currentDir.pop();
      }
    } else {
      currentDir.push(segment);
    }
  }

  return currentDir.join('/');
}

/**
 * Load an image from the file system and return a blob URL
 * @param resolvedPath - Absolute path within the project (e.g., "credit/docs/Figma/img.png")
 * @param forceReload - Force reload even if cached
 * @returns Blob URL or null if not found
 */
export async function loadImage(
  resolvedPath: string,
  forceReload = false
): Promise<string | null> {
  // Check cache first (unless force reload)
  if (!forceReload && blobUrlCache.has(resolvedPath)) {
    const cachedUrl = blobUrlCache.get(resolvedPath)!;
    // Verify the blob URL is still valid
    const isValid = await isBlobUrlValid(cachedUrl);
    if (isValid) {
      return cachedUrl;
    }
    // Invalid - remove from cache and reload
    blobUrlCache.delete(resolvedPath);
    URL.revokeObjectURL(cachedUrl);
  }

  const project = currentProject.value;
  if (!project?.dirHandle) {
    console.warn('[image-loader] No project directory handle available');
    return null;
  }

  try {
    // Path format: "rootFolder/path/to/image.png"
    // We need to navigate from root dirHandle
    const pathParts = resolvedPath.split('/');

    // First part should be the root folder name (project.dirHandle.name)
    // Skip it since we start from dirHandle
    if (pathParts[0] === project.dirHandle.name) {
      pathParts.shift();
    }

    // Navigate to the image file
    let currentHandle: FileSystemDirectoryHandle = project.dirHandle;

    for (let i = 0; i < pathParts.length - 1; i++) {
      const dirName = pathParts[i];
      try {
        currentHandle = await currentHandle.getDirectoryHandle(dirName);
      } catch {
        console.warn(
          `[image-loader] Directory not found: ${dirName} in path ${resolvedPath}`
        );
        return null;
      }
    }

    // Get the file
    const fileName = pathParts[pathParts.length - 1];
    const fileHandle = await currentHandle.getFileHandle(fileName);
    const file = await fileHandle.getFile();

    // Create blob URL
    const blobUrl = URL.createObjectURL(file);
    blobUrlCache.set(resolvedPath, blobUrl);
    verifiedUrls.add(blobUrl);

    return blobUrl;
  } catch (err) {
    console.warn(`[image-loader] Failed to load image: ${resolvedPath}`, err);
    return null;
  }
}

/**
 * Load image directly from a file's parent directory handle
 * Used when we have the markdown file's dirHandle available
 * @param dirHandle - Parent directory handle of the markdown file
 * @param imageSrc - Relative image path from markdown
 * @returns Blob URL or null if not found
 */
export async function loadImageFromHandle(
  dirHandle: FileSystemDirectoryHandle,
  imageSrc: string
): Promise<string | null> {
  // Check cache
  const cacheKey = `${dirHandle.name}:${imageSrc}`;
  if (blobUrlCache.has(cacheKey)) {
    return blobUrlCache.get(cacheKey)!;
  }

  try {
    const imageParts = imageSrc.split('/');
    let currentHandle = dirHandle;

    // Navigate through path segments
    for (let i = 0; i < imageParts.length - 1; i++) {
      const segment = imageParts[i];
      if (segment === '.' || segment === '') {
        continue;
      } else if (segment === '..') {
        // Can't go up from dirHandle, need to use parent lookup
        // This is a limitation - we'd need the full directory tree
        console.warn('[image-loader] Cannot navigate up from current handle');
        return null;
      } else {
        currentHandle = await currentHandle.getDirectoryHandle(segment);
      }
    }

    const fileName = imageParts[imageParts.length - 1];
    const fileHandle = await currentHandle.getFileHandle(fileName);
    const file = await fileHandle.getFile();

    const blobUrl = URL.createObjectURL(file);
    blobUrlCache.set(cacheKey, blobUrl);

    return blobUrl;
  } catch (err) {
    console.warn(
      `[image-loader] Failed to load image from handle: ${imageSrc}`,
      err
    );
    return null;
  }
}

/**
 * Process all images in a container, loading local images from filesystem
 * @param container - DOM element containing rendered markdown
 * @param markdownPath - Path of the current markdown file
 */
export async function processImages(
  container: HTMLElement,
  markdownPath: string
): Promise<void> {
  const images = container.querySelectorAll('img');

  const loadPromises = Array.from(images).map(async (img) => {
    const src = img.getAttribute('src');
    if (!src) return;

    // Skip already processed or external images
    if (
      src.startsWith('http://') ||
      src.startsWith('https://') ||
      src.startsWith('data:') ||
      src.startsWith('blob:')
    ) {
      return;
    }

    // Resolve and load local image
    const resolvedPath = resolveImagePath(markdownPath, src);
    const blobUrl = await loadImage(resolvedPath);

    if (blobUrl) {
      img.src = blobUrl;
      img.dataset.originalSrc = src; // Keep original for reference
    } else {
      // Mark as broken with helpful message
      img.alt = `[Image not found: ${src}]`;
      img.style.opacity = '0.5';
      img.style.border = '1px dashed var(--border)';
      img.style.padding = '1rem';
      img.style.borderRadius = '0.5rem';
    }
  });

  await Promise.all(loadPromises);
}

/**
 * Clear blob URL cache and revoke all URLs
 * Call when switching projects or cleaning up
 */
export function clearImageCache(): void {
  for (const url of blobUrlCache.values()) {
    URL.revokeObjectURL(url);
  }
  blobUrlCache.clear();
  verifiedUrls.clear();
}

/**
 * Reload all images in a container
 * Useful after folder reconnection or when images become stale
 */
export async function reloadImages(
  container: HTMLElement,
  markdownPath: string
): Promise<void> {
  const images = container.querySelectorAll('img');

  const reloadPromises = Array.from(images).map(async (img) => {
    const originalSrc = img.dataset.originalSrc || img.getAttribute('src');
    if (!originalSrc) return;

    // Skip external images
    if (
      originalSrc.startsWith('http://') ||
      originalSrc.startsWith('https://') ||
      originalSrc.startsWith('data:')
    ) {
      return;
    }

    // Force reload from filesystem
    const resolvedPath = resolveImagePath(markdownPath, originalSrc);
    const blobUrl = await loadImage(resolvedPath, true);

    if (blobUrl) {
      img.src = blobUrl;
      img.dataset.originalSrc = originalSrc;
      // Reset error styling
      img.style.opacity = '';
      img.style.border = '';
      img.style.padding = '';
      img.style.borderRadius = '';
      img.alt = img.alt.replace(/^\[Image not found:.*\]$/, '');
    }
  });

  await Promise.all(reloadPromises);
}
