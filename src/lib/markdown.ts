/**
 * Markdown rendering with Shiki syntax highlighting
 * Uses web bundle for smaller size
 * - Cached MarkdownIt instance per theme to avoid memory leaks
 * - TokyoNight theme for VSCode-like colors
 * - TOC extraction with heading IDs
 */
import MarkdownIt from 'markdown-it';
import { createHighlighterCore, type HighlighterCore } from 'shiki/core';
import { createOnigurumaEngine } from 'shiki/engine/oniguruma';

/** Heading data for TOC */
export interface TocHeading {
  id: string;
  text: string;
  level: number;
}

/** Parsed frontmatter data */
export interface FrontmatterData {
  [key: string]: unknown;
}

/** Render result with html and TOC headings */
export interface RenderResult {
  html: string;
  headings: TocHeading[];
  frontmatter?: FrontmatterData;
}

// Lazy-loaded highlighter instance
let highlighterPromise: Promise<HighlighterCore> | null = null;

// Cached MarkdownIt instances per theme (avoids creating new instance every render)
const mdCache = new Map<string, MarkdownIt>();

// Themes: Vitesse Dark for VSCode-like colors
const themesPromise = Promise.all([
  import('shiki/themes/github-light.mjs'),
  import('shiki/themes/github-dark.mjs'),
]);

const langsPromise = Promise.all([
  // Web fundamentals
  import('shiki/langs/typescript.mjs'),
  import('shiki/langs/javascript.mjs'),
  import('shiki/langs/json.mjs'),
  import('shiki/langs/jsonc.mjs'),
  import('shiki/langs/html.mjs'),
  import('shiki/langs/css.mjs'),
  import('shiki/langs/scss.mjs'),
  import('shiki/langs/sass.mjs'),
  import('shiki/langs/less.mjs'),
  import('shiki/langs/stylus.mjs'),
  import('shiki/langs/tsx.mjs'),
  import('shiki/langs/jsx.mjs'),
  // Frameworks
  import('shiki/langs/vue.mjs'),
  import('shiki/langs/svelte.mjs'),
  import('shiki/langs/astro.mjs'),
  import('shiki/langs/mdx.mjs'),
  // Backend languages
  import('shiki/langs/python.mjs'),
  import('shiki/langs/go.mjs'),
  import('shiki/langs/rust.mjs'),
  import('shiki/langs/java.mjs'),
  import('shiki/langs/kotlin.mjs'),
  import('shiki/langs/scala.mjs'),
  import('shiki/langs/groovy.mjs'),
  import('shiki/langs/c.mjs'),
  import('shiki/langs/cpp.mjs'),
  import('shiki/langs/csharp.mjs'),
  import('shiki/langs/fsharp.mjs'),
  import('shiki/langs/php.mjs'),
  import('shiki/langs/ruby.mjs'),
  import('shiki/langs/perl.mjs'),
  import('shiki/langs/swift.mjs'),
  import('shiki/langs/objective-c.mjs'),
  import('shiki/langs/dart.mjs'),
  // Functional languages
  import('shiki/langs/elixir.mjs'),
  import('shiki/langs/erlang.mjs'),
  import('shiki/langs/clojure.mjs'),
  import('shiki/langs/haskell.mjs'),
  import('shiki/langs/ocaml.mjs'),
  import('shiki/langs/lisp.mjs'),
  import('shiki/langs/scheme.mjs'),
  // Systems languages
  import('shiki/langs/zig.mjs'),
  import('shiki/langs/nim.mjs'),
  import('shiki/langs/crystal.mjs'),
  // Data & ML
  import('shiki/langs/r.mjs'),
  import('shiki/langs/julia.mjs'),
  import('shiki/langs/matlab.mjs'),
  import('shiki/langs/sql.mjs'),
  import('shiki/langs/plsql.mjs'),
  // Shell & scripting
  import('shiki/langs/bash.mjs'),
  import('shiki/langs/shellscript.mjs'),
  import('shiki/langs/powershell.mjs'),
  import('shiki/langs/bat.mjs'),
  import('shiki/langs/awk.mjs'),
  import('shiki/langs/lua.mjs'),
  import('shiki/langs/viml.mjs'),
  // DevOps & Infrastructure
  import('shiki/langs/hcl.mjs'), // Terraform
  import('shiki/langs/dockerfile.mjs'),
  import('shiki/langs/nginx.mjs'),
  import('shiki/langs/nix.mjs'),
  import('shiki/langs/bicep.mjs'),
  // Config formats
  import('shiki/langs/yaml.mjs'),
  import('shiki/langs/toml.mjs'),
  import('shiki/langs/ini.mjs'),
  import('shiki/langs/properties.mjs'),
  // Markup & docs
  import('shiki/langs/markdown.mjs'),
  import('shiki/langs/xml.mjs'),
  import('shiki/langs/latex.mjs'),
  import('shiki/langs/rst.mjs'),
  // Build tools
  import('shiki/langs/make.mjs'),
  import('shiki/langs/cmake.mjs'),
  // APIs & protocols
  import('shiki/langs/graphql.mjs'),
  import('shiki/langs/http.mjs'),
  import('shiki/langs/proto.mjs'),
  // Database
  import('shiki/langs/prisma.mjs'),
  import('shiki/langs/sparql.mjs'),
  // Blockchain
  import('shiki/langs/solidity.mjs'),
  // Misc
  import('shiki/langs/diff.mjs'),
  import('shiki/langs/git-commit.mjs'),
  import('shiki/langs/git-rebase.mjs'),
  import('shiki/langs/log.mjs'),
  import('shiki/langs/regex.mjs'),
  import('shiki/langs/mermaid.mjs'),
  import('shiki/langs/wgsl.mjs'),
  import('shiki/langs/glsl.mjs'),
  import('shiki/langs/hlsl.mjs'),
  import('shiki/langs/postcss.mjs'),
  import('shiki/langs/pug.mjs'),
  import('shiki/langs/haml.mjs'),
  import('shiki/langs/handlebars.mjs'),
  import('shiki/langs/jinja.mjs'),
  import('shiki/langs/twig.mjs'),
  import('shiki/langs/liquid.mjs'),
  import('shiki/langs/coffeescript.mjs'),
  import('shiki/langs/wasm.mjs'),
]);

// Language alias mapping (common aliases -> Shiki language names)
const langAliases: Record<string, string> = {
  // Terraform / HCL
  tf: 'hcl',
  terraform: 'hcl',
  terragrunt: 'hcl',
  // Shell
  sh: 'bash',
  shell: 'bash',
  zsh: 'bash',
  // PowerShell
  ps1: 'powershell',
  ps: 'powershell',
  // Common aliases
  yml: 'yaml',
  js: 'javascript',
  ts: 'typescript',
  py: 'python',
  rb: 'ruby',
  rs: 'rust',
  cs: 'csharp',
  fs: 'fsharp',
  'c++': 'cpp',
  'c#': 'csharp',
  'f#': 'fsharp',
  objc: 'objective-c',
  kt: 'kotlin',
  kts: 'kotlin',
  sc: 'scala',
  ex: 'elixir',
  exs: 'elixir',
  erl: 'erlang',
  hs: 'haskell',
  ml: 'ocaml',
  clj: 'clojure',
  jl: 'julia',
  pl: 'perl',
  coffee: 'coffeescript',
  md: 'markdown',
  gql: 'graphql',
  jsonl: 'json',
  json5: 'jsonc',
  // Config
  conf: 'ini',
  cfg: 'ini',
  env: 'ini',
  // Build
  makefile: 'make',
  Makefile: 'make',
  // Docker
  Dockerfile: 'dockerfile',
  // Misc
  sol: 'solidity',
  tex: 'latex',
  proto3: 'proto',
  protobuf: 'proto',
  vim: 'viml',
  'docker-compose': 'yaml',
  k8s: 'yaml',
  kubernetes: 'yaml',
};

/**
 * Get or create Shiki highlighter (lazy loaded)
 */
async function getHighlighter(): Promise<HighlighterCore> {
  if (!highlighterPromise) {
    highlighterPromise = (async () => {
      const [themes, langs] = await Promise.all([themesPromise, langsPromise]);

      return createHighlighterCore({
        themes: themes.map((t) => t.default),
        langs: langs.map((l) => l.default),
        engine: createOnigurumaEngine(import('shiki/wasm')),
      });
    })();
  }
  return highlighterPromise;
}

/** Environment passed to MarkdownIt renderer */
interface MdEnv {
  currentFilePath?: string;
}

/**
 * Get or create cached MarkdownIt instance for theme
 * Custom link renderer resolves relative .md links using env.currentFilePath
 */
function getMarkdownIt(
  theme: 'dark' | 'light',
  hl: HighlighterCore
): MarkdownIt {
  const cacheKey = theme;

  if (mdCache.has(cacheKey)) {
    return mdCache.get(cacheKey)!;
  }

  const md = new MarkdownIt({
    html: true,
    linkify: true,
    typographer: true,
  });

  // Custom link renderer for internal .md links
  const defaultLinkRender =
    md.renderer.rules.link_open ||
    ((tokens, idx, options, _env, self) => self.renderToken(tokens, idx, options));

  md.renderer.rules.link_open = (tokens, idx, options, env: MdEnv, self) => {
    const token = tokens[idx];
    const hrefIndex = token.attrIndex('href');

    if (hrefIndex >= 0) {
      const href = token.attrs![hrefIndex][1];

      // Check if internal .md link and we have currentFilePath
      if (isInternalMdLink(href) && env.currentFilePath) {
        const resolvedPath = resolvePath(env.currentFilePath, href);
        token.attrs![hrefIndex][1] = resolvedPath;
        // Add data attribute for click handler
        token.attrPush(['data-internal-link', 'true']);
      }
    }

    return defaultLinkRender(tokens, idx, options, env, self);
  };

  const shikiTheme = theme === 'dark' ? 'github-dark' : 'github-light';

  // Custom code block renderer with Shiki
  md.options.highlight = (code: string, lang: string): string => {
    // Resolve language alias
    const rawLang = lang || 'text';
    const language = langAliases[rawLang.toLowerCase()] || rawLang;

    // Special handling for mermaid diagrams - render client-side
    if (language === 'mermaid') {
      return `<div class="mermaid-container" data-mermaid="${escapeAttr(code)}">
        <div class="mermaid-diagram"></div>
        <div class="mermaid-fallback code-block-wrapper" style="display:none">
          <pre class="shiki shiki-plain" data-theme="${shikiTheme}"><code>${escapeHtml(code)}</code></pre>
        </div>
      </div>`;
    }

    try {
      // Check if language is loaded
      const loadedLangs = hl.getLoadedLanguages();
      const isSupported = loadedLangs.includes(language as any);

      let codeHtml: string;
      if (isSupported) {
        codeHtml = hl.codeToHtml(code, {
          lang: language,
          theme: shikiTheme,
        });
      } else {
        // Fallback for unsupported languages
        codeHtml = `<pre class="shiki shiki-plain" data-theme="${shikiTheme}"><code>${escapeHtml(
          code
        )}</code></pre>`;
      }

      // GitHub-style: full width wrapper with copy button at end
      return `<div class="code-block-wrapper">
        ${codeHtml}
        <button class="copy-btn" data-code="${escapeAttr(
          code
        )}" title="Copy code">
          <svg class="copy-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>
        </button>
      </div>`;
    } catch {
      return `<div class="code-block-wrapper">
        <pre class="shiki shiki-plain" data-theme="${shikiTheme}"><code>${escapeHtml(
        code
      )}</code></pre>
        <button class="copy-btn" data-code="${escapeAttr(
          code
        )}" title="Copy code">
          <svg class="copy-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>
        </button>
      </div>`;
    }
  };

  mdCache.set(cacheKey, md);
  return md;
}

/**
 * Render markdown to HTML with syntax highlighting and TOC extraction
 * @param content - Markdown content to render
 * @param theme - Theme for syntax highlighting
 * @param currentFilePath - Current file path for resolving relative links (e.g. "credit/plans/plan.md")
 */
export async function renderMarkdown(
  content: string,
  theme: 'dark' | 'light' = 'light',
  currentFilePath?: string
): Promise<RenderResult> {
  const hl = await getHighlighter();
  const md = getMarkdownIt(theme, hl);

  // Strip YAML frontmatter
  const { content: markdownContent, frontmatter } = parseFrontmatter(content);

  // Environment for renderer (used by link resolver)
  const env: MdEnv = { currentFilePath };

  // Parse tokens to extract headings
  const tokens = md.parse(markdownContent, env);
  const headings: TocHeading[] = [];
  const usedIds = new Set<string>();

  // Extract headings from tokens and inject IDs
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    if (token.type === 'heading_open') {
      const level = parseInt(token.tag.slice(1), 10);
      // Next token is the inline content
      const contentToken = tokens[i + 1];
      const text = contentToken?.content || '';
      const id = slugify(text, usedIds);

      // Add id attribute to heading
      token.attrSet('id', id);

      headings.push({ id, text, level });
    }
  }

  // Render with injected IDs and env for link resolution
  const html = md.renderer.render(tokens, md.options, env);

  return { html, headings, frontmatter };
}

/**
 * Preload highlighter (call on app init for better UX)
 */
export function preloadHighlighter(): void {
  getHighlighter().catch(console.error);
}

// ============ Helpers ============

/**
 * Parse and strip YAML frontmatter from markdown content
 * Frontmatter is delimited by --- at the start of the file
 */
function parseFrontmatter(content: string): {
  content: string;
  frontmatter?: FrontmatterData;
} {
  // Check if content starts with ---
  if (!content.startsWith('---')) {
    return { content };
  }

  // Find the closing ---
  const endMatch = content.indexOf('\n---', 3);
  if (endMatch === -1) {
    return { content };
  }

  // Extract frontmatter YAML (between the --- delimiters)
  const frontmatterStr = content.slice(4, endMatch).trim();

  // Parse simple YAML (key: value pairs)
  const frontmatter: FrontmatterData = {};
  for (const line of frontmatterStr.split('\n')) {
    const colonIdx = line.indexOf(':');
    if (colonIdx > 0) {
      const key = line.slice(0, colonIdx).trim();
      let value: unknown = line.slice(colonIdx + 1).trim();

      // Parse arrays [a, b, c]
      if (typeof value === 'string' && value.startsWith('[') && value.endsWith(']')) {
        value = value
          .slice(1, -1)
          .split(',')
          .map((s) => s.trim());
      }
      // Remove quotes
      else if (
        typeof value === 'string' &&
        ((value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'")))
      ) {
        value = value.slice(1, -1);
      }

      frontmatter[key] = value;
    }
  }

  // Return content without frontmatter (skip the closing --- and newline)
  const strippedContent = content.slice(endMatch + 4).replace(/^\n+/, '');

  return { content: strippedContent, frontmatter };
}

/**
 * Convert text to URL-friendly slug for heading IDs
 * Handles duplicates by appending counter
 * Preserves Unicode letters (Vietnamese, Japanese, etc.)
 */
function slugify(text: string, usedIds: Set<string>): string {
  let slug = text
    .toLowerCase()
    .trim()
    // Keep Unicode letters (\p{L}), numbers (\p{N}), spaces, and hyphens
    .replace(/[^\p{L}\p{N}\s-]/gu, '')
    .replace(/\s+/g, '-') // Spaces to hyphens
    .replace(/-+/g, '-') // Collapse multiple hyphens
    .replace(/^-|-$/g, ''); // Trim hyphens

  // Handle empty slugs
  if (!slug) slug = 'heading';

  // Handle duplicates
  const baseSlug = slug;
  let counter = 1;
  while (usedIds.has(slug)) {
    slug = `${baseSlug}-${counter++}`;
  }
  usedIds.add(slug);

  return slug;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function escapeAttr(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\n/g, '&#10;');
}

/**
 * Resolve relative path to absolute path based on current file location
 * Handles ./ and ../ prefixes
 */
function resolvePath(currentFilePath: string, href: string): string {
  // Skip absolute URLs and anchors
  if (
    href.startsWith('/') ||
    href.startsWith('http://') ||
    href.startsWith('https://') ||
    href.startsWith('#')
  ) {
    return href;
  }

  // Get directory of current file
  const parts = currentFilePath.split('/');
  parts.pop(); // Remove filename
  let currentDir = parts;

  // Split href into segments
  const hrefParts = href.split('/');

  for (const segment of hrefParts) {
    if (segment === '.' || segment === '') {
      // Current directory, skip
      continue;
    } else if (segment === '..') {
      // Parent directory
      if (currentDir.length > 0) {
        currentDir.pop();
      }
    } else {
      // Regular path segment
      currentDir.push(segment);
    }
  }

  return '/' + currentDir.join('/');
}

/**
 * Check if href is internal markdown link
 */
function isInternalMdLink(href: string): boolean {
  if (
    href.startsWith('http://') ||
    href.startsWith('https://') ||
    href.startsWith('#')
  ) {
    return false;
  }
  return href.endsWith('.md');
}
