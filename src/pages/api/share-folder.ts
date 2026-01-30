/**
 * Share Folder API endpoint
 * POST: Create a new folder share with content stored in Upstash Redis
 */
import { Redis } from '@upstash/redis';
import type { APIRoute } from 'astro';
import type { FileContent, TreeNode } from '../../lib/share';

export const prerender = false;

const DEFAULT_SHARE_TTL_DAYS = 7;
const MAX_CONTENT_SIZE = 1024 * 1024; // 1MB

function generateShareId(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let id = '';
  for (let i = 0; i < 8; i++) {
    id += chars[Math.floor(Math.random() * chars.length)];
  }
  return id;
}

// Validate TreeNode structure recursively
function isValidTreeNode(node: unknown): node is TreeNode {
  if (!node || typeof node !== 'object') return false;
  const n = node as Record<string, unknown>;
  if (typeof n.name !== 'string' || !n.name) return false;
  if (n.type !== 'folder' && n.type !== 'file') return false;
  if (typeof n.path !== 'string' || !n.path) return false;
  if (n.children !== undefined) {
    if (!Array.isArray(n.children)) return false;
    for (const child of n.children) {
      if (!isValidTreeNode(child)) return false;
    }
  }
  return true;
}

// Validate FileContent structure
function isValidFileContent(file: unknown): file is FileContent {
  if (!file || typeof file !== 'object') return false;
  const f = file as Record<string, unknown>;
  return typeof f.path === 'string' && typeof f.content === 'string';
}

export const POST: APIRoute = async ({ request }) => {
  try {
    // Check for required env vars
    if (
      !import.meta.env.UPSTASH_REDIS_REST_URL ||
      !import.meta.env.UPSTASH_REDIS_REST_TOKEN
    ) {
      return new Response(
        JSON.stringify({ error: 'Share feature not configured' }),
        { status: 503, headers: { 'Content-Type': 'application/json' } },
      );
    }

    const body = await request.json();
    const { title, tree, files, expiryDays } = body;

    // Validate tree
    if (!Array.isArray(tree) || tree.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Tree is required and must be non-empty array' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } },
      );
    }

    for (const node of tree) {
      if (!isValidTreeNode(node)) {
        return new Response(
          JSON.stringify({ error: 'Invalid tree structure' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } },
        );
      }
    }

    // Validate files
    if (!Array.isArray(files) || files.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Files array is required and must be non-empty' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } },
      );
    }

    for (const file of files) {
      if (!isValidFileContent(file)) {
        return new Response(
          JSON.stringify({ error: 'Invalid file structure' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } },
        );
      }
    }

    // Calculate TTL (1-30 days)
    const days =
      typeof expiryDays === 'number' && expiryDays >= 1 && expiryDays <= 30
        ? expiryDays
        : DEFAULT_SHARE_TTL_DAYS;
    const ttlSeconds = 60 * 60 * 24 * days;

    // Calculate total content size
    const encoder = new TextEncoder();
    const totalSize = files.reduce(
      (sum: number, f: FileContent) => sum + encoder.encode(f.content).length,
      0,
    );

    if (totalSize > MAX_CONTENT_SIZE) {
      return new Response(
        JSON.stringify({
          error: `Content too large (${Math.round(totalSize / 1024)}KB, max ${MAX_CONTENT_SIZE / 1024}KB)`,
        }),
        { status: 413, headers: { 'Content-Type': 'application/json' } },
      );
    }

    // Connect to Redis
    const redis = new Redis({
      url: import.meta.env.UPSTASH_REDIS_REST_URL,
      token: import.meta.env.UPSTASH_REDIS_REST_TOKEN,
    });

    // Generate unique ID and store
    const shareId = generateShareId();
    const key = `share:folder:${shareId}`;

    const data = JSON.stringify({
      title: title || 'Shared Folder',
      tree,
      files,
      createdAt: Date.now(),
      expiryDays: days,
    });

    await redis.set(key, data, { ex: ttlSeconds });

    return new Response(JSON.stringify({ id: shareId }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('[api/share-folder] Error:', err);
    return new Response(
      JSON.stringify({ error: 'Failed to create folder share' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    );
  }
};
