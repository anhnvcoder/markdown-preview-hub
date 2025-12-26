/**
 * Markdown rendering with Shiki syntax highlighting
 * Uses web bundle for smaller size
 * - Cached MarkdownIt instance per theme to avoid memory leaks
 * - TokyoNight theme for VSCode-like colors
 */
import MarkdownIt from 'markdown-it';
import { createHighlighterCore, type HighlighterCore } from 'shiki/core';
import { createOnigurumaEngine } from 'shiki/engine/oniguruma';

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

/**
 * Get or create cached MarkdownIt instance for theme
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

  const shikiTheme = theme === 'dark' ? 'github-dark' : 'github-light';

  // Custom code block renderer with Shiki
  md.options.highlight = (code: string, lang: string): string => {
    // Resolve language alias
    const rawLang = lang || 'text';
    const language = langAliases[rawLang.toLowerCase()] || rawLang;

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
 * Render markdown to HTML with syntax highlighting
 */
export async function renderMarkdown(
  content: string,
  theme: 'dark' | 'light' = 'light'
): Promise<string> {
  const hl = await getHighlighter();
  const md = getMarkdownIt(theme, hl);
  return md.render(content);
}

/**
 * Preload highlighter (call on app init for better UX)
 */
export function preloadHighlighter(): void {
  getHighlighter().catch(console.error);
}

// ============ Helpers ============

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
