# Share Feature Documentation

This document describes the Share feature for MD Preview Hub, which allows users to create temporary public links to share markdown documents with others.

## Overview

The Share feature enables users to:
- Create a shareable link for the currently open markdown file
- Share read-only previews that expire after configurable days (1-30)
- Generate links that work for anyone (no authentication required)

**Key Characteristics:**
- **Snapshot-based**: The share captures the content at the moment of sharing (not synced in real-time)
- **Configurable expiry**: Links expire after 1-30 days (default 7 days, configurable in Settings)
- **Read-only**: Viewers can only read, not edit the shared content
- **Text-only**: Local images (blob URLs) will not be visible to viewers

## Architecture

```
┌─────────────────┐        ┌──────────────────┐        ┌─────────────────┐
│   Browser       │        │   Vercel SSR     │        │  Upstash Redis  │
│   (Client)      │        │   (Serverless)   │        │  (Cloud DB)     │
└────────┬────────┘        └────────┬─────────┘        └────────┬────────┘
         │                          │                           │
         │ POST /api/share          │                           │
         │ {title, content,         │                           │
         │  expiryDays}             │                           │
         ├─────────────────────────►│                           │
         │                          │ SET share:{id} TTL:Xd     │
         │                          ├──────────────────────────►│
         │                          │                           │
         │                          │◄──────────────────────────┤
         │◄─────────────────────────┤ {id: "abc123"}            │
         │ Return shareId           │                           │
         │                          │                           │
═════════╪══════════════════════════╪═══════════════════════════╪═════════
         │                          │                           │
         │ GET /share/{id}          │                           │
         │ (Viewer opens link)      │                           │
         ├─────────────────────────►│                           │
         │                          │ GET share:{id}            │
         │                          ├──────────────────────────►│
         │                          │                           │
         │                          │◄──────────────────────────┤
         │◄─────────────────────────┤ SSR Rendered HTML         │
         │                          │                           │
         └──────────────────────────┴───────────────────────────┘
```

## Technology Stack

| Component | Technology | Purpose |
|-----------|------------|---------|
| Storage | [Upstash Redis](https://upstash.com) | Serverless Redis with REST API |
| Backend | [Astro SSR](https://astro.build) | Server-side rendering for share pages |
| Hosting | [Vercel](https://vercel.com) | Serverless functions + edge deployment |
| ID Generation | Custom alphanumeric | 8-character unique identifiers |

## File Structure

```
app/src/
├── lib/
│   └── share.ts              # Share service (blob detection, API client)
├── pages/
│   ├── api/
│   │   └── share.ts          # POST endpoint for creating shares
│   └── share/
│       └── [id].astro        # SSR page for viewing shares
└── components/
    ├── ShareButton.tsx       # Share button + modal component
    └── ShareView.tsx         # Read-only preview for shared content
```

## Setup Instructions

### 1. Create Upstash Redis Database

1. Go to [Upstash Console](https://console.upstash.com)
2. Click "Create Database"
3. Select region closest to your Vercel deployment (e.g., `us-east-1`)
4. Copy the **REST URL** and **REST Token**

### 2. Configure Environment Variables

#### For Vercel Deployment

In your Vercel project dashboard:
1. Go to **Settings** → **Environment Variables**
2. Add the following variables:

| Variable | Value | Description |
|----------|-------|-------------|
| `UPSTASH_REDIS_REST_URL` | `https://xxx-xxx.upstash.io` | Your Upstash REST endpoint |
| `UPSTASH_REDIS_REST_TOKEN` | `AXxx...` | Your Upstash REST token |

#### For Local Development

Create a `.env` file in the `app/` directory:

```env
UPSTASH_REDIS_REST_URL=https://xxx-xxx.upstash.io
UPSTASH_REDIS_REST_TOKEN=AXxx...
```

> **Important**: Never commit `.env` files to version control.

### 3. Verify Astro Configuration

Ensure your `astro.config.mjs` includes the Vercel adapter:

```javascript
import vercel from '@astrojs/vercel';

export default defineConfig({
  adapter: vercel(),
  output: 'static',
  // ... other config
});
```

## User Settings

Users can configure share link expiry in **Settings > Share Link Expiry**:

| Option | TTL |
|--------|-----|
| 1 day | 24 hours |
| 3 days | 72 hours |
| 7 days (default) | 168 hours |
| 14 days | 336 hours |
| 30 days | 720 hours |

Settings are stored per-browser in IndexedDB.

## Running Locally

### Prerequisites

- Node.js 18+
- pnpm (recommended)
- Upstash Redis account (even for local testing)

### Steps

1. Install dependencies:
   ```bash
   cd app
   pnpm install
   ```

2. Create `.env` file with Upstash credentials (see above)

3. Start development server:
   ```bash
   pnpm dev
   ```

4. Open http://localhost:4321

5. Test the share feature:
   - Open a markdown file
   - Click the Share button (next to Preview/Edit buttons)
   - Create a share link
   - Open the link in a new tab/browser

### Testing Without Upstash

If you run the app without Upstash credentials, the Share feature will show:
> "Share feature not configured"

This is expected behavior. The rest of the app works normally.

## API Reference

### POST /api/share

Create a new share.

**Request:**
```json
{
  "title": "Document Title",
  "content": "# Markdown content here...",
  "expiryDays": 7
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `title` | string | No | Document title (default: "Untitled") |
| `content` | string | Yes | Markdown content |
| `expiryDays` | number | No | Days until expiry (1-30, default: 7) |

**Response (201 Created):**
```json
{
  "id": "abc12xyz"
}
```

**Error Responses:**
- `400`: Content is required
- `413`: Content too large (max 500KB)
- `500`: Failed to create share
- `503`: Share feature not configured

### GET /share/[id]

View a shared document (SSR rendered page).

**Parameters:**
- `id`: Share ID (e.g., `abc12xyz`)

**Response:**
- `200`: HTML page with rendered markdown
- `404`: Share not found or expired

## Data Model

### Redis Key Structure

```
Key Pattern: share:{id}
Value: JSON string
TTL: configurable (1-30 days)
```

**Value Schema:**
```json
{
  "title": "string",
  "content": "string",
  "createdAt": 1706000000000,
  "expiryDays": 7
}
```

### Example

```
Key:   share:abc12xyz
Value: {"title":"README.md","content":"# Hello World","createdAt":1706000000000,"expiryDays":7}
TTL:   604800
```

## Features

### Blob URL Detection

The share service detects local blob URLs and data URLs in markdown content:

```typescript
import { hasLocalImages } from '../lib/share';

if (hasLocalImages(content)) {
  // Show warning: local images won't be visible
}
```

This warns users that:
- `blob:` URLs (from drag-and-drop images)
- Large `data:image` URLs (embedded images > 1KB)

...will not be visible to others viewing the shared link.

### Share View Features

The shared document view (`/share/[id]`) includes:

- **Read-only preview** of markdown content
- **Theme toggle** (light/dark mode)
- **Table of Contents** toggle
- **Copy link** button
- **Creation date** display
- **Expiry notice** in footer (shows actual configured expiry)
- **Link back** to MD Preview Hub

## Limitations

| Limitation | Description |
|------------|-------------|
| **Local images** | Images stored locally (blob: URLs) will not display in shared links |
| **No editing** | Shared documents are read-only |
| **Configurable expiry** | Links automatically expire and content is deleted (1-30 days) |
| **500KB max** | Maximum content size per share |
| **No password** | All shares are public (anyone with link can view) |
| **No analytics** | View counts are not tracked |

## Security Considerations

1. **ID Collision**: With 8 alphanumeric characters, there are 36^8 ≈ 2.8 trillion possible IDs. Collision is extremely unlikely.

2. **Content Validation**: The API validates:
   - Content is required
   - Content size ≤ 500KB
   - Valid JSON request body
   - expiryDays range (1-30)

3. **No User Data**: No user authentication or personal data is stored. Shares are anonymous.

4. **Auto-Expiry**: TTL ensures old data is automatically cleaned up.

## Cost Estimation (Upstash Free Tier)

| Metric | Free Tier Limit | Typical Usage |
|--------|-----------------|---------------|
| Commands/day | 10,000 | ~100 shares = 200 commands |
| Storage | 256MB | ~2,500 shares @ 100KB avg |
| Bandwidth | Unlimited | N/A |

For most small-to-medium projects, the free tier is sufficient.

## Troubleshooting

### "Share feature not configured"

**Cause**: Missing environment variables.

**Solution**: Verify `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` are set.

### "Content too large"

**Cause**: Document exceeds 500KB limit.

**Solution**: Reduce content size or split into multiple documents.

### Share link shows 404

**Causes:**
1. Link has expired
2. Invalid share ID
3. Database was cleared

**Solution**: Create a new share link.

### Local images not displaying

**Cause**: Local images use `blob:` URLs which are browser-session-specific.

**Solution**: Replace local images with online image URLs (e.g., upload to Imgur, GitHub, Cloudinary).
