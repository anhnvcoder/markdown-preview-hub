/**
 * Share service for markdown content
 * Handles sharing content via Upstash Redis with blob image detection
 */

const SHARE_API_ENDPOINT = '/api/share';

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
