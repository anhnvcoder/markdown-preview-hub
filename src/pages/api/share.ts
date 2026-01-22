/**
 * Share API endpoint
 * POST: Create a new share with content stored in Upstash Redis
 */
import type { APIRoute } from 'astro';
import { Redis } from '@upstash/redis';

// Opt-out of prerendering for this API route
export const prerender = false;

// Default TTL: 7 days in seconds
const DEFAULT_SHARE_TTL_DAYS = 7;

// Max content size: 500KB (Redis free tier friendly)
const MAX_CONTENT_SIZE = 500 * 1024;

// Generate a short unique ID
function generateShareId(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let id = '';
  for (let i = 0; i < 8; i++) {
    id += chars[Math.floor(Math.random() * chars.length)];
  }
  return id;
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
    const { title, content, expiryDays } = body;

    // Validate input
    if (!content || typeof content !== 'string') {
      return new Response(JSON.stringify({ error: 'Content is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Calculate TTL in seconds (validate expiryDays: 1-30 days)
    const days =
      typeof expiryDays === 'number' && expiryDays >= 1 && expiryDays <= 30
        ? expiryDays
        : DEFAULT_SHARE_TTL_DAYS;
    const ttlSeconds = 60 * 60 * 24 * days;

    // Check content size
    const contentSize = new TextEncoder().encode(content).length;
    if (contentSize > MAX_CONTENT_SIZE) {
      return new Response(
        JSON.stringify({
          error: `Content too large (max ${MAX_CONTENT_SIZE / 1024}KB)`,
        }),
        { status: 413, headers: { 'Content-Type': 'application/json' } },
      );
    }

    // Connect to Redis
    const redis = new Redis({
      url: import.meta.env.UPSTASH_REDIS_REST_URL,
      token: import.meta.env.UPSTASH_REDIS_REST_TOKEN,
    });

    // Generate unique ID
    const shareId = generateShareId();
    const key = `share:${shareId}`;

    // Store in Redis with TTL
    const data = JSON.stringify({
      title: title || 'Untitled',
      content,
      createdAt: Date.now(),
      expiryDays: days,
    });

    await redis.set(key, data, { ex: ttlSeconds });

    return new Response(JSON.stringify({ id: shareId }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('[api/share] Error:', err);
    return new Response(JSON.stringify({ error: 'Failed to create share' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
