/**
 * Theme store using @preact/signals
 * Reactive theme management for components
 */
import { signal } from '@preact/signals';

// Current theme: 'dark' or 'light'
export const currentTheme = signal<'dark' | 'light'>('light');

// TOC panel width - persisted in localStorage
const DEFAULT_TOC_WIDTH = 220;
const MIN_TOC_WIDTH = 150;
const MAX_TOC_WIDTH = 400;

export const tocWidth = signal<number>(
  typeof localStorage !== 'undefined'
    ? parseInt(
        localStorage.getItem('md-preview-toc-width') ||
          String(DEFAULT_TOC_WIDTH),
        10
      )
    : DEFAULT_TOC_WIDTH
);

export { MIN_TOC_WIDTH, MAX_TOC_WIDTH };

/**
 * Initialize theme from DOM and set up observer
 */
export function initTheme(): void {
  // Read initial theme from document
  const isDark = document.documentElement.classList.contains('dark');
  currentTheme.value = isDark ? 'dark' : 'light';

  // Observe class changes on documentElement
  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (mutation.attributeName === 'class') {
        const isDark = document.documentElement.classList.contains('dark');
        currentTheme.value = isDark ? 'dark' : 'light';
      }
    }
  });

  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['class'],
  });
}

/**
 * Toggle theme between dark and light
 */
export function toggleTheme(): void {
  const newTheme = currentTheme.value === 'dark' ? 'light' : 'dark';
  currentTheme.value = newTheme;
  document.documentElement.className = newTheme;
  localStorage.setItem('md-preview-theme', newTheme);
}

/**
 * Set specific theme
 */
export function setTheme(theme: 'dark' | 'light'): void {
  currentTheme.value = theme;
  document.documentElement.className = theme;
  localStorage.setItem('md-preview-theme', theme);
}
